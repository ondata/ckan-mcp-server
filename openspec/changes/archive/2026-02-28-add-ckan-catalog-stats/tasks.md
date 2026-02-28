# Tasks: add-ckan-catalog-stats

## Phase 1: Implementation

- [ ] Add `registerCatalogStatsTools(server)` to `src/tools/analyze.ts`
  - Tool name: `ckan_catalog_stats`
  - Input: `server_url`, optional `facet_limit` (default 20)
  - Single call: `package_search?q=*:*&rows=0&facet.field=["groups","res_format","organization"]`
  - Exported render function: `formatCatalogStatsMarkdown`
  - Markdown + JSON output
- [ ] Register in `src/server.ts`

## Phase 2: Tests

- [ ] Add fixture: `tests/fixtures/responses/catalog-stats.json`
- [ ] Add unit tests for `formatCatalogStatsMarkdown` in `tests/integration/analyze.test.ts`

## Phase 3: Validation

- [ ] `npm run build`
- [ ] `npm test`
- [ ] HTTP smoke test against `https://dati.comune.messina.it`

## Review

_To be filled after implementation._
