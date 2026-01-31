# Product Requirements Document (PRD)

## CKAN MCP Server

**Version**: 0.4.27
**Last Updated**: 2026-01-31
**Author**: onData
**Status**: Production

---

## 1. Executive Summary

CKAN MCP Server is a Model Context Protocol (MCP) server that enables AI agents (like Claude Desktop) to interact with over 500 CKAN-based open data portals worldwide. The server exposes MCP tools to search datasets, explore organizations, query tabular data, and access complete metadata.

### 1.1 Problem Statement

AI agents lack native capabilities to:
- Discover and search datasets in open data portals
- Query structured metadata from government datasets
- Execute queries on tabular data published on CKAN portals
- Explore public organizations and their open data production

### 1.2 Solution

An MCP server that exposes tools to interact with CKAN API v3, enabling AI agents to:
- Search datasets with advanced Solr queries and relevance ranking
- Get complete metadata for datasets and resources
- Explore organizations, groups, and tags
- Query DataStore with filters, sorting, and SQL queries
- Analyze statistics through faceting
- Global deployment on Cloudflare Workers for worldwide edge access

**Distribution Strategy**: Multi-platform deployment:
- **npm registry**: Global installation with `npm install -g @aborruso/ckan-mcp-server`
- **Cloudflare Workers**: Global edge deployment (https://ckan-mcp-server.andy-pr.workers.dev)
- **Self-hosted**: HTTP server mode for custom infrastructure

---

## 2. Target Audience

### 2.1 Primary Users

- **Data Scientist & Analyst**: Research and analysis of public datasets
- **Civic Hacker & Developer**: Application development on open data
- **Researcher & Journalist**: Investigation and analysis of government data
- **Public Administration**: Exploration of open data catalogs

### 2.2 AI Agent Use Cases

- **Claude Desktop**: Native integration via MCP configuration
- **Other MCP clients**: Any MCP protocol-compatible client
- **Automation**: Scripts and workflows requiring CKAN access

---

## 3. Core Requirements

### 3.1 Functional Requirements

#### FR-1: Dataset Search
- **Priority**: High
- **Description**: Search datasets on any CKAN server using Solr syntax
- **Acceptance Criteria**:
  - Full-text query support (q parameter)
  - Advanced filters (fq parameter)
  - Faceting for statistics (organization, tags, formats)
  - Pagination (start/rows)
  - Sorting (sort parameter)
  - Output in Markdown or JSON format
- **Implementation Status**: ✅ Implemented (`ckan_package_search`)

#### FR-2: Dataset Details
- **Priority**: High
- **Description**: Get complete metadata for a specific dataset
- **Acceptance Criteria**:
  - Search by ID or name
  - Basic metadata (title, description, author, license)
  - Resource list with details (format, size, URL, DataStore status)
  - Access service endpoints and effective download URL when available
  - Issued/modified content dates and harvested metadata timestamp
  - Organization and tags
  - Custom extra fields
  - Optional tracking statistics
- **Implementation Status**: ✅ Implemented (`ckan_package_show`)

#### FR-3: Organization Discovery
- **Priority**: Medium
- **Description**: Explore organizations publishing datasets
- **Acceptance Criteria**:
  - List all organizations (with/without full details)
  - Search by name pattern
  - Sorting and pagination
  - Dataset count per organization
  - Complete organization details with dataset list
- **Implementation Status**: ✅ Implemented (`ckan_organization_list`, `ckan_organization_show`, `ckan_organization_search`)

#### FR-4: DataStore Query
- **Priority**: High
- **Description**: Query tabular data in CKAN DataStore with standard queries and SQL
- **Acceptance Criteria**:
  - Query by resource_id
  - Key-value filters
  - Full-text search (q parameter)
  - Sorting and field selection
  - Pagination (limit/offset)
  - Distinct values
  - SQL queries with SELECT, WHERE, JOIN, GROUP BY
- **Implementation Status**: ✅ Implemented (`ckan_datastore_search`, `ckan_datastore_search_sql`)

#### FR-5: Tag Management
- **Priority**: Medium
- **Description**: Explore available tags in CKAN portals
- **Acceptance Criteria**:
  - List all tags with dataset count
  - Search by name pattern
  - Pagination and sorting
  - Faceting with vocabularies
- **Implementation Status**: ✅ Implemented (`ckan_tag_list`)

#### FR-6: Group Management
- **Priority**: Medium
- **Description**: Explore thematic groups in CKAN portals
- **Acceptance Criteria**:
  - List all groups
  - Search by pattern
  - Group details with included datasets
  - Sorting and pagination
- **Implementation Status**: ✅ Implemented (`ckan_group_list`, `ckan_group_show`, `ckan_group_search`)

#### FR-7: AI-Powered Dataset Discovery
- **Priority**: High
- **Description**: Search datasets with AI-based relevance ranking
- **Acceptance Criteria**:
  - Natural language queries
  - Scoring based on title/description/tags match
  - Automatic relevance ranking
  - Output with score visibility
- **Implementation Status**: ✅ Implemented (`ckan_find_relevant_datasets`)

#### FR-8: Server Status Check
- **Priority**: Low
- **Description**: Check availability and version of a CKAN server
- **Acceptance Criteria**:
  - Server connection verification
  - CKAN version information
  - Site title and URL
- **Implementation Status**: ✅ Implemented (`ckan_status_show`)

#### FR-9: Quality Metrics (MQA)
- **Priority**: Medium
- **Description**: Retrieve quality metrics for datasets from data.europa.eu MQA API
- **Acceptance Criteria**:
  - Query MQA API for dati.gov.it datasets
  - Return overall score and dimension breakdown (accessibility, reusability, interoperability, findability)
  - Visual indicators (✅/⚠️) for dimension scores
  - Handle identifier normalization (colons to hyphens, dot separators)
  - Support disambiguation suffixes (~~1, ~~2)
- **Implementation Status**: ✅ Implemented (`ckan_get_mqa_quality`)

### 3.2 Non-Functional Requirements

#### NFR-1: Performance
- **Response Time**: HTTP timeout at 30 seconds
- **Throughput**: Limited by remote CKAN server APIs
- **Scalability**: 
  - Stateless, can handle multiple parallel requests
  - Cloudflare Workers: global edge deployment with cold start < 60ms
  - Workers free tier: 100,000 requests/day
- **Bundle Size**: ~420KB (135KB gzipped)

#### NFR-2: Reliability
- **Error Handling**: 
  - HTTP error management (404, 500, timeout)
  - Input validation with Zod strict schemas
  - Descriptive error messages
  - WAF bypass with browser-like headers (User-Agent, Sec-*, Referer)
  - Portal hostname resolution to API URL
- **Availability**: Depends on remote CKAN server availability

#### NFR-3: Usability
- **Output Format**: 
  - Markdown for human readability (default)
  - JSON for programmatic processing
- **Character Limit**: Automatic truncation at 50,000 characters
- **Documentation**: 
  - Complete README with examples
  - EXAMPLES.md with advanced use cases
  - HTML readme on worker root endpoint
  - Complete deployment guide

#### NFR-4: Compatibility
- **CKAN Versions**: API v3 (compatible with CKAN 2.x and 3.x)
- **Node.js**: >= 18.0.0 (for local installation)
- **Transport Modes**: 
  - stdio (default) for local integration
  - HTTP for remote access
  - Cloudflare Workers for global edge deployment
- **Runtimes**:
  - Node.js (local/self-hosted)
  - Cloudflare Workers (browser runtime, Web Standards API)

#### NFR-5: Security
- **Authentication**: Not supported (public endpoints only)
- **Read-Only**: All tools are read-only, no data modification
- **Input Validation**: Strict schema validation with Zod

---

## 4. Technical Architecture

### 4.1 Technology Stack

**Runtime**:
- Node.js >= 18.0.0 (local/self-hosted)
- Cloudflare Workers (browser runtime, edge deployment)
- TypeScript (ES2022)

**Dependencies**:
- `@modelcontextprotocol/sdk@^1.0.4` - MCP protocol implementation
- `axios@^1.7.2` - HTTP client
- `zod@^3.23.8` - Schema validation
- `express@^4.19.2` - HTTP server (HTTP mode, optional)

**Build Tools**:
- `esbuild@^0.27.2` - Ultra-fast bundler (~50ms)
- `typescript@^5.4.5` - Type checking and editor support
- `wrangler@^4.58.0` - Cloudflare Workers CLI

**Test Framework**:
- `vitest@^4.0.16` - Test runner (217 tests, 100% passing)

### 4.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  MCP Client                         │
│              (Claude Desktop, etc.)                 │
└─────────────┬───────────────────────────────────────┘
              │
              │ MCP Protocol (stdio, HTTP, or Workers)
              │
┌─────────────▼───────────────────────────────────────┐
│              CKAN MCP Server                        │
│              (Node.js or Workers runtime)           │
│  ┌───────────────────────────────────────────────┐  │
│  │  MCP Tool Registry (14 tools)                 │  │
│  │  - ckan_package_search                        │  │
│  │  - ckan_package_show                          │  │
│  │  - ckan_find_relevant_datasets                │  │
│  │  - ckan_organization_list/show/search         │  │
│  │  - ckan_group_list/show/search                │  │
│  │  - ckan_tag_list                              │  │
│  │  - ckan_datastore_search                      │  │
│  │  - ckan_datastore_search_sql                  │  │
│  │  - ckan_status_show                           │  │
│  │  - ckan_get_mqa_quality                       │  │
│  └───────────┬───────────────────────────────────┘  │
│              │                                       │
│  ┌───────────▼───────────────────────────────────┐  │
│  │  HTTP Client (axios/fetch)                    │  │
│  │  - Timeout: 30s                               │  │
│  │  - User-Agent: CKAN-MCP-Server/0.4.x          │  │
│  │  - Portal config with search parser override │  │
│  └───────────┬───────────────────────────────────┘  │
└──────────────┼───────────────────────────────────────┘
               │
               │ HTTPS
               │
┌──────────────▼───────────────────────────────────────┐
│           CKAN Servers (worldwide)                   │
│  - dati.gov.it (IT)                                  │
│  - data.gov (US)                                     │
│  - open.canada.ca (CA)                               │
│  - data.gov.uk (UK)                                  │
│  - data.europa.eu (EU)                               │
│  - 500+ other CKAN portals                           │
└──────────────────────────────────────────────────────┘
```

### 4.3 Component Description

#### MCP Tool Registry
Registers available MCP tools with:
- Input schema (Zod validation)
- Output format (Markdown/JSON)
- MCP annotations (readonly, idempotent, etc.)
- Handler function

#### HTTP Client Layer
- Normalizes server URL (removes trailing slash)
- Builds API endpoint: `{server_url}/api/3/action/{action}`
- Handles timeout and errors
- Validates response (`success: true`)

#### Output Formatter
- Markdown: Tables, sections, formatting for readability
- JSON: Structured output with `structuredContent`
- Truncation: Limits output to CHARACTER_LIMIT (50000)

---

## 5. MCP Tools Specification

### 5.1 ckan_package_search

**Purpose**: Search datasets with advanced Solr queries

**Input Parameters**:
```typescript
{
  server_url: string (required)      // CKAN server base URL
  q: string (default: "*:*")         // Solr query
  fq?: string                         // Filter query
  rows: number (default: 10)          // Results per page (max 1000)
  start: number (default: 0)          // Pagination offset
  sort?: string                       // E.g.: "metadata_modified desc"
  facet_field?: string[]              // Fields for faceting
  facet_limit: number (default: 50)   // Max values per facet
  include_drafts: boolean (default: false)
  response_format: "markdown" | "json" (default: "markdown")
}
```

**Output**:
- Total results count
- Array of datasets with basic metadata
- Facets (if requested)
- Pagination links

**Solr Query Examples**:
- `q: "popolazione"` - Full-text search
- `q: "title:covid"` - Search in field
- `q: "tags:sanità"` - Tag filter
- `fq: "organization:comune-palermo"` - Organization filter
- `fq: "res_format:CSV"` - Resource format filter

### 5.2 ckan_package_show

**Purpose**: Complete details of a dataset

**Input Parameters**:
```typescript
{
  server_url: string (required)
  id: string (required)               // Dataset ID or name
  include_tracking: boolean (default: false)
  response_format: "markdown" | "json"
}
```

**Output**:
- Complete metadata (title, description, author, license)
- Organization
- Tags and groups
- Resource list with details (format, size, URL, DataStore status)
- Custom extra fields

### 5.3 ckan_organization_list

**Purpose**: List organizations

**Input Parameters**:
```typescript
{
  server_url: string (required)
  all_fields: boolean (default: false)
  sort: string (default: "name asc")
  limit: number (default: 100)        // 0 for count only
  offset: number (default: 0)
  response_format: "markdown" | "json"
}
```

**Output**:
- Array of organizations (names or complete objects)
- If `limit=0`: count of organizations with datasets

### 5.4 ckan_organization_show

**Purpose**: Specific organization details

**Input Parameters**:
```typescript
{
  server_url: string (required)
  id: string (required)               // Organization ID or name
  include_datasets: boolean (default: true)
  include_users: boolean (default: false)
  response_format: "markdown" | "json"
}
```

**Output**:
- Organization details
- Dataset list (optional)
- User list with roles (optional)

### 5.5 ckan_organization_search

**Purpose**: Search organizations by pattern

**Input Parameters**:
```typescript
{
  server_url: string (required)
  pattern: string (required)          // Pattern (automatic wildcards)
  response_format: "markdown" | "json"
}
```

**Output**:
- List of matching organizations
- Dataset count per organization
- Total datasets

**Implementation**: Uses `package_search` with `organization:*{pattern}*` and faceting

### 5.6 ckan_datastore_search

**Purpose**: Query tabular data in DataStore

**Input Parameters**:
```typescript
{
  server_url: string (required)
  resource_id: string (required)
  q?: string                          // Full-text search
  filters?: Record<string, any>       // Key-value filters
  limit: number (default: 100)        // Max 32000
  offset: number (default: 0)
  fields?: string[]                   // Fields to return
  sort?: string                       // E.g.: "anno desc"
  distinct: boolean (default: false)
  response_format: "markdown" | "json"
}
```

**Output**:
- Total records count
- Fields metadata (type, id)
- Records (max 50 in markdown for readability)
- Pagination info

**Limitations**:
- Not all resources have active DataStore
- Max 32000 records per query

### 5.7 ckan_status_show

**Purpose**: Check CKAN server status

**Input Parameters**:
```typescript
{
  server_url: string (required)
}
```

**Output**:
- Online status
- CKAN version
- Site title
- Site URL

---

## 6. Supported CKAN Portals

The server can connect to **any public CKAN server**. Main portals:

| Country | Portal | URL |
|---------|--------|-----|
| 🇮🇹 Italia | Portale Nazionale Dati Aperti | https://www.dati.gov.it/opendata |
| 🇺🇸 USA | Data.gov | https://catalog.data.gov |
| 🇨🇦 Canada | Open Government | https://open.canada.ca/data |
| 🇬🇧 UK | Data.gov.uk | https://data.gov.uk |
| 🇪🇺 EU | European Data Portal | https://data.europa.eu |
| 🌍 Demo | CKAN Official Demo | https://demo.ckan.org |

**Compatibility**:
- CKAN API v3 (CKAN 2.x and 3.x)
- Over 500 portals worldwide

---

## 7. Installation & Deployment

### 7.1 Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### 7.2 Installation

#### Option 1: npm Package (Recommended)

**Global Installation**:
```bash
npm install -g @aborruso/ckan-mcp-server
```

**npx (No Installation)**:
```bash
npx @aborruso/ckan-mcp-server@latest
```

#### Option 2: From Source (Alternative)

```bash
git clone https://github.com/ondata/ckan-mcp-server
cd ckan-mcp-server
npm install
npm run build
```

### 7.3 Usage Modes

#### stdio Mode (Default)
For integration with Claude Desktop and other local MCP clients:

```bash
npm start
```

**Claude Desktop Configuration** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ckan": {
      "command": "npx",
      "args": ["@aborruso/ckan-mcp-server@latest"]
    }
  }
}
```

**Using global installation**:
```bash
npm install -g @aborruso/ckan-mcp-server
```

```json
{
  "mcpServers": {
    "ckan": {
      "command": "ckan-mcp-server"
    }
  }
}
```

#### HTTP Mode
For remote access via HTTP:

```bash
TRANSPORT=http PORT=3000 npm start
```

Server available at: `http://localhost:3000/mcp`

**Test HTTP endpoint**:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### 7.4 Build System

The project uses **esbuild** (not tsc) for:
- Ultra-fast build (~4ms vs minutes with tsc)
- Minimal memory usage (important in WSL)
- Automatic bundling with tree-shaking

```bash
npm run build        # Build con esbuild
npm run watch        # Watch mode
npm run dev          # Build + run
```

---

## 8. Use Cases & Examples

### 8.1 Use Case 1: Dataset Discovery

**Scenario**: A data scientist searches for datasets on Italian population

```typescript
// Step 1: Cerca dataset
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione",
  rows: 20,
  sort: "metadata_modified desc"
})

// Step 2: Get details of interesting dataset
ckan_package_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "popolazione-residente-2023"
})
```

### 8.2 Use Case 2: Organization Analysis

**Scenario**: Analyze regional open data production

```typescript
// Step 1: Search for regional organizations
ckan_organization_search({
  server_url: "https://www.dati.gov.it/opendata",
  pattern: "regione"
})

// Step 2: Analyze datasets of a region
ckan_organization_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "regione-siciliana",
  include_datasets: true
})

// Step 3: Search for organization-specific datasets
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  facet_field: ["tags", "res_format"],
  rows: 50
})
```

### 8.3 Use Case 3: Data Analysis with DataStore

**Scenario**: Analyze COVID-19 tabular data

```typescript
// Step 1: Cerca dataset COVID
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "covid",
  fq: "res_format:CSV"
})

// Step 2: Get details and resource_id
ckan_package_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "covid-19-italia"
})

// Step 3: Query DataStore
ckan_datastore_search({
  server_url: "https://www.dati.gov.it/opendata",
  resource_id: "abc-123-def",
  filters: { "regione": "Sicilia" },
  sort: "data desc",
  limit: 100
})
```

### 8.4 Use Case 4: Statistical Analysis with Faceting

**Scenario**: Analyze dataset distribution by format and organization

```typescript
// Format statistics
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["res_format"],
  facet_limit: 100,
  rows: 0  // Only facets, no results
})

// Organization statistics
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["organization"],
  facet_limit: 50,
  rows: 0
})

// Tag distribution
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["tags"],
  facet_limit: 50,
  rows: 0
})
```

---

## 9. Limitations & Constraints

### 9.1 Current Limitations

1. **Read-Only**: 
   - Does not support dataset creation/modification
   - Only public endpoints (no authentication)

2. **Character Limit**:
   - Output truncated at 50,000 characters
   - Hardcoded, not configurable

3. **No Caching**:
   - Every request makes a fresh HTTP call
   - Cloudflare Workers can use edge cache (optional)

4. **DataStore Limitations**:
   - Not all resources have active DataStore
   - Max 32,000 records per query
   - Depends on CKAN server configuration

5. **SQL Support Limitations**:
   - `ckan_datastore_search_sql` works only if the portal exposes the SQL endpoint
   - Some portals disable SQL for security reasons
   - Workers runtime supports SQL queries without limitations

6. **Timeout**:
   - Fixed 30 seconds for HTTP request
   - Cloudflare Workers has stricter timeout (10s per fetch)

7. **Locale**:
   - Dates formatted in ISO `YYYY-MM-DD`
   - Not parameterized

### 9.2 External Dependencies

- **Network**: Requires internet connection
- **CKAN Server Availability**: Depends on remote server availability
- **CKAN API Compatibility**: Requires CKAN API v3

### 9.3 Known Issues

- Cloudflare Workers has stricter timeout (10s) compared to Node.js (30s)
- Some CKAN portals have non-standard configurations that might require workarounds

---

## 10. Future Enhancements

### 10.1 Completed Features

#### ✅ npm Package Publication (v0.3.2+)
- Published on npm registry: `@aborruso/ckan-mcp-server`
- Global installation: `npm install -g @aborruso/ckan-mcp-server`
- Executable CLI: `ckan-mcp-server`
- Semantic versioning (semver)
  
#### ✅ SQL Query Support (v0.4.4)
- Implemented `ckan_datastore_search_sql`
- Full support for SELECT, WHERE, JOIN, GROUP BY
- Requires portals with active DataStore SQL

#### ✅ AI-Powered Discovery (v0.4.6)
- Tool `ckan_find_relevant_datasets`
- Relevance ranking with scoring
- Natural language queries

#### ✅ Tags and Groups (v0.4.3)
- Tool `ckan_tag_list` with faceting
- Tool `ckan_group_list`, `ckan_group_show`, `ckan_group_search`
- Full support for taxonomy exploration

#### ✅ Cloudflare Workers Deployment (v0.4.0)
- Global edge deployment: https://ckan-mcp-server.andy-pr.workers.dev
- Free tier: 100k requests/day
- Cold start < 60ms
- Complete documentation in DEPLOYMENT.md

#### ✅ Portal Search Parser Configuration (v0.4.7)
- Per-portal query parser override
- Handling portals with restrictive parsers
- URL generator for browse/search links

#### ✅ MQA Quality Metrics Tool (v0.4.16 - v0.4.26)
- Tool `ckan_get_mqa_quality` for retrieving quality metrics from data.europa.eu
- Supports dati.gov.it datasets with identifier normalization (colons → hyphens, dot separators)
- Dimension score breakdown: accessibility, reusability, interoperability, findability (max 405 points)
- Visual indicators (✅/⚠️) for quick diagnosis
- Disambiguation suffix support (~~1, ~~2) for datasets with multiple matches
- Direct metrics endpoint link in output

#### ✅ Date Query Auto-Conversion (v0.4.14)
- Automatic conversion of NOW-based date math for `modified` and `issued` fields
- Converts queries like `modified:[NOW-30DAYS TO NOW]` to ISO dates
- Supports DAYS, MONTHS, YEARS units
- Backward compatible with existing queries

#### ✅ Portal Hostname Resolution (v0.4.26)
- Automatic resolution of portal hostnames to API URLs
- Supports both www and non-www variants
- Handles ANAC and other portal aliases

#### ✅ WAF Bypass Headers (v0.4.24)
- Browser-like headers (User-Agent, Sec-*, Referer) to avoid WAF blocks
- Improved compatibility with restrictive CKAN portals
- Applied to all HTTP requests automatically

### 10.2 Planned Features

#### High Priority

- [ ] **Authentication Support**
  - API key for private endpoints
  - OAuth for portals that support it
  
- [ ] **Caching Layer**
  - Cache frequent results in Workers KV
  - Configurable TTL
  - Invalidation strategy

#### Medium Priority

- [ ] **Advanced DataStore Features**
  - Support for aggregations
  - JOIN between resources
  - Computed fields

- [ ] **Batch Operations**
  - Multiple parallel queries
  - Bulk export

- [ ] **Configuration**
  - Configurable timeout
  - Configurable character limit
  - Configurable locale

#### Low Priority

- [ ] **Write Operations** (se richiesto)
  - Create/update dataset
  - Upload risorse
  - Requires authentication

- [ ] **Advanced Filtering**
  - Spatial filters (geo queries)
  - Temporal filters (date ranges)

- [ ] **Export Formats**
  - CSV export
  - Excel export
  - Graph visualization data

### 10.2 Distribution & Deployment

✅ **Completed**:
- npm registry publication: `@aborruso/ckan-mcp-server`
- Global installation: `npm install -g @aborruso/ckan-mcp-server`
- CLI command: `ckan-mcp-server`
- GitHub Releases with semantic tags
- Cloudflare Workers deployment

**Future**:
- [ ] Docker image (optional)
- [ ] Kubernetes deployment examples

### 10.3 Testing & Quality

✅ **Current State**:
- 217 unit and integration tests (100% passing)
- vitest test runner
- Coverage for all 14 tools
- Fixtures for offline testing

**Future**:
- [ ] Performance benchmarks
- [ ] E2E tests with live CKAN server
- [ ] Load testing on Workers

### 10.4 Documentation

✅ **Current State**:
- Complete README with examples
- EXAMPLES.md with advanced use cases
- DEPLOYMENT.md with release workflow
- HTML readme on worker root
- Updated PRD.md

**Future**:
- [ ] OpenAPI/Swagger spec for HTTP mode
- [ ] Video tutorial
- [ ] Best practices guide for query optimization

---

## 11. Success Metrics

### 11.1 Technical Metrics

- **Build Time**: ~50-70ms (esbuild Node.js + Workers)
- **Bundle Size**: ~420KB (~135KB gzipped)
- **Memory Usage**: < 50MB runtime (Node.js), Workers limits apply
- **Response Time**: < 30s (CKAN API timeout), < 10s (Workers)
- **Cold Start**: < 60ms (Cloudflare Workers)
- **Test Coverage**: 217 tests (100% passing)

### 11.2 Distribution Metrics

✅ **Achieved**:
- npm package published: `@aborruso/ckan-mcp-server`
- Installation time: < 1 minute
- GitHub releases with semantic versioning
- Cloudflare Workers deployment live

**Future tracking**:
- npm weekly/monthly downloads
- Workers request count (100k/day free tier)
- Installation success rate

### 11.3 Usage Metrics

- Number of MCP tool calls per session
- Most used tools
- Average results per search
- Error rate by tool
- Server coverage (unique CKAN servers used)

### 11.4 Quality Metrics

- Zero known security vulnerabilities
- Error messages clarity
- Documentation completeness
- User satisfaction (GitHub issues/feedback)

---

## 12. References

### 12.1 Documentation

- [CKAN API Documentation](https://docs.ckan.org/en/latest/api/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Apache Solr Query Syntax](https://solr.apache.org/guide/solr/latest/query-guide/standard-query-parser.html)

### 12.2 Related Resources

- [CKAN Official Site](https://ckan.org/)
- [onData Community](https://www.ondata.it/)
- [dati.gov.it](https://www.dati.gov.it/opendata/)

### 12.3 Code Repository

- **GitHub**: https://github.com/aborruso/ckan-mcp-server
- **npm**: https://www.npmjs.com/package/@aborruso/ckan-mcp-server
- **Live Demo**: https://ckan-mcp-server.andy-pr.workers.dev
- **License**: MIT License
- **Author**: Andrea Borruso (@aborruso)
- **Community**: onData

---

## 13. Appendix

### 13.1 Glossary

- **CKAN**: Comprehensive Knowledge Archive Network - open source platform for open data portals
- **MCP**: Model Context Protocol - protocol for integrating AI agents with external tools
- **Solr**: Apache Solr - full-text search engine used by CKAN
- **DataStore**: CKAN feature for SQL-like queries on tabular data
- **Faceting**: Statistical aggregations for distributive analysis
- **Package**: CKAN term for "dataset"
- **Resource**: File or API endpoint associated with a dataset

### 13.2 Solr Query Syntax Quick Reference

```
# Full-text search
q: "popolazione"

# Field search
q: "title:covid"
q: "notes:sanità"

# Boolean operators
q: "popolazione AND sicilia"
q: "popolazione OR abitanti"
q: "popolazione NOT censimento"

# Wildcard
q: "popola*"
q: "*salute*"

# Filter query (no score impact)
fq: "organization:comune-palermo"
fq: "res_format:CSV"

# Date range
fq: "metadata_modified:[2023-01-01T00:00:00Z TO *]"
fq: "metadata_created:[NOW-7DAYS TO NOW]"
```

### 13.3 Response Format Examples

**Markdown Output** (human-readable):
```markdown
# CKAN Package Search Results

**Server**: https://www.dati.gov.it/opendata
**Query**: popolazione
**Total Results**: 1234

## Datasets

### Popolazione Residente 2023
- **ID**: `abc-123-def`
- **Organization**: ISTAT
- **Tags**: popolazione, demografia, censimento
...
```

**JSON Output** (machine-readable):
```json
{
  "count": 1234,
  "results": [
    {
      "id": "abc-123-def",
      "name": "popolazione-residente-2023",
      "title": "Popolazione Residente 2023",
      "organization": { "name": "istat", "title": "ISTAT" }
    }
  ]
}
```

---

**Document Version**: 1.0.0  
**Created**: 2026-01-08  
**Status**: Approved  
**Next Review**: 2026-04-08
