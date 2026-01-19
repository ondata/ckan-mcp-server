[![npm version](https://img.shields.io/npm/v/@aborruso/ckan-mcp-server)](https://www.npmjs.com/package/@aborruso/ckan-mcp-server)
[![GitHub](https://img.shields.io/badge/github-ondata%2Fckan--mcp--server-blue?logo=github)](https://github.com/ondata/ckan-mcp-server)
[![deepwiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ondata/ckan-mcp-server)

# CKAN MCP Server

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
- 🧭 Guided MCP prompts for common workflows
- 🧪 Test suite with 186 tests (100% passing)

---

👉 If you want to dive deeper, the [**AI-generated DeepWiki**](https://deepwiki.com/ondata/ckan-mcp-server) is very well done.

---

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

# Run tests (186 tests)
npm test
```

## Usage Options

### Option 1: Local Installation (stdio mode)

**Best for**: Personal use with local MCP clients

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

**NOTE**: This service uses the Cloudflare Workers free tier which has a limit of 100,000 requests per month.

Want your own deployment? See [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Guides

### Claude Desktop Configuration

Configuration file location:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Option 1: Global Installation (Recommended)

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

#### Option 2: Local Installation (Optional)

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

#### Option 3: From Source

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

[A detailed guide](https://github.com/ondata/ckan-mcp-server/discussions/4#discussion-9359684)

#### Option 4: Cloudflare Workers (HTTP transport)

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

**NOTE**: This service uses the Cloudflare Workers free tier which has a limit of 100,000 requests per month.

**Note**: This uses the public endpoint. You can also deploy your own Workers instance and use that URL instead.

### Web Tools Configuration

- [ChatGPT web](docs/guide/chatgpt/chatgpt_web.md)
- [Claude web](docs/guide/claude/claude_web.md)

These guides are based on a public demo server, which has a limit of 100,000 calls per month. For reliable usage, it is recommended to install the CKAN MCP Server on your own machine.

## Available Tools

### Search and Discovery

- **ckan_package_search**: Search datasets with Solr queries
- **ckan_find_relevant_datasets**: Rank datasets by relevance score
- **ckan_package_show**: Complete details of a dataset
- **ckan_tag_list**: List tags with counts

### Organizations

- **ckan_organization_list**: List all organizations
- **ckan_organization_show**: Details of an organization
- **ckan_organization_search**: Search organizations by name

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
- `ckan://{server}/group/{name}/datasets` - Datasets by group (theme)
- `ckan://{server}/organization/{name}/datasets` - Datasets by organization
- `ckan://{server}/tag/{name}/datasets` - Datasets by tag
- `ckan://{server}/format/{format}/datasets` - Datasets by resource format (res_format + distribution_format)

Examples:

```
ckan://dati.gov.it/dataset/vaccini-covid
ckan://demo.ckan.org/resource/abc-123
ckan://data.gov/organization/sample-org
ckan://dati.gov.it/group/ambiente/datasets
ckan://dati.gov.it/organization/regione-toscana/datasets
ckan://dati.gov.it/tag/turismo/datasets
ckan://dati.gov.it/format/csv/datasets
```

## Guided Prompts

Prompt templates that guide users through common CKAN workflows:

- **ckan-search-by-theme**: Find a theme/group and list datasets under it
- **ckan-search-by-organization**: Discover an organization and list its datasets
- **ckan-search-by-format**: Find datasets by resource format (CSV/JSON/etc.)
- **ckan-recent-datasets**: List recently updated datasets
- **ckan-analyze-dataset**: Inspect dataset metadata and explore DataStore resources

Example (retrieve a prompt by name with args):

```json
{
  "name": "ckan-search-by-theme",
  "arguments": {
    "server_url": "https://www.dati.gov.it/opendata",
    "theme": "ambiente",
    "rows": 10
  }
}
```

## Usage Examples

### Search datasets on dati.gov.it (natural language: "search for population datasets")

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione",
  rows: 20
})
```

### Force text-field parser for long OR queries (natural language: "find hotel or accommodation datasets")

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "hotel OR alberghi OR \"strutture ricettive\" OR ospitalità OR ricettività",
  query_parser: "text",
  rows: 0
})
```
Note: when `query_parser: "text"` is used, Solr special characters in the query are escaped automatically.

### Rank datasets by relevance (natural language: "find most relevant datasets about urban mobility")

```typescript
ckan_find_relevant_datasets({
  server_url: "https://www.dati.gov.it/opendata",
  query: "mobilità urbana",
  limit: 5
})
```

### Filter by organization (natural language: "show recent datasets from Sicilian Region")

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  sort: "metadata_modified desc"
})
```

### Search organizations with wildcard (natural language: "find all organizations with health/salute in name")

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

### Get statistics with faceting (natural language: "show statistics by organization, tags and format")

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

### DataStore Query (natural language: "query tabular data filtering by region and year")

```typescript
ckan_datastore_search({
  server_url: "https://www.dati.gov.it/opendata",
  resource_id: "abc-123-def",
  filters: { "regione": "Sicilia", "anno": 2023 },
  sort: "popolazione desc",
  limit: 50
})
```

### DataStore SQL Query (natural language: "count records by country with SQL")

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

Some CKAN portals expose non-standard web URLs for viewing datasets or organizations. To support those cases, this project ships with [`src/portals.json`](src/portals.json), which maps known portal API URLs (and aliases) to custom view URL templates.

When generating a dataset or organization view link, the server:

- matches the `server_url` against `api_url` and `api_url_aliases` in [`src/portals.json`](src/portals.json)
- uses the portal-specific `dataset_view_url` / `organization_view_url` template when available
- falls back to the generic defaults (`{server_url}/dataset/{name}` and `{server_url}/organization/{name}`)

You can extend [`src/portals.json`](src/portals.json) by adding new entries under `portals` if a portal uses different web URL patterns.

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

#### 1. Fuzzy Search + Date Math + Boosting (natural language: "find healthcare datasets modified in last 6 months")

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

#### 2. Proximity Search + Complex Boolean (natural language: "find air pollution datasets excluding water")

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

#### 3. Wildcard + Field Existence + Range Queries (natural language: "regional datasets with many resources from last year")

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

#### 4. Date Ranges + Exclusive Bounds (natural language: "ISTAT datasets with 10-50 resources from specific period")

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
│   ├── index.ts            # Entry point
│   ├── server.ts           # MCP server setup
│   ├── worker.ts           # Cloudflare Workers entry
│   ├── types.ts            # Types & schemas
│   ├── utils/
│   │   ├── http.ts         # CKAN API client
│   │   ├── formatting.ts   # Output formatting
│   │   └── url-generator.ts
│   ├── tools/
│   │   ├── package.ts      # Package search/show
│   │   ├── organization.ts # Organization tools
│   │   ├── datastore.ts    # DataStore queries
│   │   ├── status.ts       # Server status
│   │   ├── tag.ts          # Tag tools
│   │   └── group.ts        # Group tools
│   ├── resources/          # MCP Resource Templates
│   │   ├── index.ts
│   │   ├── uri.ts          # URI parsing
│   │   ├── dataset.ts
│   │   ├── resource.ts
│   │   └── organization.ts
│   ├── prompts/            # MCP Guided Prompts
│   │   ├── index.ts
│   │   ├── theme.ts
│   │   ├── organization.ts
│   │   ├── format.ts
│   │   ├── recent.ts
│   │   └── dataset-analysis.ts
│   └── transport/
│       ├── stdio.ts        # Stdio transport
│       └── http.ts         # HTTP transport
├── tests/                  # Test suite (184 tests)
├── dist/                   # Compiled files (generated)
├── package.json
└── README.md
```

## Development

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) to manage change proposals and keep specifications aligned with implementation.

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

Current test coverage: ~39% (utils: 98%, tools: 15-20%).

Test suite includes:
- Unit tests for utility functions (formatting, HTTP, URI parsing, URL generation)
- Integration tests for MCP tools with mocked CKAN API responses
- Mock fixtures for CKAN API success and error scenarios

Coverage is higher for utility modules and lower for tool handlers.
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

MIT License - See [LICENSE.txt](LICENSE.txt) for complete details.

Third-party attributions: See [NOTICE.md](NOTICE.md) for third-party software notices and information.

## Useful Links

- **CKAN**: https://ckan.org/
- **CKAN API Documentation**: https://docs.ckan.org/en/latest/api/
- **MCP Protocol**: https://modelcontextprotocol.io/

## Support

For issues or questions, [open an issue on GitHub](https://github.com/ondata/ckan-mcp-server/issues/new/choose).

---

Created with ❤️ by onData for the open data community
