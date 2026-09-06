# Project Context

## Purpose
CKAN MCP Server - MCP (Model Context Protocol) server for interacting with open data portals based on CKAN (dati.gov.it, data.gov, demo.ckan.org, etc.).

Exposes MCP tools for:
- Advanced dataset search with Solr syntax
- DataStore queries for tabular data analysis
- Organization and group exploration
- Complete metadata access

## Tech Stack
- **TypeScript** (ES2022 target)
- **Node.js**
- **esbuild** - ultra-fast build system (preferred over tsc for memory efficiency)
- **@modelcontextprotocol/sdk** - official MCP SDK
- **axios** - HTTP client for CKAN API calls
- **zod** - schema validation for tool inputs
- **express** - HTTP server (for HTTP transport mode)

## Project Conventions

### Code Style
- TypeScript strict mode enabled
- Modular tool files in `src/tools/*`
- Utility functions for reusable operations (makeCkanRequest, truncateText, formatDate)
- Zod schemas for strict input validation (reject extra parameters)
- Italian locale for date formatting (it-IT)
- Markdown output optimized for human readability; JSON available for programmatic use

### Architecture Patterns
- **Modular MCP server** - registration in `src/server.ts`
  - **Tool-based architecture** - 15 registered MCP tools for CKAN operations (including MQA quality tools for dati.gov.it)
- **Multiple transport modes**:
  - stdio (default) - for local MCP client integration
  - HTTP - for remote access via POST /mcp endpoint
  - Cloudflare Workers - `/mcp` endpoint in `src/worker.ts`
- **Read-only operations** - no data modification on CKAN
- **Read-through cache** - responses cached at `makeCkanRequest` layer with action-based TTL (metadata 300s, datastore 60s, status 3600s); backend is Cloudflare Cache API on Workers, bounded in-memory LRU on Node; disable with `CKAN_CACHE_ENABLED=false`
- **Error handling** - HTTP errors, timeouts, server validation

### Testing Strategy
- **Automated tests** with Vitest (integration fixtures)
- Manual testing:
  - stdio mode: direct integration testing with Claude Desktop
  - HTTP mode: curl-based testing against localhost endpoint
- Build validation via `npm run build` before deployment

### Git Workflow
- **Main branch**: `main`
- **Commit style**: extremely concise, prioritize brevity over grammar
- **LOG.md**: date-based entries (YYYY-MM-DD format), most recent at top
- **GitHub operations**: use `gh` CLI exclusively
- Update LOG.md for any significant change

## Domain Context

### CKAN Knowledge
- **CKAN API v3** - standard API across all CKAN portals
- **Apache Solr** - powers search functionality
  - Supports field:value syntax, AND/OR/NOT operators, wildcards, ranges
  - Filter queries (fq) for filtering without affecting score
  - Facets for statistical aggregations
  - Sort and pagination (start/rows)

### Output Conventions
- All tools support `format` parameter: `markdown` (default) or `json`
- Output truncated to 50000 characters max (hardcoded)
- Dates formatted in Italian locale
- File sizes in human-readable format
- `server_url` for Italy uses `https://dati.gov.it/opendata`

## Important Constraints

### Environment
- **WSL considerations** - memory constraints require esbuild instead of tsc
- Always use `npm run build` (esbuild) not `npm run build:tsc`
- esbuild bundles internal modules but keeps external deps as-is

### Technical Limits
- 50000 character output limit (hardcoded, could be configurable)
- 30-second timeout for CKAN API calls
- Read-only operations only (security by design)
- No authentication (public endpoints only)
- Cache TTL is a freshness floor (up to 5 min for metadata, 1 min for datastore, 1h for status); disable via `CKAN_CACHE_ENABLED=false` if live data required

### Build System
- esbuild config: bundles TypeScript, externalizes runtime deps
- External deps must be in node_modules: @modelcontextprotocol/sdk, axios, express, zod
- tsconfig.json mainly for IDE support (esbuild ignores most options)

## External Dependencies

### CKAN Portals
Major supported portals:
- 🇮🇹 https://dati.gov.it/opendata (Italia)
- 🇨🇦 https://open.canada.ca/data (Canada)
- 🇬🇧 https://data.gov.uk (United Kingdom)
- 🇪🇺 https://data.europa.eu (European Union)
- 🌍 https://demo.ckan.org (Official CKAN demo)

### CKAN API Integration
- All requests use axios with 30s timeout
- User-Agent: `CKAN-MCP-Server/1.0`
- URL normalization (remove trailing slash)
- Response validation (success === true)
- Error handling: HTTP errors, timeouts, unreachable servers

### Portal Variations
Each CKAN portal may differ in:
- DataStore availability
- Custom dataset fields
- Available organizations and tags
- Supported resource formats
