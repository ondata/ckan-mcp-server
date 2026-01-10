# CKAN MCP Server

[![npm version](https://img.shields.io/npm/v/@aborruso/ckan-mcp-server)](https://www.npmjs.com/package/@aborruso/ckan-mcp-server)

MCP (Model Context Protocol) server for interacting with CKAN-based open data portals.

## Features

- ✅ Support for any CKAN server (dati.gov.it, data.gov, demo.ckan.org, etc.)
- 🔍 Advanced search with Solr syntax
- 📊 DataStore queries for tabular data analysis
- 🏢 Organization and group exploration
- 📦 Complete dataset and resource metadata
- 🎨 Output in Markdown or JSON format
- ⚡ Pagination and faceting support
- 📄 MCP Resource Templates for direct data access
- 🧪 Comprehensive test suite (120 tests, 100% passing)

## Installation

### From npm (recommended)

```bash
npm install -g @aborruso/ckan-mcp-server
```

### From source

```bash
# Clone or copy the project
cd ckan-mcp-server

# Install dependencies
npm install

# Build with esbuild (fast, ~4ms)
npm run build

# Run tests (120 tests)
npm test
```

## Usage

### Start with stdio (for local integration)

```bash
npm start
```

### Start with HTTP (for remote access)

```bash
TRANSPORT=http PORT=3000 npm start
```

The server will be available at `http://localhost:3000/mcp`

## Usage Options

### Option 1: Local Installation (stdio mode)

**Best for**: Personal use with Claude Desktop

Install and run locally on your machine (see Installation section above).

### Option 2: Self-Hosted HTTP Server

**Best for**: Team use, custom infrastructure

Deploy on your own server using Node.js:

```bash
TRANSPORT=http PORT=3000 npm start
```

### Option 3: Cloudflare Workers ⭐ NEW

**Best for**: Global access, zero infrastructure, free hosting

Use the public Workers endpoint (no local install required):

```json
{
  "mcpServers": {
    "ckan": {
      "url": "https://ckan-mcp-server.andy-pr.workers.dev/mcp"
    }
  }
}
```

Want your own deployment? See [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Claude Desktop Configuration

Configuration file location:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Option 1: Global Installation (Recommended)

Install globally to use across all projects:

```bash
npm install -g @aborruso/ckan-mcp-server
```

Then add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ckan": {
      "command": "ckan-mcp-server"
    }
  }
}
```

### Option 2: Local Installation (Optional)

If you installed locally (see Installation), use this config:

```json
{
  "mcpServers": {
    "ckan": {
      "command": "node",
      "args": ["/absolute/path/to/project/node_modules/@username/ckan-mcp-server/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/project` with your actual project path.

### Option 3: From Source

If you cloned the repository:

```json
{
  "mcpServers": {
    "ckan": {
      "command": "node",
      "args": ["/absolute/path/to/ckan-mcp-server/dist/index.js"]
    }
  }
}
```

### Option 4: Cloudflare Workers (HTTP transport)

Use the public Cloudflare Workers deployment (no local installation required):

```json
{
  "mcpServers": {
    "ckan": {
      "url": "https://ckan-mcp-server.andy-pr.workers.dev/mcp"
    }
  }
}
```

**Note**: This uses the public endpoint. You can also deploy your own Workers instance and use that URL instead.

## Available Tools

### Search and Discovery

- **ckan_package_search**: Search datasets with Solr queries
- **ckan_find_relevant_datasets**: Rank datasets by relevance score
- **ckan_package_show**: Complete details of a dataset
- **ckan_package_list**: List all datasets
- **ckan_tag_list**: List tags with counts

### Organizations

- **ckan_organization_list**: List all organizations
- **ckan_organization_show**: Details of an organization

### DataStore

- **ckan_datastore_search**: Query tabular data
- **ckan_datastore_search_sql**: SQL queries on DataStore

### Groups

- **ckan_group_list**: List groups
- **ckan_group_show**: Show group details
- **ckan_group_search**: Search groups by name

### Utilities

- **ckan_status_show**: Verify server status

## MCP Resource Templates

Direct data access via `ckan://` URI scheme:

- `ckan://{server}/dataset/{id}` - Dataset metadata
- `ckan://{server}/resource/{id}` - Resource metadata and download URL
- `ckan://{server}/organization/{name}` - Organization details

Examples:

```
ckan://dati.gov.it/dataset/vaccini-covid
ckan://demo.ckan.org/resource/abc-123
ckan://data.gov/organization/sample-org
```

## Usage Examples

### Search datasets on dati.gov.it

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione",
  rows: 20
})
```

### Rank datasets by relevance

```typescript
ckan_find_relevant_datasets({
  server_url: "https://www.dati.gov.it/opendata",
  query: "mobilità urbana",
  limit: 5
})
```

### Filter by organization

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  sort: "metadata_modified desc"
})
```

### Search organizations with wildcard

```typescript
// Find all organizations containing "salute" in the name
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "organization:*salute*",
  rows: 0,
  facet_field: ["organization"],
  facet_limit: 100
})
```

### Get statistics with faceting

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["organization", "tags", "res_format"],
  rows: 0
})
```

### List tags (natural language: "show top tags about health")

```typescript
ckan_tag_list({
  server_url: "https://www.dati.gov.it/opendata",
  tag_query: "salute",
  limit: 25
})
```

### Search groups (natural language: "find groups about environment")

```typescript
ckan_group_search({
  server_url: "https://www.dati.gov.it/opendata",
  pattern: "ambiente"
})
```

### DataStore Query

```typescript
ckan_datastore_search({
  server_url: "https://www.dati.gov.it/opendata",
  resource_id: "abc-123-def",
  filters: { "regione": "Sicilia", "anno": 2023 },
  sort: "popolazione desc",
  limit: 50
})
```

### DataStore SQL Query

```typescript
ckan_datastore_search_sql({
  server_url: "https://demo.ckan.org",
  sql: "SELECT Country, COUNT(*) AS total FROM \"abc-123-def\" GROUP BY Country ORDER BY total DESC LIMIT 10"
})
```

## Supported CKAN Portals

Some of the main compatible portals:

- 🇮🇹 **www.dati.gov.it/opendata** - Italy
- 🇺🇸 **data.gov** - United States
- 🇨🇦 **open.canada.ca/data** - Canada
- 🇬🇧 **data.gov.uk** - United Kingdom
- 🇪🇺 **data.europa.eu** - European Union
- 🌍 **demo.ckan.org** - CKAN Demo
- And 500+ more portals worldwide

### Portal View URL Templates

Some CKAN portals expose non-standard web URLs for viewing datasets or organizations. To support those cases, this project ships with `src/portals.json`, which maps known portal API URLs (and aliases) to custom view URL templates.

When generating a dataset or organization view link, the server:

- matches the `server_url` against `api_url` and `api_url_aliases` in `src/portals.json`
- uses the portal-specific `dataset_view_url` / `organization_view_url` template when available
- falls back to the generic defaults (`{server_url}/dataset/{name}` and `{server_url}/organization/{name}`)

You can extend `src/portals.json` by adding new entries under `portals` if a portal uses different web URL patterns.

## Advanced Solr Queries

CKAN uses Apache Solr for search. Examples:

```
# Basic search
q: "popolazione"

# Field search
q: "title:popolazione"
q: "notes:sanità"

# Boolean operators
q: "popolazione AND sicilia"
q: "popolazione OR abitanti"
q: "popolazione NOT censimento"

# Filters (fq)
fq: "organization:comune-palermo"
fq: "tags:sanità"
fq: "res_format:CSV"

# Wildcard
q: "popolaz*"

# Date range
fq: "metadata_modified:[2023-01-01T00:00:00Z TO *]"
```

### Advanced Query Examples

These real-world examples demonstrate powerful Solr query combinations tested on the Italian open data portal (dati.gov.it):

#### 1. Fuzzy Search + Date Math + Boosting

Find healthcare datasets (tolerating spelling errors) modified in the last 6 months, prioritizing title matches:

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(title:sanità~2^3 OR title:salute~2^3 OR notes:sanità~1) AND metadata_modified:[NOW-6MONTHS TO *]",
  sort: "score desc, metadata_modified desc",
  rows: 30
})
```

**Techniques used**:

- `sanità~2` - Fuzzy search with edit distance 2 (finds "sanita", "sanitá", minor typos)
- `^3` - Boosts title matches 3x higher in relevance scoring
- `NOW-6MONTHS` - Dynamic date math for rolling time windows
- Combined boolean logic with multiple field searches

**Results**: 871 datasets including hospital units, healthcare organizations, medical services

#### 2. Proximity Search + Complex Boolean

Environmental datasets where "inquinamento" and "aria" (air pollution) appear close together, excluding water-related datasets:

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(notes:\"inquinamento aria\"~5 OR title:\"qualità aria\"~3) AND NOT (title:acqua OR title:mare)",
  facet_field: ["organization", "res_format"],
  rows: 25
})
```

**Techniques used**:

- `"inquinamento aria"~5` - Proximity search (words within 5 positions)
- `~3` - Tighter proximity for title matches
- `NOT (title:acqua OR title:mare)` - Exclude water/sea datasets
- Faceting for statistical breakdown

**Results**: 306 datasets, primarily air quality monitoring from Milan (44) and Palermo (161), formats: XML (150), CSV (124), JSON (76)

#### 3. Wildcard + Field Existence + Range Queries

Regional datasets with at least 5 resources, published in the last year:

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "organization:regione* AND num_resources:[5 TO *] AND metadata_created:[NOW-1YEAR TO *] AND res_format:*",
  sort: "num_resources desc, metadata_modified desc",
  facet_field: ["organization"],
  rows: 40
})
```

**Techniques used**:

- `regione*` - Wildcard matches all regional organizations
- `[5 TO *]` - Inclusive range (5 or more resources)
- `res_format:*` - Field existence check (has at least one resource format)
- `NOW-1YEAR` - Rolling 12-month window

**Results**: 5,318 datasets, top contributors: Lombardy (3,012), Tuscany (1,151), Puglia (460)

#### 4. Date Ranges + Exclusive Bounds

ISTAT datasets with moderate resource count (10-50), modified in specific date range:

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(title:istat OR organization:*istat*) AND num_resources:{9 TO 51} AND metadata_modified:[2025-07-01T00:00:00Z TO 2025-12-31T23:59:59Z]",
  sort: "metadata_modified desc",
  facet_field: ["res_format", "tags"],
  rows: 30
})
```

**Techniques used**:

- `{9 TO 51}` - Exclusive bounds (10-50 resources, excluding 9 and 51)
- `[2025-07-01T00:00:00Z TO 2025-12-31T23:59:59Z]` - Explicit date range
- Combined organization wildcard with title search
- Multiple facets for content analysis

**Note**: This specific query returned 0 results due to the narrow time window, demonstrating how precise constraints work.

### Solr Query Syntax Reference

**Boolean Operators**: `AND`, `OR`, `NOT`, `+required`, `-excluded`
**Wildcards**: `*` (multiple chars), `?` (single char) - Note: left truncation not supported
**Fuzzy**: `~N` (edit distance), e.g., `health~2`
**Proximity**: `"phrase"~N` (words within N positions)
**Boosting**: `^N` (relevance multiplier), e.g., `title:water^2`
**Ranges**:

- Inclusive: `[a TO b]`, e.g., `num_resources:[5 TO 10]`
- Exclusive: `{a TO b}`, e.g., `num_resources:{0 TO 100}`
- Open-ended: `[2024-01-01T00:00:00Z TO *]`

**Date Math**: `NOW`, `NOW-1YEAR`, `NOW-6MONTHS`, `NOW-7DAYS`, `NOW/DAY`
**Field Existence**: `field:*` (field exists), `NOT field:*` (field missing)

## Project Structure

```
ckan-mcp-server/
├── src/
│   ├── index.ts          # Entry point
│   ├── server.ts         # MCP server setup
│   ├── types.ts          # Types & schemas
│   ├── utils/
│   │   ├── http.ts       # CKAN API client
│   │   └── formatting.ts # Output formatting
│   ├── tools/
│   │   ├── package.ts    # Package search/show
│   │   ├── organization.ts # Organization tools
│   │   ├── datastore.ts  # DataStore queries
│   │   └── status.ts     # Server status
│   ├── resources/        # MCP Resource Templates
│   │   ├── index.ts
│   │   ├── uri.ts        # URI parsing
│   │   ├── dataset.ts
│   │   ├── resource.ts
│   │   └── organization.ts
│   └── transport/
│       ├── stdio.ts      # Stdio transport
│       └── http.ts       # HTTP transport
├── tests/                # Test suite (113 tests)
├── dist/                 # Compiled files (generated)
├── package.json
└── README.md
```

## Development

### Testing

The project uses **Vitest** for automated testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Test coverage target is 80%. Current test suite includes:

- Unit tests for utility functions (formatting, HTTP)
- Integration tests for MCP tools with mocked CKAN API responses
- Mock fixtures for CKAN API success and error scenarios

See `tests/README.md` for detailed testing guidelines.

### Build

The project uses **esbuild** for ultra-fast compilation (~4ms):

```bash
# Build with esbuild (default)
npm run build

# Watch mode for development
npm run watch
```

### Manual Testing

```bash
# Start server in HTTP mode
TRANSPORT=http PORT=3000 npm start

# In another terminal, test available tools
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Troubleshooting

### dati.gov.it URL

**Important**: The correct URL for the Italian portal is `https://www.dati.gov.it/opendata` (not `https://dati.gov.it`).

### Connection error

```
Error: Server not found: https://esempio.gov.it
```

**Solution**: Verify the URL is correct and the server is online. Use `ckan_status_show` to verify.

### No results

```typescript
// Use a more generic query
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "*:*"
})

// Check contents with faceting
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["tags", "organization"],
  rows: 0
})
```

## Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a branch for the feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT License - See LICENSE.txt file for complete details.

## Useful Links

- **CKAN**: https://ckan.org/
- **CKAN API Documentation**: https://docs.ckan.org/en/latest/api/
- **MCP Protocol**: https://modelcontextprotocol.io/

## Support

For issues or questions:

- Open an issue on GitHub
- Contact onData: https://www.ondata.it/

---

Created with ❤️ by onData for the open data community
