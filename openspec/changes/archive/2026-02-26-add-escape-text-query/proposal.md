# Change: Escape text-field query wrapping in search parser

## Why
Wrapping arbitrary user input in `text:(...)` without escaping allows query parser errors or unintended semantics when the input contains Solr/Lucene metacharacters (e.g., `"` or `)`).

## What Changes
- Escape Solr/Lucene special characters before wrapping user input in `text:(...)`.
- Add tests to confirm escaped output and prevent regressions.

## Impact
- Affected specs: `ckan-search`
- Affected code: `src/utils/search.ts`, package search tool behavior, related tests.
