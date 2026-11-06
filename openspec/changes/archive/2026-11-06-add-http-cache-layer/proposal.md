# Add HTTP cache layer for CKAN API calls

## Why

The `No caching` limitation (see `CLAUDE.md` and `project.md`) means every MCP tool call triggers a fresh HTTP request to the upstream CKAN portal. This has real cost:

- Slow portals (e.g. `data.europa.eu` SPARQL, large Solr queries) add seconds of latency to every call
- Identical repeated queries during a single session (or across sessions on Workers) hit the upstream every time
- Some portals rate-limit; unnecessary re-fetches increase the risk of being throttled

Introducing a read-through cache in `makeCkanRequest` addresses the limitation with minimal surface area: all tools route through this single function.

## What Changes

- Add a `CkanCache` abstraction with two implementations
  - **Workers runtime**: Cloudflare Cache API (`caches.default`) — edge-level, zero infrastructure
  - **Node.js runtime**: in-memory LRU with per-entry TTL, bounded size
- Integrate the cache into `makeCkanRequest` (`src/utils/http.ts`) as a read-through layer
- TTL policy driven by `action` name (search/list → long TTL, datastore → short, errors → never cached)
- Per-request opt-out via new optional `{ cache?: false }` parameter in `makeCkanRequest`
- Environment variables to tune behavior: `CKAN_CACHE_ENABLED`, `CKAN_CACHE_TTL_DEFAULT`, `CKAN_CACHE_MAX_ENTRIES`
- Do **not** cache: non-2xx responses, responses with `success !== true`, responses exceeding a size ceiling

Out of scope (future):
- AI Gateway integration (analytics, rate limiting)
- Cache invalidation on write operations (all tools are read-only)
- Persistent cache across Workers invocations (KV / R2)

## Impact

- Affected specs: new capability `http-caching`; minor note added to `cloudflare-deployment`
- Affected code: `src/utils/http.ts` (request path), new `src/utils/cache.ts`, `src/worker.ts` and `src/index.ts` (no changes to tool files)
- Behavior change: identical CKAN calls within TTL return cached data; observable via latency, not output. Bypass path available for tests and freshness-critical calls.
