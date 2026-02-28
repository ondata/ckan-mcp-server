# Proposal: add-ckan-catalog-stats

## Why

Understanding a CKAN portal at a glance currently requires multiple calls or manual inspection.
A dedicated tool that returns total dataset count and breakdown by category, format, and organization
in one zero-parameter call gives an AI assistant immediate context about any portal.

The pattern uses `package_search` with `q=*:*&rows=0&facet.field=[...]` — a single cheap CKAN call.
`ckan_package_search` already supports `facet_field`, but requires the caller to know which fields
to facet on and to set `rows=0` manually. A dedicated tool makes this effortless.

Inspired by: `malkreide/zurich-opendata-mcp` `zurich_catalog_stats` pattern.

## What Changes

### New tool: `ckan_catalog_stats`

- Input: `server_url`, optional `facet_limit` (default 20)
- Hardcoded facet fields: `groups`, `res_format`, `organization`
- Single CKAN call: `package_search?q=*:*&rows=0&facet.field=[...]&facet.limit=N`
- Output: total dataset count + ranked breakdown by category, format, organization
- Format: markdown (default) or JSON

### Implementation

- Added to existing `src/tools/analyze.ts` (alongside `registerAnalyzeTools`)
- Registered in `src/server.ts`

## What Does NOT Change

- `ckan_package_search` unchanged
- No new files needed (extends `analyze.ts`)

## Unresolved Questions

- None.
