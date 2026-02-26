# Tasks: add-mcp-apps-hello-world

## Implementation Tasks

### Phase 1: Dependencies and Setup
- [ ] Add `@modelcontextprotocol/ext-apps` to package.json dependencies
- [ ] Run `npm install` and verify SDK installation
- [ ] Update esbuild configuration to external `@modelcontextprotocol/ext-apps`

### Phase 2: Tool Implementation - Data Fetching
- [ ] Create `src/tools/portalinfo.ts` with `ckan_portal_info_ui` tool
- [ ] Define Zod schema for tool input (server_url required)
- [ ] Implement API call to `package_search` with facets for statistics
- [ ] Implement API call to `organization_list` for top organizations
- [ ] Implement API call to `tag_list` for popular tags
- [ ] Implement API call to `status_show` for CKAN version
- [ ] Structure response data as JSON for UI consumption
- [ ] Add text fallback with markdown tables for non-UI clients

### Phase 3: Tool Implementation - Response Format
- [ ] Add `_meta.ui.resourceUri` pointing to `ui://portal-info`
- [ ] Include all statistics in tool response content
- [ ] Handle API errors gracefully (timeout, server unreachable)
- [ ] Register tool in `src/server.ts` via `registerPortalInfoTools()`
- [ ] Test tool with curl/MCP inspector (verify data structure)

### Phase 4: UI Resource - Basic Structure
- [ ] Create `src/ui/portal-info.html` with semantic HTML structure
- [ ] Add summary cards section (datasets, orgs, groups, resources)
- [ ] Add charts container sections (organizations, formats)
- [ ] Add tags section (list or cloud)
- [ ] Add metadata footer (CKAN version, last update)
- [ ] Add basic CSS styling (cards, layout, responsive)

### Phase 5: UI Resource - Chart Integration
- [ ] Add Chart.js CDN script tag to HTML
- [ ] Implement App class initialization from MCP Apps SDK
- [ ] Parse tool result data in UI JavaScript
- [ ] Create bar chart for top organizations (Chart.js)
- [ ] Create pie/bar chart for resource format distribution
- [ ] Add chart interactivity (tooltips, labels)
- [ ] Handle Chart.js CDN load failure (show tables as fallback)

### Phase 6: UI Resource - Interactivity
- [ ] Add "Refresh" button to reload statistics
- [ ] Implement tool call from UI using `app.callServerTool()`
- [ ] Update all UI sections when new data arrives
- [ ] Add loading indicator during API calls
- [ ] Handle errors in UI (show error message)
- [ ] Test UI in isolation (open HTML file with mock data)

### Phase 7: Resource Registration
- [ ] Register UI resource in server with `ui://portal-info` URI
- [ ] Set MIME type to `text/html+mcp`
- [ ] Implement resource handler serving bundled HTML content
- [ ] Bundle HTML inline as string constant in TypeScript
- [ ] Verify resource accessible via MCP resources/read

### Phase 8: Testing - Automated
- [ ] Add unit test for tool registration in `tests/unit/portalinfo.test.ts`
- [ ] Add unit test for data structure validation
- [ ] Add integration test for UI resource serving
- [ ] Add integration test with mocked CKAN responses
- [ ] Test error handling (invalid server_url, timeout)
- [ ] Verify text fallback formatting

### Phase 9: Testing - Manual
- [ ] Test in Claude Desktop (stdio mode) with dati.gov.it
- [ ] Verify all dashboard sections render correctly
- [ ] Test charts are interactive and display correct data
- [ ] Test refresh button updates statistics
- [ ] Test with different portals (data.gov, demo.ckan.org)
- [ ] Test HTTP mode with curl + browser
- [ ] Test Workers deployment if applicable

### Phase 10: Documentation
- [ ] Add MCP Apps section to CLAUDE.md explaining pattern
- [ ] Document portal dashboard tool in README.md
- [ ] Add usage examples to EXAMPLES.md (various portals)
- [ ] Add screenshots/descriptions of dashboard UI
- [ ] Update LOG.md with change entry
- [ ] Document Chart.js CDN dependency

### Phase 11: Build Validation
- [ ] Run `npm run build` - verify no errors
- [ ] Run `npm test` - verify all tests pass (target: 100%)
- [ ] Run `npm run build:worker` - verify Workers build succeeds
- [ ] Verify bundle size acceptable (<100KB increase for HTML)
- [ ] Check HTML size is reasonable (<20KB bundled)

## Validation Checklist

### Functional Requirements
- [ ] Tool accepts server_url parameter correctly
- [ ] Tool makes CKAN API calls successfully
- [ ] Tool returns structured JSON data
- [ ] Tool returns UI metadata (`_meta.ui.resourceUri`)
- [ ] Tool provides text fallback with markdown tables
- [ ] UI resource loads without errors
- [ ] All dashboard sections render (cards, charts, tags)
- [ ] Charts display correct data from CKAN
- [ ] Charts are interactive (tooltips, hover effects)
- [ ] Refresh button triggers new tool call
- [ ] UI updates with new data after refresh
- [ ] Loading indicators show during API calls
- [ ] Error messages display when API fails

### Cross-Portal Compatibility
- [ ] Works with dati.gov.it (Italy)
- [ ] Works with data.gov (USA)
- [ ] Works with demo.ckan.org
- [ ] Handles portals with few datasets gracefully
- [ ] Handles portals with thousands of datasets

### Transport Modes
- [ ] Works in stdio mode (Claude Desktop)
- [ ] Works in HTTP mode (curl + browser)
- [ ] Works in Cloudflare Workers
- [ ] No console errors in any mode

### Code Quality
- [ ] Tests pass with 100% success rate
- [ ] Code is well-commented
- [ ] HTML size < 20KB
- [ ] Bundle size increase < 100KB
- [ ] No security vulnerabilities (XSS, injection)
- [ ] Documentation clear and accurate

## Notes

- Portal dashboard is production-ready feature, not just demo
- Focus on reliable data fetching and error handling
- Keep Chart.js usage simple - no advanced features needed
- Ensure backward compatibility - existing tools unaffected
- Foundation for future interactive tools (dataset explorer, maps)
- Consider adding caching in future if performance becomes issue
