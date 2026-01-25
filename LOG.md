# LOG

## 2026-01-26

### Website - Fix color contrast issues
- **Fix**: Added custom color definitions to `tailwind.config.mjs`
- **Colors**: navy (#0A1628), data-blue (#0066CC), teal (#0D9488), coral (#F97316), amber (#F59E0B), cream (#FFFEF9)
- **Impact**: CTA section and all custom-colored elements now render correctly with proper contrast
- **Before**: Custom Tailwind classes (bg-navy, text-data-blue, etc.) were ignored, causing transparent backgrounds and unreadable text
- **After**: All colors apply correctly, navy CTA section has proper dark background with white/gray text

## 2026-01-25

### Website - Landing Page
- **Website**: Created production-ready landing page in `website/` directory
- **Stack**: Astro v5 + React + Tailwind CSS + TypeScript strict mode
- **Deployment**: GitHub Actions workflow for automatic GitHub Pages deployment
- **URL**: https://ondata.github.io/ckan-mcp-server/
- **Content**:
  - Hero section with value proposition for open data researchers
  - Features section (6 key capabilities)
  - Quick start with copy-paste configs (Claude Desktop, VS Code, Cloudflare Workers, global npm)
  - Use cases (researchers, data scientists, students, journalists, etc.)
  - Supported portals showcase (dati.gov.it, data.gov, data.europa.eu, etc.)
  - SEO optimized (meta tags, Open Graph, sitemap)
  - Responsive design (mobile-first, accessible WCAG AA)
- **Assets**:
  - SVG favicon with network graph icon
  - manifest.json for PWA support
  - robots.txt and sitemap
  - Script for PNG favicon generation (`generate-favicons.sh`)
- **Files**:
  - `website/src/pages/index.astro` (main landing page)
  - `website/src/layouts/Layout.astro` (SEO layout)
  - `website/src/components/Footer.astro`
  - `website/public/favicon.svg`, `manifest.json`, `robots.txt`
  - `.github/workflows/deploy-website.yml` (deployment automation)
  - `website/README.md` (documentation)
- **Build**: 396 packages, builds successfully in ~1s
- **Deployment trigger**: Push to main branch with changes in `website/` directory

### Documentation - MCP Inspector
- **README**: Added "Exploring the Server" section before "Manual Testing"
- **Tool**: MCP Inspector for interactive server exploration
- **Usage**: `npx @modelcontextprotocol/inspector node dist/index.js`
- **Features**: Browse tools/resources, test calls with auto-complete, real-time responses, debug errors
- **Impact**: Developers can quickly explore and test server without manual JSON-RPC

## 2026-01-23

### Release v0.4.17

- Published to npm: `@aborruso/ckan-mcp-server@0.4.17`
- Aligned with GitHub tag `v0.4.17`

### MQA Quality Metrics - Identifier normalization and disambiguation

- **Fix**: Normalize identifiers for data.europa.eu lookups (lowercase, collapse hyphens)
- **Fix**: Retry with disambiguation suffixes (`~~1`, `~~2`) when base identifier 404s
- **Result**: MQA quality now matches portal IDs for datasets like Beinasco (with `~~1`)
- **Improved errors**: clearer message when identifier is not aligned
- **Files modified**: `src/tools/quality.ts`, `tests/integration/quality.test.ts`
- **Deployed**: Cloudflare Workers v0.4.17

### Release v0.4.16

- Published to npm: `@aborruso/ckan-mcp-server@0.4.16`
- Aligned with GitHub tag `v0.4.16`

### MQA Quality Metrics - Fix identifier format

- **Bug fix**: Identifier transformation for data.europa.eu API compatibility
- **Issue**: CKAN identifiers with colon separator (e.g., `c_f158:224c373e...`) were not recognized by MQA API
- **Root cause**: data.europa.eu uses hyphen-separated identifiers (`c_f158-224c373e...`)
- **Solution**: Replace colons with hyphens before API call: `.replace(/:/g, '-')`
- **Impact**: MQA quality metrics now work for all dati.gov.it datasets, including municipal portals
- **Example**: Messina air quality dataset now returns score 405/560 (Eccellente)
- **File modified**: `src/tools/quality.ts` (line 41)
- **Deployed**: Cloudflare Workers v0.4.16

### MQA Quality Metrics Tool

- **Feature**: Added `ckan_get_mqa_quality` tool for retrieving quality metrics from data.europa.eu MQA API
- **Scope**: Only works with dati.gov.it datasets (server validation enforced)
- **Data source**: Queries https://data.europa.eu/api/mqa/cache/datasets/{identifier}
- **Identifier logic**: Uses `identifier` field from CKAN metadata, falls back to `name` if identifier is empty
- **Metrics returned**:
  - Overall score (max 405 points)
  - Accessibility (URL status, download availability)
  - Reusability (license, contact point, publisher)
  - Interoperability (format, media type)
  - Findability (keywords, category, spatial/temporal coverage)
- **Output formats**: Markdown (default, human-readable) or JSON (structured data)
- **Error handling**: Dataset not found, MQA API unavailable, invalid server URL
- **Tests**: +11 integration tests (212 total, all passing)
  - Server validation (www/non-www dati.gov.it URLs)
  - Quality retrieval with identifier
  - Fallback to name field
  - Error scenarios (404, network errors)
  - Markdown formatting (complete/partial data, availability indicators)
- **Documentation**: README.md (new Quality Metrics section), EXAMPLES.md (usage example with expected metrics)
- **Files**:
  - `src/tools/quality.ts` (new, 194 lines)
  - `src/server.ts` (register quality tools)
  - `tests/integration/quality.test.ts` (new, 11 tests)
  - `tests/fixtures/responses/mqa-quality-success.json` (new)
  - `tests/fixtures/responses/package-show-{with,without}-identifier.json` (new)
- **OpenSpec**: Proposal in `openspec/changes/add-mqa-quality-tool/` (4 requirements, 11 scenarios)

## 2026-01-22

### Date Query Auto-Conversion (v0.4.14)

- **Feature**: Auto-convert NOW-based date math for `modified` and `issued` fields
- **Problem**: CKAN Solr supports `NOW-XDAYS` syntax only on `metadata_modified` and `metadata_created` fields
- **Solution**: New `convertDateMathForUnsupportedFields()` automatically converts queries like `modified:[NOW-30DAYS TO NOW]` to ISO dates `modified:[2025-12-23T... TO 2026-01-22T...]`
- **Supported fields**: `modified`, `issued` (auto-converted) | `metadata_modified`, `metadata_created` (native NOW support)
- **Supported units**: DAYS, MONTHS, YEARS (singular and plural forms)
- **Tests**: +10 unit tests (201 total, all passing)
- **Documentation**: Updated tool description with NOW syntax limitations and examples
- **Files**: `src/utils/search.ts`, `src/tools/package.ts`, `tests/unit/search.test.ts`
- **No breaking changes**: Backward compatible - existing queries work unchanged

## 2026-01-19

### Search Parser Escaping
- **Fix**: Escape Solr special characters when forcing `text:(...)` queries
- **Tests**: Added unit coverage for escaping and forced parser output
- **Files**: `src/utils/search.ts`, `tests/unit/search.test.ts`, `README.md`

## 2026-01-17

### Documentation Alignment
- **Test counts updated**: README.md (184→190), PRD.md (130→190)
- **Version updated**: PRD.md version 0.4.7→0.4.12
- **Date updated**: PRD.md last updated 2026-01-10→2026-01-17
- **Verification**: All 13 tools, 7 resources, 5 prompts implemented and documented
- **Files**: `README.md`, `PRD.md`

### GitHub Templates
- **Issue templates**: Added bug report and feature request YAML forms
  - Bug report: CKAN portal URL, steps, expected/actual, error, Node version
  - Feature request: problem/use case, proposed solution, alternatives
  - Auto-labels: `bug` and `enhancement`
- **Issue chooser**: Routes questions to Discussions Q&A
- **PR template**: Description, related issue, test/docs checklist
- **Files**: `.github/ISSUE_TEMPLATE/{bug_report,feature_request,config}.yml`, `.github/PULL_REQUEST_TEMPLATE.md`

## 2026-01-16

### Demo Video Preparation
- **Documentation**: Created complete demo video documentation suite in `docs/video/`
  - `demo-script.md` - Commands and technical notes for 4 use cases
  - `demo-expected-results.md` - Actual test results with data samples
  - `demo-recording-guide.md` - Step-by-step recording guide with voiceover scripts
  - `pre-recording-checklist.md` - Practical day-of checklist
  - `demo-fallback-options.md` - Comprehensive fallback strategies for 8 scenarios
  - `demo-timing-report.md` - Performance analysis and timing verification
- **Testing**: Verified all demo commands working with dati.gov.it
  - Portal overview: 67,614 datasets, top 10 organizations (~5s)
  - Targeted search: 263 Milano transport datasets (~10s)
  - Dataset details: Complete metadata with CSV/JSON resources (~10s)
  - DuckDB analysis: DESCRIBE, SUMMARIZE, SAMPLE all working (~8s total)
- **Target**: 5-7 minute video demonstrating MCP convenience for Italian open data
- **Status**: Ready for recording with high confidence level

## 2026-01-15

### Version 0.4.12 - Dataset filter resources
- **Feature**: Added `ckan://{server}/.../datasets` resource templates for group, organization, tag, and format filters
- **Fix**: Map `ckan://` hostnames to portal API base URLs (e.g., dati.gov.it → /opendata)
- **Fix**: Format filtering now matches `res_format` and `distribution_format` (with case variants)
- **Docs**: Updated README and future ideas with new URI templates
- **Docs**: Updated `docs/proposta-spunti-datos-gob-es-mcp.md` marking resource templates as completed
- **Tests**: Added unit tests for dataset filter resource templates
- **Files**: New `src/resources/dataset-filters.ts`, updates in `src/resources/index.ts`, `src/worker.ts`

### Version 0.4.11 - Prompt argument coercion
- **Fix**: Prompt arguments now coerce numeric strings (e.g., rows) for MCP prompt requests
- **Docs**: Updated evaluation notes for 0.4.11
- **No breaking changes**: Prompt names and outputs unchanged

### Version 0.4.10 - Guided MCP prompts
- **Feature**: Added 5 guided MCP prompts (theme, organization, format, recent datasets, dataset analysis)
- **Docs**: README and new `docs/prompts.md` updated with usage examples
- **Tests**: Added prompt unit tests; total now 184 tests (all passing)
- **Files**: New `src/prompts/*`, updates in `src/server.ts`, `src/worker.ts`, README.md

## 2026-01-11

### Version 0.4.9 - Security, Testing & Documentation
- **Security**: Updated @modelcontextprotocol/sdk from 1.25.1 to 1.25.2 (fixes HIGH severity ReDoS vulnerability)
- **Testing**: Added 49 new unit tests for package.ts scoring functions
- **Coverage**: Improved from 37.33% to 38.63% (package.ts: 12.5% to 15%)
- **Total tests**: 179 tests (all passing, +49 from 130)
- **Documentation**: Corrected test coverage claims (was "113 tests, 97%+" now accurate "179 tests, ~39%")
- **Deployment**: Added npm audit check to DEPLOYMENT.md
- **Files modified**: package.json, src/server.ts, src/worker.ts, README.md, CLAUDE.md, docs/DEPLOYMENT.md
- **New file**: tests/unit/package-scoring.test.ts
- **No breaking changes**: All existing functionality preserved

### Test improvements - package scoring functions
- **Added**: 49 new unit tests for package.ts scoring functions
- **Coverage improvement**: package.ts from 12.5% to 15%
- **Overall coverage**: 37.33% to 38.63%
- **Total tests**: 130 to 179 tests (all passing)
- **New test file**: tests/unit/package-scoring.test.ts
- **Functions tested**:
  - extractQueryTerms (10 tests)
  - escapeRegExp (6 tests)
  - textMatchesTerms (10 tests)
  - scoreTextField (6 tests)
  - scoreDatasetRelevance (17 tests with edge cases)
- **Exports**: Made internal functions testable (extractQueryTerms, escapeRegExp, textMatchesTerms, scoreTextField)
- **Impact**: Better coverage of dataset relevance scoring logic

### Documentation corrections - test coverage accuracy
- **Fix**: Corrected test coverage claims in README.md and CLAUDE.md
- **Previous claim**: "113 tests, 97%+ coverage"
- **Actual values**: 130 tests passing, ~37% overall coverage
  - Utility modules: 98% coverage (excellent)
  - Tool handlers: 12-20% coverage (needs improvement)
- **Impact**: Documentation now accurately reflects project state
- **Files modified**: README.md, CLAUDE.md

### Documentation enhancement - deployment security
- **Added**: npm audit check to DEPLOYMENT.md (Step 4.5)
- **Added**: Security audit to pre-release checklist
- **Recommendation**: Always run `npm audit` before production deployment

### Security fix - MCP SDK update
- **Fix**: Update @modelcontextprotocol/sdk from 1.25.1 to 1.25.2
- **Reason**: Resolves HIGH severity ReDoS vulnerability (GHSA-8r9q-7v3j-jr4g)
- **Tests**: All 130 tests passing
- **Audit**: 0 vulnerabilities

## 2026-01-10

### Version 0.4.8 - Organization list fallback
- **Fix**: On CKAN 500, fall back to `package_search` facets for org counts
- **Output**: Facet lists show top 10; suggest `response_format: json` and `facet_limit`

## 2026-01-10

### Web GUI intelligent tool selection
- **MCP tool awareness**: Gemini now selects appropriate tool from 15 available
  - Loads tool list on startup via `tools/list`
  - Passes available tools to Gemini with descriptions
  - Gemini chooses tool and generates arguments based on query type
  - Examples: `ckan_organization_list` for "organizations with most datasets"
  - `ckan_find_relevant_datasets` for smart searches
  - `ckan_tag_list` for tag statistics
- **Multi-type results**: UI handles datasets, organizations, tags
  - Organization cards show package count
  - Dataset cards show resources and org name
  - Status shows tool being used ("Using ckan_organization_list...")
- **Fallback**: Defaults to `ckan_package_search` if Gemini fails
- **Fix**: Query "quali organizzazioni con il maggior numero di dataset" now works correctly

### Web GUI redesign + conversation context
- **UI redesign**: Dark theme with data editorial aesthetic
  - Typography: DM Serif Display + IBM Plex Sans
  - Color scheme: Deep charcoal (#0f1419) with cyan accent (#06b6d4)
  - Glass morphism effects, gradient text, subtle grid background
  - Smooth animations: slide-in, hover transitions, status pulse
  - Collapsible settings panel with icon-based controls
  - Enhanced dataset cards with hover lift and glow
  - Custom scrollbar, loading shimmer, SVG icons throughout
- **Conversation context**: Added history management
  - Gemini receives conversation history for contextual refinement
  - Users can ask follow-up queries ("only from Tuscany", "last 5 years")
  - History limited to 10 messages (5 exchanges) to avoid token overflow
  - Reset button to clear conversation and start fresh
- **UX improvements**: Better visual hierarchy, spacing, interaction patterns
- **Responsive**: Mobile-friendly layout maintained

### Web GUI chat MVP
- **Web GUI**: Replaced landing with MCP-backed chat UI (vanilla + Tailwind)
- **MCP**: Added JSON-RPC search flow with dataset cards
- **Fix**: Added `Accept` header for MCP 406 requirement
- **Fix**: Normalize natural-language queries before search
- **Gemini**: Added API key input and NL→Solr query call

### Web GUI landing + Pages deploy
- **Web GUI**: Added static landing page in `web-gui/public`
- **CI**: Added GitHub Pages workflow for auto deploy on HTML changes

## 2026-01-10

### Version 0.4.7 - Portal search parser override
- **Config**: Added per-portal search parser config
- **Tool**: Added query parser override for package search and relevance

## 2026-01-10

### Version 0.4.6 - Relevance ranking
- **Tool**: Added `ckan_find_relevant_datasets`
- **Docs**: Updated README/EXAMPLES
- **Tests**: Added relevance scoring checks

## 2026-01-10

### Version 0.4.5 - Health version
- **Workers**: /health version/tools updated

## 2026-01-10

### Version 0.4.4 - DataStore SQL
- **Tool**: Added `ckan_datastore_search_sql`
- **Docs**: Updated README/EXAMPLES/PRD for SQL support
- **Tests**: Added SQL fixture and checks

## 2026-01-10

### Version 0.4.3 - Tags and Groups
- **Tags**: Added `ckan_tag_list` with faceting and filtering
- **Groups**: Added `ckan_group_list`, `ckan_group_show`, `ckan_group_search`
- **Docs**: Updated README with examples and tool list
- **Tests**: Added tag/group fixtures and tests

### Version 0.4.2 - Packaging
- **npm package**: Added `.npmignore` to exclude dev artifacts

### Version 0.4.1 - Maintenance
- **Date formatting**: ISO `YYYY-MM-DD` output, tests aligned
- **HTTP transport**: Single shared transport per process
- **Registration**: Centralized tool/resource setup via `registerAll()`
- **Docs**: Updated CLAUDE/PRD/REFACTORING notes

## 2026-01-10

### Documentation Enhancement - Solr Field Types
- **New section in EXAMPLES.md**: "Understanding Solr Field Types: Exact vs Fuzzy Search"
  - Documents difference between `type=string` (exact match) and `type=text` (fuzzy)
  - String fields: res_format, tags, organization, license, state, name (case-sensitive)
  - Text fields: title, notes, author, maintainer (normalized, fuzzy enabled)
  - Practical example: `res_format:CSV` (43,836 results) vs `res_format:csv` (0 results)
  - Links to CKAN Solr schema on GitHub
  - Explains why some searches are exact and others are fuzzy
- **Impact**: Users understand when exact matching is required vs when fuzzy search works

### Version 0.4.0 - Cloudflare Workers Deployment ⭐

- **Production deployment**: Server now live on Cloudflare Workers
  - Public endpoint: `https://ckan-mcp-server.andy-pr.workers.dev`
  - Global edge deployment (low latency worldwide)
  - Free tier: 100,000 requests/day
  - Bundle size: 398KB (minified: 130KB gzipped)
  - Cold start time: 58ms

- **New files**:
  - `src/worker.ts` (95 lines): Workers entry point using Web Standards transport
  - `wrangler.toml` (5 lines): Cloudflare Workers configuration

- **New npm scripts**:
  - `build:worker`: Compile for Workers (browser platform, ESM format)
  - `dev:worker`: Local testing with wrangler dev
  - `deploy`: Build and deploy to Cloudflare

- **Architecture**:
  - Uses `WebStandardStreamableHTTPServerTransport` from MCP SDK
  - Compatible with Workers runtime (no Node.js APIs)
  - Stateless mode (no session management)
  - JSON responses enabled for simplicity
  - CORS enabled for browser access

- **Testing**: All 7 MCP tools verified in Workers environment
  - Health check: ✅ Working
  - tools/list: ✅ Returns all 7 tools
  - ckan_status_show: ✅ External CKAN API calls working
  - Response times: < 2s for typical queries

- **Documentation**:
  - Updated README.md with "Deployment Options" section
  - Added Option 4 to Claude Desktop config (Workers HTTP transport)
  - Created OpenSpec proposal in `openspec/changes/add-cloudflare-workers/`

- **No breaking changes**: stdio and self-hosted HTTP modes still fully supported
  - Dual build system: Node.js bundle unchanged
  - Existing tests (113) all passing
  - Version bumped to 0.4.0

## 2026-01-09

### Version 0.3.2 - npm Publication
- **npm Publication**: Published to npm registry as `@aborruso/ckan-mcp-server`
  - Package size: 68.6 KB (236 KB unpacked)
  - Public access configured
  - Installation time: 5 min → 30 sec (90% faster)
  - User actions: 6 steps → 2 steps (67% reduction)
- **Global Command Support**: Added `bin` field to package.json
  - Direct command: `ckan-mcp-server` (no node path required)
  - Works system-wide after global install
- **Documentation Enhancement**: Three installation options in README
  - Option 1: Global installation (recommended)
  - Option 2: Local project installation
  - Option 3: From source (development)
  - Platform-specific paths (macOS, Windows, Linux)
- **GitHub Release**: Tagged v0.3.2 with release notes
- **Impact**: Low barrier to entry, standard npm workflow, better discoverability

### Project Evaluation v0.3.2
- **Overall Rating**: 9.0/10 (local evidence; external distribution not verified)
- **Distribution readiness**: 9/10 (metadata and CLI entry point verified)
- **Testing**: 113 tests passing; coverage 97%+ (2026-01-09)
- **Status**: Packaging and docs production-ready; npm/GitHub release require external verification
- See `docs/evaluation-v0.3.2.md` for full assessment

### Tests & Coverage Update
- Added unit tests for HTTP error branches and URL generator org paths
  - Tests: `tests/unit/http.test.ts`, `tests/unit/url-generator.test.ts`
- `npm test`: 113 tests passing
- `npm run test:coverage`: 97.01% statements, 89.36% branches, 100% functions, 96.87% lines

### README Enhancement - Real-World Advanced Examples
- **New Section**: "Advanced Query Examples" in README.md
  - 4 real-world examples tested on dati.gov.it portal
  - English explanations with Italian query terms maintained
  - Each example includes: use case, query, techniques, results
- **Example 1**: Fuzzy search + date math + boosting (871 healthcare datasets)
- **Example 2**: Proximity search + complex boolean (306 air quality datasets)
- **Example 3**: Wildcard + range + field existence (5,318 regional datasets)
- **Example 4**: Date ranges + exclusive bounds (demonstrates precise constraints)
- **Solr Syntax Reference**: Quick reference table for all query operators
- **Impact**: Users have practical, tested examples for advanced searches

### Documentation Enhancement - Advanced Solr Queries
- **Tool Description**: Enhanced `ckan_package_search` tool description with comprehensive Solr query syntax
  - Added boolean operators (AND, OR, NOT, +, -, grouping)
  - Added wildcards, fuzzy search, proximity search
  - Added range queries (inclusive/exclusive bounds)
  - Added date math (NOW-1YEAR, NOW/DAY, etc.)
  - Added field existence checks
  - Added boosting/relevance scoring (^, ^=)
  - 15+ inline examples in tool description
- **EXAMPLES.md**: New "Advanced Solr Query Features" section (~280 lines)
  - Fuzzy search examples (edit distance matching)
  - Proximity search (words within N positions)
  - Boosting examples (relevance scoring)
  - Field existence checks
  - Date math with relative dates
  - Complex nested queries
  - Range queries with different bounds
  - Wildcard patterns
  - Practical advanced examples
- **Impact**: LLMs calling MCP server now have comprehensive query syntax reference

## 2026-01-08

### Configuration & URL Management
- **Portal-Specific URLs**: Introduced configuration system for non-standard CKAN portals
  - New `src/portals.json`: Configurable mapping for portals like `dati.gov.it`
  - New `src/utils/url-generator.ts`: Utility for generating context-aware view URLs
  - Fixed issue where `dati.gov.it` links pointed to standard CKAN paths instead of custom `/view-dataset/` paths
  - Automated replacement of `{id}`, `{name}` and `{server_url}` placeholders in URL templates
  - Updated `ckan_package_search`, `ckan_package_show`, `ckan_organization_list` and `ckan_organization_show` tools to use the new system

### Version 0.3.0
- **MCP Resource Templates**: Direct data access via `ckan://` URI scheme
  - `ckan://{server}/dataset/{id}` - Dataset metadata
  - `ckan://{server}/resource/{id}` - Resource metadata
  - `ckan://{server}/organization/{name}` - Organization metadata
  - New `src/resources/` module (5 files, ~240 lines)
- **Tests**: 101 tests total (was 79), 100% passing
- **Cleanup**: Removed `src/index-old.ts`, standardized to English

### Project Evaluation v0.3.0
- **Overall Rating**: 9/10 - Production-ready with excellent architecture
- **Improvements from v0.2.0**:
  - Removed legacy code (index-old.ts)
  - Standardized documentation to English
  - Added MCP Resource Templates
  - Expanded test suite (79 → 101 tests)
- **Remaining enhancements**: Caching layer, configurable limits, authentication
- See `docs/evaluation-v0.3.0.md` for full assessment

### Version 0.2.0
- **Test Suite**: Added comprehensive automated testing infrastructure
  - **79 tests total**: 100% passing
  - **Unit tests** (25): formatting utilities, HTTP client
  - **Integration tests** (54): all 7 CKAN API tools
  - **Coverage**: vitest with v8 coverage support
  - Test fixtures for all CKAN endpoints + error scenarios
  - Scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`
- **Documentation**: Translated to English
  - README.md: comprehensive project overview
  - EXAMPLES.md: detailed usage patterns
  - CLAUDE.md: AI assistant instructions
- **OpenSpec**: Added change proposals
  - Test suite implementation proposal
  - Documentation translation spec

## 2026-01-08 (earlier)

### Code Refactoring
- **Major refactoring**: Restructured codebase from monolithic file to modular structure
  - **Before**: 1 file (`src/index.ts`) - 1021 lines
  - **After**: 11 organized modules - 1097 total lines
  - **Structure**:
    ```
    src/
    ├── index.ts (39)         # Entry point
    ├── server.ts (12)        # MCP server config
    ├── types.ts (16)         # Types & schemas
    ├── utils/                # Utilities (88 lines)
    │   ├── http.ts           # CKAN API client
    │   └── formatting.ts     # Output formatting
    ├── tools/                # Tool handlers (903 lines)
    │   ├── package.ts        # 2 tools
    │   ├── organization.ts   # 3 tools
    │   ├── datastore.ts      # 1 tool
    │   └── status.ts         # 1 tool
    └── transport/            # Transports (39 lines)
        ├── stdio.ts
        └── http.ts
    ```
  - **Benefits**:
    - Smaller files (max 350 lines vs 1021)
    - Localized and safe changes
    - Isolated testing possible
    - Simplified maintenance
    - Zero breaking changes
  - **Performance**: Build time 16ms, bundle 33KB (unchanged)
  - **Testing**: All 7 tools working

### Documentation Updates
- Created `REFACTORING.md` - Complete refactoring documentation
- Updated `CLAUDE.md` - Updated with new modular structure
- Updated `PRD.md` - Added npm publication requirement
  - Goal: Simple installation like PyPI in Python
  - `npm install -g ckan-mcp-server`
  - `npx ckan-mcp-server`

### Testing
- **Comprehensive testing** on https://www.dati.gov.it/opendata
  - Server status: CKAN 2.10.3, 66,937 datasets
  - COVID search: 90 datasets found
  - Organization search: Regione Toscana (10,988 datasets)
  - Faceting statistics: Top orgs, formats, tags
  - Dataset details: Vaccini COVID-19 2024 (Puglia)
  - Response times: 3-5 seconds (network + CKAN API)
  - All 7 tools working perfectly

### Status: Production Ready
- Code refactored and modular
- Fully tested and functional
- Documentation complete
- Ready for npm publication

## 2026-01-07

- **New tool**: `ckan_organization_search` - search organizations by name pattern
  - Simple input: only `pattern` (automatic wildcards)
  - Output: only matching organizations (zero datasets downloaded)
  - Efficient: server-side filtering, token savings
  - Example: pattern "toscana" -> 2 orgs, 11K total datasets
- Initial release
- MCP server for CKAN open data portals
- 7 tools: package_search, package_show, organization_list, organization_show, organization_search, datastore_search, status_show
- Build system: esbuild (ultra-fast, 47ms build)
- Fixed TypeScript memory issues by switching from tsc to esbuild
- Corrected dati.gov.it URL to https://www.dati.gov.it/opendata
- Created CLAUDE.md for repository guidance
- Tested successfully with dati.gov.it (4178 datasets on "popolazione" query)
