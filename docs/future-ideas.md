# Future Ideas

Ideas and enhancements for CKAN MCP Server, collected from analysis and external inspiration.

## From Data.gov MCP Server Analysis (2026-01-08)

Source: https://skywork.ai/skypage/en/unlocking-government-data-mcp-server/

## From openascot-ckan-mcp (2026-01-10)

Source: https://lobehub.com/it/mcp/openascot-ckan-mcp

### Portal presets and overrides

- Curated portal catalog with overrides (dataset URL templates, datastore alias, action transport).
- Optional init tool to select portal and store session metadata.

### Probe and audit tools

- Audit tool to probe API behavior and suggest overrides.
- Availability tool to list known portals and current selection.

### Insight tools

- Relevance scoring on title/notes/tags/org with top-N results.
- Update cadence analysis with stale alerts.
- Freshness check from MCP query vs declared frequency, warning that CKAN often exposes only metadata updates (resource description may change while data stays old).
- Structure summary with schema + null-rate (when DataStore enabled).
- Wrapper tool combining relevance + freshness + structure.

### Download helper

- Dataset download helper with MIME detection and local cache hints.

### 1. ~~MCP Resource Templates~~ ✅ IMPLEMENTED (v0.3.0)

Implemented in v0.3.0 with three resource templates:
- `ckan://{server}/dataset/{id}` - Dataset metadata
- `ckan://{server}/resource/{id}` - Resource metadata
- `ckan://{server}/organization/{name}` - Organization metadata

Extended with dataset filters:
- `ckan://{server}/group/{name}/datasets` - Datasets by group
- `ckan://{server}/organization/{name}/datasets` - Datasets by organization
- `ckan://{server}/tag/{name}/datasets` - Datasets by tag
- `ckan://{server}/format/{format}/datasets` - Datasets by resource format

### 2. Tool: `ckan_tag_list` (Medium Priority)

List and search tags on a CKAN server.

```typescript
ckan_tag_list({
  server_url: "https://dati.gov.it",
  query: "sanit",      // optional: filter by pattern
  all_fields: true,    // include tag metadata
  response_format: "markdown"
})
```

**CKAN API**: `tag_list`, `tag_show`

**Implementation complexity**: Low (~50 lines)

### 3. Tools: `ckan_group_list` + `ckan_group_show` (Medium Priority)

Groups are different from organizations in CKAN:
- **Organizations**: publishers (e.g., "Comune di Palermo")
- **Groups**: thematic categories (e.g., "Environment", "Transport")

```typescript
ckan_group_list({
  server_url: "https://dati.gov.it",
  all_fields: true,
  response_format: "markdown"
})

ckan_group_show({
  server_url: "https://dati.gov.it",
  id: "ambiente",
  include_datasets: true
})
```

**CKAN API**: `group_list`, `group_show`

**Implementation complexity**: Low-medium (~150 lines, similar to organization tools)

---

## From Project Evaluation (2026-01-08)

### Quick Wins

- [x] Remove `src/index-old.ts`
- [x] Standardize language to English throughout
- [x] Fix README project structure section

### Configuration

- [ ] Make `CHARACTER_LIMIT` configurable via env var
- [ ] Make date locale configurable

### Missing Features

- [x] Implement `ckan_datastore_search_sql`
- [ ] Add optional response caching with TTL
- [ ] Add CKAN API key authentication support

---

## Online Deployment with Cloudflare Workers

### Rationale

The server is **stateless and lightweight**:
- No database or persistent state
- Only HTTP calls to CKAN APIs
- All operations are read-only
- Each request is independent

**Cloudflare Workers** is the ideal platform:
- Free tier: 100k requests/day
- Native SSE (Server-Sent Events) support for MCP HTTP transport
- Global edge deployment (low latency worldwide)
- Zero cold starts
- Automatic HTTPS

### Alternative Platforms Considered

- **Railway**: Free tier $5/month credit - good for stateful apps, overkill for this
- **Fly.io**: Free tier 3 shared VMs - more infrastructure control than needed
- **Render**: Free tier with spin-down - not ideal for MCP availability

### Implementation Approach

1. **Adapt HTTP transport** for Workers environment:
   - Convert Express.js endpoint to Workers `fetch()` handler
   - Implement SSE streaming for MCP protocol

2. **Configuration**:
   - Use Workers environment variables for settings
   - Keep `wrangler.toml` minimal

3. **Testing**:
   - Use `wrangler dev` for local testing
   - Deploy to workers.dev subdomain first

4. **Example deployment**:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Configure Worker
cat > wrangler.toml << EOF
name = "ckan-mcp-server"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
EOF

# Deploy
wrangler deploy
```

5. **Worker adapter** (`src/worker.ts` - estimated ~80 lines):

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/mcp') {
      return new Response('Not Found', { status: 404 });
    }

    const server = new McpServer({ /* ... */ });
    registerAllTools(server);

    // Implement SSE streaming for MCP
    const { readable, writable } = new TransformStream();
    // ... MCP protocol handling

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
```

**Implementation complexity**: Medium (~100-150 lines total)
- Create worker.ts adapter
- Update build config for Workers output
- Test with wrangler dev
- Deploy and verify

**Deployment URL**: `https://ckan-mcp-server.<account>.workers.dev`

---

## MCP Apps Interactive UI (2026-02-20)

Source: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/

MCP Apps enables tools to return interactive UI components (sandboxed iframes) rendered directly in the conversation. Tools add `_meta.ui.resourceUri` to responses; the UI can call back tool methods via JSON-RPC.

Supported clients (claimed): Claude, ChatGPT, Goose, VS Code Insiders.

> **⚠️ Status (2026-02-20)**: Tested on Claude.ai — MCP Apps is NOT yet active in public clients. The `_meta.ui` field is silently ignored. Server-side implementation (v0.4.40) is complete and correct but effectively dormant. Retest when Anthropic announces public availability.

### DataStore Table Viewer (High Priority) — ~~IMPLEMENTED~~ v0.4.40, awaiting client support

`ckan_datastore_search` returns an interactive sortable/filterable/paginated table instead of plain text. Server-side done; blocked on client support.

**Target users**: data analysts, journalists, PA staff exploring tabular open data.

### Auto Chart from DataStore (Medium Priority)

After a DataStore query, auto-detect numeric + categorical/temporal columns and offer a bar/line/pie chart. Users choose axes without exporting to Excel.

**Target users**: analysts wanting quick visual insight on open data series.

### Search Results Card View (Medium Priority)

`ckan_package_search` results as interactive cards (name, org, format badges, date) with live client-side filters for format/org/year. Click a card to expand details via `ckan_package_show`.

**Target users**: researchers browsing many results to narrow down by format or publisher.

### MQA Quality Scorecard (Low Priority, dati.gov.it only)

Visual gauge/radar chart for the 4 MQA dimensions (accessibility, reusability, interoperability, findability) with a clickable list of failing flags.

**Target users**: PA open data managers checking and improving their dataset quality.

---

## Companion Skill for CKAN MCP Server (2026-02-23)

Source: https://www.mcpjam.com/blog/skills

Skills are context folders (a `SKILL.md` file) that teach an agent *how* to use a set of MCP tools.
Companies like Figma, Sentry, and Atlassian ship skills alongside their MCP servers.
The formula: **context (Skill) + tools (MCP) = real work**.

### Rationale

The CKAN MCP tools are powerful but non-obvious:
- Solr query syntax (`q`, `fq`, facets) has a learning curve
- Portal differences (datastore availability, custom fields) require tribal knowledge
- Multi-step workflows (search → show → datastore → analyze) are not self-evident

A companion skill would encode all this context so an agent can execute complex open-data workflows without user hand-holding.

### Proposed Skill: `ckan-explorer`

**Target workflows to encode**:

1. **Dataset discovery** — search by topic on a specific portal, rank by relevance + freshness, open best match
2. **Tabular data exploration** — find a DataStore-enabled resource, run `ckan_datastore_search`, summarize schema and sample rows
3. **Organization audit** — list datasets by organization, check update cadence, flag stale ones
4. **Solr cheat-sheet** — inline examples for common query patterns (wildcard, range, boolean, field-scoped)
5. **Portal-specific hints** — known quirks of dati.gov.it, data.gov, data.europa.eu

**Structure**:

```
skills/ckan-explorer/
└── SKILL.md        # workflow instructions + Solr cheat-sheet + portal notes
```

**Skill content outline**:
- When to use each tool (`ckan_package_search` vs `ckan_package_show` vs `ckan_datastore_search`)
- Step-by-step recipe for "find and analyze a dataset"
- Solr syntax quick reference with copy-paste examples
- Debugging tips (no results → broaden query; datastore empty → check `datastore_active`)
- Portal quirks section (dati.gov.it MQA fields, data.gov extras, etc.)

**Implementation complexity**: Low — pure documentation, no code.

**Distribution**: Publish alongside the MCP server in the same repo (or as a separate npm package mirroring Figma/Sentry pattern).

---

## From datagouv-mcp Analysis (2026-02-25)

Source: https://github.com/datagouv/datagouv-mcp

Python MCP server for data.gouv.fr with 10 tools. Interesting patterns and ideas:

### Workflow guidance in tool docstrings — IMPLEMENTED (v0.4.48)

Every tool docstring ends with "Typical workflow: tool_a → tool_b → tool_c".
Steers the LLM to use tools in the correct multi-step sequence. Zero code change, immediate improvement.

### `list_dataset_resources` as a separate tool

Separates "list resources in a dataset" from "get dataset metadata". Forces an explicit step where the LLM sees all formats, sizes, and DataStore availability before deciding how to access data.

- [ ] Add `ckan_list_resources` tool with format, size, DataStore flag, and URL summary

### `download_and_parse_resource` — direct file access fallback

When DataStore is not available, downloads and parses files in-process (CSV, JSON, JSONL, CSV.GZ). Streaming with size guard, automatic delimiter sniffing, BOM handling. Would dramatically expand what the server can do.

- [ ] Implement `ckan_download_resource` with CSV/JSON/JSONL support and size limits

### Stop-word query cleaning with fallback

Removes generic words ("données", "csv", "fichier") from search queries before querying. Falls back to original query if zero results. Useful because LLMs include descriptive words that break AND logic.

- [ ] Add format-related stop-word cleaning to `ckan_package_search` (strip "csv", "json", etc. from `q`, use in `fq` instead)

### Metrics / usage statistics

Monthly visits and downloads for datasets/resources. CKAN has `tracking_summary` in `package_show` — could expose it.

- [ ] Add `ckan_get_metrics` tool (where portal supports tracking)

### Health endpoint

`/health` with version and timestamp. Low-effort, good operational practice.

- [ ] Add `/health` endpoint to HTTP transport

### Page-based pagination alias

`page` + `page_size` instead of `start`/`rows`. More intuitive for LLMs.

- [ ] Add `page` alias parameter to `ckan_package_search`

---

## Backlog Priority

1. ~~**High**: MCP Resource Templates~~ ✅ Done (v0.3.0)
2. ~~**Medium**: `ckan_tag_list`, `ckan_group_list/show`~~ ✅ Done (v0.4.3)
3. **High**: DataStore Table Viewer (MCP Apps interactive UI)
4. **Medium**: Portal presets, audit tool, insight tools
5. **Medium**: Auto Chart from DataStore, Search Results Card View
6. **Low**: Caching, authentication, config options, MQA Scorecard UI
