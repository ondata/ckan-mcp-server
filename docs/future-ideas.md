# Future Ideas

Ideas and enhancements for CKAN MCP Server, collected from analysis and external inspiration.

## Beyond 1:1 API Mapping — User Journey Tools (2026-05-02)

Source: David Soria Parra (MCP co-creator) at AI Engineer summit.

The core insight: MCP servers should be **products**, not REST wrappers.
Instead of exposing low-level API calls (e.g., `organization_list`, `tag_list`),
design tools around the real questions users want to answer.

### Examples of user journey tools for CKAN

Standard CKAN API always exposes: metadata, organizations, groups, tags, facets, resource formats,
`metadata_modified`, declared update frequency. DataStore (schema + row queries) is optional and
often absent (e.g., dati.gov.it). Download counts are not available in CKAN core.

**High applicability** (standard CKAN API is sufficient):

- "How fresh is the data published by organization Y?" → compare `metadata_modified` against
  declared frequency for every dataset in an org; flag stale ones
- "What is the thematic coverage of a portal?" → aggregate groups, tags, facets into a topic map
- "Which organizations are most active on topic X?" → faceted search by theme + org ranking
- "Find all machine-readable datasets on topic X" → filter by format (CSV, JSON, GeoJSON, XLSX)
  and rank by recency

**Partial applicability** (requires DataStore, not always available):

- "Can I query this dataset directly?" → check `datastore_active` flag on resources, return
  schema + sample rows when available
- "Are datasets from city X and national level compatible for joining?" → compare DataStore
  schemas for field overlap; only works when both have DataStore enabled

**Cross-portal** (feasible, requires querying multiple portals):

- "What comparable datasets exist on topic X across multiple portals?" → parallel search on
  known portals, deduplicate by title similarity; no native CKAN dedup signal

**Not applicable** (data not in standard CKAN API):

- "Most downloaded datasets" → CKAN does not expose download counts via API

### Principle

Each tool should answer a question a data analyst would actually ask,
not mirror a single CKAN API endpoint. Tools can internally call multiple
CKAN endpoints and synthesize the result.

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

> **⚠️ Not applicable for Cloudflare Workers deployment**: Workers have a 128MB memory cap, CPU time limits, and no filesystem access. In-process file download and parsing is not viable in that runtime. This feature would only work in the Node.js (stdio/HTTP) deployment.

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

## Cloudflare Worker Telemetry Archiver (2026-03-03)

Script Python per scaricare e archiviare in JSONL gli eventi di telemetria del Worker Cloudflare.
Usa l'API Observability di Cloudflare con paginazione e stato tra esecuzioni.

**File di riferimento**: `tmp/worker_telemetry_archiver.py`

```python
import requests, json, time
from datetime import datetime
from pathlib import Path

ACCOUNT_ID = "c89b6bdafbbb793bf64cfa3b271fa5a4"
API_TOKEN = "TUO_API_TOKEN"  # crea da dash.cloudflare.com/profile/api-tokens
OUTPUT_FILE = "worker_events.jsonl"
STATE_FILE = "last_run.json"

def get_last_run():
    if Path(STATE_FILE).exists():
        with open(STATE_FILE) as f:
            return json.load(f)["last_run_ts"]
    return int(time.time()) - 86400  # Prima esecuzione: ultime 24 ore

def save_last_run(ts):
    with open(STATE_FILE, "w") as f:
        json.dump({"last_run_ts": ts}, f)

def fetch_events(from_ts, to_ts):
    url = f"https://api1.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/observability/telemetry/query"
    headers = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}
    all_events, offset = [], None
    while True:
        body = {
            "timeframe": {"from": from_ts, "to": to_ts},
            "view": "events",
            "limit": 2000,
            "parameters": {
                "filters": [{"key": "$metadata.type", "operation": "eq", "value": "cf-worker"}],
                "filterCombination": "and",
                "orderBy": {"value": "timestamp", "order": "asc"}
            }
        }
        if offset:
            body["offset"] = offset
        resp = requests.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
        events = data.get("result", {}).get("events", [])
        all_events.extend(events)
        next_offset = data.get("result", {}).get("nextOffset")
        if not next_offset or len(events) == 0:
            break
        offset = next_offset
    return all_events

def run():
    now_ts = int(time.time())
    from_ts = get_last_run()
    events = fetch_events(from_ts, now_ts)
    if events:
        with open(OUTPUT_FILE, "a") as f:
            for event in events:
                f.write(json.dumps(event) + "\n")
    save_last_run(now_ts)

if __name__ == "__main__":
    while True:
        run()
        time.sleep(86400)
```

**Note**:
- Endpoint: `https://api1.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/observability/telemetry/query`
- Token: crea da `dash.cloudflare.com/profile/api-tokens` con permesso `Workers Observability`
- Salva stato in `last_run.json` per evitare duplicati tra esecuzioni
- Output JSONL: un evento per riga, facilmente analizzabile con `duckdb` o `jq`

---

## Plugin Architecture (2026-04-09)

Source: https://github.com/okfn/mcp-ckan

OKFN's mcp-ckan is a plugin framework with no built-in tools — tools are loaded at runtime from external Python packages via `mcp_ckan` entry points. The server starts empty; users must install plugins separately. As of 2026-04, no public plugins exist.

Our approach is opposite: all tools are built-in and ready at first start. A plugin system would let third parties extend the server without modifying core code.

### Possible plugin categories

**Domain-specific tools**
- `ckan-mcp-plugin-budget` — tools for budget/financial datasets (chapters, annual comparisons)
- `ckan-mcp-plugin-geo` — spatial analysis on GeoJSON/Shapefile resources
- `ckan-mcp-plugin-ambiente` — environmental indicators, air/water time series

**Portal-specific extensions**
- `ckan-mcp-plugin-datigovit` — dati.gov.it extras (HVD, DCAT-AP_IT, EUDP themes)
- `ckan-mcp-plugin-dataeuropa` — native SPARQL + MQA quality integration
- `ckan-mcp-plugin-opencanada` — EN/FR bilingualism, Canada-specific filters

**Cross-cutting features**
- `ckan-mcp-plugin-compare` — compare datasets across different portals
- `ckan-mcp-plugin-monitor` — track changes (new/removed/updated datasets)
- `ckan-mcp-plugin-export` — export to specific formats (Excel, GeoPackage)

### Design considerations

- Keep core tools built-in (current approach works well)
- Plugins as optional add-ons, not a replacement for core
- Entry point pattern (like OKFN) or simpler file-based discovery
- Risk: building infrastructure nobody uses (OKFN lesson)

---

## Progressive Disclosure / Code Mode (2026-04-14)

Source: https://blog.cloudflare.com/enterprise-mcp/

Cloudflare's enterprise MCP post describes "Code Mode": collapsing 52 tools into 2 generic portals, achieving ~94% token reduction in context window usage. For clients with limited context windows or many tools loaded, this matters.

### Idea: `ckan_query` generic tool

A single tool that accepts any CKAN `action` + raw `params` dict, replacing the 20+ specific tools:

```typescript
ckan_query({
  server_url: "https://www.dati.gov.it/opendata",
  action: "package_search",
  params: { q: "ambiente", rows: 5 }
})
```

**Benefits**:
- Schema is 3 fields vs 15–20 per tool — minimal context footprint
- Covers every CKAN API action, including ones not explicitly implemented
- Ideal for power users and agents that already know the CKAN API

**Tradeoffs**:
- Loses per-tool input validation (Zod schemas), documentation, and examples
- LLM must know CKAN API action names and parameter structure without hints
- No tool-level output formatting (would return raw JSON)

**Possible approach**: ship both — keep specific tools for guided use, add `ckan_query` as an escape hatch for advanced cases. Clients that need minimal context can expose only `ckan_query`.

**Implementation complexity**: Low (~50 lines) — thin wrapper around `makeCkanRequest`.

---

## Backlog Priority

1. ~~**High**: MCP Resource Templates~~ ✅ Done (v0.3.0)
2. ~~**Medium**: `ckan_tag_list`, `ckan_group_list/show`~~ ✅ Done (v0.4.3)
3. **High**: DataStore Table Viewer (MCP Apps interactive UI)
4. **Medium**: Portal presets, audit tool, insight tools
5. **Medium**: Auto Chart from DataStore, Search Results Card View
6. **Low**: Caching, authentication, config options, MQA Scorecard UI
