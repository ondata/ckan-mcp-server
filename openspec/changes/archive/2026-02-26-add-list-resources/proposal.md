# Change: Add `ckan_list_resources` tool

## Why

When an LLM calls `ckan_package_show`, it receives the full dataset metadata with resources embedded deep in the response. This makes it hard for the LLM to quickly assess which resources are available, what formats they use, and whether DataStore is enabled — before deciding which tool to call next.

A dedicated `ckan_list_resources` tool forces an explicit step where the LLM sees a focused summary of all resources (format, size, DataStore availability, URL) and can make an informed decision about how to access the data.

Inspired by datagouv-mcp's `list_dataset_resources` pattern (https://github.com/datagouv/datagouv-mcp).

## What Changes

- New tool `ckan_list_resources` in `src/tools/package.ts`
- Returns a compact summary of all resources in a dataset: name, format, size, DataStore flag, download URL
- Markdown output as a table for quick scanning; JSON for programmatic use
- Includes workflow guidance in docstring

## Impact

- Affected specs: `ckan-search` (new tool in the package/search capability)
- Affected code: `src/tools/package.ts` (new tool registration), tests
- No breaking changes — purely additive
