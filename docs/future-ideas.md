# Future Ideas

Ideas and enhancements for CKAN MCP Server, collected from analysis and external inspiration.

## From Data.gov MCP Server Analysis (2026-01-08)

Source: https://skywork.ai/skypage/en/unlocking-government-data-mcp-server/

### 1. ~~MCP Resource Templates~~ ✅ IMPLEMENTED (v0.3.0)

Implemented in v0.3.0 with three resource templates:
- `ckan://{server}/dataset/{id}` - Dataset metadata
- `ckan://{server}/resource/{id}` - Resource metadata
- `ckan://{server}/organization/{name}` - Organization metadata

Remaining: `ckan://{server}/group/{name}` (see Groups tools below)

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

- [ ] Implement `ckan_datastore_search_sql` (mentioned in README)
- [ ] Add optional response caching with TTL
- [ ] Add CKAN API key authentication support

---

## Backlog Priority

1. ~~**High**: MCP Resource Templates~~ ✅ Done (v0.3.0)
2. **Medium**: `ckan_tag_list`, `ckan_group_list/show`, group resource template
3. **Low**: Caching, authentication, SQL queries, config options
