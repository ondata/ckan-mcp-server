# Design: per-portal upstream rate limiter

## Token Bucket Algorithm

Each hostname gets its own bucket with:
- `tokens`: current available requests (float, 0 to `burst`)
- `lastRefill`: timestamp of last token refill

On each request:
1. Refill: `tokens = min(burst, tokens + (elapsed_ms / 1000) * rps)`
2. If `tokens >= 1`: consume 1 token, proceed immediately
3. If `tokens < 1`: compute wait time = `(1 - tokens) / rps * 1000` ms
   - If wait <= `maxWaitMs`: sleep, then retry from step 1
   - Else: throw `RateLimitError`

This is a single-class, pure-TypeScript implementation with no dependencies.
`setTimeout` / `Promise` sleep works identically in Node and Workers.

**Why token bucket over sliding window?**
Sliding window requires storing per-request timestamps (O(burst) memory per hostname).
Token bucket is O(1) per hostname and handles burst naturally via the `burst` parameter.

## Bucket Lifecycle

Buckets are created lazily on first request to each hostname and stored in a `Map<string, Bucket>`.
No eviction needed: the number of distinct CKAN portal hostnames accessed in a session is small
(single digits in practice). A max-size cap of 200 entries is enforced as a safety measure.

## Hostname Extraction

Rate limiting is keyed on the **resolved** hostname (after portal-config override), not the
raw `server_url`. This means `dati.anticorruzione.it` and `dati.anticorruzione.it/opendata`
share the same bucket — correct behavior.

## Integration Point

In `makeCkanRequest`, the order is:

```
validateServerUrl()
  → resolvePortalHostname()
    → cache.get()  ← if hit: return immediately (no rate limit consumed)
    → rateLimiter.acquire(hostname)  ← blocks or throws
    → fetch()
    → cache.set()
    → return result
```

Cache hit never touches the rate limiter — correct, since no upstream request is made.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `CKAN_RATE_LIMIT_ENABLED` | `true` (prod), `false` (VITEST) | Mirror of cache pattern |
| `CKAN_RATE_LIMIT_RPS` | `5` | Requests per second per hostname |
| `CKAN_RATE_LIMIT_BURST` | `10` | Max tokens in bucket (burst capacity) |
| `CKAN_RATE_LIMIT_MAX_WAIT_MS` | `5000` | Max wait before throwing RateLimitError |

Defaults are conservative: 5 rps is well under typical CKAN portal limits (usually 10–30 rps),
while burst=10 allows a quick series of initial queries without noticeable delay.

## Error Type

```ts
export class RateLimitError extends Error {
  constructor(hostname: string, waitMs: number) {
    super(`Rate limit exceeded for ${hostname}: would need to wait ${waitMs}ms`);
    this.name = 'RateLimitError';
  }
}
```

Tools catch this as a generic `Error` and surface it to the MCP client via the standard
error response — no special handling needed.

## Open Questions

- Should `rps` be overridable per-hostname via a JSON env var
  (e.g. `CKAN_RATE_LIMIT_OVERRIDES={"data.europa.eu":1}`)? Useful but adds parsing complexity.
  Defer to a follow-up.
- Should the limiter log a warning when it blocks (vs throws)? Useful for telemetry.
  Low cost, likely worth adding.
