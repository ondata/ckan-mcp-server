#!/usr/bin/env bash
# Fetch daily npm download counts for ckan-mcp-server.
# - Normal run: fetches yesterday's count (append if not already present).
# - First run / backfill: fetches the last 7 days individually.
# Output: data/npm_downloads.jsonl  (one JSON object per line, sorted by date)

set -euo pipefail

PACKAGE="@aborruso/ckan-mcp-server"
OUTPUT="data/npm_downloads.jsonl"
BACKFILL_DAYS=7

# Ensure output file exists
touch "$OUTPUT"

# Collect dates already recorded
recorded_dates() {
  if [[ -s "$OUTPUT" ]]; then
    jq -r '.date' "$OUTPUT"
  fi
}

# Fetch downloads for a single date (YYYY-MM-DD) and append if not already recorded
fetch_day() {
  local date="$1"

  # Skip if already recorded
  if recorded_dates | grep -qx "$date"; then
    echo "  already recorded: $date — skip"
    return
  fi

  local url="https://api.npmjs.org/downloads/point/${date}:${date}/${PACKAGE}"
  local response
  response=$(curl -sf "$url") || { echo "  warning: failed to fetch $date"; return; }

  local downloads
  downloads=$(echo "$response" | jq -r '.downloads // 0')

  echo "{\"date\":\"${date}\",\"downloads\":${downloads}}" >> "$OUTPUT"
  echo "  fetched: $date → $downloads downloads"
}

# Build list of dates to process: yesterday + backfill if needed
yesterday=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)

recorded_count=$(recorded_dates | wc -l | tr -d ' ')

if [[ "$recorded_count" -eq 0 ]]; then
  echo "First run — backfilling last ${BACKFILL_DAYS} days..."
  for i in $(seq $((BACKFILL_DAYS - 1)) -1 0); do
    day=$(date -u -d "${yesterday} -${i} days" +%Y-%m-%d 2>/dev/null \
          || date -u -v-${i}d -jf "%Y-%m-%d" "$yesterday" +%Y-%m-%d)
    fetch_day "$day"
  done
else
  echo "Fetching yesterday (${yesterday})..."
  fetch_day "$yesterday"
fi

# Sort file by date ascending
tmp=$(mktemp)
jq -sc 'sort_by(.date) | .[]' "$OUTPUT" > "$tmp"
mv "$tmp" "$OUTPUT"

echo "Done. Total records: $(wc -l < "$OUTPUT")"
