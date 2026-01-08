# Change: Add MCP Resource Templates

## Why

MCP has two primitives for exposing data: **Tools** (functions) and **Resources** (data). Currently we only expose tools. Adding resources enables:

1. Direct data access without tool calls
2. Native caching and subscription support
3. Better LLM context injection
4. Alignment with MCP best practices (see Data.gov MCP server pattern)

## What Changes

- Add MCP Resource Templates using RFC 6570 URI syntax
- Implement `ckan://` URI scheme for dataset and resource access
- Create new module `src/resources/` for resource handlers
- Register resources alongside existing tools

**New URI templates**:
- `ckan://{server}/dataset/{id}` - Dataset metadata
- `ckan://{server}/resource/{id}` - Resource metadata and download URL
- `ckan://{server}/organization/{name}` - Organization details

## Impact

- Affected specs: New capability `mcp-resources`
- Affected code:
  - `src/index.ts` - import and register resources
  - `src/resources/` - new directory with resource handlers
  - `src/utils/http.ts` - may need minor adjustments
- No breaking changes to existing tools
- Dependencies: No new dependencies required

## Benefits

| Aspect | Current (Tools) | With Resources |
|--------|-----------------|----------------|
| Data access | Tool call required | Direct read |
| Caching | Manual | MCP native |
| Subscriptions | Not supported | Supported |
| Context loading | Via tool results | Direct injection |

## Risks

- **URI parsing complexity**: Need to handle `ckan://` scheme correctly
- **Error handling**: Different pattern than tools
- **Testing**: New test patterns needed for resources

## References

- [MCP Resources Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [Data.gov MCP Server](https://skywork.ai/skypage/en/unlocking-government-data-mcp-server/1980445961155629056) - uses `datagov://` scheme
