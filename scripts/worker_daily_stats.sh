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
      count(*)                                   AS calls,
      count(*) FILTER (WHERE outcome = 'ok')     AS ok,
      count(*) FILTER (WHERE outcome != 'ok')    AS errors
    FROM read_json('$INPUT', format='newline_delimited')
    GROUP BY 1
    ORDER BY 1
  ) TO '${OUTPUT}' (FORMAT JSON)
"

echo "Done. $(wc -l < "$OUTPUT") daily records written to $OUTPUT"
