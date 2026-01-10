# Change: Add ckan_analyze_dataset_structure tool

## Why
Users need quick schema and quality signals without manual inspection.

## What Changes
- Add MCP tool `ckan_analyze_dataset_structure` for schema summaries.
- Use resource schema or DataStore fields for columns and types.
- Compute null-rate stats when DataStore is available.

## Impact
- Affected specs: `ckan-insights`
- Affected code: `src/tools/datastore.ts` and resource utilities

## Open Questions
- Default `sample_size` for null-rate analysis?
- How to select resource when only dataset id is provided?
