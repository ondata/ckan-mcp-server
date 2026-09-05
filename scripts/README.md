# scripts/

Service scripts for the CKAN MCP Server project.

## worker_telemetry_archiver.py

Fetches Cloudflare Worker telemetry events via the Observability API and appends them to
`data/worker_events_flat.jsonl`. The raw payload is never persisted: fetch → flatten →
dedup by event id → rewrite, all in memory.

Each run:
1. Fetches events since the last run (incremental, state in `data/worker_telemetry_last_run.json`)
2. Uses 24h chunks to avoid API downsampling
3. Filters server-side on `$metadata.type = cf-worker` **and** `$metadata.service = ckan-mcp-server`
4. Drops GET probes (MCP client health checks, no tool involved)
5. Merges with existing data, deduplicates by event id, sorts by timestamp asc

**Requirements**: `CF_API_TOKEN` env var or in `.env`. Free plan: 3-day retention. Paid: 7 days.
Optional: `CF_ACCOUNT_ID`, `CF_SCRIPT_NAME` (defaults to `ckan-mcp-server`).

```bash
# Incremental update (default: since last run)
python3 scripts/worker_telemetry_archiver.py

# First run: backfill N days (max 7 paid, 3 free)
python3 scripts/worker_telemetry_archiver.py --backfill-days 3

# Daemon mode: loop every 24h
python3 scripts/worker_telemetry_archiver.py --daemon
```

### Output fields

| field | source | notes |
|---|---|---|
| `id` | `$metadata.id` | unique event id |
| `timestamp` | `timestamp` | ISO 8601 UTC |
| `outcome` | `$workers.outcome`, else `source.status`, else `$metadata.level` | `unknown` when none is conclusive |
| `tool` | `source.tool` | MCP tool name |
| `server` | `source.server` | CKAN portal URL, verbatim as the caller passed it |
| `query` | `source.q` / `source.query` / `source.id` / `source.pattern` / `source.sql` | unified search term |
| `error` | `$metadata.error` | application-level error, null if none |
| `script_version` | `$workers.scriptVersion.id` | Worker version, to tie an error to a release |
| `request_id` | `$metadata.requestId` | correlates events of the same request |
| `trigger` | `$metadata.trigger` | e.g. `POST /mcp` |
| `cache_hit` | `source.cache_hit` | null on runtime crashes (no application log) |
| `duration_ms` | `source.duration_ms` | end-to-end, measured by the Worker |
| `limit` | `source.limit` | page size the caller asked for |

`outcome` is resolved from the most reliable source available, in this order:

1. `$workers.outcome` — the runtime verdict (`ok` / `exception` / `exceededCpu` /
   `canceled`). Available up to 2026-07-12 only.
2. `source.status` — written by the Worker itself (`src/worker.ts`) after inspecting the
   MCP response. Catches application errors, which the runtime still counts as `ok`.
3. `$metadata.level` — the only signal left for crashes that never reach the application
   log (CPU limit, exception), where `source.status` is absent.
4. `unknown` — none of the three. Never assumed to be `ok`.

`outcome` and `error` remain distinct: `error` is the logged message. A request can be
`ok` and still carry one (167 events in March 2026: the Worker returned a response, the
MCP layer had failed).

### Known gaps in the archived data

- **`outcome` is null between 2026-07-12 and 2026-09-05.** Cloudflare stopped returning
  `$workers.outcome` (the object now carries `spanId`/`traceId` instead). The archiver
  falls back to `$metadata.level`, which only tells `error` from everything else, so
  those two months have no runtime outcome and cannot be backfilled: retention is 3 days.
  From 2026-09-05 the gap is closed forward by `source.status`, which the Worker has been
  logging all along and the archiver was discarding: on a 47-event live sample it resolved
  every record (40 `ok`, 7 `error`, no `unknown`). The July-September records stay null;
  `ok` there is not a claim the archive can support, so do not filter on `outcome = 'ok'`
  across that window.
- **May-July 2026 contains 589 `sdmx_*` events from another Worker** on the same
  Cloudflare account (`opensdmx-mcp`). The query filtered only on `$metadata.type`. Fixed
  on 2026-09-05; the existing records are not recoverable, filter them out when analysing
  (`tool NOT LIKE 'sdmx%'`).
- **March 2026 is dominated by evaluation runs** (2.953 calls and 242 distinct portals,
  against ~70 portals a month afterwards). It is benchmark traffic, not usage.
- `data/worker_events.jsonl`, the raw archive, is no longer written: 7e78b32 (2026-03-24)
  untracked it and moved to the in-memory flow. A ~12 MB copy frozen at that date may
  still sit in a local checkout; it is gitignored and safe to delete.

## worker_daily_stats.sh

Aggregates `worker_events_flat.jsonl` by day into `data/worker_daily_calls.jsonl`
(`date`, `calls`, `ok`, `errors`). Fully recomputed each run.

An event counts as an error when `error` is set or `outcome` is one of `exception`,
`exceededCpu`, `canceled`, `error` — so the count stays valid across the July 2026
schema change.

```bash
bash scripts/worker_daily_stats.sh
```

## smoke.mjs — the release gate

`npm run smoke` runs the known-answer cases in `tests/smoke/cases.json` against live
portals and exits non-zero on the first failed assertion. `npm run smoke -- lecce` runs
only the cases whose name matches.

Every case asserts **which** dataset comes back, not how many, and carries a `regression`
field naming the failure it guards. That distinction is the reason the file exists:
v0.4.122 shipped with result counts verified and the ranking broken, because a query
returning 679 datasets and a query returning the right one first are different claims.

The gate is checked against the defects it claims to catch. Reintroducing the v0.4.121
wrapping rule fails 4 of the 12 cases; removing the parser probe from
`ckan_find_relevant_datasets`, the v0.4.122 regression, fails the case that requires the
two search tools to agree.

Cases hit real portals, so the thresholds are loose enough to survive catalog drift and
a failure can also mean a portal is down — check the message before assuming a code bug.

```bash
npm run build && npm run smoke
```

## GitHub Actions

`update-telemetry.yml` runs both scripts automatically twice a day (06:00 and 18:00 UTC).
Requires the `CF_API_TOKEN` repository secret.
