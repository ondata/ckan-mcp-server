#!/usr/bin/env bash
# Aggregate worker_events_flat.jsonl by day and write worker_daily_calls.jsonl.
# Fully recomputed each run (safe: flat file is append-only + deduped upstream).
# Output: data/worker_daily_calls.jsonl  (one JSON object per line, sorted by date)

set -euo pipefail

INPUT="data/worker_events_flat.jsonl"
OUTPUT="data/worker_daily_calls.jsonl"

if [[ ! -s "$INPUT" ]]; then
  echo "No input data found at $INPUT — skipping."
  exit 0
fi

# Explicit columns: a key missing from every line (error_kind, before the archiver
# first wrote it) reads as NULL instead of failing the bind.
duckdb -c "
  COPY (
    SELECT
      strftime(timestamp::TIMESTAMP, '%Y-%m-%d') AS date,
      count(*)                                                   AS calls,
      -- 'ok' means 'did not come back as an error', not a runtime confirmation:
      -- the API stopped exposing outcome on 2026-07-12 (see scripts/README.md)
      count(*) FILTER (WHERE NOT is_error)                       AS ok,
      count(*) FILTER (WHERE is_error AND NOT is_invalid)        AS errors,
      -- Rejected before any portal was contacted: mostly scanners sending dozens of
      -- tools in the same second with server_url '', 'test', '{not:a string}'.
      -- Counted apart so 'errors' measures failures on real portals.
      count(*) FILTER (WHERE is_error AND is_invalid)            AS invalid_input
    FROM (
      SELECT
        timestamp,
        -- outcome only covers events up to 2026-07-12 (the field then vanished
        -- from the API); error stays populated across the whole history and also
        -- catches application errors that the runtime reported as ok
        error IS NOT NULL
          OR coalesce(outcome IN ('exception', 'exceededCpu', 'canceled', 'error'), false)
          AS is_error,
        -- coalesce: a runtime crash can carry no tool and no server (the March 2026
        -- 'Stateless transport' errors), and a NULL here would drop the call from
        -- both errors and invalid_input
        coalesce(CASE
          -- logged since v0.4.133
          WHEN error_kind IS NOT NULL THEN error_kind IN ('validation', 'not_allowed')
          -- older lines: infer it from the server value
          -- ckan_find_portals takes no server, so an empty one is not bad input there
          WHEN srv = '' THEN tool LIKE 'ckan_%' AND tool <> 'ckan_find_portals'
          ELSE NOT regexp_matches(srv, '^https?://')
            OR regexp_matches(srv, '^https?://([^/]*\\.)?example\\.(com|org|net)([:/]|\$)')
        END, false) AS is_invalid
      FROM (
        SELECT *, trim(coalesce(server::VARCHAR, ''), '\"') AS srv
        FROM read_json('$INPUT', format='newline_delimited', columns={
          timestamp: 'VARCHAR', tool: 'VARCHAR', outcome: 'VARCHAR', error: 'VARCHAR',
          server: 'JSON', error_kind: 'VARCHAR'
        })
      )
    )
    GROUP BY 1
    ORDER BY 1
  ) TO '${OUTPUT}' (FORMAT JSON)
"

echo "Done. $(wc -l < "$OUTPUT") daily records written to $OUTPUT"
