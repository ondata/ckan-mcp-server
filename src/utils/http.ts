/**
 * HTTP utilities for CKAN API requests
 */

import axios, { AxiosError } from "axios";
import { getPortalApiUrlForHostname, getPortalApiPath, getPortalMigration } from "./portal-config.js";
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
import {
  SsrfGuardError,
  readBoundedText,
  MAX_RESPONSE_BYTES,
  decodePossiblyCompressed,
  getSafeAgents,
  validateServerUrl,
  assertRedirectKeepsPrivateExemption,
  safeFetch
} from "./safe-http.js";

export {
  SsrfGuardError,
  isPrivateHostAllowed,
  isBlockedIp,
  validateServerUrl,
  assertRedirectKeepsPrivateExemption,
  warnIfPrivateHostsOverHttp,
  assertHttpAllowlistConfigured,
  createSsrfSafeLookup,
  getSafeDispatcher,
  __setDnsResolverForTests,
  assertHostnameResolvesSafe,
  safeFetch
} from "./safe-http.js";

export interface MakeCkanRequestOptions {
  cache?: boolean;
  rateLimit?: boolean;
  /** Send the params as a JSON body. For portals that lose a parameter on GET. */
  post?: boolean;
}

export class CkanApiError extends Error {
  readonly status: number | undefined;
  readonly action: string;
  /** The portal the request went to, as the caller wrote it: lets the hint know its origin. */
  readonly serverUrl: string | undefined;
  /** The reason CKAN itself gave, when the portal answered with a CKAN error body. */
  readonly ckanReason: string | undefined;
  constructor(message: string, status: number | undefined, action: string, serverUrl?: string, ckanReason?: string) {
    super(message);
    this.name = 'CkanApiError';
    this.status = status;
    this.action = action;
    this.serverUrl = serverUrl;
    this.ckanReason = ckanReason;
  }
}

const MAX_CKAN_REASON_LENGTH = 300;
/** Error bodies larger than this are not read: a CKAN error is a few hundred bytes. */
const MAX_ERROR_BODY_BYTES = 64 * 1024;

/**
 * The reason CKAN gives for a failed action: `error.message`, or for a validation error
 * (which has none) its fields, `query: column "x" does not exist`. One line, capped,
 * with a notice of how many characters were omitted.
 *
 * Only a CKAN error body counts — an object with `success: false` and an `error` — so a
 * firewall page or any other upstream content is never echoed (GHSA-6f9w).
 */
export function extractCkanErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { success, error } = body as { success?: unknown; error?: unknown };
  if (success !== false || error === undefined || error === null) return null;

  let text: string;
  if (typeof error === 'string') {
    text = error;
  } else if (typeof error === 'object') {
    const fields = error as Record<string, unknown>;
    if (typeof fields.message === 'string') {
      text = fields.message;
    } else {
      text = Object.entries(fields)
        .filter(([key]) => key !== '__type')
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('; ') : typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join('; ');
    }
  } else {
    return null;
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= MAX_CKAN_REASON_LENGTH) return text;
  // Say what was cut: the full reason is only in the portal's own API answer.
  return `${text.slice(0, MAX_CKAN_REASON_LENGTH)}… [${text.length - MAX_CKAN_REASON_LENGTH} more characters from the portal omitted]`;
}

/** Build the error for a non-2xx answer, quoting CKAN's own reason when it gave one. */
function httpError(status: number, statusText: string, body: unknown, action: string, serverUrl: string): CkanApiError | CkanTransportError {
  // Cloudflare answers these itself when it cannot reach the origin, so `fetch` does not
  // throw and the status text is empty or "<none>" (#560). The portal was never reached.
  if ((status >= 520 && status <= 527) || status === 530) {
    return new CkanTransportError(`Network error: Cloudflare could not reach the portal (HTTP ${status})`, serverUrl);
  }
  // CKAN answers an unknown action with a bare JSON string, translated up to the colon. Only
  // the fact is kept and the name is ours: an arbitrary body is never reflected (GHSA-6f9w).
  const reason = extractCkanErrorMessage(body)
    ?? (typeof body === 'string' && body.endsWith(`Action name not known: ${action}`) ? `Action name not known: ${action}` : undefined);
  return new CkanApiError(`CKAN API error (${status}): ${reason ?? (statusText || 'Unknown error')}`, status, action, serverUrl, reason);
}

/**
 * A request that never reached CKAN: DNS, socket, or our own 30s timeout.
 *
 * Deliberately not a `CkanApiError`: nothing answered, so there is no status and no
 * upstream message to quote. `formatCkanError` still turns it into a hint, because
 * "Request timeout connecting to X" alone does not tell an LLM whether to retry.
 */
export class CkanTransportError extends Error {
  /** The portal the request went to, as the caller wrote it. */
  readonly serverUrl: string | undefined;

  constructor(message: string, serverUrl?: string) {
    super(message);
    this.name = 'CkanTransportError';
    this.serverUrl = serverUrl;
  }
}

/**
 * The SSRF guards surface inside an `AxiosError` in two shapes: directly in `cause`
 * (connection-time `lookup` refusals) or one level deeper, under axios' own
 * `ERR_FR_REDIRECTION_FAILURE` wrap of the `beforeRedirect` throw (redirect hops).
 * Return the guard error, or null when the failure came from the network itself.
 */
function unwrapSsrfGuardError(axiosError: AxiosError): SsrfGuardError | null {
  if (axiosError.cause instanceof SsrfGuardError) return axiosError.cause;
  const redirected = (axiosError.cause as { cause?: unknown } | null | undefined)?.cause;
  return redirected instanceof SsrfGuardError ? redirected : null;
}

export function formatCkanError(error: unknown, _toolName: string): string {
  if (error instanceof CkanTransportError) {
    const migration = error.serverUrl ? getPortalMigration(error.serverUrl) : null;
    if (migration) {
      return `${error.message}\n→ ${migration.notice} See ${migration.docs_url}`;
    }
    // The request never arrived, so retrying is the first thing to try and the
    // status tool is how the caller finds out whether the portal is up at all. Its
    // own answer can be served from the cache for an hour (see `getTtlForAction`),
    // which is a deliberate TTL rather than an oversight, so the hint says so
    // instead of promising a live check.
    return `${error.message}\n→ Portal unreachable. Retry later, or call \`ckan_status_show\` to check portal health (its answer can come from the cache for up to an hour).`;
  }
  if (!(error instanceof CkanApiError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const { status, action, message, serverUrl } = error;

  // A portal that left CKAN answers every CKAN request the same way — catalog.data.gov
  // returns a bare 404 — so no status-based hint can be right for it. Say what happened
  // and where the data went, whatever the status.
  const migration = serverUrl ? getPortalMigration(serverUrl) : null;
  if (migration) {
    return `${message}\n→ ${migration.notice} See ${migration.docs_url}`;
  }

  // SQL access is optional in CKAN and many portals disable it, answering 404 or 400 on
  // the endpoint itself. The resource_id is usually fine, so pointing at
  // `ckan_package_show` sends the caller round a loop that ends on the same answer.
  const noSqlEndpoint = '→ This portal does not expose the SQL endpoint (optional in CKAN, often disabled). Use `ckan_datastore_search` with `filters`/`sort` instead; the resource_id is probably fine.';
  const actionUnknown = error.ckanReason === `Action name not known: ${action}`;

  let hint = '';
  if (status === 404) {
    if (action === 'datastore_search_sql') {
      hint = noSqlEndpoint;
    } else if (action.startsWith('datastore_search')) {
      hint = '→ Get a valid resource_id first: call `ckan_package_show` on a dataset, then pick a resource where `datastore_active` is true.';
    } else if (action === 'package_show') {
      hint = '→ Use `ckan_package_search` to find a valid dataset name or ID.';
    } else if (action === 'organization_show') {
      hint = '→ Use `ckan_organization_list` or `ckan_organization_search` to discover valid organization names.';
    } else if (action === 'group_show') {
      hint = '→ Use `ckan_group_list` or `ckan_group_search` to discover valid group names.';
    }
  } else if (status === 400 && actionUnknown && action === 'datastore_search_sql') {
    hint = noSqlEndpoint;
  } else if (status === 400 && actionUnknown && action === 'datastore_search') {
    hint = '→ This portal has no DataStore, so its tables cannot be queried here. Download the resource through its URL instead (`ckan_package_show` lists them).';
  } else if (status === 400) {
    if (action === 'datastore_search_sql') {
      hint = '→ Invalid SQL syntax or unknown column — check column names with `ckan_datastore_search` before writing SQL.';
    } else if (action.startsWith('datastore_search')) {
      hint = '→ Bad request — likely an invalid field name or filter syntax; check column names with a `SELECT *` query first.';
    }
  } else if (status === 403) {
    if (!error.ckanReason) {
      // No CKAN body: a firewall or bot-protection page (data.forest.go.th answers
      // "Just a moment...", gudang.lokadata.id "Permintaan Ditolak") refused the client.
      hint = '→ The portal\'s firewall or bot protection refused the request (no CKAN answer). It is not a parameter problem and retrying will not help; the portal may be usable only from a browser.';
    } else if (action === 'datastore_search_sql') {
      // CKAN allows a fixed list of SQL functions and no system tables.
      hint = '→ This SQL uses something not permitted on this portal (CKAN accepts a limited list of functions and no system tables such as information_schema). Rewrite the query without it, or use `ckan_datastore_search`.';
    }
  } else if (status === 409 && action === 'datastore_search_sql') {
    hint = '→ The portal rejected the SQL (reason above). Check table and column names with `ckan_datastore_search` (limit 1), then fix the query.';
  } else if (status === 409 || status === 422) {
    hint = '→ Portal rejected the request — parameters may conflict; simplify filters and retry.';
  } else if (status === 503 || status === 502 || status === 504) {
    hint = '→ Portal temporarily unavailable — retry in a few seconds, or call `ckan_status_show` to check portal health (cached up to an hour).';
  } else if (status === 500) {
    hint = '→ Portal internal error — try a different portal or retry later, and call `ckan_status_show` to check portal health (cached up to an hour).';
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

// Default identity: some WAFs (dati.anticorruzione.it) reject anything but a Chrome UA.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Fallback identity: Anubis challenges any UA naming Mozilla, and lets honest bots through.
const HONEST_USER_AGENT = 'CKAN-MCP-Server/1.0';

/**
 * True when the body is an Anubis proof-of-work challenge page (https://anubis.techaro.lol/)
 * instead of CKAN JSON. No fixed User-Agent satisfies both Anubis and Chrome-only WAFs
 * (issue #7), so `makeCkanRequest` retries once with `HONEST_USER_AGENT` when it sees one.
 */
export function isAnubisChallenge(body: unknown): boolean {
  return typeof body === 'string' && body.includes('anubis_challenge');
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
    ? await buildCacheKey(baseUrl, action, params)
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
  const acquireRateToken = async (): Promise<void> => {
    if (rateLimitEnabled) {
      const hostname = new URL(resolvedServerUrl).hostname;
      await getRateLimiter().acquire(hostname);
    }
  };
  await acquireRateToken();

  try {
    // One retry, only for Anubis: see isAnubisChallenge.
    const fetchDecoded = async (honest: boolean): Promise<unknown> => {
      if (isNode) {
        const safeAgents = await getSafeAgents();
        // The host the request is currently on, to tell where each redirect comes from.
        let hopHostname = new URL(url).hostname;
        const config = {
          timeout: 30000,
          responseType: "arraybuffer",
          maxRedirects: 5,
          // Re-validate every redirect hop: Node skips the agent's `lookup` for IP
          // literals, so a public host 302-ing to e.g. 169.254.169.254 would otherwise
          // be followed. Also enforces CKAN_ALLOWED_DOMAINS on redirect targets.
          beforeRedirect: (redirectOptions: { href: string }) => {
            assertRedirectKeepsPrivateExemption(hopHostname, redirectOptions.href);
            hopHostname = new URL(redirectOptions.href).hostname;
            validateServerUrl(redirectOptions.href);
          },
          // Never route through HTTP_PROXY/HTTPS_PROXY: a proxy would connect to the
          // target itself, bypassing the SSRF-safe lookup pinned in the agents below.
          proxy: false,
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
            ...(honest
              ? {}
              : {
                  'Sec-CH-UA': '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
                  'Sec-CH-UA-Mobile': '?0',
                  'Sec-CH-UA-Platform': '"Linux"'
                }),
            'User-Agent': honest ? HONEST_USER_AGENT : BROWSER_USER_AGENT
          }
        } as const;
        const response = opts.post
          ? await axios.post(url, params, config)
          : await axios.get(url, { params, ...config });

        return decodePossiblyCompressed(
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
        const fetchUrl = !opts.post && searchParams.toString()
          ? `${url}?${searchParams.toString()}`
          : url;
        // The timer runs until the body is read, not just the headers: a portal that
        // sent headers and then stalled kept a Worker call open for 134 s
        // (open.canada.ca, 2026-10-31).
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const timeoutError = () => new CkanTransportError(`Request timeout connecting to ${serverUrl}`, serverUrl);
        try {
          let response: Response;
          try {
            // safeFetch re-validates each redirect hop (same guard as the axios branch)
            response = await safeFetch(fetchUrl, {
              method: opts.post ? "POST" : "GET",
              ...(opts.post ? { body: JSON.stringify(params) } : {}),
              signal: controller.signal,
              headers: {
                Accept: "application/json, text/plain, */*",
                "Accept-Encoding": "identity",
                ...(opts.post ? { "Content-Type": "application/json" } : {}),
                "User-Agent": honest ? HONEST_USER_AGENT : BROWSER_USER_AGENT
              }
            }, { maxHops: 5 });
          } catch (error) {
            // Workers has no axios, so this branch is the only place a fetch failure can be
            // classified: a bare `TypeError` reaches `formatCkanError` and the caller gets
            // no retry guidance. The SSRF guards throw `SsrfGuardError` with their own
            // message, and those keep it.
            if (controller.signal.aborted) throw timeoutError();
            if (error instanceof TypeError) {
              throw new CkanTransportError(`Network error: ${error.message}`, serverUrl);
            }
            throw error;
          }

          if (!response.ok) {
            // The body carries CKAN's reason (`Not authorized to call function NULLIF`);
            // the status text alone never said what to fix. Read it only when small.
            let body: unknown = null;
            const errorLength = Number(response.headers.get("content-length"));
            if (!(Number.isFinite(errorLength) && errorLength > MAX_ERROR_BODY_BYTES)) {
              const text = await readBoundedText(response, MAX_ERROR_BODY_BYTES);
              try {
                if (text !== null) body = JSON.parse(text);
              } catch { /* not JSON: fall back to the status text */ }
            }
            throw httpError(response.status, response.statusText, body, action, serverUrl);
          }

          const declaredLength = Number(response.headers.get("content-length"));
          if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
            throw new CkanApiError(`Response too large (${declaredLength} bytes)`, undefined, action, serverUrl);
          }
          let buffer: ArrayBuffer;
          try {
            buffer = await response.arrayBuffer();
          } catch (error) {
            // Past the headers no guard can fire, so any failure here is the connection:
            // Workers reports a dropped one as a plain `Error("Network connection lost.")`.
            if (controller.signal.aborted) throw timeoutError();
            throw new CkanTransportError(
              `Network error: ${error instanceof Error ? error.message : String(error)}`,
              serverUrl
            );
          }
          if (buffer.byteLength > MAX_RESPONSE_BYTES) {
            throw new CkanApiError(`Response too large (${buffer.byteLength} bytes)`, undefined, action, serverUrl);
          }
          const headers: Record<string, string> = {};
          response.headers.forEach((headerValue, headerKey) => {
            headers[headerKey] = headerValue;
          });
          return decodePossiblyCompressed(buffer, headers);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    };

    let decodedData = await fetchDecoded(false);
    if (isAnubisChallenge(decodedData)) {
      // The retry is a second upstream request: it pays its own rate token.
      await acquireRateToken();
      decodedData = await fetchDecoded(true);
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
        action,
        serverUrl
      );
    }
  } catch (error) {
    if (error instanceof CkanApiError) throw error;
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const guardError = unwrapSsrfGuardError(axiosError);
      if (guardError) throw guardError;
      // The SSRF guards refuse before any connection; axios surfaces the refusal
      // directly in `cause` (connection-time `lookup`) or one level deeper, under
      // its ERR_FR_REDIRECTION_FAILURE wrap of the `beforeRedirect` throw. The
      // guard's verdict must keep its own message — wrapping it in the
      // "Portal unreachable. Retry later" hint would tell the LLM to retry a
      // destination that will never pass, which the fetch branch already avoids.
      if (axiosError.response) {
        // With `responseType: "arraybuffer"` the error body is bytes, possibly compressed:
        // read as an object it never had an `error`, and every 4xx said "Unknown error".
        const { status, statusText, data, headers } = axiosError.response;
        let body: unknown = null;
        try {
          body = await decodePossiblyCompressed(data, headers as Record<string, unknown>);
        } catch { /* undecodable body: fall back to the status text */ }
        throw httpError(status, statusText, body, action, serverUrl);
      } else if (axiosError.code === 'ECONNABORTED') {
        throw new CkanTransportError(`Request timeout connecting to ${serverUrl}`, serverUrl);
      } else if (axiosError.code === 'ENOTFOUND') {
        throw new CkanTransportError(`Server not found: ${serverUrl}`, serverUrl);
      } else {
        throw new CkanTransportError(`Network error: ${axiosError.message}`, serverUrl);
      }
    }
    throw error;
  }
}
