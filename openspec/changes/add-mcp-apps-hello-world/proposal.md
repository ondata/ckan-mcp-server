# Proposal: add-mcp-apps-hello-world

## Summary

Add a CKAN portal dashboard tool (`ckan_portal_info_ui`) that displays interactive overview of any CKAN data portal with statistics, top organizations/tags, and resource format distribution charts. Demonstrates MCP Apps integration with real CKAN data.

## Context

MCP Apps (announced January 2026) is the first official MCP extension enabling tools to return interactive UI components. The extension is production-ready and supported by Claude, ChatGPT, Goose, and VS Code Insiders.

Current CKAN MCP Server limitations:
- All tool outputs are text-based (markdown or JSON)
- No interactive data exploration capabilities
- No visual statistics or charts
- Users must call multiple tools to understand portal overview
- No quick way to assess portal size/content

A CKAN portal dashboard would:
- Show complete portal overview in single interactive UI
- Demonstrate MCP Apps integration with real CKAN API data
- Provide template for future interactive tools (tables, maps)
- Deliver immediate user value (production-ready feature)
- Validate technical feasibility with real-world complexity

## Motivation

### User value
- **Quick portal assessment** - understand any CKAN portal in seconds
- **Visual statistics** - charts more intuitive than text tables
- **Top content discovery** - see most active organizations and popular tags
- **Format analysis** - understand available data formats at a glance
- **Production-ready** - immediately useful feature, not just demo

### Technical value
- Validates MCP Apps SDK integration with real CKAN API calls
- Tests UI resource serving in stdio/HTTP/Workers transport modes
- Establishes patterns for building interactive CKAN tools
- Proves feasibility of complex UI with multiple data sources
- Foundation for future features (dataset explorer, geographic maps)

## Proposed Solution

Create `ckan_portal_info_ui` tool that displays interactive dashboard for any CKAN portal.

**Tool inputs:**
- `server_url` (required) - CKAN portal URL (e.g., https://dati.gov.it/opendata)

**Tool behavior:**
1. Calls multiple CKAN APIs to gather portal statistics:
   - `package_search` with rows=0 and facets for counts and distributions
   - `organization_list` for top organizations
   - `tag_list` for popular tags
   - `status_show` for CKAN version info
2. Returns structured data + UI metadata (`_meta.ui.resourceUri`)
3. UI renders interactive dashboard with:
   - **Summary cards**: total datasets, organizations, groups, resources
   - **Bar chart**: top 10 organizations by dataset count
   - **Tag cloud/list**: most popular tags
   - **Pie/bar chart**: resource format distribution (CSV, JSON, PDF, etc.)
   - **Metadata**: CKAN version, last update timestamp
   - **Refresh button**: reload statistics

Implementation approach:
- Add `@modelcontextprotocol/ext-apps` dependency
- Create new tool file `src/tools/portalinfo.ts`
- Reuse existing `makeCkanRequest()` utility for API calls
- Create UI resource in `src/ui/portal-info.html` (bundled inline)
- Use Chart.js or D3.js for interactive charts (embedded via CDN)
- Register UI resource via `ui://portal-info` scheme
- Support both text fallback (markdown table) and UI modes

### Architecture decisions
- **Vanilla JS + Chart.js** - minimal dependencies, excellent chart library
- **Inline bundled HTML** - single artifact, works in all transport modes
- **CDN for Chart.js** - no need to bundle large library (~200KB)
- **Multiple API calls** - demonstrates real-world complexity
- **Faceted search** - efficient statistics gathering with single request
- **Text fallback** - markdown tables for non-UI clients

## Alternatives Considered

1. **Generic hello world with timestamp**
   - Rejected: No real value, doesn't demonstrate CKAN integration
   - Portal dashboard provides actual utility

2. **Simple stats without charts**
   - Rejected: Charts are key value of interactive UI
   - Text tables already available via existing tools

3. **Add UI to existing package_search tool**
   - Rejected: Mixing concerns, more complex to implement
   - Dedicated dashboard tool clearer and more focused

4. **Use React/Vue framework**
   - Rejected: Adds build complexity and bundle size
   - Vanilla JS + Chart.js sufficient for dashboard

5. **Bundle Chart.js instead of CDN**
   - Rejected: ~200KB bundle size increase
   - CDN acceptable for interactive UI (requires network anyway)

## Open Questions

1. Which chart library should we use?
   - **Recommendation**: Chart.js via CDN - simple, well-documented, 200KB
   - **Alternative**: D3.js for more flexibility but steeper learning curve

2. Should we cache portal statistics to reduce API calls?
   - **Recommendation**: No caching initially (consistent with other tools)
   - **Future**: Add optional caching if performance becomes issue

3. How many top organizations/tags to display?
   - **Recommendation**: Top 10 organizations, top 20 tags
   - **Rationale**: Fits in single screen, sufficient for overview

4. Should dashboard support comparison between portals?
   - **Recommendation**: No, keep single-portal focus for first version
   - **Future**: Multi-portal comparison could be separate tool

5. Should we include dataset quality metrics (MQA scores)?
   - **Recommendation**: No, focus on basic statistics
   - **Note**: MQA only available for dati.gov.it, not universal

## Success Criteria

- [ ] `ckan_portal_info_ui` tool accepts server_url parameter
- [ ] Tool makes multiple CKAN API calls successfully
- [ ] Tool returns structured data + UI metadata
- [ ] UI renders dashboard with all sections (cards, charts, tags)
- [ ] Charts display correct data and are interactive
- [ ] Refresh button updates all statistics
- [ ] Works in Claude Desktop (stdio mode)
- [ ] Works in HTTP mode
- [ ] Works in Cloudflare Workers
- [ ] Text fallback provides useful markdown tables
- [ ] Tests validate tool execution and data formatting
- [ ] Documentation includes portal dashboard usage examples

## Risks and Mitigations

**Risk**: Multiple API calls increase tool execution time
- **Impact**: Dashboard may take 2-5 seconds to load
- **Mitigation**: Use faceted search to minimize requests (1-2 API calls)
- **Acceptable**: Interactive UI worth the wait for richer data

**Risk**: Chart.js CDN dependency may fail/timeout
- **Mitigation**: Detect CDN load failure, show tables as fallback
- **Alternative**: Bundle Chart.js if CDN reliability is issue

**Risk**: Large portals (10K+ datasets) may cause slow responses
- **Mitigation**: Use rows=0 for counts, limit facet results to top 10/20
- **Note**: CKAN servers optimize faceted queries well

**Risk**: MCP Apps SDK incompatible with Cloudflare Workers
- **Mitigation**: Test Workers compatibility early
- **Fallback**: Document Workers limitation if needed

**Risk**: UI complexity makes maintenance harder
- **Mitigation**: Keep HTML < 300 lines, well-commented
- **Alternative**: Split into modules if grows beyond 500 lines

## Dependencies

- External:
  - `@modelcontextprotocol/ext-apps` npm package (SDK)
  - Chart.js via CDN (chart rendering)
- Internal:
  - Reuse `makeCkanRequest()` from `src/utils/http.ts`
  - No changes to existing tools required

## Timeline Estimate

Medium complexity, estimated 2-3 development sessions:
- Day 1: Add dependency, create tool with API calls, test data fetching
- Day 2: Create dashboard UI, integrate Chart.js, test rendering
- Day 3: Test all transport modes, add tests, update documentation
