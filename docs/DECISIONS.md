# Design Decisions

Non-default choices made in this project — why we did X instead of the obvious Y.

---

## Build System

**Choice**: esbuild instead of `tsc`

`tsc` caused memory errors in WSL environments on large codebases. esbuild compiles in milliseconds and bundles internal modules into a single file. TypeScript (`tsconfig.json`) is kept only for editor support (LSP, type checking in IDE).

External dependencies (`@modelcontextprotocol/sdk`, `axios`, `express`, `zod`) are kept external (not bundled) so they must exist in `node_modules`.

`npm run build:tsc` is available as fallback but not used in CI or releases.

---

## Transport Modes

**Choice**: three transports (stdio, HTTP, Cloudflare Workers) sharing the same tool handlers

Tool handlers (`src/tools/`) are runtime-agnostic. Entry points (`src/index.ts` for Node, `src/worker.ts` for Workers) wire up the right transport. This avoids duplicating tool logic.

Default is `stdio` (for Claude Desktop and local MCP clients). HTTP mode is opt-in via `TRANSPORT=http`. Workers deployment uses `src/worker.ts` as a separate entry point.

---

## Output Format

**Choice**: Markdown default, JSON opt-in

Markdown is optimized for human readability in AI conversations. JSON (`response_format: "json"`) is available when the caller needs machine-readable data — it strips ~70% of CKAN metadata fields to reduce token usage.

**Character limit**: 50,000 chars hardcoded in `src/types.ts` (`CHARACTER_LIMIT`). When exceeded, `truncateJson` shrinks known arrays instead of cutting mid-string, and degrades to a small `{_truncated, _error}` object when shrinking cannot get under the limit — the output always parses as JSON. Markdown uses `truncateText` which cuts at the limit with a note. Error paths go through `formatError` so that `response_format: "json"` stays parseable on failures too.

**`structuredContent` is capped like the text** (issue #39): `jsonToolResult()` truncates once and parses the result back, so both channels carry the same bounded payload. Before this, the limit applied to `content[].text` only — `ckan_tag_list` with `limit=1000` on dati.gov.it returned ~50K of text alongside 65,382 uncapped characters of `structuredContent`, which made the cap meaningless for any client reading that channel.

An earlier note here claimed capping would drop rows from `datastore-table-ui`. That was wrong: the UI resource is commented out in `src/resources/index.ts` and never registered, and `ckan_datastore_search` returns no `structuredContent` at all. No exception was needed.

See `docs/JSON-OUTPUT.md` for the full field schema per tool.

---

## Solr Query Handling

CKAN uses Apache Solr for search. Several non-default decisions apply here.

### force_text_field: wrapping queries in `text:(...)`

**Problem**: CKAN portals don't set `df=text` explicitly in Solr queries. This is a known CKAN bug ([ckan/ckan#4376](https://github.com/ckan/ckan/pull/4376), 2018) present even in major national portals like dati.gov.it. Result: multi-term OR queries like `water OR environment` return 0 results silently — no error, just wrong count.

The bug affects the web GUI too — verified on dati.gov.it (`acqua OR Water` → 0, `acqua` → 1,359) and dati.toscana.it. It is a server-side Solr configuration issue; our fix only applies to calls going through the MCP server, not the portal GUI.

**Fix**: wrap the query in `text:(water OR environment)` to explicitly target the full-text field.

**Configuration**: `portals.json` has a per-portal `search.force_text_field` boolean. Portals known to need it are listed there. Unknown portals are auto-probed (see below).

### Auto-probe for unknown portals

**Choice**: on first call to a portal not in `portals.json`, run 2 parallel `rows=0` probe queries (`data OR dati` with default parser vs `text:(data OR dati)`) and compare counts.

If `text_count > default_count × 2` → the portal has the bug → use `text:(...)` for that portal. Result is cached in session memory (zero overhead on subsequent calls).

**Threshold rationale**: a 2× ratio catches real failures (catalog.data.gov: 4 vs 388,953; open.canada.ca: 0 vs 23,740) while not triggering on portals where the default parser already works well (opendata.swiss: 5,089 default vs 799 text — correctly not triggered).

**Portal still in `portals.json`**: always skips the probe. Manual config takes precedence.

### NOW date math — issued and modified fields

**Problem**: Solr date math (`NOW-30DAY`, `NOW-1YEAR`, etc.) works on native Solr fields (`metadata_modified`, `metadata_created`) but not on CKAN extra fields (`issued`, `modified`). These are indexed differently and don't support Solr date expressions. Result: `issued:[NOW-30DAY TO *]` silently returns 0.

**Fix**: auto-convert NOW expressions to ISO dates for `issued` and `modified` fields in both `q` and `fq` before sending to the API. `metadata_modified` and `metadata_created` are left untouched.

See `resolveNowExpr()` and `convertNowForExtraFields()` in `src/tools/package.ts`.

### Bilingual queries

**Convention** (documented in skill, not enforced by code): always use `q="TERM_NATIVE OR TERM_EN"` because CKAN portals store metadata in the publisher's language. A single-language query silently misses datasets without translation.

### content_recent helper

**Choice**: `issued:[ISO TO NOW] OR (-issued:* AND metadata_created:[NOW-Ndays TO NOW])`

`issued` is the publisher's content date (best for "recently published"). But many datasets don't have it. Fallback to `metadata_created` covers the rest. Using both avoids losing either category.

---

## Portal Configuration (`portals.json`)

**Choice**: per-portal JSON config instead of runtime detection for everything

Known portals have stable settings (API path, `force_text_field`, HVD field name, SPARQL endpoint, view URLs). Encoding them in `portals.json` avoids repeated probes and makes behavior predictable and reviewable.

Unknown portals fall back to defaults (`force_text_field: false`, standard API path, etc.) and are auto-probed when needed.

**Non-standard API paths**: most CKAN portals expose the API at `/api/3/action`. Some do not. `portals.json` has an `api_path` field to override this per portal. Currently only one portal needs it:

- `data.gov.uk`: uses `/api/action` (not `/api/3/action`)

The fallback `getPortalApiPath()` in `portal-config.ts` returns `/api/3/action` for any portal not listed, so unknown portals work out of the box unless they also use a non-standard path.

Notable non-standard portals:
- `data.gov.uk`: `api_path: "/api/action"`, needs `force_text_field`
- `dati.gov.it`: `api_url` includes a path prefix (`/opendata`), so the full API base is `https://www.dati.gov.it/opendata/api/3/action`; needs `force_text_field`, has HVD support, has a SPARQL endpoint
- `opendata.swiss`: default parser returns more results than text parser — do NOT set `force_text_field`

**SPARQL endpoint User-Agent**: `lod.dati.gov.it/sparql` returns 403 without a browser-like `User-Agent`. The server sends `Mozilla/5.0 (compatible; CKAN-MCP-Server/1.0)` for all SPARQL requests. Direct curl calls without this header will fail — always include `-H "User-Agent: Mozilla/5.0 (compatible; CKAN-MCP-Server/1.0)"`.

---

## DataStore Availability

**Decision**: do not assume DataStore is available; always check `datastore_active: true` on resources before calling DataStore tools.

DataStore is a CKAN extension — many portals don't have it. `dati.gov.it` does **not** have DataStore. For DataStore testing, use `dati.comune.messina.it` or `open.canada.ca`.

---

## Read-Only

**Decision**: all tools are read-only. No write, update, or delete operations on any CKAN portal.

Rationale: MCP servers used in AI conversations should not modify external state without explicit user intent and confirmation flows that are outside the current scope.

---

## Two README Files

**Choice**: `README.md` (full, for GitHub) and `.readme-npm.md` (short intro + link, for npm).

npm displays the README from the published tarball. A full README with many images is too heavy for the npm page. `prepack`/`postpack` hooks in `package.json` swap them automatically during `npm publish`.

**Rule**: always use absolute GitHub URLs in both files — npm cannot resolve relative paths from the tarball.

---

## Test Target Portal

**Rule**: always use `https://www.dati.gov.it/opendata` for tests. Never `demo.ckan.org`.

`demo.ckan.org` has unpredictable data — datasets appear and disappear. `dati.gov.it` is stable, well-maintained, and large enough for meaningful tests.

For DataStore tests: `https://dati.comune.messina.it`.
