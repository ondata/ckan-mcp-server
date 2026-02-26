# Design: add-mcp-apps-hello-world

## Overview

This design document explains the architectural approach for adding an interactive CKAN portal dashboard using MCP Apps. The dashboard provides visual overview of any CKAN data portal with statistics, charts, and top content discovery.

## Architecture

### Component Structure

```
src/
├── tools/
│   └── portalinfo.ts          # Dashboard tool implementation
├── ui/
│   └── portal-info.html       # Dashboard UI (bundled inline)
└── server.ts                  # Register tool and UI resource
```

### Data Flow

1. **Tool Call**:
   - Client → Server: `tools/call` with `ckan_portal_info_ui` + `server_url`
   - Server → CKAN API: Multiple requests (package_search, organization_list, tag_list, status_show)
   - CKAN API → Server: Statistics, facets, lists
   - Server → Client: Structured JSON + `_meta.ui.resourceUri = "ui://portal-info"`

2. **UI Resource Fetch**:
   - Client → Server: `resources/read` with `ui://portal-info`
   - Server → Client: HTML with embedded Chart.js and MCP Apps SDK

3. **UI Rendering**:
   - UI parses tool result JSON
   - Populates summary cards (dataset count, org count, etc.)
   - Renders bar chart for top organizations
   - Renders pie/bar chart for format distribution
   - Displays tag list

4. **User Interaction (Refresh)**:
   - User clicks "Refresh" button
   - UI calls `app.callServerTool("ckan_portal_info_ui", { server_url })`
   - Server repeats CKAN API calls
   - UI updates all sections with new data

### Tool Response Structure

```typescript
{
  content: [
    {
      type: "text",
      text: `# Portal Statistics for ${server_url}\n\n` +
            `- Total Datasets: ${count}\n` +
            `- Organizations: ${org_count}\n...` +
            `\n(Interactive dashboard available in UI)`
    }
  ],
  _meta: {
    ui: {
      resourceUri: "ui://portal-info",
      data: {
        server_url: "https://dati.gov.it/opendata",
        statistics: {
          dataset_count: 32451,
          organization_count: 245,
          group_count: 18,
          resource_count: 89232
        },
        top_organizations: [
          { name: "Ministero Salute", dataset_count: 3421 },
          { name: "Regione Toscana", dataset_count: 2134 },
          ...
        ],
        top_tags: [
          { name: "sanità", count: 1234 },
          { name: "ambiente", count: 987 },
          ...
        ],
        format_distribution: {
          "CSV": 45234,
          "JSON": 12456,
          "PDF": 8932,
          "XML": 5421,
          ...
        },
        metadata: {
          ckan_version: "2.9.5",
          last_update: "2026-01-27T10:30:00Z"
        }
      }
    }
  }
}
```

### UI Resource Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CKAN Portal Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    /* Dashboard layout with CSS Grid */
    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      padding: 1rem;
    }
    .card {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h3 { margin: 0 0 0.5rem; font-size: 0.9rem; color: #666; }
    .card .value { font-size: 2rem; font-weight: bold; color: #2c3e50; }
    .chart-container { height: 300px; }
  </style>
</head>
<body>
  <div id="app">
    <header>
      <h1>Portal Dashboard</h1>
      <p id="portal-url"></p>
      <button id="refresh">🔄 Refresh Statistics</button>
    </header>

    <div class="dashboard">
      <!-- Summary Cards -->
      <div class="card">
        <h3>Datasets</h3>
        <div class="value" id="dataset-count">-</div>
      </div>
      <div class="card">
        <h3>Organizations</h3>
        <div class="value" id="org-count">-</div>
      </div>
      <div class="card">
        <h3>Groups</h3>
        <div class="value" id="group-count">-</div>
      </div>
      <div class="card">
        <h3>Resources</h3>
        <div class="value" id="resource-count">-</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="chart-section">
      <h2>Top Organizations</h2>
      <div class="chart-container">
        <canvas id="org-chart"></canvas>
      </div>
    </div>

    <div class="chart-section">
      <h2>Resource Format Distribution</h2>
      <div class="chart-container">
        <canvas id="format-chart"></canvas>
      </div>
    </div>

    <!-- Tags -->
    <div class="tag-section">
      <h2>Popular Tags</h2>
      <div id="tag-list"></div>
    </div>

    <!-- Metadata -->
    <footer>
      <p>CKAN Version: <span id="ckan-version">-</span></p>
      <p>Last Update: <span id="last-update">-</span></p>
    </footer>
  </div>

  <script type="module">
    import { App } from '@modelcontextprotocol/ext-apps';

    const app = new App({
      name: "CKAN Portal Dashboard",
      version: "1.0.0"
    });

    let currentServerUrl = '';
    let orgChart, formatChart;

    // Initialize or update dashboard
    function updateDashboard(data) {
      const { server_url, statistics, top_organizations, top_tags,
              format_distribution, metadata } = data;

      currentServerUrl = server_url;

      // Update URL display
      document.getElementById('portal-url').textContent = server_url;

      // Update summary cards
      document.getElementById('dataset-count').textContent =
        statistics.dataset_count.toLocaleString();
      document.getElementById('org-count').textContent =
        statistics.organization_count.toLocaleString();
      document.getElementById('group-count').textContent =
        statistics.group_count.toLocaleString();
      document.getElementById('resource-count').textContent =
        statistics.resource_count.toLocaleString();

      // Update organization chart
      updateOrgChart(top_organizations);

      // Update format chart
      updateFormatChart(format_distribution);

      // Update tags
      updateTags(top_tags);

      // Update metadata
      document.getElementById('ckan-version').textContent =
        metadata.ckan_version || 'Unknown';
      document.getElementById('last-update').textContent =
        new Date(metadata.last_update).toLocaleString();
    }

    function updateOrgChart(organizations) {
      const ctx = document.getElementById('org-chart');
      const labels = organizations.map(o => o.name);
      const data = organizations.map(o => o.dataset_count);

      if (orgChart) orgChart.destroy();

      orgChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Datasets',
            data: data,
            backgroundColor: '#3498db'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    function updateFormatChart(distribution) {
      const ctx = document.getElementById('format-chart');
      const labels = Object.keys(distribution);
      const data = Object.values(distribution);

      if (formatChart) formatChart.destroy();

      formatChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              '#3498db', '#2ecc71', '#f39c12', '#e74c3c',
              '#9b59b6', '#1abc9c', '#34495e', '#95a5a6'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    function updateTags(tags) {
      const tagList = document.getElementById('tag-list');
      tagList.innerHTML = tags
        .map(t => `<span class="tag">${t.name} (${t.count})</span>`)
        .join(' ');
    }

    // Handle tool results
    app.onToolResult((result) => {
      if (result._meta?.ui?.data) {
        updateDashboard(result._meta.ui.data);
      }
    });

    // Handle refresh button
    document.getElementById('refresh').onclick = async () => {
      if (!currentServerUrl) return;

      document.getElementById('refresh').disabled = true;
      document.getElementById('refresh').textContent = '⏳ Loading...';

      try {
        await app.callServerTool('ckan_portal_info_ui', {
          server_url: currentServerUrl
        });
      } catch (error) {
        alert('Failed to refresh: ' + error.message);
      } finally {
        document.getElementById('refresh').disabled = false;
        document.getElementById('refresh').textContent = '🔄 Refresh Statistics';
      }
    };
  </script>
</body>
</html>
```

## Key Design Decisions

### 1. Dashboard Focus vs Generic Hello World

**Decision**: Build portal dashboard, not generic greeting

**Rationale**:
- Demonstrates real CKAN integration with value for users
- Shows how to handle multiple API calls and data aggregation
- Provides template for future data visualization tools
- Production-ready feature, not just example code

**Trade-offs**:
- More complex implementation (~300 lines vs ~50)
- Multiple API calls increase latency (2-5 seconds)
- **Acceptable**: Complexity justified by utility, latency acceptable for rich data

### 2. Chart.js via CDN vs Bundled

**Decision**: Load Chart.js from CDN, not bundled

**Rationale**:
- Chart.js is ~200KB minified - significant bundle size increase
- CDN provides caching across MCP apps
- Faster initial server startup (smaller bundle)
- UI requires network anyway (MCP protocol)

**Trade-offs**:
- CDN failure breaks charts (mitigate with table fallback)
- Slight privacy concern (CDN sees request)
- **Mitigation**: Detect load failure, show data in tables if Chart.js unavailable

### 3. Faceted Search vs Multiple API Calls

**Decision**: Use faceted `package_search` for statistics + separate calls for lists

**Rationale**:
- Single package_search with facets provides most statistics efficiently
- Facets return counts for organizations, tags, formats in one request
- Separate calls needed only for organization/tag details (names)
- Minimizes API calls (2-3 total vs 5-6)

**Implementation**:
```typescript
// Single efficient query
const stats = await makeCkanRequest(server_url, 'package_search', {
  q: '*:*',
  rows: 0,  // Don't need actual datasets
  facet_field: ['organization', 'tags', 'res_format'],
  facet_limit: 20
});
```

### 4. Data Structure in Tool Response

**Decision**: Include all data in `_meta.ui.data`, not just in content

**Rationale**:
- UI needs structured JSON, not markdown text
- `_meta.ui.data` is semantically correct location for UI-specific data
- Allows text fallback to be human-readable (markdown tables)
- Follows MCP Apps pattern from official examples

**Structure**:
- `content`: Text fallback for non-UI clients
- `_meta.ui.resourceUri`: Points to dashboard HTML
- `_meta.ui.data`: Complete JSON for UI rendering

### 5. Vanilla JavaScript + Chart.js vs React

**Decision**: Vanilla JS with Chart.js, no framework

**Rationale**:
- Chart.js handles chart complexity - no need for framework
- Dashboard is relatively simple (~200 lines JS)
- No build step for UI - just HTML string
- Easier for contributors to understand and modify

**Trade-offs**:
- Manual DOM manipulation (no reactive updates)
- No component reusability
- **Acceptable**: Dashboard is focused, complexity manageable

### 6. Refresh Button vs Auto-Refresh

**Decision**: Manual refresh button, no automatic polling

**Rationale**:
- User controls when to make expensive API calls
- Consistent with server's no-caching philosophy
- Avoids battery drain on mobile devices
- CKAN portal statistics change slowly (minutes/hours, not seconds)

**Future**: Could add auto-refresh option with user preference

## API Integration Strategy

### Efficient Data Gathering

```typescript
async function gatherPortalStatistics(server_url: string) {
  // Call 1: Main statistics with facets
  const searchResult = await makeCkanRequest(server_url, 'package_search', {
    q: '*:*',
    rows: 0,
    facet_field: ['organization', 'tags', 'res_format'],
    facet_limit: 20
  });

  const dataset_count = searchResult.count;
  const facets = searchResult.search_facets;

  // Call 2: Organization details (names)
  const org_list = await makeCkanRequest(server_url, 'organization_list', {
    all_fields: false,
    limit: 10
  });

  // Call 3: CKAN version
  const status = await makeCkanRequest(server_url, 'status_show', {});

  // Merge facet counts with organization names
  const top_organizations = mergeOrgDataWithFacets(org_list, facets.organization);

  return {
    statistics: {
      dataset_count,
      organization_count: facets.organization.items.length,
      // ... other stats
    },
    top_organizations,
    top_tags: facets.tags.items,
    format_distribution: facets.res_format.items,
    metadata: {
      ckan_version: status.ckan_version,
      last_update: new Date().toISOString()
    }
  };
}
```

### Error Handling

Each API call wrapped in try-catch:
- Timeout: Return partial data with error indicator
- 404: Handle gracefully (portal may not support endpoint)
- Network error: Fail fast with clear error message

## Security Considerations

### Iframe Sandboxing

MCP Apps hosts render UI in sandboxed iframes. Our responsibilities:

**No XSS vulnerabilities:**
- All data from CKAN escaped before rendering
- No `innerHTML` with untrusted data - use `textContent`
- Chart.js handles its own escaping

**No external resources (except CDN):**
- Chart.js from trusted CDN (jsdelivr)
- No user-controlled URLs loaded
- No images, fonts, stylesheets from external sources

### JSON-RPC Message Validation

All tool calls validated by Zod schema:

```typescript
const PortalInfoSchema = z.object({
  server_url: z.string().url().describe("CKAN portal URL")
});
```

Server validates `server_url` is valid URL before making requests.

### User Consent

Hosts require user consent before executing tool calls from UI. Our responsibility: none (host enforces).

## Performance Considerations

### API Call Latency

Typical execution time:
- Fast portal (demo.ckan.org): 1-2 seconds
- Medium portal (data.gov): 2-3 seconds
- Large portal (dati.gov.it): 3-5 seconds

**Acceptable**: Interactive UI worth the wait, users expect some loading time.

**Optimization**: Use faceted search to minimize requests (2-3 calls vs 5-6).

### Bundle Size Impact

- `@modelcontextprotocol/ext-apps`: ~50KB
- Dashboard HTML (inline): ~15KB
- Chart.js (CDN): 0KB bundled, ~200KB download
- **Total**: ~65KB bundle increase

**Acceptable**: Small relative to existing bundle, CDN amortizes Chart.js cost.

### Chart Rendering Performance

Chart.js optimized for performance:
- 10 organizations: <10ms render time
- 8-10 format categories: <10ms
- 20 tags: <5ms (no chart, just list)

**No performance concerns** for typical dataset sizes.

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/portalinfo.test.ts
describe('Portal Info Tool', () => {
  it('should validate server_url parameter', () => {
    // Test Zod schema validation
  });

  it('should structure data correctly', () => {
    // Verify response has statistics, top_organizations, etc.
  });

  it('should include UI metadata', () => {
    // Verify _meta.ui.resourceUri present
  });

  it('should provide text fallback', () => {
    // Verify markdown table in content
  });
});
```

### Integration Tests

```typescript
// tests/integration/portalinfo.test.ts
describe('Portal Info with Mocked CKAN', () => {
  it('should handle successful API responses', () => {
    // Mock package_search, organization_list, status_show
    // Verify data aggregation correct
  });

  it('should handle API timeout gracefully', () => {
    // Mock timeout, verify partial data returned
  });

  it('should handle missing facets', () => {
    // Some portals don't support all facets
  });
});
```

### Manual Testing Checklist

1. **Data Accuracy**: Compare dashboard numbers with portal web UI
2. **Chart Correctness**: Verify chart data matches returned JSON
3. **Responsiveness**: Test on different screen sizes
4. **Error Handling**: Test with invalid URLs, unreachable servers
5. **Cross-Portal**: Test dati.gov.it, data.gov, demo.ckan.org
6. **Refresh**: Verify button updates all sections

## Future Extensions

This portal dashboard enables:

1. **Dataset Explorer**:
   - Tool: `ckan_dataset_explorer_ui`
   - UI: Searchable, filterable table of datasets
   - Pattern: Same structure, add advanced filtering

2. **Resource Viewer**:
   - Tool: `ckan_resource_view_ui`
   - UI: Preview CSV/JSON with sorting, pagination
   - Pattern: Table rendering + data transformation

3. **Geographic Map**:
   - Tool: `ckan_geo_view_ui`
   - UI: Leaflet map with dataset locations
   - Pattern: Same App class, add map library

4. **Time Series Analysis**:
   - Tool: `ckan_timeseries_ui`
   - UI: Line charts for dataset updates over time
   - Pattern: Chart.js line chart + temporal data

## Open Implementation Questions

1. **Should we cache portal statistics?**
   - Recommendation: No caching initially (consistent with other tools)
   - Future: Add TTL cache if performance becomes issue

2. **How to handle very large tag lists (100+ tags)?**
   - Recommendation: Show top 20, add "Show more" button
   - Alternative: Tag cloud with size proportional to count

3. **Should we add portal comparison (side-by-side)?**
   - Recommendation: No, single portal focus for MVP
   - Future: Separate comparison tool possible

4. **Add download statistics (view/download counts)?**
   - Recommendation: No, not universally supported across portals
   - Note: Would require DataStore SQL or additional API

5. **Include dataset quality scores (MQA)?**
   - Recommendation: No, only available for dati.gov.it
   - Alternative: Add conditional display if detected
