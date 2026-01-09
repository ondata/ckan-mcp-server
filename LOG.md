# LOG

## 2026-01-09

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
