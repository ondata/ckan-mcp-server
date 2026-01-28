# mcp-apps-example Specification

## Purpose

Define requirements for a CKAN portal dashboard tool that demonstrates MCP Apps interactive UI capabilities with real data visualization.

## ADDED Requirements

### Requirement: Portal Dashboard Tool Registration

The system SHALL provide a `ckan_portal_info_ui` tool that displays interactive dashboard for any CKAN data portal.

#### Scenario: Tool listed in available tools

- **GIVEN** MCP server is running
- **WHEN** client requests tools/list
- **THEN** response includes `ckan_portal_info_ui` tool with description indicating portal dashboard with statistics and charts

#### Scenario: Tool execution with server_url parameter

- **GIVEN** MCP server is running
- **WHEN** client calls `ckan_portal_info_ui` with `server_url: "https://dati.gov.it/opendata"`
- **THEN** tool makes CKAN API calls to gather statistics
- **AND** response includes `_meta.ui.resourceUri` pointing to `ui://portal-info`
- **AND** response includes `_meta.ui.data` with structured dashboard data
- **AND** response includes text fallback with markdown tables

#### Scenario: Tool validates server_url parameter

- **GIVEN** MCP server is running
- **WHEN** client calls `ckan_portal_info_ui` with invalid server_url
- **THEN** tool returns validation error for invalid URL format

#### Scenario: Tool handles missing parameter

- **GIVEN** MCP server is running
- **WHEN** client calls `ckan_portal_info_ui` without server_url
- **THEN** tool returns error indicating server_url is required

### Requirement: Portal Statistics Gathering

The tool SHALL gather comprehensive portal statistics using efficient CKAN API calls.

#### Scenario: Gather dataset count

- **GIVEN** tool is called with valid server_url
- **WHEN** tool executes package_search with rows=0
- **THEN** response includes total dataset count from CKAN portal

#### Scenario: Gather organization statistics

- **GIVEN** tool is called with valid server_url
- **WHEN** tool executes package_search with organization facets
- **THEN** response includes top 10 organizations with dataset counts
- **AND** organization names are resolved via organization_list

#### Scenario: Gather tag statistics

- **GIVEN** tool is called with valid server_url
- **WHEN** tool executes package_search with tag facets
- **THEN** response includes top 20 tags with usage counts

#### Scenario: Gather format distribution

- **GIVEN** tool is called with valid server_url
- **WHEN** tool executes package_search with res_format facets
- **THEN** response includes resource format distribution (CSV, JSON, PDF, etc.)

#### Scenario: Gather CKAN version

- **GIVEN** tool is called with valid server_url
- **WHEN** tool executes status_show
- **THEN** response includes CKAN version information

#### Scenario: Handle API timeout gracefully

- **GIVEN** tool is called with slow/unreachable server
- **WHEN** CKAN API call times out
- **THEN** tool returns partial data with error indication
- **AND** response includes text explaining timeout

### Requirement: Dashboard UI Resource

The system SHALL expose a UI resource via `ui://portal-info` containing interactive dashboard with charts.

#### Scenario: UI resource listed in resources

- **GIVEN** MCP server is running
- **WHEN** client requests resources/list
- **THEN** response includes `ui://portal-info` resource with MIME type `text/html+mcp`
- **AND** resource description indicates CKAN portal dashboard

#### Scenario: UI resource returns complete HTML

- **GIVEN** MCP server is running
- **WHEN** client reads `ui://portal-info` resource
- **THEN** response contains valid HTML document with Chart.js CDN reference
- **AND** HTML includes MCP Apps SDK initialization
- **AND** HTML includes sections for cards, charts, tags, metadata

#### Scenario: UI HTML is self-contained except CDN

- **GIVEN** UI resource HTML is retrieved
- **WHEN** HTML is parsed
- **THEN** all CSS is inlined (no external stylesheets)
- **AND** JavaScript is inlined (except Chart.js CDN)
- **AND** no external images or fonts

### Requirement: Dashboard Summary Cards

The dashboard UI SHALL display summary statistics in card layout.

#### Scenario: Display dataset count card

- **GIVEN** UI receives tool result with statistics
- **WHEN** UI renders dashboard
- **THEN** UI displays "Datasets" card with total count formatted with thousands separator

#### Scenario: Display organization count card

- **GIVEN** UI receives tool result with statistics
- **WHEN** UI renders dashboard
- **THEN** UI displays "Organizations" card with count

#### Scenario: Display groups count card

- **GIVEN** UI receives tool result with statistics
- **WHEN** UI renders dashboard
- **THEN** UI displays "Groups" card with count

#### Scenario: Display resources count card

- **GIVEN** UI receives tool result with statistics
- **WHEN** UI renders dashboard
- **THEN** UI displays "Resources" card with count

### Requirement: Organization Chart Visualization

The dashboard SHALL display top organizations as interactive bar chart.

#### Scenario: Render organization bar chart

- **GIVEN** UI receives tool result with top_organizations data
- **WHEN** UI renders charts
- **THEN** UI displays horizontal bar chart with organization names and dataset counts
- **AND** chart is interactive with tooltips on hover

#### Scenario: Chart shows top 10 organizations

- **GIVEN** tool returns 10 top organizations
- **WHEN** UI renders organization chart
- **THEN** chart displays all 10 organizations in descending order by dataset count

#### Scenario: Update chart on refresh

- **GIVEN** dashboard is already rendered
- **WHEN** user clicks refresh and new data arrives
- **THEN** organization chart updates with new data without page reload
- **AND** previous chart instance is destroyed before creating new one

### Requirement: Format Distribution Chart

The dashboard SHALL display resource format distribution as chart.

#### Scenario: Render format pie chart

- **GIVEN** UI receives tool result with format_distribution data
- **WHEN** UI renders charts
- **THEN** UI displays pie chart with format types and counts
- **AND** chart uses distinct colors for each format

#### Scenario: Chart shows all common formats

- **GIVEN** portal has CSV, JSON, PDF, XML resources
- **WHEN** UI renders format chart
- **THEN** chart displays all formats with proportional sizes
- **AND** tooltip shows exact count on hover

### Requirement: Tag Display

The dashboard SHALL display popular tags as list.

#### Scenario: Display tag list

- **GIVEN** UI receives tool result with top_tags data
- **WHEN** UI renders tags section
- **THEN** UI displays tags as styled list with names and counts
- **AND** tags are separated with visual spacing

#### Scenario: Show top 20 tags

- **GIVEN** tool returns 20 popular tags
- **WHEN** UI renders tag section
- **THEN** all 20 tags are visible without scrolling

### Requirement: Metadata Footer

The dashboard SHALL display portal metadata in footer.

#### Scenario: Display CKAN version

- **GIVEN** UI receives tool result with metadata
- **WHEN** UI renders footer
- **THEN** footer displays CKAN version (e.g., "2.9.5")

#### Scenario: Display last update timestamp

- **GIVEN** UI receives tool result with metadata
- **WHEN** UI renders footer
- **THEN** footer displays last update time in localized format

### Requirement: Interactive Refresh

The dashboard SHALL provide refresh button to reload statistics.

#### Scenario: Refresh button triggers tool call

- **GIVEN** dashboard is rendered with dati.gov.it data
- **WHEN** user clicks "Refresh" button
- **THEN** UI calls `app.callServerTool("ckan_portal_info_ui", { server_url })`
- **AND** button shows loading state during API call
- **AND** button is disabled during loading

#### Scenario: Dashboard updates after refresh

- **GIVEN** user clicks refresh button
- **WHEN** server responds with new data
- **THEN** all dashboard sections update (cards, charts, tags, metadata)
- **AND** charts are re-rendered with new data
- **AND** button returns to normal state

#### Scenario: Handle refresh error

- **GIVEN** user clicks refresh button
- **WHEN** server responds with error
- **THEN** UI displays error message to user
- **AND** dashboard remains functional (no crash)
- **AND** button returns to normal state

### Requirement: Chart.js CDN Integration

The dashboard SHALL load Chart.js from CDN with fallback handling.

#### Scenario: Load Chart.js successfully

- **GIVEN** UI resource loads in browser
- **WHEN** Chart.js CDN script tag executes
- **THEN** Chart.js library is available globally
- **AND** charts render without errors

#### Scenario: Handle CDN load failure

- **GIVEN** UI resource loads but CDN is unavailable
- **WHEN** Chart.js fails to load within timeout
- **THEN** UI detects failure and shows data in table format instead
- **AND** user sees message indicating charts unavailable

### Requirement: Transport Mode Compatibility

The portal dashboard SHALL work in all supported transport modes.

#### Scenario: Works in stdio mode

- **GIVEN** MCP server running in stdio mode
- **WHEN** Claude Desktop calls portal info tool
- **THEN** dashboard renders in Claude UI
- **AND** all interactions (refresh) work correctly

#### Scenario: Works in HTTP mode

- **GIVEN** MCP server running in HTTP mode
- **WHEN** client sends POST to /mcp endpoint
- **THEN** tool returns UI metadata correctly
- **AND** UI resource accessible via resources/read

#### Scenario: Works in Workers mode

- **GIVEN** MCP server deployed to Cloudflare Workers
- **WHEN** client calls portal info tool
- **THEN** tool executes without runtime errors
- **AND** all CKAN API calls complete successfully
- **AND** UI resource serves correctly

### Requirement: Text Fallback for Non-UI Clients

The tool SHALL provide markdown fallback for clients without UI support.

#### Scenario: Text fallback includes all statistics

- **GIVEN** non-UI client calls portal info tool
- **WHEN** client parses response content
- **THEN** text includes markdown tables with statistics
- **AND** text includes dataset count, org count, group count
- **AND** text includes top organizations list
- **AND** text includes top tags list
- **AND** text includes format distribution

#### Scenario: Text mentions UI availability

- **GIVEN** non-UI client calls portal info tool
- **WHEN** client reads response text
- **THEN** text includes note that interactive dashboard available for UI-capable clients

### Requirement: Cross-Portal Compatibility

The dashboard SHALL work with various CKAN portals correctly.

#### Scenario: Works with dati.gov.it (large portal)

- **GIVEN** tool called with `server_url: "https://dati.gov.it/opendata"`
- **WHEN** tool gathers statistics
- **THEN** all statistics load correctly (30K+ datasets)
- **AND** dashboard renders without performance issues

#### Scenario: Works with demo.ckan.org (small portal)

- **GIVEN** tool called with `server_url: "https://demo.ckan.org"`
- **WHEN** tool gathers statistics
- **THEN** all statistics load correctly (small dataset count)
- **AND** dashboard handles small numbers gracefully

#### Scenario: Handles portal with few organizations

- **GIVEN** portal has only 3 organizations
- **WHEN** dashboard renders organization chart
- **THEN** chart displays 3 bars without errors
- **AND** chart is readable despite few data points

### Requirement: Error Handling and Resilience

The dashboard SHALL handle errors gracefully without crashing.

#### Scenario: Handle invalid server URL

- **GIVEN** tool called with malformed URL
- **WHEN** tool validates input
- **THEN** tool returns clear error message
- **AND** error indicates URL format problem

#### Scenario: Handle unreachable server

- **GIVEN** tool called with unreachable server URL
- **WHEN** tool attempts CKAN API calls
- **THEN** tool returns error after timeout
- **AND** error message indicates server unreachable

#### Scenario: Handle partial API failures

- **GIVEN** package_search succeeds but status_show fails
- **WHEN** tool aggregates data
- **THEN** tool returns statistics without CKAN version
- **AND** dashboard renders with "Unknown" for missing version

## Non-Requirements

- Real-time updates (auto-refresh every N seconds)
- Dataset quality metrics (MQA scores) - only available for dati.gov.it
- Multi-portal comparison (side-by-side dashboards)
- Download statistics (views/downloads per dataset)
- Drill-down into specific organizations or tags
- Export dashboard as image or PDF
- Customizable chart types or colors
- Historical trend analysis
- Dataset search functionality within dashboard
