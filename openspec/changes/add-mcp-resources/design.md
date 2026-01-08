# Design: MCP Resource Templates

## Context

MCP protocol supports two primitives:
- **Tools**: Functions that perform actions (current implementation)
- **Resources**: Data that can be read directly (to be added)

The `@modelcontextprotocol/sdk` provides `server.registerResourceTemplate()` for dynamic resources with URI templates.

## Goals / Non-Goals

### Goals
- Expose CKAN data as MCP resources using `ckan://` URI scheme
- Support dataset, resource, and organization access
- Reuse existing `makeCkanRequest()` for CKAN API calls
- Maintain consistency with tool output formats

### Non-Goals
- Write operations (resources are read-only by design)
- Caching implementation (defer to future enhancement)
- Authentication support (public endpoints only, same as tools)
- Real-time subscriptions (defer to future enhancement)

## Decisions

### URI Scheme Design

**Decision**: Use `ckan://{server}/type/{id}` pattern

```
ckan://dati.gov.it/dataset/vaccini-covid
ckan://data.gov/resource/abc-123
ckan://demo.ckan.org/organization/sample-org
```

**Rationale**:
- Server in hostname position enables multi-server support
- Type in path makes intent clear
- ID as final segment matches REST conventions

**Alternatives considered**:
1. `ckan://dataset/{server}/{id}` - rejected: server as path segment is unusual
2. `ckan+https://{server}/...` - rejected: overly complex
3. Query parameters `ckan://data?server=...&id=...` - rejected: less readable

### Module Structure

**Decision**: Create `src/resources/` directory with one file per resource type

```
src/resources/
├── index.ts          # Export registerAllResources()
├── dataset.ts        # ckan://{server}/dataset/{id}
├── resource.ts       # ckan://{server}/resource/{id}
└── organization.ts   # ckan://{server}/organization/{name}
```

**Rationale**: Mirrors existing `src/tools/` structure for consistency.

### URI Parsing

**Decision**: Extract server from URI hostname, type and ID from path

```typescript
function parseResourceUri(uri: URL): { server: string; type: string; id: string } {
  const server = uri.hostname;
  const [, type, id] = uri.pathname.split('/');
  return { server: `https://${server}`, type, id };
}
```

**Rationale**: Simple parsing, assumes HTTPS (most CKAN servers use it).

### Response Format

**Decision**: Return JSON by default (no markdown option for resources)

**Rationale**:
- Resources are meant for programmatic access
- LLMs can interpret JSON directly
- Keeps implementation simple
- Tools still support markdown for interactive use

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| SDK API changes | Pin SDK version, test before updates |
| URI parsing edge cases | Validate URIs before processing |
| Large responses | Apply existing `CHARACTER_LIMIT` truncation |
| Server unreachable | Same error handling as tools |

## Migration Plan

1. Add resources alongside existing tools (no breaking changes)
2. Resources are additive - tools remain fully functional
3. No migration needed for existing users

## Implementation Sequence

1. Create `src/resources/` directory structure
2. Implement URI parsing utility
3. Implement dataset resource template
4. Implement resource resource template
5. Implement organization resource template
6. Register resources in `src/index.ts`
7. Add tests for resource handlers
8. Update documentation

## Open Questions

1. Should resources support `response_format` parameter like tools?
2. Should we add `ckan://{server}/search?q=...` for search results as resource?
3. How to handle CKAN servers that require `www.` prefix (e.g., dati.gov.it)?
