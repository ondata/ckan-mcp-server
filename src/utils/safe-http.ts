/**
 * Backend-free HTTP safety: SSRF guards (URL literals, DNS resolution, redirect hops),
 * bounded body reads and decompression, and a redirect-checking fetch. This module
 * reads no configuration: the caller passes the allowlist, the private hosts, the size
 * caps and the setting names to show in messages on every call. `http.ts` reads them
 * from the environment and exports wrappers under the original names, so existing
 * imports from `./http.js` are unchanged.
 */

/**
 * Read a body as text, stopping at `maxBytes`: a missing or false Content-Length must
 * not let a portal stream an unbounded error body into memory. Null when the body is
 * larger, or the read fails.
 */
export async function readBoundedText(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * A request refused by one of the SSRF/domain-safety guards before any connection
 * was made: `validateServerUrl`, the connection-time DNS `lookup`, or the per-hop
 * redirect re-check. The guard's message is a verdict — the destination will never
 * pass — so a "Portal unreachable. Retry later" hint would send the caller round a
 * loop. Neither the fetch branch nor the axios branch wraps it; both rethrow it
 * as-is, exactly as a failed-connection error keeps its own text.
 */
export class SsrfGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfGuardError';
  }
}

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
  encoding: string | undefined,
  maxDecompressedBytes: number
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
      if (decompressed.byteLength > maxDecompressedBytes) {
        throw new Error("Decompressed response exceeds size limit");
      }
      return new TextDecoder("utf-8").decode(decompressed).trim();
    } catch {
      // Fall back to plain text decoding.
    }
  }
  return new TextDecoder("utf-8").decode(buffer).trim();
}

/**
 * Decode a response body (JSON when it parses, text otherwise), decompressing it with
 * the output capped at `maxDecompressedBytes` (decompression-bomb guard, GHSA-q5gv).
 */
export async function decodePossiblyCompressed(
  data: unknown,
  headers: Record<string, unknown> | undefined,
  maxDecompressedBytes: number
): Promise<unknown> {
  if (data === null || data === undefined) {
    return data;
  }

  const arrayBuffer = asArrayBuffer(data);
  if (arrayBuffer && typeof Buffer === "undefined") {
    const encoding = getHeaderValue(headers, "content-encoding");
    const text = await decodeArrayBufferText(arrayBuffer, encoding, maxDecompressedBytes);
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

  const zlibOpts: ZlibOptions = { maxOutputLength: maxDecompressedBytes };
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
    // (kept bounded by the caller's response size cap on the request paths).
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
 * Private-network addresses an administrator may open for one named host
 * (the private-host list): loopback, RFC 1918 and IPv6 unique-local. Link-local and
 * cloud metadata (169.254.0.0/16), 0.0.0.0/8, shared, multicast and reserved ranges stay
 * blocked even for a listed host.
 */
function isPrivateNetworkIp(v: string): boolean {
  if (v.includes(':')) {
    const w = parseIpv6(v);
    if (!w) return false;
    return (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) || // ::1 loopback
      (w[0] & 0xfe00) === 0xfc00;                                  // fc00::/7 unique local
  }
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const o1 = Number(m[1]);
  const o2 = Number(m[2]);
  return o1 === 10 || o1 === 127 ||
    (o1 === 172 && o2 >= 16 && o2 <= 31) ||
    (o1 === 192 && o2 === 168);
}

/**
 * The settings the URL guards need, passed in on every call. Lists are comma-separated,
 * as the administrator wrote them (empty: not set); the names are the settings to show
 * in messages.
 */
export interface UrlGuardSettings {
  /** Domain allowlist, exact match, e.g. "domain1.com,domain2.org". Empty: no allowlist. */
  allowedDomains: string;
  /** Hostnames allowed to be private, exact match, e.g. "localhost,intra.example". */
  privateHosts: string;
  /** Name of the allowlist setting, as shown in messages. */
  allowedDomainsName: string;
  /** Name of the private-host setting, as shown in messages. */
  privateHostsName: string;
}

/**
 * Whether `hostname` is on the administrator's private-host list (`privateHosts`,
 * comma-separated, exact match, e.g. "localhost,intra.example"). Off when empty.
 */
export function isPrivateHostAllowed(hostname: string, privateHosts: string): boolean {
  const raw = privateHosts;
  if (!raw) return false;
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return raw.split(',').some((e) => e.trim().toLowerCase().replace(/^\[|\]$/g, '') === h && h !== '');
}

/**
 * Returns true if an IP address (IPv4 or IPv6 string) is in a private/internal/special range.
 * Shared by the synchronous literal guard (`validateServerUrl`) and the DNS-resolution
 * guard (`createSsrfSafeLookup` / `assertHostnameResolvesSafe`), so a hostname that
 * *resolves* to an internal address is blocked, not just an internal IP literal.
 */
/**
 * Parse an IPv6 literal into its eight 16-bit words, or null if malformed.
 * Total (never throws) and dependency-free: `isBlockedIp` also runs on the Workers
 * build, where `node:net` is unavailable. Accepts every spelling of the same address
 * (compressed, expanded, upper-case, leading zeros, trailing dotted-quad) so the
 * classifier below decides on values, not on how the address happened to be written.
 */
function parseIpv6(input: string): number[] | null {
  const v = input.split('%')[0]; // drop any zone id (fe80::1%eth0)
  if (v.includes(':::') || (v.match(/::/g) || []).length > 1) return null;

  const [head, tail, ...rest] = v.split('::');
  if (rest.length > 0) return null;
  const compressed = v.includes('::');

  const words: number[] = [];
  const pushGroups = (part: string): boolean => {
    if (part === '') return true;
    for (const g of part.split(':')) {
      if (g.includes('.')) {
        // trailing dotted-quad (::ffff:127.0.0.1, ::127.0.0.1)
        const m = g.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (!m) return false;
        const o = m.slice(1).map(Number);
        if (o.some((n) => n > 255)) return false;
        words.push((o[0] << 8) | o[1], (o[2] << 8) | o[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(g)) return false;
      words.push(parseInt(g, 16));
    }
    return true;
  };

  if (!pushGroups(head)) return null;
  const headLen = words.length;
  if (!pushGroups(compressed ? tail : '')) return null;
  const tailLen = words.length - headLen;

  if (!compressed) return words.length === 8 ? words : null;
  const gap = 8 - headLen - tailLen;
  if (gap < 1) return null;
  return [...words.slice(0, headLen), ...Array(gap).fill(0), ...words.slice(headLen)];
}

/**
 * Returns true if an IP address (IPv4 or IPv6 string) is in a private/internal/special range.
 * Shared by the synchronous literal guard (`validateServerUrl`) and the DNS-resolution
 * guard (`createSsrfSafeLookup` / `assertHostnameResolvesSafe`), so a hostname that
 * *resolves* to an internal address is blocked, not just an internal IP literal.
 *
 * IPv6 is parsed into words before classification: several IPv6 ranges embed an IPv4
 * address (NAT64, 6to4, IPv4-compatible), so `64:ff9b::a9fe:a9fe` is the cloud metadata
 * endpoint written in IPv6 and must be blocked exactly like 169.254.169.254.
 */
export function isBlockedIp(ip: string, allowPrivate = false): boolean {
  const v = ip.toLowerCase().trim();
  if (allowPrivate && isPrivateNetworkIp(v)) return false;

  // IPv6 (any address containing a colon)
  if (v.includes(':')) {
    const w = parseIpv6(v);
    if (!w) return true; // unparseable: fail closed
    const zeros = (n: number) => w.slice(0, n).every((x) => x === 0);
    return (
      zeros(6) ||                                  // ::/96 unspecified, loopback, IPv4-compatible
      (zeros(5) && w[5] === 0xffff) ||             // ::ffff:0:0/96 IPv4-mapped
      (w[0] === 0x0064 && w[1] === 0xff9b &&
        ((w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0) ||
          w[2] === 0x0001)) ||                     // 64:ff9b::/96 + 64:ff9b:1::/48 NAT64
      w[0] === 0x2002 ||                           // 2002::/16 6to4
      (w[0] === 0x2001 && w[1] === 0x0000) ||      // 2001::/32 Teredo
      (w[0] & 0xfe00) === 0xfc00 ||                // fc00::/7 unique local
      (w[0] & 0xffc0) === 0xfe80 ||                // fe80::/10 link-local
      (w[0] & 0xffc0) === 0xfec0 ||                // fec0::/10 site-local (deprecated)
      (w[0] & 0xff00) === 0xff00                   // ff00::/8 multicast
    );
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
    (o1 === 198 && (o2 === 18 || o2 === 19)) || // 198.18.0.0/15 benchmarking
    o1 >= 224                                // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, broadcast
  );
}

/**
 * Validate that a server URL is safe to request (SSRF prevention).
 * Blocks non-HTTP/S protocols and private/internal IP *literals*.
 * Hostnames that resolve to internal IPs are blocked later, at connection time,
 * by the DNS-resolution guards (see `createSsrfSafeLookup` / `assertHostnameResolvesSafe`).
 */
export function validateServerUrl(serverUrl: string, settings: UrlGuardSettings): void {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new SsrfGuardError(`Invalid URL: ${serverUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfGuardError(`Disallowed protocol "${parsed.protocol}". Only http and https are allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const privateOk = isPrivateHostAllowed(hostname, settings.privateHosts);

  const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'ip6-localhost',
    'ip6-loopback',
  ]);
  if (BLOCKED_HOSTNAMES.has(hostname) && !privateOk) {
    throw new SsrfGuardError(`Access to "${hostname}" is not allowed.`);
  }

  // Block IPv4 private/special literals. WHATWG URL already normalizes integer/hex/
  // octal/short IPv4 forms (e.g. 0x7f000001 → 127.0.0.1) to dotted-decimal here, so a
  // single dotted-quad check covers all those encodings (GHSA-8hxx).
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isBlockedIp(hostname, privateOk)) {
    throw new SsrfGuardError(`Access to private/internal IP addresses is not allowed.`);
  }

  // Block IPv6 private/loopback literals (URL hostname keeps the brackets)
  if (hostname.startsWith('[') && isBlockedIp(hostname.slice(1, -1), privateOk)) {
    throw new SsrfGuardError(`Access to private/internal IPv6 addresses is not allowed.`);
  }

  // Optional domain allowlist, e.g. "domain1.com,domain2.org"
  const rawAllowed = settings.allowedDomains;
  const allowedDomains = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
  if (allowedDomains.length > 0 && !allowedDomains.includes(hostname)) {
    throw new SsrfGuardError(`Domain "${hostname}" is not in the allowed list (${settings.allowedDomainsName}).`);
  }
}

/**
 * A redirect may enter a host on the private-host list only from another listed host, so
 * a public server cannot answer with a 302 to e.g. `http://localhost:5003/` and have it
 * followed. Other hops are checked by `validateServerUrl` as before.
 */
export function assertRedirectKeepsPrivateExemption(
  fromHostname: string,
  toUrl: string,
  settings: UrlGuardSettings
): void {
  const to = new URL(toUrl).hostname.toLowerCase();
  if (isPrivateHostAllowed(to, settings.privateHosts) &&
      !isPrivateHostAllowed(fromHostname.toLowerCase(), settings.privateHosts)) {
    throw new SsrfGuardError(
      `A redirect from "${fromHostname}" to "${to}" is not allowed: ` +
      `a private host (${settings.privateHostsName}) can only be reached from a listed host.`
    );
  }
}

type ResolvedAddress = { address: string; family?: number };
export type DnsLookupModule = {
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
 * Strict by default: `allowPrivateHosts` lets a host on the private-host list resolve to
 * a private address. The list comes from `privateHosts`, called at each lookup because
 * agents outlive any one request; `settings` is kept and read at each lookup too. Only
 * the agents from `createSafeAgents` ask for it; the fetch dispatcher below does not, so
 * it stays closed to private hosts at connect time.
 */
export function createSsrfSafeLookup(
  dnsModule: DnsLookupModule,
  settings: { allowPrivateHosts?: boolean } = {},
  privateHosts: () => string = () => ''
) {
  return function ssrfSafeLookup(hostname: string, options: any, callback: any): void {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const family = options && typeof options === 'object' ? options.family : undefined;
    const allowPrivate = settings.allowPrivateHosts === true &&
      isPrivateHostAllowed(hostname, privateHosts());
    dnsModule.lookup(hostname, { all: true, family: family || 0 }, (err, addresses) => {
      if (err) {
        callback(err);
        return;
      }
      const list = Array.isArray(addresses) ? addresses : [addresses as ResolvedAddress];
      for (const a of list) {
        if (isBlockedIp(a.address, allowPrivate)) {
          callback(new SsrfGuardError(
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

/**
 * Build SSRF-safe http/https Agents (Node only) whose lookup lets the hosts returned by
 * `privateHosts` resolve to private addresses. Resolves to null off Node/on failure.
 * Not cached here: the caller keeps one set for the process.
 */
export async function createSafeAgents(
  privateHosts: () => string
): Promise<{ httpAgent: unknown; httpsAgent: unknown } | null> {
  try {
    // String-concatenated specifiers keep esbuild from bundling node builtins
    // into the Cloudflare Workers build (mirrors loadZlib above).
    const dnsMod = (await import("node:" + "dns")) as unknown as DnsLookupModule;
    const httpMod = (await import("node:" + "http")) as any;
    const httpsMod = (await import("node:" + "https")) as any;
    const lookup = createSsrfSafeLookup(dnsMod, { allowPrivateHosts: true }, privateHosts);
    return {
      httpAgent: new httpMod.Agent({ lookup }),
      httpsAgent: new httpsMod.Agent({ lookup }),
    };
  } catch {
    return null;
  }
}

type SsrfSafeLookup = ReturnType<typeof createSsrfSafeLookup>;
type UndiciModule = {
  Agent: new (options: { connect: { lookup: SsrfSafeLookup } }) => unknown;
};

let _safeDispatcher: Promise<unknown | null> | null = null;

/**
 * Lazily build an undici Dispatcher whose connections resolve through
 * `createSsrfSafeLookup`, so `fetch()` connects to exactly the address we validated.
 * This is what `httpAgent`/`httpsAgent` do for the axios path: without it the fetch
 * path validates the hostname and then lets undici resolve it a second time, leaving
 * a TOCTOU window a DNS-rebinding record can win.
 * Returns null off Node (Cloudflare Workers, where the CF sandbox blocks internal egress).
 */
export function getSafeDispatcher(): Promise<unknown | null> {
  if (!_safeDispatcher) {
    _safeDispatcher = (async () => {
      try {
        // Non-constant specifiers: esbuild constant-folds `"undici" + ""` and would
        // bundle the whole of undici (and break the browser-platform Workers build),
        // so the name is assembled at runtime and left as a live dynamic import.
        const dnsMod = (await import("node:" + "dns")) as unknown as DnsLookupModule;
        const undiciSpecifier = ["und", "ici"].join("");
        const undiciMod = (await import(undiciSpecifier)) as UndiciModule;
        return new undiciMod.Agent({ connect: { lookup: createSsrfSafeLookup(dnsMod) } });
      } catch {
        return null;
      }
    })();
  }
  return _safeDispatcher;
}

type DnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;
let _dnsResolver: DnsResolver | null = null;

/** Test seam: override the DNS resolver used by `assertHostnameResolvesSafe`. */
export function __setDnsResolverForTests(fn: DnsResolver | null): void {
  _dnsResolver = fn;
}

/**
 * Resolve a hostname and throw if it maps to a private/internal IP.
 * Used by the fetch-based paths that cannot attach a custom
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
    throw new SsrfGuardError(`Cannot resolve "${hostname}" for SSRF validation (failing closed).`);
  }

  // Not relaxed for the private-host list: this guard serves the fetch-based paths,
  // which stay closed to private hosts.
  for (const a of addresses) {
    if (isBlockedIp(a.address)) {
      throw new SsrfGuardError(
        `Access to private/internal IP addresses is not allowed ` +
        `("${hostname}" resolves to ${a.address}).`
      );
    }
  }
}

/**
 * Fetch that does NOT blindly follow redirects: each hop's target is re-validated
 * with `validateServerUrl` (against `opts.urlGuard()`, called at each hop) +
 * `assertHostnameResolvesSafe` before it is followed,
 * closing redirect-based SSRF (e.g. a public endpoint 302-ing to 169.254.169.254).
 * The caller is expected to have validated the initial URL already.
 *
 * On Node every hop also goes through the SSRF-safe undici dispatcher, which pins the
 * connection to the address it validated — so a rebinding record cannot swap in an
 * internal IP between the check and the connect. `assertHostnameResolvesSafe` stays as
 * defence in depth for runtimes where no dispatcher is available.
 * On Workers, `assertHostnameResolvesSafe` is a no-op (the CF sandbox blocks internal egress).
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  opts: { maxHops?: number; httpsOnly?: boolean; urlGuard: () => UrlGuardSettings }
): Promise<Response> {
  const maxHops = opts.maxHops ?? 3;
  const dispatcher = await getSafeDispatcher();
  let current = url;
  for (let hop = 0; ; hop++) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      ...(dispatcher ? { dispatcher } : {})
    } as RequestInit);
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
    validateServerUrl(next, opts.urlGuard());
    await assertHostnameResolvesSafe(new URL(next).hostname);
    current = next;
  }
}
