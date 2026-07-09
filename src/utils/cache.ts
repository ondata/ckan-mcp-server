/**
 * HTTP cache layer for CKAN API responses.
 *
 * Provides a runtime-aware read-through cache with two backends:
 * - WorkersCacheApi: Cloudflare Workers edge cache via caches.default
 * - MemoryLruCache: bounded in-memory LRU for Node.js
 *
 * Selection is automatic; callers interact only with the CkanCache interface.
 */

export interface CkanCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export interface CacheConfig {
  enabled: boolean;
  ttlDefault: number;
  maxEntries: number;
  maxEntryBytes: number;
}

const TTL_METADATA = new Set([
  "package_search",
  "package_show",
  "current_package_list_with_resources",
  "resource_show",
  "organization_show",
  "organization_list",
  "organization_search",
  "group_show",
  "group_list",
  "group_search",
  "tag_list",
  "tag_show",
  "tag_search"
]);

const TTL_STATUS = new Set(["status_show", "site_read"]);
const TTL_DATASTORE = new Set(["datastore_search", "datastore_search_sql"]);

export function getTtlForAction(action: string, fallback: number): number {
  if (TTL_METADATA.has(action)) return 300;
  if (TTL_STATUS.has(action)) return 3600;
  if (TTL_DATASTORE.has(action)) return 60;
  return fallback;
}

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

export function getCacheConfig(): CacheConfig {
  const enabledRaw = readEnv("CKAN_CACHE_ENABLED");
  const isTest = readEnv("VITEST") === "true";
  const enabled = enabledRaw !== undefined ? enabledRaw !== "false" : !isTest;
  const ttlDefault = Number(readEnv("CKAN_CACHE_TTL_DEFAULT")) || 300;
  const maxEntries = Number(readEnv("CKAN_CACHE_MAX_ENTRIES")) || 500;
  const maxEntryBytes =
    Number(readEnv("CKAN_CACHE_MAX_ENTRY_BYTES")) || 1024 * 1024;
  return { enabled, ttlDefault, maxEntries, maxEntryBytes };
}

/** Recursively sort object keys so serialization is order-independent and type-preserving. */
function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalizeValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Serialize params to an unambiguous, injection-proof canonical string. Uses typed JSON
 * (not `k=v` joins), so `{q:"budget",rows:10}` and `{q:"budget&rows=10"}` — and a nested
 * object vs. its stringified form — never collide onto the same cache key (GHSA-78x9).
 */
export function canonicalizeParams(params: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    filtered[key] = value;
  }
  return JSON.stringify(canonicalizeValue(filtered));
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(hashBuffer);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function buildCacheKey(
  serverUrl: string,
  action: string,
  params: Record<string, unknown>
): Promise<string> {
  // JSON-array framing so serverUrl/action/params boundaries are unambiguous too.
  const raw = JSON.stringify([serverUrl, action, canonicalizeParams(params)]);
  return sha1Hex(raw);
}

interface LruEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryLruCache implements CkanCache {
  private readonly store = new Map<string, LruEntry>();

  constructor(private readonly maxEntries: number) {}

  async get(key: string): Promise<unknown | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export class WorkersCacheApi implements CkanCache {
  private readonly origin = "https://ckan-mcp-cache.internal";

  async get(key: string): Promise<unknown | undefined> {
    try {
      const response = await caches.default.match(`${this.origin}/${key}`);
      if (!response) return undefined;
      return await response.json();
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      const body = JSON.stringify(value);
      const response = new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, s-maxage=${ttlSeconds}`
        }
      });
      await caches.default.put(`${this.origin}/${key}`, response);
    } catch {
      // Silent failure: caching is best-effort.
    }
  }
}

let sharedCache: CkanCache | null = null;

export function getCache(): CkanCache {
  if (sharedCache) return sharedCache;

  const hasWorkersCaches =
    typeof caches !== "undefined" &&
    typeof (caches as { default?: unknown }).default !== "undefined";

  const isNode =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;

  if (hasWorkersCaches && !isNode) {
    sharedCache = new WorkersCacheApi();
  } else {
    sharedCache = new MemoryLruCache(getCacheConfig().maxEntries);
  }
  return sharedCache;
}

/**
 * Reset the shared cache instance. Intended for tests.
 */
export function __resetCacheForTests(): void {
  sharedCache = null;
}
