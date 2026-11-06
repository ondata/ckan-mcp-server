# Change: Add ckan_analyze_dataset_structure tool

> Abandoned, not implemented. `ckan_analyze_datasets` already returns the DataStore schema for search results, though not null rates. Archived on 2026-11-06 without updating the specs.

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
