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
- 🧪 Comprehensive test suite (101 tests, 100% passing)

## Installation

```bash
# Clone or copy the project
cd ckan-mcp-server

# Install dependencies
npm install

# Build with esbuild (fast, ~4ms)
npm run build

# Run tests (101 tests)
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

## Claude Desktop Configuration

Add to Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ckan": {
      "command": "node",
      "args": ["/path/to/ckan-mcp-server/dist/index.js"]
    }
  }
}
```

Su macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Su Windows: `%APPDATA%\Claude\claude_desktop_config.json`
Su Linux: `~/.config/Claude/claude_desktop_config.json`

## Available Tools

### Search and Discovery

- **ckan_package_search**: Search datasets with Solr queries
- **ckan_package_show**: Complete details of a dataset
- **ckan_package_list**: List all datasets

### Organizations

- **ckan_organization_list**: List all organizations
- **ckan_organization_show**: Details of an organization

### DataStore

- **ckan_datastore_search**: Query tabular data
- **ckan_datastore_search_sql**: SQL queries (in development)

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

## Supported CKAN Portals

Some of the main compatible portals:

- 🇮🇹 **www.dati.gov.it/opendata** - Italy
- 🇺🇸 **data.gov** - United States
- 🇨🇦 **open.canada.ca/data** - Canada
- 🇬🇧 **data.gov.uk** - United Kingdom
- 🇪🇺 **data.europa.eu** - European Union
- 🌍 **demo.ckan.org** - CKAN Demo
- And 500+ more portals worldwide

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

## Project Structure

```
ckan-mcp-server/
├── src/
│   └── index.ts          # MCP server implementation
├── dist/                 # Compiled files (generated)
├── package.json          # npm dependencies
├── tsconfig.json         # TypeScript configuration
├── README.md             # This file
└── SKILL.md             # Detailed skill documentation
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

MIT License - See SKILL.md file for complete details.

## Useful Links

- **CKAN**: https://ckan.org/
- **CKAN API Documentation**: https://docs.ckan.org/en/latest/api/
- **MCP Protocol**: https://modelcontextprotocol.io/
- **onData**: https://www.ondata.it/
- **dati.gov.it**: https://www.dati.gov.it/opendata/

## Support

For issues or questions:
- Open an issue on GitHub
- Contact onData: https://www.ondata.it/

---

Created with ❤️ by onData for the open data community
