# Architecture

This document explains how ckan-mcp-server works, for anyone who wants to understand or extend it.

## What it does

The server acts as a bridge between an MCP client (Claude, another AI agent, any MCP-compatible tool) and any [CKAN](https://ckan.org)-based open data portal. It translates MCP tool calls into CKAN API v3 HTTP requests and returns structured results.

```
MCP client  ←→  ckan-mcp-server  ←→  CKAN portal (HTTP API)
```

## Request flow

1. The client calls a tool, e.g. `ckan_package_search` with `server_url` and `q` parameters
2. The tool handler validates the input with Zod
3. `makeCkanRequest()` resolves the portal URL, builds the API endpoint, and fires an HTTP GET
4. The CKAN API responds with JSON (`{ success: true, result: ... }`)
5. The handler formats the result as Markdown or JSON and returns it to the client

## Source layout

```
src/
├── index.ts          # Entry point: picks transport (stdio or HTTP), starts server
├── worker.ts         # Alternative entry point for Cloudflare Workers
├── server.ts         # Creates McpServer instance, registers all tools/resources/prompts
├── types.ts          # Shared TypeScript types and Zod schemas
│
├── tools/            # One file per capability group
│   ├── package.ts    # ckan_package_search, ckan_package_show
│   ├── organization.ts
│   ├── datastore.ts  # ckan_datastore_search, ckan_datastore_search_sql
│   ├── group.ts
│   ├── tag.ts
│   ├── quality.ts    # MQA quality metrics
│   ├── analyze.ts    # ckan_analyze_datasets, ckan_catalog_stats
│   ├── sparql.ts
│   └── status.ts
│
├── resources/        # MCP Resource Templates (ckan:// URI scheme)
├── prompts/          # MCP Prompts (reusable prompt templates)
│
├── utils/
│   ├── http.ts       # makeCkanRequest() — the core HTTP client
│   ├── formatting.ts # truncateText(), formatDate(), formatBytes()
│   ├── portal-config.ts  # Portal-specific config lookup (portals.json)
│   ├── search.ts     # Query escaping and parsing
│   └── url-generator.ts  # Dataset/org URL generation
│
├── transport/
│   ├── stdio.ts      # For Claude Desktop and local MCP clients
│   └── http.ts       # For remote access (Docker, Cloudflare)
│
└── portals.json      # Known portals and their quirks
```

## Key patterns

### Adding a tool

Every tool follows the same pattern:

```typescript
server.tool("ckan_my_tool", "Description", { /* Zod schema */ }, async (args) => {
  const result = await makeCkanRequest(args.server_url, "action_name", { param: args.param });
  const text = args.format === "json" ? JSON.stringify(result) : renderMarkdown(result);
  return { content: [{ type: "text", text }] };
});
```

1. Create or open the relevant file in `src/tools/`
2. Define the Zod schema for inputs
3. Call `makeCkanRequest()` with the CKAN action name
4. Format the result (Markdown by default, JSON if requested)
5. Register the tool via `registerXxxTools(server)` and add it to `server.ts`

### Portal config (`portals.json`)

Some portals have non-standard API paths, custom URL formats, or require tweaked query parameters. `src/portals.json` captures these quirks. `portal-config.ts` resolves a URL to its config at runtime. If a portal has no entry, sensible defaults apply.

### Output formats

Every tool accepts a `format` parameter:
- `markdown` (default) — human-readable, with headers and tables
- `json` — compact object with only essential fields (~70% fewer tokens than raw CKAN output)

### Transport

The server runs in one of three modes, selected via the `TRANSPORT` environment variable:

| Mode | Value | Use case |
|------|-------|----------|
| stdio | (default) | Claude Desktop, local MCP clients |
| HTTP | `TRANSPORT=http` | Docker, remote access |
| Cloudflare Workers | (via `worker.ts`) | Global edge deployment |

## Build and test

```bash
npm run build   # Compile with esbuild (fast)
npm test        # Run all tests with Vitest
```

Tests live in `tests/`, mirroring the `src/` structure. Fixtures in `tests/fixtures/` mock CKAN API responses so tests run without network access.
