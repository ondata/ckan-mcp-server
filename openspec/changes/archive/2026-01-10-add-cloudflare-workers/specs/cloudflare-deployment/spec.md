# cloudflare-deployment Specification

## Purpose
Enable deployment of CKAN MCP Server to Cloudflare Workers platform, providing global HTTP access without local installation or server management.

## ADDED Requirements

### Requirement: Workers Entry Point

The system SHALL provide a Cloudflare Workers-compatible entry point that handles HTTP requests using the Workers fetch API.

#### Scenario: Health check endpoint

- **WHEN** client sends `GET /health` to Workers endpoint
- **THEN** server returns JSON with status, version, tool count, and resource count

#### Scenario: MCP protocol endpoint

- **WHEN** client sends `POST /mcp` with JSON-RPC request to Workers endpoint
- **THEN** server processes MCP request and returns JSON-RPC response

#### Scenario: Invalid route

- **WHEN** client requests any path other than `/health` or `/mcp`
- **THEN** server returns 404 Not Found

#### Scenario: Invalid method on MCP endpoint

- **WHEN** client sends non-POST request to `/mcp`
- **THEN** server returns 404 Not Found

---

### Requirement: MCP Server Integration

The system SHALL initialize MCP server instance on each Workers invocation and register all tools and resources.

#### Scenario: Server initialization

- **WHEN** Workers receives MCP request
- **THEN** server creates MCP Server instance with name "ckan-mcp-server" and version "0.4.0"

#### Scenario: Tool registration

- **WHEN** Workers initializes MCP server
- **THEN** server registers all 7 CKAN tools (package_search, package_show, organization_list, organization_show, organization_search, datastore_search, status_show)

#### Scenario: Resource registration

- **WHEN** Workers initializes MCP server
- **THEN** server registers all 3 resource templates (dataset, resource, organization)

#### Scenario: Tools list request

- **WHEN** client calls `tools/list` method via Workers endpoint
- **THEN** response includes all 7 registered CKAN tools with descriptions

---

### Requirement: Web Standards HTTP Client

The system SHALL use native Web Fetch API for CKAN API requests instead of Node.js-specific libraries.

#### Scenario: CKAN API request with fetch

- **WHEN** tool calls `makeCkanRequest()` in Workers runtime
- **THEN** client uses native `fetch()` with 30-second timeout

#### Scenario: Query parameter encoding

- **WHEN** CKAN request includes parameters (e.g., `q`, `rows`, `start`)
- **THEN** client encodes parameters in URL using `URLSearchParams`

#### Scenario: Request timeout

- **WHEN** CKAN API takes longer than 30 seconds
- **THEN** client aborts request using `AbortController` and returns timeout error

#### Scenario: HTTP error handling

- **WHEN** CKAN API returns HTTP error status (4xx, 5xx)
- **THEN** client throws error with status code and message

#### Scenario: CKAN API validation

- **WHEN** CKAN API returns 200 OK but `success: false`
- **THEN** client throws error with CKAN error message

---

### Requirement: Workers Build Configuration

The system SHALL provide separate build configuration for Workers deployment targeting browser platform with ESM format.

#### Scenario: Workers build script

- **WHEN** user runs `npm run build:worker`
- **THEN** esbuild compiles `src/worker.ts` to `dist/worker.js` in ESM format

#### Scenario: Bundle all dependencies

- **WHEN** esbuild builds Workers bundle
- **THEN** all dependencies are bundled (no external modules)

#### Scenario: Platform targeting

- **WHEN** esbuild builds Workers bundle
- **THEN** platform is set to `browser` and target is `es2022`

#### Scenario: Output format

- **WHEN** Workers build completes
- **THEN** output is ESM format (not CommonJS)

#### Scenario: Bundle size validation

- **WHEN** Workers build completes
- **THEN** bundle size is less than 1MB (Workers script size limit)

---

### Requirement: Wrangler Configuration

The system SHALL provide Wrangler configuration file for Workers deployment and local development.

#### Scenario: Wrangler configuration file

- **WHEN** project contains `wrangler.toml` in root directory
- **THEN** configuration specifies name, main entry point, and compatibility date

#### Scenario: Build command

- **WHEN** `wrangler deploy` or `wrangler dev` runs
- **THEN** Wrangler executes `npm run build:worker` before deployment

#### Scenario: Local development server

- **WHEN** user runs `npm run dev:worker`
- **THEN** Wrangler starts local Workers server on http://localhost:8787

---

### Requirement: Workers Deployment

The system SHALL deploy to Cloudflare Workers and provide public HTTPS endpoint.

#### Scenario: Deploy to Workers

- **WHEN** user runs `npm run deploy`
- **THEN** Wrangler builds and uploads worker to Cloudflare

#### Scenario: Public endpoint

- **WHEN** deployment succeeds
- **THEN** Workers script is accessible at `https://ckan-mcp-server.<account>.workers.dev`

#### Scenario: HTTPS support

- **WHEN** client accesses Workers endpoint
- **THEN** connection uses HTTPS with valid certificate

---

### Requirement: Tool Functionality Preservation

The system SHALL maintain identical functionality for all CKAN tools in Workers runtime compared to Node.js runtime.

#### Scenario: Package search in Workers

- **WHEN** client calls `ckan_package_search` via Workers endpoint
- **THEN** response is identical to Node.js runtime response

#### Scenario: Datastore query in Workers

- **WHEN** client calls `ckan_datastore_search` via Workers endpoint
- **THEN** response is identical to Node.js runtime response

#### Scenario: Resource template in Workers

- **WHEN** client reads `ckan://{server}/dataset/{id}` via Workers
- **THEN** response is identical to Node.js runtime response

#### Scenario: Error handling in Workers

- **WHEN** CKAN API is unreachable in Workers runtime
- **THEN** error response matches Node.js runtime error format

---

### Requirement: Response Format Compatibility

The system SHALL support both markdown and JSON output formats in Workers runtime.

#### Scenario: Markdown format

- **WHEN** client requests tool with `response_format: "markdown"`
- **THEN** Workers returns formatted markdown text

#### Scenario: JSON format

- **WHEN** client requests tool with `response_format: "json"`
- **THEN** Workers returns raw JSON data

#### Scenario: Character limit

- **WHEN** response exceeds CHARACTER_LIMIT (50000 characters)
- **THEN** Workers truncates response identically to Node.js runtime

---

### Requirement: Error Handling

The system SHALL handle Workers-specific errors gracefully with JSON-RPC error responses.

#### Scenario: Malformed JSON-RPC request

- **WHEN** client sends invalid JSON to `/mcp` endpoint
- **THEN** Workers returns JSON-RPC error with code -32700 (Parse error)

#### Scenario: Internal worker error

- **WHEN** worker encounters unexpected exception
- **THEN** Workers returns JSON-RPC error with code -32603 (Internal error)

#### Scenario: Method not found

- **WHEN** client calls non-existent MCP method
- **THEN** Workers returns JSON-RPC error with code -32601 (Method not found)

---

### Requirement: CORS Support

The system SHALL include CORS headers to enable browser-based MCP clients.

#### Scenario: CORS headers on success

- **WHEN** Workers returns successful response
- **THEN** response includes `Access-Control-Allow-Origin: *` header

#### Scenario: CORS headers on error

- **WHEN** Workers returns error response
- **THEN** response includes `Access-Control-Allow-Origin: *` header

#### Scenario: Preflight request

- **WHEN** browser sends OPTIONS request for CORS preflight
- **THEN** Workers returns allowed methods and headers

---

### Requirement: Deployment Documentation

The system SHALL provide comprehensive documentation for deploying to Cloudflare Workers.

#### Scenario: Deployment guide

- **WHEN** contributor wants to deploy Workers instance
- **THEN** `docs/DEPLOYMENT.md` provides step-by-step instructions

#### Scenario: Prerequisites documentation

- **WHEN** contributor reads DEPLOYMENT.md
- **THEN** document lists all prerequisites (Cloudflare account, wrangler CLI)

#### Scenario: Troubleshooting guide

- **WHEN** deployment fails
- **THEN** DEPLOYMENT.md includes common errors and solutions

#### Scenario: README update

- **WHEN** user reads README.md
- **THEN** deployment options section includes Cloudflare Workers option

---

### Requirement: Backwards Compatibility

The system SHALL maintain all existing deployment modes (stdio, self-hosted HTTP) without breaking changes.

#### Scenario: Stdio mode unchanged

- **WHEN** user runs `npm start` after Workers implementation
- **THEN** stdio transport works identically to pre-Workers version

#### Scenario: Self-hosted HTTP mode unchanged

- **WHEN** user runs `TRANSPORT=http PORT=3000 npm start` after Workers implementation
- **THEN** HTTP server works identically to pre-Workers version

#### Scenario: Existing tests pass

- **WHEN** user runs `npm test` after Workers implementation
- **THEN** all 113 existing tests pass without modification

#### Scenario: Node.js bundle unchanged

- **WHEN** user runs `npm run build` after Workers implementation
- **THEN** Node.js bundle (`dist/index.js`) is unchanged

---

### Requirement: Development Workflow

The system SHALL support efficient local development and testing of Workers deployment.

#### Scenario: Local Workers testing

- **WHEN** developer runs `npm run dev:worker`
- **THEN** wrangler starts local server with hot reload

#### Scenario: Quick iteration

- **WHEN** developer modifies `src/worker.ts`
- **THEN** wrangler automatically rebuilds and reloads

#### Scenario: curl testing

- **WHEN** developer sends curl request to local Workers
- **THEN** response matches expected MCP protocol format

---

### Requirement: Monitoring and Debugging

The system SHALL provide access to Workers logs and metrics for troubleshooting.

#### Scenario: Real-time logs

- **WHEN** developer runs `wrangler tail`
- **THEN** console.log output from worker appears in terminal

#### Scenario: Error logs

- **WHEN** worker throws exception
- **THEN** stack trace appears in `wrangler tail` output

#### Scenario: Cloudflare dashboard

- **WHEN** user accesses Cloudflare Workers dashboard
- **THEN** metrics show request count, error rate, and CPU time

---

## Related Specifications

- **mcp-resources**: Resource templates must work in Workers runtime
- **documentation-language**: Deployment docs must be in English

---

## Implementation Notes

### HTTP Client Migration
- Replace `axios` with `fetch()` in `src/utils/http.ts`
- Use `AbortController` for timeout (same 30s limit)
- Maintain identical error handling behavior

### Build System
- Add `esbuild.worker.js` for Workers-specific build
- Keep existing `esbuild.config.js` for Node.js build
- Add npm scripts: `build:worker`, `dev:worker`, `deploy`

### Testing Approach
- Manual testing with `wrangler dev` and curl
- Production testing after deployment
- Claude Desktop integration test
- Existing test suite validates tool logic (no new tests needed)

### Deployment Process
1. User creates Cloudflare account (free)
2. User installs wrangler CLI
3. User authenticates: `wrangler login`
4. User builds: `npm run build:worker`
5. User deploys: `wrangler deploy`
6. User gets endpoint: `https://ckan-mcp-server.<account>.workers.dev`

### Bundle Size Optimization
- Remove `axios` dependency (save ~15KB)
- Use esbuild tree-shaking
- Minify Workers bundle
- Target: < 50KB (well below 1MB limit)

### Future Enhancements
- Add Workers KV caching (documented in future-ideas.md)
- Support custom domains (documented in future-ideas.md)
- Add API key authentication via Workers secrets (documented in future-ideas.md)
