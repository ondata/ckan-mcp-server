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

## Backlog Priority

1. ~~**High**: MCP Resource Templates~~ ✅ Done (v0.3.0)
2. ~~**Medium**: `ckan_tag_list`, `ckan_group_list/show`~~ ✅ Done (v0.4.3)
3. **Medium**: Portal presets, audit tool, insight tools
4. **Low**: Caching, authentication, config options
