# Change: Add ckan_analyze_dataset_updates tool

## Why
Users need quick insight on dataset freshness and update cadence.

## What Changes
- Add MCP tool `ckan_analyze_dataset_updates` for dataset freshness analysis.
- Combine `metadata_modified` and resource `last_modified` to estimate cadence.
- Flag stale datasets based on a configurable threshold.

## Impact
- Affected specs: `ckan-insights`
- Affected code: `src/tools/package.ts` and `src/tools/datastore.ts`

## Open Questions
- Default `stale_days` threshold?
- How to handle resources without `last_modified`?
