# Data

This folder contains datasets collected automatically by scheduled workflows.

License: [CC BY-SA 4.0](LICENSE)

---

## npm_downloads.jsonl

Daily download counts for the [`@aborruso/ckan-mcp-server`](https://www.npmjs.com/package/@aborruso/ckan-mcp-server) npm package.

**Source**: [npm Downloads API](https://api.npmjs.org/downloads/point/{date}:{date}/@aborruso/ckan-mcp-server)
**Update**: daily at 04:00 UTC via `.github/workflows/update-npm-downloads.yml`
**Script**: `scripts/npm_downloads.sh`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `date` | string (YYYY-MM-DD) | Reference date |
| `downloads` | integer | Total downloads on that day |

**Example**:
```json
{"date":"2026-03-05","downloads":244}
```

---

## worker_events_flat.jsonl

Flattened log of tool invocations received by the [Cloudflare Workers](https://ckan-mcp-server.andy-pr.workers.dev) deployment.

**Source**: Cloudflare Workers Analytics API
**Update**: twice daily (06:00 and 18:00 UTC) via `.github/workflows/update-telemetry.yml`
**Script**: `scripts/worker_telemetry_flatten.py`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event ID (ULID) |
| `timestamp` | string (ISO 8601) | Event timestamp (UTC) |
| `outcome` | string | Request outcome (`ok`, `exception`, …) |
| `tool` | string | MCP tool name called |
| `server` | string | Target CKAN portal URL |
| `query` | string | Query or resource ID passed to the tool |
| `error` | string\|null | Error message if outcome is not `ok` |
| `fq` | string\|null | Solr filter query passed to the tool (since 2026-10-27) |
| `sort` | string\|null | Sort parameter passed to the tool (since 2026-10-27) |
| `result_count` | integer\|null | Total matches reported by the portal, `0` included. Only `ckan_package_search` and `ckan_find_relevant_datasets` (since 2026-10-27) |
| `result_start` | integer\|null | Offset of the first returned dataset in the ranking (`0` for `ckan_find_relevant_datasets`) |
| `result_ids` | string[]\|null | Ids of the returned datasets, in rank order, max 20. `[]` when `result_count` is `0`, `null` for other tools |
| `result_names` | string[]\|null | Names (slugs) of the same datasets, same order as `result_ids` |
| `error_message` | string\|null | First 200 characters of the error a failed tool call returned, on one line (since 2026-10-28) |
| `error_kind` | string\|null | Coarse class of that error: `validation`, `not_allowed`, `timeout`, `upstream_http`, `unreachable`, `other` |

**Example**:
```json
{"id":"01KK008CSRE7HHVW5D9B6Y8ZCB","timestamp":"2026-03-05T22:00:26Z","outcome":"ok","tool":"sparql_query","server":"","query":"SELECT ...","error":null}
```

---

## worker_daily_calls.jsonl

Daily aggregate of tool invocations from the Cloudflare Workers deployment. Fully recomputed from `worker_events_flat.jsonl` on each telemetry update.

**Source**: derived from `worker_events_flat.jsonl`
**Update**: twice daily (06:00 and 18:00 UTC) via `.github/workflows/update-telemetry.yml`
**Script**: `scripts/worker_daily_stats.sh`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `date` | string (YYYY-MM-DD) | Reference date |
| `calls` | integer | Total tool invocations |
| `ok` | integer | Successful invocations |
| `errors` | integer | Failed invocations on real portals |
| `invalid_input` | integer | Failed invocations rejected before any portal was contacted (since 2026-10-28): `error_kind` `validation` or `not_allowed`; on older lines inferred from `server` (not an http(s) URL, `example.com/org/net`, or empty for a `ckan_*` tool other than `ckan_find_portals`). `calls` = `ok` + `errors` + `invalid_input` |

**Example**:
```json
{"date":"2026-10-27","calls":209,"ok":135,"errors":11,"invalid_input":63}
```

---

## worker_telemetry_last_run.json

Timestamp of the last successful telemetry fetch, used by the archiver script to avoid re-fetching already-collected events.

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `last_run_ms` | integer | Unix timestamp in milliseconds of the last fetch |
