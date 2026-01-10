# Change: Update CKAN search parser handling per portal

## Why
Some CKAN portals (notably dati.gov.it) use a default edismax parser with restrictive `mm` settings that breaks long OR queries. For those portals, the Lucene standard parser on the `text` field yields correct results.

## What Changes
- Add per-portal search configuration to `src/portals.json` to force `text:(...)` queries where needed.
- Add an optional tool override to force the text-field parser regardless of portal defaults.
- Update tool documentation to describe the behavior and override.

## Impact
- Affected specs: `ckan-insights`, new `ckan-search` capability
- Affected code: `src/portals.json`, `src/tools/package.ts`, `src/utils/*` (if new helper is added)
