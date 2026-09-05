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

duckdb -c "
  COPY (
    SELECT
      strftime(timestamp::TIMESTAMP, '%Y-%m-%d') AS date,
      count(*)                                                   AS calls,
      -- 'ok' means 'did not come back as an error', not a runtime confirmation:
      -- the API stopped exposing outcome on 2026-07-12 (see scripts/README.md)
      count(*) FILTER (WHERE NOT is_error)                       AS ok,
      count(*) FILTER (WHERE is_error)                           AS errors
    FROM (
      SELECT
        timestamp,
        -- outcome only covers events up to 2026-07-12 (the field then vanished
        -- from the API); error stays populated across the whole history and also
        -- catches application errors that the runtime reported as ok
        error IS NOT NULL
          OR coalesce(outcome IN ('exception', 'exceededCpu', 'canceled', 'error'), false)
          AS is_error
      FROM read_json('$INPUT', format='newline_delimited')
    )
    GROUP BY 1
    ORDER BY 1
  ) TO '${OUTPUT}' (FORMAT JSON)
"

echo "Done. $(wc -l < "$OUTPUT") daily records written to $OUTPUT"
