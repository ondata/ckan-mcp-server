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

### `text:(...)` wrapping: only for boolean queries

**Mechanism** (established 2026-09-05, replacing an earlier explanation that blamed a Solr `df` bug): `package_search` sends a colon-free query to Solr's **dismax** parser with `q.op=AND`, `mm='2<-1 5<80%'` and `qf='name^4 title^4 tags^2 groups^2 text'` (`ckan/lib/search/query.py`). dismax has no boolean syntax, so `A OR B` collapses into `A AND B` — on dati.gov.it `aria OR Milano` returns 59, exactly what `aria AND Milano` returns. A colon takes the query off dismax; wrapping it as `text:(A OR B)` restores the OR (3421).

The same switch is why wrapping harms everything else: it drops the `qf` boosts that rank titles and tags first, searches the catch-all `text` field alone, and ANDs every term instead of applying `mm`. Measured on dati.gov.it: `defibrillatori Comune di Lecce` 678 → 1, `musei roma arte opere catalogo` 9 → 0. On 40 real queries from telemetry, the wrapper helped 8 of 9 boolean queries and hurt 10 of 31 plain ones, six of them to zero.

**Choice**: wrap only queries that carry `AND`/`OR`/`NOT`, or punctuation inside a word that dismax would read as an operator (`e-government` → `e` NOT `government`, 58,919 results unwrapped against 278). A plain keyword query — the shape an LLM client generates — goes to the portal's own parser unwrapped.

**Escaping**: a `+`/`-`/`!` in operator position and balanced grouping parentheses survive the escaping. Escaping them inverts the caller's intent: `text:(ambiente \-rifiuti)` returns 398, exactly the set the caller excluded, against 7649 unescaped. Unbalanced parentheses and a parenthesis the caller escaped are still escaped as literals.

**Invariant**: every tool that builds a Solr query resolves the parser through `resolveSearchQuery` and the same probe. Today: `ckan_package_search` and `ckan_find_relevant_datasets`. A change to the parser is verified against every tool on that list — v0.4.122 shipped with the second one forgotten. Spec: `openspec/specs/ckan-search`.

### Parser probe, run for every portal

**Choice**: the wrap/no-wrap verdict is measured at runtime for every portal, configured ones included. `force_text_field` was removed from `portals.json` in #534: the stored values had gone stale, with two portals marked "no wrapping" for a reason the rule above now handles, so there is one source of truth.

**Why the old probe was wrong**: it asked `data OR dati`, two words common enough to saturate. On dati.comune.milano.it `data` alone and `data OR dati` both return 2564, so the probe read the portal as healthy while `aria OR acqua` returned 0 against 54 and 33 for the single terms.

**Algorithm**: pick two terms from the catalog itself — single-word tag facets between 0.5% and 30% of the catalog, falling back to frequent title words, restricted to letters, digits and underscore so no Solr syntax leaks in — and count `A`, `B`, `A OR B`, `text:(A OR B)`. An `A OR B` returning fewer hits than either operand is not being honoured; the wrapper is the answer only if the wrapped form returns more. `data.stadt-zuerich.ch`, whose `text` field returns 0 for every query, is correctly left alone.

**Cost**: a plain query pays nothing, since only a boolean query can be wrapped. Five extra `rows=0` calls the first time a boolean query reaches a portal in a session (0.58 s on Workers, 0.11 s after), then nothing. A verdict is cached only when it was actually measured, so a portal that timed out is retried rather than written off for the session.

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

Known portals have stable settings (API path, HVD field name, SPARQL endpoint, view URLs). Encoding them in `portals.json` avoids repeated probes and makes behavior predictable and reviewable.

Unknown portals fall back to defaults (standard API path, etc.). The Solr parser verdict is not a setting: it is measured for every portal, see above.

**Non-standard API paths**: most CKAN portals expose the API at `/api/3/action`. Some do not. `portals.json` has an `api_path` field to override this per portal. Currently only one portal needs it:

- `data.gov.uk`: uses `/api/action` (not `/api/3/action`)

The fallback `getPortalApiPath()` in `portal-config.ts` returns `/api/3/action` for any portal not listed, so unknown portals work out of the box unless they also use a non-standard path.

Notable non-standard portals:
- `data.gov.uk`: `api_path: "/api/action"`
- `dati.gov.it`: `api_url` includes a path prefix (`/opendata`), so the full API base is `https://www.dati.gov.it/opendata/api/3/action`; has HVD support, has a SPARQL endpoint
- `data.stadt-zuerich.ch`: the `text` field returns 0 for every query, so wrapping must never apply there — the probe finds this on its own; it is the reason the probe exists at all

**Migrated portals stay listed**: a portal that has left CKAN keeps its entry, marked `migrated` with a notice and a docs URL, rather than being deleted. `catalog.data.gov` moved to a non-CKAN API in 2025 and answers 404 to every CKAN request; deleting the entry would turn the notice back into "Unknown error" for the callers who still try it (47 in five months). The lookup is by hostname, as request routing is, so any spelling of the host gets the notice (#540).

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

---

## Release Gate

**Rule**: `npm run smoke` must be green before a tag. It runs known-answer search queries against live portals and asserts **which** dataset comes back, not how many.

v0.4.122 shipped with result counts verified and the ranking broken: `bonifica siti contaminati Piemonte` went from 5 results to 22, which was the fix working, while `defibrillatori Comune di Lecce` went from 1 result to 679 with the Lecce dataset nowhere in the top three, which was a regression. Both look identical if you only check how many results came back. Counting results proves recall; only the first result proves usefulness, and usefulness is what a caller asked for.

Every case in `tests/smoke/cases.json` names the regression it guards, and the gate is checked against them: reintroducing the v0.4.121 wrapping rule fails 4 of 13, removing the parser probe from `ckan_find_relevant_datasets` fails the case that compares the two search tools. A case is added when a real defect is found, not speculatively — twelve cases that describe failures that happened are worth more than a hundred generic ones.

## Release Cadence

**Rule**: a release does not go out the same day as the change that motivates it.

On 2026-09-05 three versions went out in one day, two of them to repair the one before. For a package with downstream reuse, a day's delay costs nothing and a shipped regression costs a correction release plus the trust of whoever installed in between. The gate above catches what it knows about; a night in between catches what it does not.

A release needs a reason that concerns whoever installs it. Tooling, test and documentation changes ride along with the next such reason; `main` ahead of the tag is the normal state, not a debt.
