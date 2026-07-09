/**
 * HTTP utilities for CKAN API requests
 */

import axios, { AxiosError } from "axios";
import { getPortalApiUrlForHostname, getPortalApiPath } from "./portal-config.js";
import {
  buildCacheKey,
  getCache,
  getCacheConfig,
  getTtlForAction
} from "./cache.js";
import {
  getRateLimiter,
  getRateLimitConfig
} from "./rate-limiter.js";

export interface MakeCkanRequestOptions {
  cache?: boolean;
  rateLimit?: boolean;
}

export class CkanApiError extends Error {
  readonly status: number | undefined;
  readonly action: string;
  constructor(message: string, status: number | undefined, action: string) {
    super(message);
    this.name = 'CkanApiError';
    this.status = status;
    this.action = action;
  }
}

export function formatCkanError(error: unknown, _toolName: string): string {
  if (!(error instanceof CkanApiError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const { status, action, message } = error;
  let hint = '';
  if (status === 404) {
    if (action.startsWith('datastore_search')) {
      hint = '→ Get a valid resource_id first: call `ckan_package_show` on a dataset, then pick a resource where `datastore_active` is true.';
    } else if (action === 'package_show') {
      hint = '→ Use `ckan_package_search` to find a valid dataset name or ID.';
    } else if (action === 'organization_show') {
      hint = '→ Use `ckan_organization_list` or `ckan_organization_search` to discover valid organization names.';
    }
  } else if (status === 400) {
    if (action === 'datastore_search_sql') {
      hint = '→ Invalid SQL syntax or unknown column — check column names with `ckan_datastore_search` before writing SQL.';
    } else if (action.startsWith('datastore_search')) {
      hint = '→ Bad request — likely an invalid field name or filter syntax; check column names with a `SELECT *` query first.';
    }
  } else if (status === 409 || status === 422) {
    hint = '→ Portal rejected the request — parameters may conflict; simplify filters and retry.';
  } else if (status === 503 || status === 502 || status === 504) {
    hint = '→ Portal temporarily unavailable — retry in a few seconds.';
  } else if (status === 500) {
    hint = '→ Portal internal error — try a different portal or retry later.';
  } else if (status === undefined) {
    hint = '→ The portal may not support this action, or the endpoint is unavailable.';
  }
  return hint ? `${message}\n${hint}` : message;
}

let _lastCacheHit: boolean | null = null;

/** Returns whether the last makeCkanRequest call was served from cache. */
export function getLastCacheHit(): boolean | null {
  return _lastCacheHit;
}

// Response/decompression size caps (DoS prevention — GHSA-q5gv). Generous enough for
// any legitimate CKAN JSON, small enough to stop a decompression bomb from OOM-ing us.
const MAX_RESPONSE_BYTES =
  (typeof process !== "undefined" && Number(process.env?.CKAN_MAX_RESPONSE_BYTES)) || 32 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES =
  (typeof process !== "undefined" && Number(process.env?.CKAN_MAX_DECOMPRESSED_BYTES)) || 64 * 1024 * 1024;

type ZlibOptions = { maxOutputLength?: number };
type ZlibModule = {
  brotliDecompressSync: (input: Buffer, options?: ZlibOptions) => Buffer;
  gunzipSync: (input: Buffer, options?: ZlibOptions) => Buffer;
  inflateSync: (input: Buffer, options?: ZlibOptions) => Buffer;
};

const loadZlib = (() => {
  let cached: Promise<ZlibModule | null> | null = null;
  return async (): Promise<ZlibModule | null> => {
    if (!cached) {
      cached = (async () => {
        try {
          const mod = (await import("node:" + "zlib")) as ZlibModule;
          return mod;
        } catch {
          return null;
        }
      })();
    }
    return cached;
  };
})();

function getHeaderValue(
  headers: Record<string, unknown> | undefined,
  name: string
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value.join(",") : String(value);
    }
  }
  return undefined;
}

function asBuffer(data: unknown): Buffer | undefined {
  if (!data) {
    return undefined;
  }
  if (typeof Buffer === "undefined") {
    return undefined;
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return undefined;
}

function asArrayBuffer(data: unknown): ArrayBuffer | undefined {
  if (!data) {
    return undefined;
  }
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return undefined;
}

async function decodeArrayBufferText(
  buffer: ArrayBuffer,
  encoding?: string
): Promise<string> {
  if (encoding && typeof DecompressionStream !== "undefined") {
    try {
      const stream = new DecompressionStream(
        encoding.includes("br")
          ? "br"
          : encoding.includes("deflate")
          ? "deflate"
          : "gzip"
      );
      const decompressed = await new Response(
        new Blob([buffer]).stream().pipeThrough(stream)
      ).arrayBuffer();
      if (decompressed.byteLength > MAX_DECOMPRESSED_BYTES) {
        throw new Error("Decompressed response exceeds size limit");
      }
      return new TextDecoder("utf-8").decode(decompressed).trim();
    } catch {
      // Fall back to plain text decoding.
    }
  }
  return new TextDecoder("utf-8").decode(buffer).trim();
}

async function decodePossiblyCompressed(
  data: unknown,
  headers?: Record<string, unknown>
): Promise<unknown> {
  if (data === null || data === undefined) {
    return data;
  }

  const arrayBuffer = asArrayBuffer(data);
  if (arrayBuffer && typeof Buffer === "undefined") {
    const encoding = getHeaderValue(headers, "content-encoding");
    const text = await decodeArrayBufferText(arrayBuffer, encoding);
    if (!text) {
      return text;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  const buffer = asBuffer(data);
  if (!buffer) {
    if (typeof data === "object") {
      return data;
    }
    return data;
  }

  const encoding = getHeaderValue(headers, "content-encoding");
  let decodedBuffer = buffer;
  const zlib = await loadZlib();

  const zlibOpts: ZlibOptions = { maxOutputLength: MAX_DECOMPRESSED_BYTES };
  try {
    if (zlib) {
      if (encoding?.includes("gzip")) {
        decodedBuffer = zlib.gunzipSync(buffer, zlibOpts);
      } else if (encoding?.includes("br")) {
        decodedBuffer = zlib.brotliDecompressSync(buffer, zlibOpts);
      } else if (encoding?.includes("deflate")) {
        decodedBuffer = zlib.inflateSync(buffer, zlibOpts);
      } else if (
        buffer.length >= 2 &&
        buffer[0] === 0x1f &&
        buffer[1] === 0x8b
      ) {
        decodedBuffer = zlib.gunzipSync(buffer, zlibOpts);
      }
    }
  } catch {
    // Decompression failed or exceeded maxOutputLength: fall back to the raw buffer
    // (kept bounded below by MAX_RESPONSE_BYTES on the request paths).
    decodedBuffer = buffer;
  }

  const text = decodedBuffer.toString("utf-8").trim();
  if (!text) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Returns true if an IP address (IPv4 or IPv6 string) is in a private/internal/special range.
 * Shared by the synchronous literal guard (`validateServerUrl`) and the DNS-resolution
 * guard (`createSsrfSafeLookup` / `assertHostnameResolvesSafe`), so a hostname that
 * *resolves* to an internal address is blocked, not just an internal IP literal.
 */
export function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase().trim();

  // IPv6 (any address containing a colon)
  if (v.includes(':')) {
    if (v === '::1' || v === '::') return true;     // loopback / unspecified
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // fc00::/7 unique local
    if (v.startsWith('fe80')) return true;          // fe80::/10 link-local
    if (v.startsWith('::ffff:')) return true;       // IPv4-mapped IPv6
    return false;
  }

  // IPv4 dotted-decimal
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const o1 = Number(m[1]);
  const o2 = Number(m[2]);
  return (
    o1 === 0 ||                              // 0.0.0.0/8
    o1 === 10 ||                             // 10.0.0.0/8 private
    o1 === 127 ||                            // 127.0.0.0/8 loopback
    (o1 === 100 && o2 >= 64 && o2 <= 127) || // 100.64.0.0/10 shared
    (o1 === 169 && o2 === 254) ||            // 169.254.0.0/16 link-local / cloud metadata
    (o1 === 172 && o2 >= 16 && o2 <= 31) ||  // 172.16.0.0/12 private
    (o1 === 192 && o2 === 168) ||            // 192.168.0.0/16 private
    o1 === 255                               // broadcast
  );
}

/**
 * Validate that a server URL is safe to request (SSRF prevention).
 * Blocks non-HTTP/S protocols and private/internal IP *literals*.
 * Hostnames that resolve to internal IPs are blocked later, at connection time,
 * by the DNS-resolution guards (see `createSsrfSafeLookup` / `assertHostnameResolvesSafe`).
 */
export function validateServerUrl(serverUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(`Invalid URL: ${serverUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Disallowed protocol "${parsed.protocol}". Only http and https are allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'ip6-localhost',
    'ip6-loopback',
  ]);
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Access to "${hostname}" is not allowed.`);
  }

  // Block IPv4 private/special literals. WHATWG URL already normalizes integer/hex/
  // octal/short IPv4 forms (e.g. 0x7f000001 → 127.0.0.1) to dotted-decimal here, so a
  // single dotted-quad check covers all those encodings (GHSA-8hxx).
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isBlockedIp(hostname)) {
    throw new Error(`Access to private/internal IP addresses is not allowed.`);
  }

  // Block IPv6 private/loopback literals (URL hostname keeps the brackets)
  if (hostname.startsWith('[') && isBlockedIp(hostname.slice(1, -1))) {
    throw new Error(`Access to private/internal IPv6 addresses is not allowed.`);
  }

  // Optional domain allowlist: CKAN_ALLOWED_DOMAINS=domain1.com,domain2.org
  const rawAllowed = typeof process !== 'undefined' ? (process.env.CKAN_ALLOWED_DOMAINS ?? '') : '';
  const allowedDomains = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
  if (allowedDomains.length > 0 && !allowedDomains.includes(hostname)) {
    throw new Error(`Domain "${hostname}" is not in the allowed list (CKAN_ALLOWED_DOMAINS).`);
  }
}

/**
 * Refuse to run the network-exposed HTTP transport without a domain allowlist.
 * `CKAN_ALLOWED_DOMAINS` (default-deny) is mandatory for HTTP; set
 * `CKAN_HTTP_ALLOW_ALL=true` to explicitly opt out (logs a warning).
 * stdio is unaffected — it stays open so any portal can be queried locally.
 */
export function assertHttpAllowlistConfigured(): void {
  const raw = typeof process !== 'undefined' ? (process.env.CKAN_ALLOWED_DOMAINS ?? '') : '';
  const domains = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (domains.length > 0) return;

  if (typeof process !== 'undefined' && process.env.CKAN_HTTP_ALLOW_ALL === 'true') {
    console.error(
      '[SECURITY WARNING] HTTP transport is running WITHOUT a domain allowlist ' +
      '(CKAN_HTTP_ALLOW_ALL=true). Any client can drive requests to arbitrary hosts. ' +
      'Set CKAN_ALLOWED_DOMAINS to restrict which CKAN hosts can be queried.'
    );
    return;
  }

  throw new Error(
    'Refusing to start HTTP transport without a domain allowlist.\n' +
    'Set CKAN_ALLOWED_DOMAINS="portal1.org,portal2.gov" to restrict which hosts can be queried,\n' +
    'or set CKAN_HTTP_ALLOW_ALL=true to explicitly run without restriction (NOT recommended when network-exposed).'
  );
}

type ResolvedAddress = { address: string; family?: number };
type DnsLookupModule = {
  lookup: (
    hostname: string,
    options: { all: true; family?: number },
    callback: (err: NodeJS.ErrnoException | null, addresses: ResolvedAddress[]) => void
  ) => void;
};

/**
 * Build a Node `lookup` function (for http/https Agents) that resolves the hostname,
 * rejects if ANY resolved address is private/internal, and pins the connection to the
 * validated address — closing the DNS-name SSRF bypass and DNS-rebinding (the IP the
 * socket connects to is exactly the one we validated, no second resolution).
 * Exported with an injectable dns module so it can be unit-tested without real DNS.
 */
export function createSsrfSafeLookup(dnsModule: DnsLookupModule) {
  return function ssrfSafeLookup(hostname: string, options: any, callback: any): void {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const family = options && typeof options === 'object' ? options.family : undefined;
    dnsModule.lookup(hostname, { all: true, family: family || 0 }, (err, addresses) => {
      if (err) {
        callback(err);
        return;
      }
      const list = Array.isArray(addresses) ? addresses : [addresses as ResolvedAddress];
      for (const a of list) {
        if (isBlockedIp(a.address)) {
          callback(new Error(
            `Access to private/internal IP addresses is not allowed ` +
            `("${hostname}" resolves to ${a.address}).`
          ));
          return;
        }
      }
      if (options && options.all) {
        callback(null, list);
        return;
      }
      callback(null, list[0].address, list[0].family);
    });
  };
}

let _safeAgents: Promise<{ httpAgent: unknown; httpsAgent: unknown } | null> | null = null;

/** Lazily build SSRF-safe http/https Agents (Node only). Returns null off Node/on failure. */
function getSafeAgents(): Promise<{ httpAgent: unknown; httpsAgent: unknown } | null> {
  if (!_safeAgents) {
    _safeAgents = (async () => {
      try {
        // String-concatenated specifiers keep esbuild from bundling node builtins
        // into the Cloudflare Workers build (mirrors loadZlib above).
        const dnsMod = (await import("node:" + "dns")) as unknown as DnsLookupModule;
        const httpMod = (await import("node:" + "http")) as any;
        const httpsMod = (await import("node:" + "https")) as any;
        const lookup = createSsrfSafeLookup(dnsMod);
        return {
          httpAgent: new httpMod.Agent({ lookup }),
          httpsAgent: new httpsMod.Agent({ lookup }),
        };
      } catch {
        return null;
      }
    })();
  }
  return _safeAgents;
}

type DnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;
let _dnsResolver: DnsResolver | null = null;

/** Test seam: override the DNS resolver used by `assertHostnameResolvesSafe`. */
export function __setDnsResolverForTests(fn: DnsResolver | null): void {
  _dnsResolver = fn;
}

/**
 * Resolve a hostname and throw if it maps to a private/internal IP.
 * Used by the fetch-based paths (e.g. sparql_query) that cannot attach a custom
 * lookup agent. No-op when DNS is unavailable (Cloudflare Workers — CF sandbox
 * already blocks internal addresses) or when resolution fails (request fails naturally).
 */
export async function assertHostnameResolvesSafe(hostname: string): Promise<void> {
  let lookup: DnsResolver;
  if (_dnsResolver) {
    lookup = _dnsResolver;
  } else {
    let dnsMod: any;
    try {
      dnsMod = await import("node:" + "dns");
    } catch {
      // DNS module unavailable (Cloudflare Workers): the CF sandbox already blocks
      // internal egress, so this guard is a no-op there.
      return;
    }
    lookup = (h: string) => dnsMod.promises.lookup(h, { all: true });
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await lookup(hostname);
  } catch {
    // Fail closed: if we cannot resolve the name, do NOT let the request proceed to a
    // socket that would resolve it independently (TOCTOU / SSRF bypass).
    throw new Error(`Cannot resolve "${hostname}" for SSRF validation (failing closed).`);
  }

  for (const a of addresses) {
    if (isBlockedIp(a.address)) {
      throw new Error(
        `Access to private/internal IP addresses is not allowed ` +
        `("${hostname}" resolves to ${a.address}).`
      );
    }
  }
}

/**
 * Fetch that does NOT blindly follow redirects: each hop's target is re-validated
 * with `validateServerUrl` + `assertHostnameResolvesSafe` before it is followed,
 * closing redirect-based SSRF (e.g. a public endpoint 302-ing to 169.254.169.254).
 * The caller is expected to have validated the initial URL already.
 * On Workers, `assertHostnameResolvesSafe` is a no-op (the CF sandbox blocks internal egress).
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  opts: { maxHops?: number; httpsOnly?: boolean } = {}
): Promise<Response> {
  const maxHops = opts.maxHops ?? 3;
  let current = url;
  for (let hop = 0; ; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    const status = response.status;
    const location = response.headers.get("location");
    const isRedirect =
      (status === 301 || status === 302 || status === 303 ||
       status === 307 || status === 308) && !!location;
    if (!isRedirect) {
      return response;
    }
    if (hop >= maxHops) {
      throw new Error(`Too many redirects (>${maxHops})`);
    }
    const next = new URL(location as string, current).toString();
    if (opts.httpsOnly && new URL(next).protocol !== "https:") {
      throw new Error("Redirect to a non-HTTPS URL is not allowed");
    }
    validateServerUrl(next);
    await assertHostnameResolvesSafe(new URL(next).hostname);
    current = next;
  }
}

function auditLog(serverUrl: string, action: string, params: Record<string, any>, cacheHit: boolean): void {
  if (typeof process === 'undefined' || !(process as { versions?: { node?: string } }).versions?.node) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    server: serverUrl,
    action,
    cache_hit: cacheHit
  };
  if (params.q !== undefined)    entry.q    = params.q;
  if (params.fq !== undefined)   entry.fq   = params.fq;
  if (params.sql !== undefined)  entry.sql  = String(params.sql).slice(0, 200);
  if (params.id !== undefined)   entry.id   = params.id;
  if (params.rows !== undefined) entry.rows = params.rows;
  if (params.limit !== undefined) entry.limit = params.limit;
  try { process.stderr.write(JSON.stringify(entry) + '\n'); } catch { /* ignore */ }
}

/**
 * Make HTTP request to CKAN API
 */
export async function makeCkanRequest<T>(
  serverUrl: string,
  action: string,
  params: Record<string, any> = {},
  opts: MakeCkanRequestOptions = {}
): Promise<T> {
  const isNode =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;

  validateServerUrl(serverUrl);

  let resolvedServerUrl = serverUrl;
  try {
    const hostname = new URL(serverUrl).hostname;
    const portalApiUrl = getPortalApiUrlForHostname(hostname);
    if (portalApiUrl) {
      resolvedServerUrl = portalApiUrl;
    }
  } catch {
    // Keep provided URL if parsing fails
  }

  // Normalize server URL
  const baseUrl = resolvedServerUrl.replace(/\/$/, '');
  const apiPath = getPortalApiPath(resolvedServerUrl);
  const url = `${baseUrl}${apiPath}/${action}`;

  const cacheConfig = getCacheConfig();
  const cacheEnabled = cacheConfig.enabled && opts.cache !== false;
  const ttl = getTtlForAction(action, cacheConfig.ttlDefault);
  const cache = cacheEnabled && ttl > 0 ? getCache() : null;
  const cacheKey = cache
    ? await buildCacheKey(resolvedServerUrl, action, params)
    : "";

  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached !== undefined) {
      _lastCacheHit = true;
      auditLog(serverUrl, action, params, true);
      return cached as T;
    }
  }
  _lastCacheHit = false;

  const rateLimitConfig = getRateLimitConfig();
  const rateLimitEnabled = rateLimitConfig.enabled && opts.rateLimit !== false;
  if (rateLimitEnabled) {
    const hostname = new URL(resolvedServerUrl).hostname;
    await getRateLimiter().acquire(hostname);
  }

  try {
    let decodedData: unknown;

    if (isNode) {
      const safeAgents = await getSafeAgents();
      const response = await axios.get(url, {
        params,
        timeout: 30000,
        responseType: "arraybuffer",
        maxRedirects: 5,
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_RESPONSE_BYTES,
        ...(safeAgents
          ? { httpAgent: safeAgents.httpAgent, httpsAgent: safeAgents.httpsAgent }
          : {}),
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Sec-CH-UA': '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
          'Sec-CH-UA-Mobile': '?0',
          'Sec-CH-UA-Platform': '"Linux"',
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      decodedData = await decodePossiblyCompressed(
        response.data,
        response.headers
      );
    } else {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
          continue;
        }
        searchParams.set(key, String(value));
      }
      const fetchUrl = searchParams.toString()
        ? `${url}?${searchParams.toString()}`
        : url;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      let response: Response;
      try {
        response = await fetch(fetchUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Encoding": "identity",
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new CkanApiError(`CKAN API error (${response.status}): ${response.statusText}`, response.status, action);
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw new CkanApiError(`Response too large (${declaredLength} bytes)`, undefined, action);
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_BYTES) {
        throw new CkanApiError(`Response too large (${buffer.byteLength} bytes)`, undefined, action);
      }
      const headers: Record<string, string> = {};
      response.headers.forEach((headerValue, headerKey) => {
        headers[headerKey] = headerValue;
      });
      decodedData = await decodePossiblyCompressed(buffer, headers);
    }

    if (decodedData && (decodedData as { success?: boolean }).success === true) {
      const result = (decodedData as { result: T }).result;
      if (cache) {
        try {
          const serialized = JSON.stringify(result);
          if (serialized.length <= cacheConfig.maxEntryBytes) {
            await cache.set(cacheKey, result, ttl);
          }
        } catch {
          // Non-serializable payload: skip caching silently.
        }
      }
      auditLog(serverUrl, action, params, false);
      return result;
    } else {
      // Do NOT reflect the full upstream body to the caller: if the server was
      // pointed/redirected at a non-CKAN host it could carry internal detail,
      // turning blind SSRF into a return-value channel (GHSA-6f9w). Log it
      // server-side only (truncated) and return a generic, action-scoped error.
      try {
        if (typeof process !== "undefined") {
          process.stderr.write(
            `[ckan] success=false action=${action}: ${JSON.stringify(decodedData).slice(0, 500)}\n`
          );
        }
      } catch { /* ignore logging failures */ }
      throw new CkanApiError(
        `CKAN API returned success=false for action "${action}".`,
        undefined,
        action
      );
    }
  } catch (error) {
    if (error instanceof CkanApiError) throw error;
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        const errorMsg = data?.error?.message || data?.error || 'Unknown error';
        throw new CkanApiError(`CKAN API error (${status}): ${errorMsg}`, status, action);
      } else if (axiosError.code === 'ECONNABORTED') {
        throw new Error(`Request timeout connecting to ${serverUrl}`);
      } else if (axiosError.code === 'ENOTFOUND') {
        throw new Error(`Server not found: ${serverUrl}`);
      } else {
        throw new Error(`Network error: ${axiosError.message}`);
      }
    }
    throw error;
  }
}
