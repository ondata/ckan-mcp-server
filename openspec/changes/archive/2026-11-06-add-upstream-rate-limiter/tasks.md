# Tasks

> Reconciled with the code on 2026-11-06. Ticked: verified in the current code, tests or tags. Unticked: not done, or no longer verifiable.

## 1. Rate limiter module

- [x] 1.1 Create `src/utils/rate-limiter.ts` with `RateLimitError` class
- [x] 1.2 Implement `Bucket` type (`tokens`, `lastRefill`)
- [x] 1.3 Implement `UpstreamRateLimiter` class with `acquire(hostname)` method
- [x] 1.4 Implement token refill logic (elapsed-based)
- [x] 1.5 Implement wait-and-retry path up to `maxWaitMs`
- [x] 1.6 Implement max-size cap (200 hostnames) on bucket map
- [x] 1.7 Export `getRateLimiter()` singleton factory
- [x] 1.8 Export `__resetRateLimiterForTests()`
- [x] 1.9 Export `getRateLimitConfig()` reading env vars

## 2. Integration in `makeCkanRequest`

- [x] 2.1 Extend `MakeCkanRequestOptions` with `rateLimit?: boolean`
- [x] 2.2 After cache miss, call `rateLimiter.acquire(resolvedHostname)` when enabled
- [x] 2.3 Honor `CKAN_RATE_LIMIT_ENABLED=false` and `opts.rateLimit=false` to skip entirely
- [x] 2.4 Ensure cache hits never reach the rate limiter

## 3. Tests

- [ ] 3.1 Unit: token refill — tokens increase proportional to elapsed time
- [x] 3.2 Unit: burst — up to `burst` requests fire immediately
- [x] 3.3 Unit: blocking — request beyond burst waits then proceeds
- [x] 3.4 Unit: timeout — wait exceeds `maxWaitMs`, throws `RateLimitError`
- [x] 3.5 Unit: different hostnames get independent buckets
- [ ] 3.6 Unit: `opts.rateLimit=false` bypasses limiter
- [ ] 3.7 Integration: cache hit does not consume a rate limit token

## 4. Docs

- [ ] 4.1 Add env vars to `CLAUDE.md` Known Limitations / configuration section
- [ ] 4.2 Update `openspec/project.md` architecture notes
- [x] 4.3 Update `LOG.md`

## 5. End-to-end verification

- [x] 5.1 `npm run build` clean
- [x] 5.2 `npm test` green
- [ ] 5.3 HTTP server test: 15 rapid identical calls to same portal, verify only first N
      reach upstream (use mocked axios call count to confirm)
- [x] 5.4 Bump version, commit, tag, release
