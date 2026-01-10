# Change: Add ckan_dataset_insights tool

## Why
Users want a single call that returns ranked datasets plus freshness and structure insights.

## What Changes
- Add MCP tool `ckan_dataset_insights` as a wrapper.
- Combine outputs from `ckan_find_relevant_datasets`, `ckan_analyze_dataset_updates`, and `ckan_analyze_dataset_structure`.
- Provide compact summary per dataset.

## Impact
- Affected specs: `ckan-insights`
- Affected code: new insights module orchestrating existing tools

## Open Questions
- Default number of datasets to enrich?
- Should structure analysis be optional for non-DataStore resources?
