# MCP Best Practices Evaluation

Source: https://www.philschmid.de/mcp-best-practices

Date: 2026-01-27

## Summary

Analysis of CKAN MCP Server against 6 best practices from "MCP is Not the Problem, It's your Server: Best Practices for Building MCP Servers".

## Best Practices Overview

1. **Outcomes, Not Operations** - Design tools around user goals, not API operations
2. **Flatten Your Arguments** - Use top-level primitives, avoid nested objects
3. **Instructions are Context** - Docstrings and error messages are agent context
4. **Curate Ruthlessly** - Expose only what's needed, not everything (5-15 tools per server)
5. **Name Tools for Discovery** - Service-prefixed, action-oriented names (`{service}_{action}_{resource}`)
6. **Paginate Large Results** - Paginate with metadata (`has_more`, `next_offset`, `total_count`)

## Key Insights from Article

**MCP is a User Interface for AI Agents**, not a REST API wrapper:

- **Discovery**: Expensive for agents (schema in every request) vs cheap for humans (read docs once)
- **Composability**: Multi-step tool calls are slow vs fast for humans
- **Flexibility**: Too many options lead to hallucination vs helpful for humans

**Example: Order Tracking**

❌ Bad (operation-focused):
- `get_user_by_email()`
- `list_orders(user_id)`
- `get_order_status(order_id)`

✅ Good (outcome-focused):
- `track_latest_order(email)` - one call, orchestration in server code

**Token Economics**:
- Every tool description competes in context window
- Agents operate under tight context constraints
- Build for discovery, not exhaustive exposure

## Current Status

### ✅ Best Practice 1: Outcomes, Not Operations

**Status**: Mostly adheres

**Positive**:
- `ckan_find_relevant_datasets` - outcome-focused (find datasets by relevance)
- `ckan_organization_search` - simplified pattern-based search
- `ckan_get_mqa_quality` - high-level quality assessment

**Needs improvement**:
- `ckan_package_search` exposes raw Solr syntax (operation-focused)
- `ckan_datastore_search_sql` requires SQL knowledge (operation-focused)

**Recommendation**: Consider adding higher-level tools like:
- `ckan_find_datasets_by_topic` (natural language → Solr query)
- `ckan_analyze_dataset_quality` (automated quality checks)
- `ckan_compare_organizations` (compare stats between orgs)

**Practical Example: Dataset Discovery**

Current approach (operation-focused):
1. Agent calls `ckan_package_search(q="transport", rows=10)`
2. Parses 10 datasets with full metadata
3. Calls `ckan_package_show(id=...)` for each interesting dataset
4. Calls `ckan_get_mqa_quality(dataset_id=...)` for quality check

Improved approach (outcome-focused):
- `ckan_discover_datasets(topic="transport", include_quality=true, limit=5)`
  - Returns: top 5 datasets by relevance with quality scores
  - Orchestration happens server-side
  - One tool call instead of 10+

### ✅ Best Practice 2: Flatten Your Arguments

**Status**: Excellent adherence

**Evidence**:
- All tools use flat, top-level arguments
- Zod schemas with `.strict()` validation
- No nested configuration objects
- Simple types: `server_url: string`, `limit: number`, `q: string`

**Example from `ckan_datastore_search`**:
```typescript
inputSchema: z.object({
  server_url: z.string().url(),
  resource_id: z.string().min(1),
  q: z.string().optional(),
  filters: z.record(z.any()).optional(),  // Only exception
  limit: z.number().int().min(1).max(32000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
  fields: z.array(z.string()).optional(),
  sort: z.string().optional(),
  distinct: z.boolean().optional().default(false),
  response_format: ResponseFormatSchema
}).strict()
```

**Note**: `filters` parameter is the only nested object, but it's optional and simple (key-value pairs).

### ✅ Best Practice 3: Instructions are Context

**Status**: Good, with room for improvement

**Positive**:
- Detailed docstrings in every tool
- Clear parameter descriptions with examples
- Solr query syntax documented inline
- Error messages include context

**Example from `ckan_package_search`**:
```typescript
description: `Search for datasets (packages) on a CKAN server using Solr query syntax.

Supports full Solr search capabilities including filters, facets, and sorting.
Use this to discover datasets matching specific criteria.

Args:
  - server_url (string): Base URL of CKAN server (e.g., "https://dati.gov.it/opendata")
  - q (string): Search query using Solr syntax (default: "*:*" for all)
  ...
Query Syntax (parameter q):
  Boolean operators:
    - AND / &&: "water AND climate"
    - OR / ||: "health OR sanità"
    ...
`
```

**Needs improvement**:
- Add more inline examples in descriptions
- Include common pitfalls in docstrings
- Error messages could be more actionable

**Recommendation**: Expand docstrings with:
- "Common mistakes" section
- "See also" links to related tools
- More real-world usage examples

### ⚠️ Best Practice 4: Curate Ruthlessly

**Status**: Partially adheres

**Positive**:
- Only 11 tools (not overwhelming)
- Read-only operations (safe)
- Focused on common use cases

**Concerns**:
- `ckan_package_search` exposes full Solr syntax (complex)
- `ckan_datastore_search_sql` requires SQL (expert-level)
- Some tools return large responses without pagination hints

**Issues**:
- Low-level tools (`package_search`, `datastore_search_sql`) require technical expertise
- No clear progression from beginner → advanced tools
- Missing "quick start" tools for common tasks

**Recommendation**:
1. Add simplified "quick" tools:
   - `ckan_quick_search` - natural language search
   - `ckan_get_dataset` - simple ID-based retrieval
2. Mark advanced tools clearly in descriptions
3. Create tool categories (Basic, Advanced, Expert)

### ✅ Best Practice 5: Name Tools for Discovery

**Status**: Excellent adherence

**Evidence**:
- Service prefix: `ckan_*` on all tools
- Action-oriented: `search`, `show`, `list`, `find`
- Clear hierarchy: `package_search`, `organization_search`

**Examples**:
- ✅ `ckan_package_search` (clear: CKAN service, search packages)
- ✅ `ckan_find_relevant_datasets` (clear: find by relevance)
- ✅ `ckan_get_mqa_quality` (clear: get quality metrics)

**Comparison to anti-pattern**:
- ❌ `search` (ambiguous)
- ❌ `get_data` (generic)
- ✅ `ckan_datastore_search` (specific)

### ⚠️ Best Practice 6: Paginate Large Results

**Status**: Partially adheres

**Positive**:
- `ckan_package_search` supports `start`/`rows` pagination
- `ckan_datastore_search` has `limit`/`offset` pagination
- Default limits are reasonable (10-100)

**Concerns**:
- Pagination guidance only shown AFTER fetching results
- No upfront warning about large result sets
- `truncateText()` silently truncates at 50,000 chars
- No "has_more" flag in JSON responses

**Evidence from `datastore.ts:127-130`**:
```typescript
if (result.total && result.total > params.offset + (result.records?.length || 0)) {
  const nextOffset = params.offset + params.limit;
  markdown += `**More results available**: Use \`offset: ${nextOffset}\` for next page.\n`;
}
```

**Issues**:
1. Pagination hints only in Markdown format
2. No structured pagination metadata in JSON responses
3. Silent truncation via `truncateText()`

**Recommendation**:
1. Add structured pagination metadata to ALL responses:
```typescript
{
  results: [...],
  pagination: {
    total: 1500,
    offset: 0,
    limit: 100,
    has_more: true,
    next_offset: 100
  }
}
```
2. Add warnings in tool descriptions about large datasets
3. Suggest using facets for exploration instead of fetching all records

## Overall Assessment

### Strengths

1. **Excellent naming** (`ckan_*` prefix, action-oriented)
2. **Flat arguments** (no nested configs)
3. **Good documentation** (detailed docstrings with examples)
4. **Pagination support** (start/rows, limit/offset)

### Weaknesses

1. **Too operation-focused** (exposes Solr/SQL directly)
2. **Limited curation** (no beginner/advanced separation)
3. **Incomplete pagination metadata** (no structured pagination info)
4. **Silent truncation** (50K char limit without warning)

### Priority Improvements

#### High Priority

1. **Add pagination metadata to JSON responses**
   - Include `total`, `offset`, `limit`, `has_more`, `next_offset`
   - Make pagination discoverable before fetching

2. **Add outcome-focused tools**
   - `ckan_quick_search` - natural language → Solr
   - `ckan_analyze_dataset` - automated quality checks
   - `ckan_get_dataset_preview` - quick overview without full metadata

3. **Improve truncation handling**
   - Warn before truncating (not silently)
   - Return truncation metadata (`truncated: true, original_size: 150000`)

#### Medium Priority

4. **Categorize tools by complexity**
   - Beginner: `quick_search`, `package_show`, `organization_show`
   - Advanced: `package_search`, `datastore_search`
   - Expert: `datastore_search_sql`

5. **Enhance error messages**
   - Add suggestions for common errors
   - Link to relevant documentation
   - Provide example queries

6. **Add "See also" links**
   - Cross-reference related tools
   - Suggest alternative approaches
   - Guide users to appropriate tools

#### Low Priority

7. **Add query builder helpers**
   - Validate Solr syntax before sending
   - Suggest corrections for malformed queries
   - Provide query templates

## Concrete Improvements: Before/After

Inspired by the Gmail MCP Server example in the article, here's how CKAN tools could be redesigned:

### Dataset Search

**Before (current)**:
```typescript
ckan_package_search(
  server_url: string,
  q: string,  // Requires Solr syntax knowledge
  fq: string,
  rows: number,
  start: number,
  sort: string,
  facet_field: string[],
  facet_limit: number,
  include_drafts: boolean,
  query_parser: 'default' | 'text',
  response_format: 'markdown' | 'json'
)
// Returns: Full Solr response with nested facets, search_facets, etc.
```

Problems: 11 parameters, requires Solr expertise, nested response structure

**After (proposed)**:
```typescript
// Simple search for most use cases
ckan_search_datasets(
  server: string,  // Shortened from server_url
  query: string,   // Natural language
  limit: number = 10
) -> [{"id", "title", "description", "organization", "quality_score"}]

// Advanced search when needed
ckan_search_datasets_advanced(
  server: string,
  query: string,
  filters: {"organization": string, "tags": string[], "format": string},
  sort_by: "relevance" | "modified" | "created" = "relevance",
  limit: number = 10,
  offset: number = 0
) -> {"results": [...], "pagination": {"total", "has_more", "next_offset"}}
```

**Benefits**:
- 3 parameters for common case (vs 11)
- Natural language query (server converts to Solr)
- Flat response structure
- Pagination metadata included
- Two tools (simple + advanced) instead of one complex tool

### Organization Discovery

**Before (current)**:
```typescript
ckan_organization_list(server_url, all_fields, sort, limit, offset, response_format)
ckan_organization_show(server_url, id, include_datasets, include_users, response_format)
ckan_organization_search(server_url, pattern, response_format)
```

Problems: Three separate tools, agent must orchestrate

**After (proposed)**:
```typescript
ckan_find_organization(
  server: string,
  name: string,
  include_stats: boolean = true
) -> {"name", "title", "description", "dataset_count", "top_tags": [str]}
```

**Benefits**:
- One tool for common case
- Returns curated info (not everything)
- Includes stats without extra call

## Conclusion

CKAN MCP Server scores **4/6** on MCP best practices:

- ✅ Excellent: Naming (5/6), Flat Arguments (2/6)
- ✅ Good: Instructions as Context (3/6)
- ⚠️ Partial: Outcomes Not Operations (1/6), Curate Ruthlessly (4/6), Paginate Large Results (6/6)

**Overall Grade**: B+ (Good, with clear path to excellence)

The server is well-structured and follows most best practices. Key improvements needed:
1. Add outcome-focused tools for common tasks
2. Implement structured pagination metadata
3. Better handle large responses with warnings

These changes would elevate the server from "good technical wrapper" to "excellent agent interface".

## Implementation Roadmap

### Phase 1: Quick Wins (Low Effort, High Impact)

1. **Add pagination metadata to all responses** (~2 hours)
   - Include `has_more`, `next_offset`, `total_count` in JSON responses
   - Add structured pagination section to Markdown responses

2. **Improve tool descriptions** (~3 hours)
   - Add "When to use" section
   - Add "Common mistakes" warnings
   - Add "See also" links to related tools

3. **Categorize tools in README** (~1 hour)
   - Beginner: 4 tools (quick_search, package_show, organization_show, status_show)
   - Advanced: 5 tools (package_search, datastore_search, organization_list, group tools)
   - Expert: 2 tools (datastore_search_sql, find_relevant_datasets)

### Phase 2: Outcome-Focused Tools (Medium Effort)

4. **Add `ckan_discover_datasets` tool** (~4 hours)
   - Natural language query → Solr translation
   - Include quality scores by default
   - Return curated results (not raw Solr)

5. **Add `ckan_get_dataset_preview` tool** (~2 hours)
   - Quick overview without full metadata
   - Include first 3 resources with formats
   - Include organization and update date

6. **Add `ckan_find_organization` tool** (~2 hours)
   - Single tool for organization discovery
   - Include stats without extra calls
   - Return top tags and recent datasets

### Phase 3: Advanced Features (Higher Effort)

7. **Query validation and suggestions** (~6 hours)
   - Validate Solr syntax before sending
   - Suggest corrections for malformed queries
   - Provide query templates in errors

8. **Smart truncation with warnings** (~3 hours)
   - Warn before truncating
   - Return truncation metadata
   - Suggest pagination when appropriate

## Target Metrics (From Article)

**Current State**:
- Tools per server: 11 (within 5-15 recommendation ✅)
- Average parameters per tool: ~6 (good)
- Tools with nested args: 1 (`filters` in datastore_search)
- Tools with pagination: 7/11 (64%)
- Tools with structured pagination metadata: 0/11 (0%)

**Target State**:
- Tools per server: 12-15 (add 3-4 outcome-focused)
- Average parameters per tool: 4 (simplify)
- Tools with nested args: 0 (flatten filters)
- Tools with pagination: 12/15 (80%)
- Tools with structured pagination metadata: 12/15 (100%)

## References

- Article: https://www.philschmid.de/mcp-best-practices
- Block's MCP Playbook: (referenced in article)
- GitHub's Security Guide: (referenced in article)
- FastMCP AI Engineering Summit: (referenced in article)

## Extracted with agent-browser

This evaluation was created using `agent-browser` CLI for web content extraction:

```bash
agent-browser open https://www.philschmid.de/mcp-best-practices
agent-browser get text 'article'
```

The `get text 'article'` command provides readability-like extraction of main content.
