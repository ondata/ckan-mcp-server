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

let _lastCacheHit: boolean | null = null;

/** Returns whether the last makeCkanRequest call was served from cache. */
export function getLastCacheHit(): boolean | null {
  return _lastCacheHit;
}

type ZlibModule = {
  brotliDecompressSync: (input: Buffer) => Buffer;
  gunzipSync: (input: Buffer) => Buffer;
  inflateSync: (input: Buffer) => Buffer;
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

  try {
    if (zlib) {
      if (encoding?.includes("gzip")) {
        decodedBuffer = zlib.gunzipSync(buffer);
      } else if (encoding?.includes("br")) {
        decodedBuffer = zlib.brotliDecompressSync(buffer);
      } else if (encoding?.includes("deflate")) {
        decodedBuffer = zlib.inflateSync(buffer);
      } else if (
        buffer.length >= 2 &&
        buffer[0] === 0x1f &&
        buffer[1] === 0x8b
      ) {
        decodedBuffer = zlib.gunzipSync(buffer);
      }
    }
  } catch {
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
 * Validate that a server URL is safe to request (SSRF prevention).
 * Blocks non-HTTP/S protocols and private/internal IP ranges.
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

  if (hostname === 'localhost') {
    throw new Error(`Access to "${hostname}" is not allowed.`);
  }

  // Block IPv4 private/special ranges
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [o1, o2] = ipv4.slice(1).map(Number);
    const blocked =
      o1 === 0 ||                              // 0.0.0.0/8
      o1 === 10 ||                             // 10.0.0.0/8 private
      o1 === 127 ||                            // 127.0.0.0/8 loopback
      (o1 === 100 && o2 >= 64 && o2 <= 127) || // 100.64.0.0/10 shared
      (o1 === 169 && o2 === 254) ||            // 169.254.0.0/16 link-local / AWS metadata
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||  // 172.16.0.0/12 private
      (o1 === 192 && o2 === 168) ||            // 192.168.0.0/16 private
      o1 === 255;                              // broadcast
    if (blocked) {
      throw new Error(`Access to private/internal IP addresses is not allowed.`);
    }
  }

  // Block IPv6 private/loopback
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1);
    const lower = ipv6.toLowerCase();
    const blockedIpv6 =
      lower === '::1' ||           // loopback
      lower === '::' ||            // unspecified
      lower.startsWith('fc') ||    // fc00::/7 unique local
      lower.startsWith('fd') ||    // fd00::/8 unique local
      lower.startsWith('fe80') ||  // fe80::/10 link-local
      lower.startsWith('::ffff:'); // IPv4-mapped
    if (blockedIpv6) {
      throw new Error(`Access to private/internal IPv6 addresses is not allowed.`);
    }
  }

  // Optional domain allowlist: CKAN_ALLOWED_DOMAINS=domain1.com,domain2.org
  const rawAllowed = typeof process !== 'undefined' ? (process.env.CKAN_ALLOWED_DOMAINS ?? '') : '';
  const allowedDomains = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
  if (allowedDomains.length > 0 && !allowedDomains.includes(hostname)) {
    throw new Error(`Domain "${hostname}" is not in the allowed list (CKAN_ALLOWED_DOMAINS).`);
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
      const response = await axios.get(url, {
        params,
        timeout: 30000,
        responseType: "arraybuffer",
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
        throw new Error(`CKAN API error (${response.status}): ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
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
      throw new Error(
        `CKAN API returned success=false: ${JSON.stringify(decodedData)}`
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        const errorMsg = data?.error?.message || data?.error || 'Unknown error';
        throw new Error(`CKAN API error (${status}): ${errorMsg}`);
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
