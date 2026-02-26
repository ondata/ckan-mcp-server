## Context

MCP Apps is an MCP extension (January 2026) that lets tools attach a `_meta.ui.resourceUri` to any response. The MCP client loads that URI in a sandboxed iframe and enables bidirectional JSON-RPC between the UI and the MCP server.

This is a new architectural pattern for this project: the first tool to return a UI resource alongside data. The design must work across all three transports (stdio, HTTP, Cloudflare Workers).

## Goals / Non-Goals

- Goals:
  - Interactive table for `ckan_datastore_search` results (sort, filter, paginate without re-prompting)
  - Non-breaking: clients that don't support MCP Apps see unchanged text output
  - Single self-contained HTML file for the UI asset (no build step, no framework)
  - Works in stdio, HTTP, and Workers transports

- Non-Goals:
  - Charts or visualizations (separate future idea)
  - Editing data (CKAN DataStore is read-only via public API)
  - Supporting `ckan_datastore_search_sql` in this change

## Decisions

- **UI asset delivery**: Serve the HTML file as a static MCP Resource (`src/ui/datastore-table.html`). The URI pattern is `ckan-ui://datastore-table`. The MCP SDK handles resource serving; no separate HTTP server needed.
- **Single HTML file**: Inline CSS and JS, no external dependencies. Simon Willison pattern — keeps it auditable and avoids CDN latency inside iframes.
- **Client-side filtering only for small pages**: For large datasets, re-call the tool via JSON-RPC. Threshold: if total records ≤ 500 use client-side; otherwise call tool for each sort/filter/page.
- **Detecting UI-capable client**: Check MCP protocol negotiation for `experimental.mcpApps` capability. If absent, skip `_meta.ui.resourceUri`.
- **Column type inference**: Scan first 20 rows to detect numeric/date/string columns. Numeric columns sort numerically, dates sort chronologically, strings lexicographically.

## Risks / Trade-offs

- **Client support is still limited** → Mitigation: graceful degradation; text output always present.
- **Iframe sandboxing** restricts some browser APIs → The UI uses only postMessage + basic DOM, no localStorage or fetch (tool calls via JSON-RPC instead).
- **Workers serving static assets** requires binding a KV or inline asset → Use inline HTML string in `worker.ts` for Workers transport; file read for Node.js.

## Open Questions

- Should sort/filter state reset on each new `ckan_datastore_search` call, or persist in the UI session?
- Should the table offer a "Download as CSV" button (client-side, from current page data only)?
