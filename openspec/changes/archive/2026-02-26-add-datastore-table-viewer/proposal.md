# Change: Add DataStore Table Viewer (MCP Apps interactive UI)

## Why

`ckan_datastore_search` returns static text. Users who want to sort, filter, or paginate must re-issue the tool call with different parameters. MCP Apps (January 2026) allows tools to return interactive UI components rendered directly in the conversation, making data exploration self-contained.

## What Changes

- `ckan_datastore_search` adds `_meta.ui.resourceUri` to its response when an interactive client is detected
- A new HTML/JS UI asset is served at a static URI, rendering the data as a sortable, filterable, paginated table
- The UI calls `ckan_datastore_search` back via MCP JSON-RPC when the user changes sort/filter/page — no new tool call from the user required
- No change to the text/markdown output path; non-UI clients are unaffected

## Impact

- Affected specs: `datastore-table-viewer` (new capability)
- Affected code: `src/tools/datastore.ts`, new `src/ui/datastore-table.html`
- Non-breaking: existing JSON/markdown behavior preserved
