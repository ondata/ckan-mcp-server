# Design: HTTP cache layer

## Context

`makeCkanRequest` in `src/utils/http.ts` is the single chokepoint through which every tool issues CKAN API calls. It runs in two environments:

- **Node.js** (stdio + HTTP transport): long-lived process, full Node APIs available
- **Cloudflare Workers**: short-lived isolate, no filesystem, but `caches.default` (Cache API) and `globalThis.caches` available

The project has no caching today. Introducing it is a performance optimization with observable behavioral edges (staleness, size limits), so it is spec-worthy.

## Goals

- Transparent to tool code — only `makeCkanRequest` changes
- Same cache API across runtimes, different backends underneath
- Safe by default: never cache errors, never cache partial/unvalidated payloads
- Tunable via env vars without code changes
- Easy to disable globally (`CKAN_CACHE_ENABLED=false`) or per call

## Non-Goals

- Cache invalidation (no write paths exist)
- Distributed cache across Worker regions (Cache API is per-colo; acceptable)
- Persistent cache survival across restarts in Node (not needed for MCP use)

## Decisions

### Decision 1: two backends behind one interface

```ts
interface CkanCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}
```

- `WorkersCacheApi` — wraps `caches.default`, stores serialized `Response` with `Cache-Control: s-maxage=<ttl>`
- `MemoryLruCache` — Map-based LRU with insertion-ordered eviction and explicit expiry timestamp

**Alternative considered**: a single unified implementation using only `Map`. Rejected — it would not leverage Cloudflare's edge cache on Workers, defeating half the purpose.

### Decision 2: cache key composition

Key = `sha1(resolvedServerUrl + action + canonicalizedParams)` where canonicalization sorts keys and stringifies values. This ensures:

- Different portals never collide
- Parameter order doesn't affect key
- Same query → same key

SHA1 is available both in Node (`crypto`) and Workers (`crypto.subtle`). Hash reduces long query strings (Solr filters can be kilobytes) to 40 hex chars.

### Decision 3: TTL policy

Driven by a small lookup table keyed on `action`:

| Action pattern | Default TTL | Rationale |
|---|---|---|
| `package_search`, `package_show`, `organization_*`, `group_*`, `tag_list` | 300s (5 min) | Catalog metadata changes slowly |
| `status_show`, `site_read` | 3600s (1h) | Portal capabilities essentially static |
| `datastore_search`, `datastore_search_sql` | 60s (1 min) | May point at live data |
| anything else / unknown | value of `CKAN_CACHE_TTL_DEFAULT` (default 300s) | Safe middle ground |

TTLs are ceilings — env var `CKAN_CACHE_TTL_DEFAULT` overrides the fallback.

### Decision 4: what to cache vs skip

Cache **only** when:
- HTTP response was 2xx
- Decoded payload is an object with `success === true`
- Serialized payload size ≤ 1 MiB (configurable via `CKAN_CACHE_MAX_ENTRY_BYTES`)

Errors, timeouts, network failures are never stored. This prevents "cached failure" amplification.

### Decision 5: bypass mechanism

`makeCkanRequest<T>(serverUrl, action, params, opts?: { cache?: boolean })` — passing `{ cache: false }` skips both read and write. Tests use this to avoid interference. No tool needs to set it today.

## Risks / Trade-offs

- **Staleness**: a user editing a CKAN dataset may not see changes for up to TTL seconds. Acceptable for a read-only exploration tool.
- **Memory in Node**: bounded by `CKAN_CACHE_MAX_ENTRIES` (default 500). Worst case ~500 MB if every entry is at the 1 MiB ceiling — realistic average is far lower, but document the knob.
- **Workers Cache API quirks**: only caches GET requests with proper headers. We wrap the CKAN response in a synthetic `Response` object keyed by a `Request` constructed from the cache key. Standard pattern; works as long as we set `Cache-Control: s-maxage`.

## Migration Plan

Additive only. No existing behavior changes when `CKAN_CACHE_ENABLED=false`. Ship with default `true` on Workers, `true` on Node.

Tests pinning fixtures (`tests/integration/*`) pass `{ cache: false }` or run with `CKAN_CACHE_ENABLED=false` in the Vitest setup file — pick whichever is less invasive when implementing.

## Open Questions

- Telemetry: log cache hit/miss to `worker_events_flat.jsonl`? Good idea, low cost, defer to follow-up unless trivial.
- Should `CKAN_CACHE_TTL_DEFAULT=0` fully disable, or should `CKAN_CACHE_ENABLED=false` remain the canonical switch? Keep both; `0` disables implicitly.
