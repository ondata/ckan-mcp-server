# Future Ideas

Ideas and enhancements for CKAN MCP Server, collected from analysis and external inspiration.

## From Data.gov MCP Server Analysis (2026-01-08)

Source: https://skywork.ai/skypage/en/unlocking-government-data-mcp-server/

### 1. MCP Resource Templates (High Priority)

Add MCP Resources alongside tools. Resources allow clients to "read" data directly instead of calling tools.

**Proposed URI schemes**:

```
ckan://{server}/dataset/{id}
ckan://{server}/resource/{id}
ckan://{server}/organization/{name}
ckan://{server}/group/{name}
```

**Benefits**:
- More natural data access pattern for LLMs
- Enables subscription to resource updates
- Better integration with MCP ecosystem
- Progressive data retrieval

**Implementation complexity**: Medium-high (requires new architecture)

See detailed explanation below.

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

## MCP Resources - Detailed Explanation

### What are MCP Resources?

MCP has two main primitives for exposing data:

1. **Tools**: Functions that perform actions (what we have now)
2. **Resources**: Data that can be read directly (what we could add)

### Current approach (Tools only)

```
Client: "Get dataset info"
   ↓
Call tool: ckan_package_show({ server_url, id })
   ↓
Tool executes HTTP request
   ↓
Returns formatted response
```

### With Resources

```
Client: "Read ckan://dati.gov.it/dataset/vaccini-covid"
   ↓
Server returns dataset metadata directly
   ↓
No tool call needed, just resource read
```

### Resource Templates (RFC 6570)

Instead of static URIs, we define templates:

```typescript
server.registerResourceTemplate({
  uriTemplate: "ckan://{server}/dataset/{id}",
  name: "CKAN Dataset",
  description: "Access dataset metadata from any CKAN server",
  mimeType: "application/json"
});
```

The client can then construct URIs like:
- `ckan://dati.gov.it/dataset/vaccini-covid-19`
- `ckan://data.gov/dataset/climate-data`
- `ckan://demo.ckan.org/dataset/sample`

### Implementation Sketch

```typescript
// src/resources/dataset.ts

export function registerDatasetResources(server: McpServer) {
  // Template for dataset metadata
  server.registerResourceTemplate(
    {
      uriTemplate: "ckan://{server}/dataset/{id}",
      name: "CKAN Dataset",
      description: "Dataset metadata from a CKAN server",
      mimeType: "application/json"
    },
    async (uri, params) => {
      const { server, id } = params;
      const serverUrl = `https://${server}`;

      const result = await makeCkanRequest(
        serverUrl,
        'package_show',
        { id }
      );

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  // Template for resource file access
  server.registerResourceTemplate(
    {
      uriTemplate: "ckan://{server}/resource/{id}",
      name: "CKAN Resource",
      description: "Resource metadata and download URL",
      mimeType: "application/json"
    },
    async (uri, params) => {
      // Implementation...
    }
  );
}
```

### Benefits of Resources

| Aspect | Tools | Resources |
|--------|-------|-----------|
| Use case | Actions, queries | Data access |
| Caching | Manual | Built-in support |
| Subscriptions | Not supported | Supported |
| Discovery | List tools | List + templates |
| LLM context | Via tool results | Direct injection |

### Challenges

1. **URI parsing**: Need to extract server URL from `ckan://` scheme
2. **Error handling**: Different from tool errors
3. **Authentication**: May need per-server API keys
4. **Caching**: Should implement TTL for resource reads

---

## From Project Evaluation (2026-01-08)

### Quick Wins

- [x] Remove `src/index-old.ts`
- [x] Standardize language to English throughout
- [ ] Fix README project structure section

### Configuration

- [ ] Make `CHARACTER_LIMIT` configurable via env var
- [ ] Make date locale configurable

### Missing Features

- [ ] Implement `ckan_datastore_search_sql` (mentioned in README)
- [ ] Add optional response caching with TTL
- [ ] Add CKAN API key authentication support

---

## Backlog Priority

1. **High**: MCP Resource Templates
2. **Medium**: `ckan_tag_list`, `ckan_group_list/show`
3. **Low**: Caching, authentication, SQL queries
