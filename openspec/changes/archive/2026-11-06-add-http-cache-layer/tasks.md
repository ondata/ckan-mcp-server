# Tasks

> Reconciled with the code on 2026-11-06. Ticked: verified in the current code, tests or tags. Unticked: not done, or no longer verifiable.

## 1. Cache abstraction

- [x] 1.1 Create `src/utils/cache.ts` with `CkanCache` interface
- [x] 1.2 Implement `MemoryLruCache` (Node) with TTL expiry and LRU eviction
- [x] 1.3 Implement `WorkersCacheApi` wrapper around `caches.default`
- [x] 1.4 Export `getCache()` factory that picks backend based on runtime detection
- [x] 1.5 Implement canonical cache-key builder (sorted params → sha1)

## 2. Integration in `makeCkanRequest`

- [x] 2.1 Add optional `opts?: { cache?: boolean }` parameter
- [x] 2.2 Compute cache key before HTTP call
- [x] 2.3 Return cached value on hit (when not bypassed)
- [x] 2.4 Store result on successful response (success === true, size ≤ ceiling)
- [x] 2.5 Resolve TTL via action-based policy table with env-var fallback
- [x] 2.6 Honor `CKAN_CACHE_ENABLED=false` to short-circuit both read and write

## 3. Configuration surface

- [x] 3.1 Read `CKAN_CACHE_ENABLED`, `CKAN_CACHE_TTL_DEFAULT`, `CKAN_CACHE_MAX_ENTRIES`, `CKAN_CACHE_MAX_ENTRY_BYTES`
- [ ] 3.2 Document env vars in `README.md` and `CLAUDE.md` (remove `No caching` limitation note)
- [ ] 3.3 Expose the same knobs to Workers via `wrangler.toml` `[vars]`

## 4. Tests

- [x] 4.1 Unit tests for `MemoryLruCache` (set/get/expiry/eviction)
- [x] 4.2 Unit tests for cache-key canonicalization (param order, missing values)
- [x] 4.3 Integration test: two identical calls → single upstream hit (use existing mock fixtures)
- [x] 4.4 Integration test: error response not cached, next call re-hits upstream
- [x] 4.5 Integration test: `{ cache: false }` bypasses both read and write
- [x] 4.6 Ensure existing test suite passes with cache enabled (isolate via env var in setup)

## 5. End-to-end verification

- [x] 5.1 `npm run build` clean
- [x] 5.2 `npm test` green
- [ ] 5.3 Start HTTP server, call `ckan_package_search` twice with same args, verify second call is faster (log-based or timing-based)
- [ ] 5.4 `npm run dev:worker`, same verification against local Wrangler
- [x] 5.5 Update `LOG.md` with dated entry

## 6. Docs & release

- [x] 6.1 Update `project.md` — replace `No caching` with cache description
- [x] 6.2 Add section to `CLAUDE.md` describing cache config
- [x] 6.3 Bump version in `package.json` and `manifest.json` (minor)
- [x] 6.4 Follow release workflow in `CLAUDE.md` (tag, dxt, skill, deploy)
