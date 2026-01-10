# Change: Add ckan_find_relevant_datasets tool

## Why
Ranked discovery helps surface the best datasets for a query without manual sorting.

## What Changes
- Add MCP tool `ckan_find_relevant_datasets` wrapping `package_search`.
- Score results using weighted fields (title, notes, tags, organization).
- Return top N datasets with score breakdown.

## Impact
- Affected specs: `ckan-insights`
- Affected code: `src/tools/package.ts` (or new insights module)

## Open Questions
- Default weights for title/notes/tags/organization?
- Default `limit` when omitted?
