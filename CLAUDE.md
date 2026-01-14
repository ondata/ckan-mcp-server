<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Important**: This project uses **English** as its primary language. All documentation, code comments, and commit messages should be in English.

## Project Overview

CKAN MCP Server - MCP (Model Context Protocol) server for interacting with CKAN-based open data portals (dati.gov.it, data.gov, demo.ckan.org, etc.).

The server exposes MCP tools for:
- Advanced dataset search with Solr syntax
- DataStore queries for tabular data analysis
- Organization and group exploration
- Complete metadata access

## Build and Development

### Main Commands

```bash
# Build project (uses esbuild - fast and lightweight)
npm run build

# Run test suite (179 tests - unit + integration)
npm test

# Watch mode for tests during development
npm run test:watch

# Test coverage report
npm run test:coverage

# Start server in stdio mode (default for local integration)
npm start

# Start server in HTTP mode (for remote access)
TRANSPORT=http PORT=3000 npm start

# Watch mode for development
npm run watch

# Build + run
npm run dev

# Cloudflare Workers deployment (v0.4.0+)
npm run build:worker      # Build for Workers
npm run dev:worker        # Test locally with Wrangler
npm run deploy            # Deploy to Cloudflare Workers
```

### Build System

The project uses **esbuild** for compilation and **vitest** for testing:

- **Build**: Ultra-fast builds (milliseconds instead of minutes)
- **Tests**: 179 tests (unit + integration) with 100% success rate
- **Coverage**: ~39% overall (utils: 98%, tools: 15-20%) - available via vitest with v8 coverage engine

The `build:tsc` script is available as a fallback but can cause memory issues in some environments (particularly WSL). Always use `npm run build` which uses esbuild.

The esbuild build bundles all internal modules but keeps external dependencies (`@modelcontextprotocol/sdk`, `axios`, `express`, `zod`) as external, so they must be present in `node_modules`.

### Testing

The project has a comprehensive test suite using **Vitest**:

```
tests/
├── unit/
│   ├── formatting.test.ts    # Utility functions (19 tests)
│   ├── http.test.ts           # HTTP client (6 tests)
│   └── uri.test.ts            # URI parsing (11 tests)
├── integration/
│   ├── package.test.ts        # Package tools (29 tests)
│   ├── organization.test.ts   # Organization tools (6 tests)
│   ├── datastore.test.ts      # DataStore tools (17 tests)
│   ├── resources.test.ts      # MCP Resources (11 tests)
│   └── status.test.ts         # Status tools (2 tests)
└── fixtures/
    ├── responses/             # Success response mocks
    └── errors/                # Error scenario mocks
```

**Test Coverage**: 179 tests total (85 unit + 94 integration)

When making changes:
1. Run tests before committing: `npm test`
2. Ensure all tests pass
3. Add tests for new features or bug fixes
4. Follow existing test patterns in `tests/` directory

## Architecture

### Code Structure

The server is implemented with a modular structure to improve maintainability and testability:

```
src/
├── index.ts              # Entry point Node.js (42 lines)
├── worker.ts             # Entry point Cloudflare Workers (95 lines) [v0.4.0+]
├── server.ts             # MCP server setup (12 lines)
├── types.ts              # Types & schemas (16 lines)
├── utils/
│   ├── http.ts           # CKAN API client (51 lines)
│   └── formatting.ts     # Output formatting (37 lines)
├── tools/
│   ├── package.ts        # Package tools (350 lines)
│   ├── organization.ts   # Organization tools (341 lines)
│   ├── datastore.ts      # DataStore tools (146 lines)
│   └── status.ts         # Status tools (66 lines)
├── resources/            # MCP Resource Templates
│   ├── index.ts          # Resource registration (19 lines)
│   ├── uri.ts            # URI parsing utilities (50 lines)
│   ├── dataset.ts        # Dataset resource (56 lines)
│   ├── resource.ts       # Resource resource (56 lines)
│   └── organization.ts   # Organization resource (58 lines)
└── transport/
    ├── stdio.ts          # Stdio transport (12 lines)
    └── http.ts           # HTTP transport (27 lines)
```

**Total**: ~1445 lines (including Workers deployment)

**Note**: `worker.ts` (v0.4.0+) is an alternative entry point for Cloudflare Workers deployment. Tool handlers (`tools/*`) are shared between Node.js and Workers runtimes.

The server (`src/index.ts`):

1. **Entry Point** (`index.ts`)
   - Imports and registers all tools
   - Chooses transport (stdio/http) from environment variable
   - Handles startup and error handling

2. **Registered Tools** (in separate modules)
   - `tools/package.ts`: `ckan_package_search`, `ckan_package_show`
   - `tools/organization.ts`: `ckan_organization_list`, `ckan_organization_show`, `ckan_organization_search`
   - `tools/datastore.ts`: `ckan_datastore_search`
   - `tools/status.ts`: `ckan_status_show`

3. **MCP Resource Templates** (`resources/`)
   - `ckan://{server}/dataset/{id}` - Dataset metadata
   - `ckan://{server}/resource/{id}` - Resource metadata
   - `ckan://{server}/organization/{name}` - Organization metadata

4. **Utility Functions** (`utils/`)
   - `http.ts`: `makeCkanRequest<T>()` - HTTP client for CKAN API v3
   - `formatting.ts`: `truncateText()`, `formatDate()`, `formatBytes()`

5. **Type Definitions** (`types.ts`)
   - `ResponseFormat` enum (MARKDOWN, JSON)
   - `ResponseFormatSchema` Zod validator
   - `CHARACTER_LIMIT` constant

5. **Transport Layer** (`transport/`)
   - `stdio.ts`: Standard input/output (Claude Desktop)
   - `http.ts`: HTTP server (remote access)

6. **Validation Schema**
   - Uses Zod to validate all tool inputs
   - Each tool has a strict schema that rejects extra parameters

7. **Output Formatting**
   - All tools support two formats: `markdown` (default) and `json`
   - Markdown format optimized for human readability
   - JSON format for programmatic processing

### Transport Modes

The server supports three transport modes:

- **stdio** (default): for integration with Claude Desktop and other local MCP clients
- **http**: exposes POST `/mcp` endpoint on configurable port (default 3000)
- **Cloudflare Workers** (v0.4.0+): global edge deployment via `src/worker.ts`

### Cloudflare Workers Deployment

**Added in v0.4.0**. The server can be deployed to Cloudflare Workers for global HTTP access.

**Key files**:
- `src/worker.ts` - Workers entry point using Web Standards transport
- `wrangler.toml` - Cloudflare configuration

**Deployment workflow**:
1. `npm run dev:worker` - Test locally (http://localhost:8787)
2. `npm run deploy` - Deploy to Cloudflare
3. Access at: `https://ckan-mcp-server.<account>.workers.dev`

**Architecture**:
- Uses `WebStandardStreamableHTTPServerTransport` from MCP SDK
- Compatible with Workers runtime (no Node.js APIs)
- Stateless mode (no session management)
- All 7 tools and 3 resource templates work identically to Node.js version

See `docs/DEPLOYMENT.md` for complete deployment guide.

### CKAN API Integration

The server uses CKAN API v3 available on any CKAN portal. All requests:

- Use `axios` with 30 second timeout
- Send User-Agent `CKAN-MCP-Server/1.0`
- Handle HTTP errors, timeouts, and server not found
- Normalize server URL (removing trailing slash)
- Validate that `response.success === true`

### Solr Queries

CKAN uses Apache Solr for search. The `ckan_package_search` tool supports:

- **q** (query): complete Solr syntax (field:value, AND/OR/NOT, wildcard, range)
- **fq** (filter query): additional filters without affecting score
- **facet_field**: aggregations for statistical analysis
- **sort**: result ordering
- **start/rows**: pagination

Common query examples are documented in `EXAMPLES.md`.

## TypeScript Configuration

The project uses ES2022 as target and module system.

**Note**: `tsconfig.json` is present mainly for editor support (IDE, LSP). The actual compilation uses esbuild which ignores most TypeScript options to maximize speed.

TypeScript configuration (for IDE):
- Output in `dist/` directory
- Strict mode enabled
- Strict type checking with noUnusedLocals, noUnusedParameters, noImplicitReturns
- Skip lib check to reduce overhead
- Declaration and source map disabled

## Dependencies

**Runtime**:
- `@modelcontextprotocol/sdk` - Official MCP SDK
- `axios` - HTTP client for CKAN API
- `zod` - Schema validation
- `express` - HTTP server (only for http mode)

**Dev**:
- `esbuild` - Build tool (bundler and compiler)
- `typescript` - Only for type checking and editor support
- `@types/node`, `@types/express` - Type definitions

## Supported CKAN Portals

The server can connect to any CKAN instance. Some main portals:

- 🇮🇹 https://dati.gov.it (Italy)
- 🇺🇸 https://catalog.data.gov (United States)
- 🇨🇦 https://open.canada.ca/data (Canada)
- 🇬🇧 https://data.gov.uk (United Kingdom)
- 🇪🇺 https://data.europa.eu (European Union)
- 🌍 https://demo.ckan.org (Official CKAN Demo)

Each portal may have different configurations for:
- DataStore availability
- Custom dataset fields
- Available organizations and tags
- Supported resource formats


The project uses **Vitest** for automated testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Current test coverage: ~39% overall (utility modules: 98%, tool handlers: 15-20%).

Test suite includes:
- Unit tests for utility functions (formatting, HTTP, URI parsing, URL generation, search)
- Integration tests for MCP tools with mocked CKAN API responses
- Mock fixtures for CKAN API success and error scenarios

Coverage is strong for utility modules but needs improvement for tool handlers.
See `tests/README.md` for detailed testing guidelines and fixture structure.

### Manual Testing

For manual testing:

```bash
# Build project
npm run build

# Test stdio mode
npm start
# (Server will wait for MCP commands on stdin)

# Test HTTP mode in a terminal
TRANSPORT=http PORT=3000 npm start

# In another terminal, test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d {"jsonrpc":"2.0","method":"tools/list","id":1}
```

To test with Claude Desktop, add MCP configuration to config file.
To test with Claude Desktop, add the MCP configuration to the config file.

## Development Notes

### Version History

**v0.4.0 (2026-01-10)**: Cloudflare Workers deployment
- Added `src/worker.ts` for Workers runtime
- Global edge deployment support
- Web Standards transport integration
- See `docs/DEPLOYMENT.md` for deployment guide

**v0.3.0 (2026-01-08)**: MCP Resource Templates
- Added `ckan://` URI scheme support
- Direct data access for datasets, resources, organizations

**v0.2.0 (2026-01-08)**: Comprehensive test suite
- 179 tests (unit + integration)
- ~39% code coverage (utils well-tested, tools improving)

**v0.1.0 (2026-01-08)**: Modular refactoring
- Restructured from monolithic file to 11 modules
- Improved maintainability and testability

### Known Limitations

- **Output limit**: 50,000 characters hardcoded in `types.ts` (could be configurable)
- **Date formatting**: Uses fixed ISO `YYYY-MM-DD` in `utils/formatting.ts` (could be configurable)
- **Read-only**: All tools are read-only (no data modification on CKAN)
- **No caching**: Every request makes fresh HTTP call to CKAN APIs
- **No authentication**: Uses only public CKAN endpoints
- **No WebSocket**: MCP over HTTP uses JSON responses (not SSE streaming in Workers)

### Adding New Tools

1. Create new file in `src/tools/`
2. Export `registerXxxTools(server: McpServer)` function
3. Add to `registerAll()` in `src/server.ts`
4. Add tests in `tests/integration/`
5. Build and test: `npm run build && npm test`

### Release Workflow

When releasing a new version:

1. **Update version**: Edit `package.json` version field
2. **Update LOG.md**: Add entry with date and changes
3. **Commit changes**: `git add . && git commit -m "..."`
4. **Push to GitHub**: `git push origin main`
5. **Create tag**: `git tag -a v0.x.0 -m "..." && git push origin v0.x.0`
6. **Publish to npm** (optional): `npm publish`
7. **Deploy to Cloudflare** (if code changed): `npm run deploy`

See `docs/DEPLOYMENT.md` for detailed Cloudflare deployment instructions.

## CSV Data Exploration

For exploring CSV resources from datasets, use duckdb CLI (already installed) with direct HTTP URL:

```bash
duckdb -jsonlines -c "DESCRIBE SELECT * FROM read_csv('http://url/file.csv')"
duckdb -jsonlines -c "SUMMARIZE SELECT * FROM read_csv('http://url/file.csv')"
duckdb -jsonlines -c "SELECT * FROM read_csv('http://url/file.csv') USING SAMPLE 10"
```

Use direct resource URLs (http/https), not GitHub view/blob URLs. The `-jsonlines` parameter outputs in JSONL format, easier for AI to parse.

For random sampling, use `USING SAMPLE N` syntax (where N is the number of rows):

```bash
duckdb -jsonlines -c "SELECT * FROM read_csv('http://url/file.csv') USING SAMPLE 10"
```
