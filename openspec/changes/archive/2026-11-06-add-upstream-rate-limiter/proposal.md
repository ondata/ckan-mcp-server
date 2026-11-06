# Add per-portal upstream rate limiter

## Why

CKAN portals are public infrastructure shared by many users. If multiple MCP clients
hit the same worker instance simultaneously (or if a single client issues burst queries),
the worker can generate tens of parallel HTTP requests to the same portal hostname.
Many portals throttle or temporarily block IPs that exceed their undocumented limits
(observed on dati.gov.it, data.europa.eu, open.canada.ca).

The cache layer (v0.4.100) reduces repeat hits, but the first request to each unique
query still reaches the upstream. A rate limiter caps the outgoing request rate per
hostname regardless of cache state.

## What Changes

- Add a `UpstreamRateLimiter` class in `src/utils/rate-limiter.ts`
- Algorithm: **token bucket** — simple, handles bursts gracefully, well-understood
- Integrate in `makeCkanRequest` after cache lookup (cache hit bypasses limiter entirely)
- When the bucket for a hostname is empty: **wait** (back-pressure) up to a configurable
  max-wait timeout, then throw a descriptive error if still over limit
- Per-isolate in-memory state (acceptable: protects individual isolates from bursting;
  global coordination via Durable Objects is out of scope)
- Config via env vars: `CKAN_RATE_LIMIT_ENABLED`, `CKAN_RATE_LIMIT_RPS` (requests per
  second per hostname, default 5), `CKAN_RATE_LIMIT_BURST` (max burst size, default 10),
  `CKAN_RATE_LIMIT_MAX_WAIT_MS` (max wait before error, default 5000)
- Per-call opt-out: `makeCkanRequest(..., { rateLimit: false })` — extends existing `opts`

Out of scope:
- Global rate limiting across Workers isolates (requires Durable Objects or KV counters)
- Per-user or per-client limiting (no auth layer)
- Persistent rate limit state across Node restarts

## Impact

- Affected code: new `src/utils/rate-limiter.ts`, small change to `src/utils/http.ts`
- No tool changes
- New env vars documented in README, CLAUDE.md
- New capability spec: `upstream-rate-limiter`
