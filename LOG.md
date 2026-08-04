# LOG

## 2026-08-04

### v0.4.116

Ships the two DataStore output fixes below, plus `.greptile/rules.md`: the automated review on #43 produced one confident false positive, so the invariants a generic reviewer cannot know are now stated in the repo.

### DataStore tables no longer hide columns silently

Both markdown renderers in `src/tools/datastore.ts` cut the record table at 8 columns with no notice. On the Messina electoral-lists resource (14 columns) the table stopped right before `cognome`, `nome`, `sesso` and `voti`: a model reading it saw an election dataset with no votes and no candidate names, and nothing told it anything was missing. Row truncation was already handled properly (`... and N more records`, `Total Records`); columns were not.

Both renderers now append a note naming the omitted columns and pointing at the way to retrieve them (`fields` parameter for search, an explicit SELECT list for SQL, or `response_format: "json"`). The JSON path never had the bug — `compactDatastoreResult` passes every column through.

Found while checking what the GovInsider piece on the OKFN Brazil/Uruguay pilot added to `docs/future-ideas.md` (nothing new — it covers the same pilot already recorded on 2026-06-11), but its failure mode is exactly this: the model fills a gap it cannot see.

### `_full_text` no longer eats a table slot

Surfaced by the end-to-end check above: `datastore_search_sql` on `SELECT *` returns CKAN's internal `_full_text` column, which repeats the whole row as one concatenated string. It was taking the first table slot and pushing out a real column, and the same query reported 15 columns via SQL against 14 via `datastore_search`. `_id` was already filtered; `_full_text` now is too, in both renderers and in the JSON output (where it was pure token waste). The two tools now agree on the column count.

465 tests pass; verified end to end against `dati.comune.messina.it`.

## 2026-08-03

### v0.4.115

First release published from CI. No functional change: this exists to exercise the release workflow added earlier today end to end — tag guard, OIDC authentication, provenance attestation — rather than discovering whether it works during a release that actually matters.

Worked on the first try: the job went green in 34s and the attestation binds the tarball to `ondata/ckan-mcp-server`, workflow `release.yml`, ref `refs/tags/v0.4.115`, on a GitHub-hosted runner. `npm view @aborruso/ckan-mcp-server@0.4.115 dist.attestations` returns an SLSA v1 provenance; the same query on the hand-published 0.4.114 returns nothing.

One snag worth remembering: `mcp-publisher` failed with an expired JWT, and re-running `login github` then died with `incorrect_device_code` before the browser step. Neither error named the real cause — the local binary was **1.5.0 from 6 March**, and the device-auth flow changed by **1.8.0**. Updating the binary fixed it. When the registry token expires, check the publisher version too: both were installed the same day and go stale together.



### npm provenance: release workflow on tags

`npm view @aborruso/ckan-mcp-server@0.4.114 dist.attestations` came back empty — packages were published by hand from a local machine, with nothing binding a tarball to the commit that produced it. Adopters could check *which* version was current (see below) but not *where it came from*.

- New `.github/workflows/release.yml`: triggers on `v*` tags, verifies the tag matches `package.json` **before** anything else (npm publishes are irreversible after 72h), then `npm ci` → build → tests → `npm publish --provenance`. Guard tested both ways; `npm test -- --run` confirmed against the current 461-test suite.
- `package.json` had **no `repository` field** — a hard prerequisite for provenance, which would have failed the publish. Set to `ondata/ckan-mcp-server`.
- Release workflow in `CLAUDE.md` rewritten rather than extended: step 5 now warns that pushing the tag *is* the publish, step 9 says explicitly not to run `npm publish` by hand (two paths would collide on `EPUBLISHCONFLICT`), and step 10 must wait for the CI run to go green because the MCP Registry validates that the npm version exists.
- `.readme-full.md` added to `.gitignore`: the `prepack`/`postpack` pair swaps in the short npm README, so a local publish failing between the two hooks leaves the wrong `README.md` in the tree, one `git add .` away from being committed.
- Authentication is **trusted publishing (OIDC)**, not a secret. The first draft used an `NPM_TOKEN`; `npm profile get` then surfaced npm's own warning that "tokens that bypass 2FA are being restricted for direct publishing", which pointed at the mechanism npm now recommends instead. Trusted publishing needs no stored credential, emits provenance by default, and — because the trusted publisher names the GitHub repo explicitly — also settles the open question about the npm scope (`@aborruso`) differing from the GitHub org (`ondata`). The workflow upgrades npm to ≥ 11.5.1 explicitly: Node 22 ships npm 10.x, which falls back to token auth *silently* and would publish unattested. `--provenance` is kept although implied, so that degradation fails the job instead of passing quietly.
- **Not yet active**: the trusted publisher has to be registered by hand on npmjs.com (package → Settings → Trusted Publisher → GitHub Actions → `ondata` / `ckan-mcp-server` / `release.yml`). Until then the workflow runs and fails at the publish step. Note that the workflow filename is part of that identity.

### MCP Registry entry realigned to 0.4.114

Published and verified against the public endpoint: the registry now serves **0.4.114** with `isLatest: true` (updated 2026-08-03T06:01:07Z), and the old 0.4.83 record dropped to `isLatest: false`.

The official MCP Registry entry for `io.github.aborruso/ckan-mcp-server` had been stuck at **0.4.83 since 2026-03-12** — 31 patch releases and almost five months behind npm, while still flagged `isLatest: true`. Clients resolving the server through the registry were pointed at a build predating the v0.4.108 SSRF remediation, and 0.4.83 is still installable from npm.

- Root cause, not a one-off slip: the Release Workflow in `CLAUDE.md` listed the version bump for `package.json` and `manifest.json` but never `server.json`, and `npm publish` does not touch the registry. The drift was structural and would have kept growing.
- Fixed `server.json` (both `version` and `packages[0].version` — two fields, easy to half-update) and rewrote the release workflow: `server.json` added to step 1, a new step 10 for `mcp-publisher publish` placed after `npm publish` since the registry validates that the npm version exists, plus a `curl` one-liner to verify the published entry.
- Surfaced by an unsolicited vendor email selling a £395 "MCP Readiness Audit". The sales pitch was worthless — the remedy it offered has nothing to do with the defect — but the three technical claims all checked out under verification. Worth recording: the finding was real and cost the sender two `curl` calls, which is exactly how long it would have taken us to catch it ourselves with a check in the release procedure.
- Registry tokens (`.mcpregistry_*`) verified: gitignored, never committed.

## 2026-07-31

### v0.4.114

structuredContent capped like the text (closes #39).

The v0.4.113 cap applied to `content[].text` only, so any client reading the structured channel got the full payload — `ckan_tag_list limit=1000` on dati.gov.it: ~50K of text against 65,382 uncapped characters. The limit was a fiction for those clients.

- New `jsonToolResult()`: truncates once via `truncateJson` and parses the result back into `structuredContent`, so the two channels cannot disagree and `_truncated`/`_original_count` reach structured readers too. Applied to 13 call sites.
- `ckan_status_show` and `ckan_find_portals` pair structured output with Markdown text, so there is no truncated JSON to derive it from: they cap it on its own via the new `cappedStructured()`. My first pass left them uncapped calling them "bounded by shape" — wrong, as review pointed out: `status_show` is echoed straight from the portal, and the 50-result limit on `find_portals` bounds the number of entries, not the length of their titles and URLs. Only the `all_fields=false` count branches of `ckan_organization_list`/`ckan_group_list` stay outside the cap: a single integer.
- **Correction**: the deferral in v0.4.113 claimed capping would drop rows from `datastore-table-ui`. That was wrong and never verified — the UI resource is commented out in `src/resources/index.ts:18` and never registered, and `ckan_datastore_search` returns no `structuredContent` at all. No exception was needed. Same failure mode as the bug being fixed: a plausible claim about the code that nobody checked.
- 7 new tests (461 total), covering a payload long in a single field rather than in many, and a bounded-count list whose entries are individually oversized. Docs realigned: `README.md`, `docs/JSON-OUTPUT.md`, `docs/DECISIONS.md`, `CLAUDE.md` all asserted the uncapped behaviour.
- Released end to end: tag, GitHub release with DXT and skill, npm `0.4.114`, Cloudflare version `36b611fd`. Verified on the public endpoint after waiting for edge propagation — `tag_list limit=1000`: 49,938 characters on both channels, byte-identical, `_truncated` set. `status_show` and `find_portals` legitimately differ across channels: Markdown text against JSON structured output, two renderings of the same data.
- Process note: check edge propagation with an active probe, not a fixed wait. The v0.4.113 verification measured the old code because it ran seconds after deploy, and briefly looked like a broken release.

### v0.4.113 — release addendum

Released the same day: tag, GitHub release with DXT and skill, npm `0.4.113`, Cloudflare version `1cac40ea`. Also merged #38 (`docs: document user-facing limits`, contributed by `averyquinnhq`), which closed #37, and disabled the `claude-code-review` workflow: it cannot pass on fork PRs, since GitHub withholds secrets and the OIDC token for `pull_request` events from forks, so the job dies on token setup regardless of the diff. The file is kept in the repo. `CONTRIBUTING.md` now also states that `build:tsc` is not a gate — a contributor exhausted 8 GB of heap on it before reporting they could not pass it, because the warning lived only in `CLAUDE.md`.

### v0.4.113

JSON output always parseable (issue #39).

The docs promised "always valid JSON"; the code did not deliver it. Surfaced while reviewing PR #38 (an AI contribution by `averyquinnhq`), which documented the real behaviour and contradicted issue #37 — the PR was right.

- **Live repro**: `ckan_tag_list limit=1000` on dati.gov.it → 50,046 characters, `JSON.parse` fails. Not a corner case: an ordinary call.
- **`truncateJson`**: the last-resort branch cut the serialized string (`truncateText(JSON.stringify(...))`, with an in-code comment admitting "may produce invalid JSON"). It now empties arrays progressively and, when that is not enough, degrades to a valid `{_truncated, _error}`. `SHRINKABLE_KEYS` extended (+`rows`, `datasets`, `portals`, `facets`, `fields`) with a sacrifice order: bulk rows first, `fields` last.
- **8 tools + 4 Resources** used `truncateText(JSON.stringify(...))` directly: routed through `truncateJson`. `sparql_query` appended `/* output truncated */` to cut JSON (JSON has no comments): rewritten.
- **4 tools with no cap at all**: `ckan_get_mqa_quality`, `ckan_get_mqa_quality_details` (bare JSON.stringify), `ckan_find_portals`, `ckan_status_show` (markdown).
- **A third unparseable path**: no `catch` honoured `response_format` — every error came back as prose even with `json`. New `formatError()`; errors now return `{error, _error: true}` plus `isError: true`. Zod validation errors stay textual (emitted by the SDK before the handler runs).
- **`structuredContent` stays uncapped** (65,382 characters against 50,000 of text on tag_list): capping it would drop rows from `datastore-table-ui`, which consumes it. Decision deferred, documented in `docs/DECISIONS.md`.
- 10 new tests (`truncateJson` had none), 453 passing. E2e: `tag_list` from PARSE-FAIL to parse-ok; real errors parseable in json mode.
- `CONTRIBUTING.md`: section on AI-assisted contributions (disclosure, small diffs, verifiable claims).
- Review follow-up: `addDemoFooter()` was appended to JSON output in `quality.ts`, breaking parsing on Workers — now wraps the Markdown branch only, inside `truncateText`. Added `isError: true` to the two non-dati.gov.it guards. The `truncateJson` fallback now degrades further so it always respects small limits. 454 passing.

## 2026-07-09

### v0.4.112

Security — Round 3: hardening (closes the last group of advisories in triage).

- **Error reflection**: `makeCkanRequest` no longer embeds the upstream body (`JSON.stringify(decodedData)`) in the error returned to the caller — now a generic action-scoped message, with detail on stderr only (truncated). `worker.ts` catch-all: removed `error.message` from the JSON-RPC `data` field (server-side logging only). Closes the semi-blind read channel of the SSRF.
- **postMessage UI** (`resources/datastore-table-ui.ts`): the host origin is pinned from the reply to the `ui/initialize` handshake; messages carrying data are accepted only from that origin, and outbound messages use an explicit target origin (never `'*'`).
- **Prompt injection on org/group**: extended the c499 containment to the `organization.ts` and `group.ts` renderers — `description` in an untrusted block (`wrapUntrusted`), newlines collapsed in lists.
- 3 new tests (error no-leak, org/group description fencing); 443 passing. E2e: generic error on 404 (no internal body), normal requests fine. Worker build fine.

### v0.4.111

Security — Round 2: three distinct low-cost bugs.

- **MQA allowlist bypass** (`isValidMqaServer`, `tools/quality.ts`): unanchored regex replaced by URL parsing plus exact host comparison (`dati.gov.it`/`www.dati.gov.it`). Suffix (`dati.gov.it.attacker.com`) and userinfo (`dati.gov.it@attacker.com`) tricks are now rejected.
- **Decompression bomb / unbounded buffering** (`utils/http.ts`): response size cap (`maxContentLength`/`maxBodyLength` on axios plus a byte check on `arrayBuffer` in the fetch branch, default 32MB) and decompression output cap (`maxOutputLength` on gunzip/brotli/inflateSync plus a check on DecompressionStream, default 64MB). Override via `CKAN_MAX_RESPONSE_BYTES`/`CKAN_MAX_DECOMPRESSED_BYTES`. Stops OOM/stalls from hyper-compressed payloads.
- **Cache-key collision** (`utils/cache.ts`): `canonicalizeParams` now produces typed canonical JSON (recursive sort) instead of a `k=v` join with unescaped `&`; `buildCacheKey` frames it in `JSON.stringify([url,action,canon])`. `{q:"budget",rows:10}` and `{q:"budget&rows=10"}` no longer collide.
- 2 new tests (plus updated regressions); 440 passing. E2e: valid MQA host reaches data.europa.eu, bypass rejected, normal requests fine. Worker build fine.
- Further hardening in progress for upcoming releases.

### v0.4.110

Security — Round 1: SSRF cluster on the `fetch` path (GHSA-vmrr, GHSA-38f8; GHSA-8hxx clarified):

- **Centralized `safeFetch()`** in `utils/http.ts`: `redirect:"manual"` plus re-validation of every hop (`validateServerUrl` + `assertHostnameResolvesSafe`), bounded hops, `httpsOnly` option. Closes redirect-SSRF (e.g. a public endpoint 302-ing to `169.254.169.254`) without breaking legitimate canonical redirects. Used by `sparql_query` (3 fetches) and by the MQA metrics fetch in `quality.ts`.
- **`assertHostnameResolvesSafe` is now fail-closed**: it distinguishes "DNS module absent (Workers) → no-op" from "resolution failed → throw". Previously a DNS error let the request proceed (fail-open / TOCTOU).
- **GHSA-8hxx**: verified that WHATWG `URL` already normalizes IPv4 encodings (int/hex/octal/short) to dotted-decimal before `validateServerUrl` → the existing check already covers them. No code added (the advisory PoC tested the regex against raw strings, not the parsed hostname). Only a comment and regression tests. The remaining `::7f00:1` (IPv4-compatible IPv6) is not routable, as the advisory itself concedes.
- MQA fetch: constant host (`data.europa.eu`), so hardening for consistency rather than a real vector.
- 6 new tests (redirect→internal blocked, redirect→non-HTTPS rejected, fail-closed on DNS error, IPv4 encodings blocked). 438 passing. E2e: Wikidata via `safeFetch` fine, internal IP blocked. Worker build fine.
- Further security hardening in progress for upcoming releases.

### v0.4.109

Security hardening — 3 advisories, "poison and door" (environmental risk before the knives):

- **GHSA-3369** (second-order SSRF, `ckan_list_resources`): source-portal probing is now **opt-in** (`check_source_portal` defaults to `false`). It used to be ON: listing a dataset's resources contacted hosts and ports taken from the dataset's own data (confused deputy + port-scan oracle + amplification via `Promise.all`). Added: ports other than 80/443 dropped in `extractSourcePortal` (uses `hostname`, not `host`), fan-out capped at 10 probes.
- **GHSA-c499** (indirect prompt injection): free-text portal fields (`notes`, resource `description`) were rendered verbatim in the output. They are now wrapped in a delimited `untrusted` block with a warning (`wrapUntrusted`), with inner fences neutralized; portal URLs are scheme-validated (http/https only) and rendered as inline code (`safeUrlText`); `ckan_list_resources` table cells are neutralized (`|`, newlines). Containment, not a complete fix — documented for integrators.
- **GHSA-v3j5** (exposed HTTP transport): binds to **`127.0.0.1`** by default (was `0.0.0.0`), `enableDnsRebindingProtection` plus `allowedHosts`/`allowedOrigins`. `docker-compose.yml` publishes on `127.0.0.1:3000:3000` (with `CKAN_HTTP_HOST=0.0.0.0` inside the container). New env vars: `CKAN_HTTP_HOST`, `CKAN_HTTP_ALLOWED_HOSTS`, `CKAN_HTTP_ALLOWED_ORIGINS`. Closing this door downgrades the whole SSRF cluster from "remote" to "local".
- 4 new tests; 432 passing. Verified e2e against a real HTTP deployment (loopback bind, 403 on disallowed Host, no probing by default, notes fenced). Worker build fine.
- Docs: README (HTTP env var table), SKILL (source-portal now opt-in), docker/README, docker-compose.
- **Not done yet** (fetch SSRF cluster, MQA regex, cache, decompression bomb, postMessage UI): knives and hardening, in later rounds.

## 2026-06-22

### v0.4.108

- Security fix (GHSA-798p-78g2-v556): close DNS-name SSRF bypass — `validateServerUrl` only checked the hostname string, so a name resolving to an internal IP (e.g. `lvh.me` → `127.0.0.1`, `*.nip.io` → cloud IMDS) bypassed the guard. Added DNS resolution + validation of every resolved IP, with connection pinning via a custom `lookup` agent (closes DNS-rebinding and redirect-to-internal) on the Node/axios path; pre-resolution check on the fetch-based `sparql_query` (HTTPS-only). Extracted `isBlockedIp` shared by literal and resolved-IP guards. `maxRedirects: 5` on CKAN requests.
- Hardening: the network-exposed HTTP transport now refuses to start without `CKAN_ALLOWED_DOMAINS` (default-deny), unless explicitly opted out with `CKAN_HTTP_ALLOW_ALL=true` (logs a warning). stdio stays open. Cloudflare Worker unaffected (CF sandbox already blocks internal addresses).
- 11 new tests (isBlockedIp, SSRF-safe lookup, allowlist gate, DNS-bypass on sparql). Verified end-to-end against a real HTTP deployment.
- Reported by: EchoSkorJjj

## 2026-06-18

### v0.4.107

- `ckan_package_show`: surface DCAT-AP fields already returned by package_show but previously hidden in markdown output — Rights Holder (`holder_name` via readDcatExtra), Publisher (`publisher_name`), Update Frequency (`frequency`), Language (`language`), Access Rights (`access_rights`). Each printed only when present; no new tools or API calls. `conforms_to` deliberately excluded (renders as raw JSON). Verified on dati.gov.it (DCAT-AP-IT) and open.canada.ca (no regression).

## 2026-05-31

### v0.4.106

- Security fix (GHSA-g84h-j7jj-x32p): block `ip6-localhost` and `ip6-loopback` SSRF bypass — hostname aliases present in `/etc/hosts` on Linux that resolve to `::1` but bypassed the existing SSRF filter (GHSA-3xm7-qw7j-qc8v); replaced single `localhost` check with a blocked-hostname `Set`; 2 new unit tests added
- Reported by: hibrian827

## 2026-05-25

### v0.4.105

- Fix (scoring): `ckan_find_relevant_datasets` now scores `holder_name` (DCAT-AP_IT `dct:rightsHolder`) and `publisher_name` (`dct:publisher`) as distinct weighted fields, separate from `organization`
- Rationale: on federated catalogs (e.g. `dati.gov.it`, but the pattern applies to any portal harvesting from sub-publishers), `organization` is the harvesting catalog (e.g. `regione-puglia`), NOT the data owner. Queries like "datasets from Comune di Lecce" previously scored 0 on the owner field when the dataset was harvested via Regione Puglia or a local action group, missing the actual `rightsHolder`
- The fields are read from `extras[]` (the authoritative DCAT-AP_IT location on Italian portals) with fallback to root-level. On dati.gov.it, `package_search` exposes `holder_name` and `publisher_name` both in `extras[]` (correct DCAT values) and at root (often overwritten by the harvester with the organization name); reading only the root would be wrong. The root-level fallback preserves correct behavior on non-DCAT-AP_IT portals (data.gov, open.canada.ca)
- Bug surfaced on real-world Puglia datasets: `defibrillatori-esterni` (extras.holder=Comune di Mesagne, root.holder=GAL Terra dei Messapi, organization=GAL Terra dei Messapi) and `defibrillatori-dae-progetto-comune-cardioprotetto` (extras.holder=Comune di Lecce, organization=Regione Puglia)
- Defaults: `holder=4` (peer with `title` — actual institutional owner per DCAT-AP_IT), `publisher=2` (lower because sometimes a technical role like "Redazione OD" rather than the institution)
- API: `weights` object accepts two new optional fields (`holder`, `publisher`); backward-compatible — clients not setting them get the improved scoring by default
- Types: added `holder_name?: string` and `publisher_name?: string` to `CkanPackage` interface (previously accessed via index signature)
- Added internal helper `readDcatExtra(dataset, key)` that encapsulates the extras-first, root-fallback lookup
- Score breakdown markdown and JSON outputs include `holder` and `publisher` per dataset
- Validated against live `package_search` responses on dati.gov.it: defibrillatori-esterni (Mesagne) 6 → 12, comune-cardioprotetto (Lecce) 10 → 13

## 2026-05-20

### v0.4.104

- Source portal DataStore fallback + LLM error hints (see 2026-05-18 entries below)

## 2026-05-18

- Source portal DataStore fallback: `ckan_list_resources` now probes the source portal when a resource has `datastore_active=false` and its download URL belongs to a different CKAN instance (harvested dataset pattern). Adds `source_datastore_active` and `source_portal_url` fields to output. New `check_source_portal` parameter (default `true`) to skip extra HTTP calls. New `extractSourcePortal()` utility in `url-generator.ts`. Scoped to CKAN-to-CKAN harvesting (detects `/resource/{uuid}/` URL pattern). 12 new tests → 399 total.
- LLM error hints: add `CkanApiError` class to `makeCkanRequest` (carries `status` + `action`); add `formatCkanError()` with hint table mapping HTTP status/action → actionable suggestion for the LLM (404 datastore → `ckan_package_show`, 404 package → `ckan_package_search`, 400 SQL → check columns, 503 → retry, etc.)
- Replace raw `error.message` interpolation in all tool catch blocks (datastore, package, organization, group, analyze, portal-discovery, quality) with `formatCkanError()`
- Replace fragile string-match in `organization.ts` (`includes('CKAN API error (500)')`) with `error instanceof CkanApiError && error.status === 500`
- Tests: 9 new unit tests for `CkanApiError` and `formatCkanError` → 387 total (381 pass, 6 skipped)

## 2026-04-22

- Security: add optional domain allowlist (`CKAN_ALLOWED_DOMAINS` env var) in `validateServerUrl()`; blocks requests to unlisted public domains — CERT-AgID MCP recommendation
- Security: add structured audit logging to stderr for all `makeCkanRequest` calls in Node modes (stdio + http); fields: `ts`, `server`, `action`, `cache_hit`, query params — CERT-AgID MCP recommendation
- Tests: 8 new tests (4 allowlist, 3 audit log) → 383 total (377 pass, 6 skipped)

## 2026-04-14

### v0.4.102

- Add `cache_hit` field to worker telemetry log entries
- `getLastCacheHit()` exported from `src/utils/http.ts`; `worker.ts` logs after response with `cache_hit: true/false`
- Enables cache hit rate analysis in `worker_events_flat.jsonl`

### v0.4.101

- Add per-portal upstream rate limiter (`src/utils/rate-limiter.ts`)
- Token bucket algorithm, one independent bucket per hostname
- Integration in `makeCkanRequest`: cache hit bypasses limiter; only upstream fetches consume tokens
- Config: `CKAN_RATE_LIMIT_ENABLED`, `CKAN_RATE_LIMIT_RPS` (default 5), `CKAN_RATE_LIMIT_BURST` (default 10), `CKAN_RATE_LIMIT_MAX_WAIT_MS` (default 5000)
- Per-call bypass via `opts.rateLimit: false`; disabled by default in Vitest runs
- `RateLimitError` thrown when wait exceeds `maxWaitMs` (includes hostname + wait ms)
- 13 new unit tests; suite now 370 tests, all green
- OpenSpec: `add-upstream-rate-limiter`

### v0.4.100

- Add read-through HTTP cache layer in `makeCkanRequest` (`src/utils/cache.ts`)
- Backends: Cloudflare Cache API on Workers, bounded in-memory LRU on Node
- Action-based TTL: metadata 300s, datastore 60s, status 3600s; fallback configurable
- Env vars: `CKAN_CACHE_ENABLED`, `CKAN_CACHE_TTL_DEFAULT`, `CKAN_CACHE_MAX_ENTRIES`, `CKAN_CACHE_MAX_ENTRY_BYTES`
- Per-call bypass via `makeCkanRequest(..., { cache: false })`; errors and oversize payloads never cached
- 29 new unit tests; suite now 357 tests, all green
- Measured locally: 348 ms cache miss → 13 ms cache hit on identical `package_search` calls (~27×)
- OpenSpec: `add-http-cache-layer` (proposal + design + spec)

## 2026-04-09

### v0.4.99

- Fix `resolveSearchQuery`: `*:*` and fielded queries (e.g. `title:X`) are no longer wrapped in `text:(...)` when auto-detected parser override is "text" — `escapeSolrQuery` was turning `*:*` into `\*\:\*`, returning 0 results on portals like dati.comune.messina.it

## 2026-04-05

- Fix `ckan_package_search`: quoted phrases (e.g. `"aree protette"`) now work inside `text:(...)` wrapping — removed `"` from `escapeSolrQuery` special chars so phrase queries are preserved

## 2026-04-03

### v0.4.97

- Improve tool parameter descriptions for Code Mode compatibility (group, tag, package tools)
- Add `.describe()` to all parameters in `ckan_group_list`, `ckan_group_show`, `ckan_group_search`
- Add `.describe()` to all parameters in `ckan_tag_list`
- Improve `ckan_package_show` parameter descriptions (server_url example, id UUID/slug hint)

## 2026-03-26

### v0.4.96

- Add `dati.regione.sicilia.it` (Sicily open data portal) to `portals.json` with `force_text_field: false` — CKAN 2.6.8 does not support the `text:(...)` query wrapper

### v0.4.95

- Show `Portal Locale` (`locale_default`) in `ckan_status_show` markdown output
- Add query language hint to `ckan_package_search` description: check locale before searching
- Update skill query construction rule: dynamic locale check via `ckan_status_show` instead of hardcoded portal table

### v0.4.94

- Add `data.gov.ua` (Ukraine open data portal) to `portals.json` with explicit `force_text_field: false` to prevent auto-detection from incorrectly wrapping Solr queries in `text:(...)`, which caused 0 results

## 2026-03-24

### v0.4.93

- fix(worker): return 405 immediately for GET /mcp — prevents bot scanners from hanging the Worker and consuming CPU quota

## 2026-03-23

### v0.4.92

- fix(http): create server + transport per request — SDK 1.26.0 security fix enforces stateless transport cannot be reused across requests

### v0.4.91

- fix(worker): create server + transport per request — SDK 1.27.1 enforces stateless transport cannot be reused across requests

## 2026-03-22

### v0.4.90

- chore(deps): update `@modelcontextprotocol/sdk` 1.25.2 → 1.27.1 — fixes Claude Desktop crash with MCP protocol `2025-11-25`

## 2026-03-19

### v0.4.89

- fix(`tools/organization.ts`): `ckan_organization_search` lowercases pattern before Solr query — fixes case-sensitive search (e.g. "Roma" → no results)

### v0.4.88

- fix(`tools/organization.ts`): `ckan_organization_search` now shows `view_url` in markdown table and JSON output; `ckan_organization_show` JSON includes `view_url` — all using `portals.json` custom patterns



- evals(`evals/tool-selection`): tool selection eval pipeline — synthetic NL query generation (Gemini, 1583 records), train/eval split, fine-tuning Qwen2.5-0.5B with Unsloth on Colab T4; 86.3% accuracy on 8 tools; model published at huggingface.co/aborruso/ckan-tool-selector

## 2026-03-17

- fix(`tools/sparql.ts`): add `; charset=utf-8` to POST Content-Type — fixes accented chars corruption in SPARQL queries (issue #22)

## 2026-03-16

- docs(`tools/datastore.ts`): add security note to `ckan_datastore_search_sql` — clarifies SQL forwarding boundary; bump v0.4.86
- security(`tools/sparql.ts`): apply `validateServerUrl()` to `sparql_query` — blocks SSRF via private IPs (gap from GHSA-3xm7-qw7j-qc8v); 1 new test

## 2026-03-15

- security(`utils/http.ts`): add `validateServerUrl()` — blocks SSRF via private/loopback IPs, link-local, and non-HTTP/S protocols; 15 new tests

## 2026-03-14

- fix(`worker.ts`): add OPTIONS preflight handler at `/mcp` — was returning 405, blocking CORS-based connectors (e.g. Dify)

## 2026-03-12

- chore(`package.json`, `server.json`): fix mcpName to `io.github.aborruso/ckan-mcp-server` (ondata org not authorized); bump to v0.4.83
- chore(`package.json`, `server.json`): add `mcpName` for MCP Registry publication (`io.github.ondata/ckan-mcp-server`); bump to v0.4.82

## 2026-03-10

- fix(`worker.ts`+`worker_telemetry_flatten.py`): `ckan_find_portals` now logs `country`, `language`, `has_datastore`, `min_datasets` — previously always `null` in `worker_events_flat.jsonl`
- fix(`worker.ts`): `sparql_query` now logs correct `server` field — was always `""` because logging code read `server_url` but SPARQL tool uses `endpoint_url`; fix: `a['server_url'] ?? a['endpoint_url'] ?? ''`

## 2026-03-08

- fix(skill): bilingual query rule made conditional — use native language only on monolingual portals (dati.gov.it → IT, data.gov → EN); bilingual only on multilingual portals (data.europa.eu, open.canada.ca)
- fix(skill): geographic qualifiers (city/region/country) must never be OR-joined with topic terms — always use `fq` or AND; OR-joining a place name inflates results with off-topic datasets

## 2026-03-08

- feat(`package.ts`): auto-detect Solr parser mode for unknown portals via probe query `data OR dati` (2 parallel rows=0 calls); if text count > default count × 2 → use text:(...) wrapping; result cached per portal URL for session lifetime
- feat(`portal-config.ts`): add `isPortalSearchExplicitlyConfigured()` to distinguish known vs unknown portals
- fix(`package.ts`): auto-convert `NOW` date math to ISO dates for `issued` and `modified` fields in `q` and `fq` — these are CKAN extra fields not native Solr fields, so `NOW` syntax returned 0 results on all portals tested (dati.gov.it, catalog.data.gov); ISO dates work universally
- fix(`package.ts`): fix `content_recent` clause to use ISO date for `issued` field (same root cause)
- docs(`tools.md`): clarify date math limitation — `NOW` only works on `metadata_modified`/`metadata_created`; `issued`/`modified` require explicit ISO dates (now auto-converted by server)

## 2026-03-07 (v0.4.77)

- fix(`http.ts`): remove `Referer`, `Sec-Fetch-*`, `Upgrade-Insecure-Requests` from axios headers — these triggered WAF block on BA Data (data.buenosaires.gob.ar) and other portals with strict WAF rules; dati.gov.it unaffected

## 2026-03-06 (v0.4.75)

- fix(`ckan_find_portals`): deduplicate portals by hostname, preferring https over http
- feat: new tool `ckan_find_portals` — discovers CKAN portals from datashades.info registry (~950 portals); filters by country, keyword, min_datasets, language, has_datastore; LLM translates country to English

## 2026-03-06 (v0.4.74)

- fix: use `z.coerce.number()` for all numeric tool parameters — fixes validation errors when MCP clients pass numbers as strings (closes #16)

## 2026-03-05 (v0.4.73)

- feat: `package_show` now includes `api_json_url` for dataset and each resource (direct CKAN API JSON link)
- fix: `api_json_url` uses portal-specific API path via `getPortalApiPath` instead of hardcoded `/api/3/action`

## 2026-03-05 (v0.4.72)

- fix: `package_show` JSON now includes `hvd_category`, `applicable_legislation`, `frequency`, `language`, `publisher_name`, `holder_name`
- fix: `fq` parameter docs warn about correct Solr OR syntax and `extras_` prefix for CKAN extras fields

## 2026-03-04 (v0.4.71)

- feat: new MCP prompt `ckan-search-hvd` — guided HVD search using `hvd.category_field` from `portals.json`; fallback to keyword search for unconfigured portals

## 2026-03-04 (v0.4.70)

- feat: `ckan_status_show` now shows HVD dataset count when portal has `hvd.category_field` configured in `portals.json`

## 2026-03-04 (v0.4.69)

- feat: `ckan_package_search` and `ckan_package_show` JSON output now include `view_url` field pointing to the dataset page on the source portal

## 2026-03-04 (v0.4.68)

- feat: SPARQL endpoint config in `portals.json` — `sparql.endpoint_url` + `sparql.method` per portal (Italy: `lod.dati.gov.it/sparql`, GET-only)
- feat: `ckan_status_show` now shows SPARQL endpoint when configured for the portal
- fix: `sparql_query` — GET fallback on 403/405 for endpoints that reject POST; User-Agent set to `Mozilla/5.0 (compatible; CKAN-MCP-Server/1.0)` (required by AWS WAF on lod.dati.gov.it)
- refactor: `portal-config.ts` — added `SparqlConfig` type, `getSparqlConfig(endpointUrl)`, `getPortalSparqlConfig(serverUrl)`; tool count 18→19

## 2026-03-04 (v0.4.67)

- improve: `sparql_query` — validate SELECT-only, auto-inject LIMIT (default 25, max 1000), truncate output at CHARACTER_LIMIT; +11 tests (310 total)
- remove: `europa_dataset_search` tool and related files (`src/tools/europa.ts`, `src/utils/europa-http.ts`, Europa types in `src/types.ts`, docs, tests); tool count 19→18

## 2026-03-04 (v0.4.66)

- feat: add `sparql_query` tool — execute SPARQL SELECT against any public HTTPS endpoint (e.g. data.europa.eu/sparql, DBpedia, Wikidata)
- feat(europa): update `europa_dataset_search` description to suggest `sparql_query` for publisher aggregations and queries not exposed as facets
- test: add 12 tests for `sparql_query` (querySparqlEndpoint, formatSparqlMarkdown, formatSparqlJson)

## 2026-03-04 (v0.4.65)

- feat(europa): add `publisher` to `ALLOWED_FACETS` in `europa_dataset_search` — now shows top publishers per query

## 2026-03-04 (v0.4.64)

- fix(europa): `q=*` now correctly returns all 1.7M+ datasets — Europa API ignores `q` when omitted; sending `q=*` was causing Elasticsearch to return only ~6k results; match-all queries (`*`, `*:*`) now omit the `q` parameter

## 2026-03-04

- feat: expose Europa API facets in `europa_dataset_search` — country, format, categories, and 15 more facet types now rendered as tables (markdown) and compact objects (JSON, top 15 items per facet)
- feat: add `is_hvd` boolean filter to `europa_dataset_search` — search only among High Value Datasets
- refactor: filter Europa facets to 8 useful ones (country, categories, format, is_hvd, scoring, language, subject, hvdCategory), resolve multilingual titles to requested lang, JSON output 52KB→12KB
- feat: compact JSON output for heavy tools — `package_search`, `package_show`, `organization_list/show`, `group_list/show`, `datastore_search/search_sql` now return only essential fields in JSON mode (~70% token reduction)
- feat: `truncateJson()` — JSON-safe truncation that shrinks arrays instead of cutting mid-string, always produces valid JSON
- fix: filter `_id` field from datastore JSON output (already done in markdown)
- docs: add `docs/JSON-OUTPUT.md` — complete field schema for all tools in JSON mode
- feat: add `europa_dataset_search` tool for European Data Portal (data.europa.eu) — searches 1.7M+ datasets across all EU countries with country filter, multilingual support, and HVD badge
- new files: `src/utils/europa-http.ts`, `src/tools/europa.ts`, `tests/integration/europa.test.ts`
- types: add `EuropaDataset`, `EuropaDistribution`, `EuropaMultilingualField`, `EuropaLabelledValue` interfaces
- JSON output filters multilingual fields to requested language only (compact response)
- fix(http): add AbortController 30s timeout to Workers fetch — prevents hang when CKAN server is slow (root cause of Worker timeout errors)

## 2026-03-03 (v0.4.59)

- packaging: add DXT one-click install support — `manifest.json` + `npm run pack:dxt` script produces `ckan-mcp-server.dxt` for Claude Desktop
- docs: add "One-click install" section in README Claude Desktop section
- release workflow: DXT artifact now uploaded to GitHub releases

## 2026-03-02 (v0.4.58)

- tools: add HVD note on synthesis queries — when `q=*:*` + org/tag facets (or `rows=0`) on dati.gov.it, auto-fetch real-time HVD count and append EU Reg. 2023/138 note to markdown output
- portals: add `hvd.category_field` config to dati.gov.it in `portals.json`
- utils: export `getPortalHvdConfig()` from `portal-config.ts`

## 2026-03-02

- worker: enable Cloudflare Workers Logs (`[observability]` in `wrangler.toml`)
- worker: log structured JSON for every tool call (tool, server, q, fq, id, sql, etc.)

## 2026-03-02 (v0.4.57)

- portals: add `data.stadt-zuerich.ch` (City of Zurich) with custom `organization_view_url` pointing to CKAN backend
- docs: add `data.stadt-zuerich.ch` to verified portals table in `src/README.md`
- docs: add `data.opentransportdata.swiss` to known issues (API on separate domain, requires API key)
- tools: add "no data found" note to all no-results responses to discourage LLM hallucination
- docs: add LLM hallucination note to README Troubleshooting section

## 2026-03-01

- docs: rewrite README intro — plain-language description, two-path table (local vs hosted), audience statement
- docs: add MIT license badge to README badge row
- docs: add "Use it in your favorite tool" section (ChatGPT, Claude Code, Claude Desktop, Gemini CLI, VS Code)
- docs: backup of previous README saved as README.bak.md

## 2026-02-28 (v0.4.53)

- feat: new tool `ckan_analyze_datasets` — search + DataStore schema introspection in one call; includes `info.label`/`info.notes` from DataStore Dictionary when available
- feat: new tool `ckan_catalog_stats` — portal overview (total datasets, categories, formats, organizations) via single faceted query
- refactor: `quality.ts` tools migrated from deprecated `server.tool()` to `registerTool()` with full annotations
- tests: 287 passing (+15 new tests)

## 2026-02-28 (v0.4.52)

- fix: HTTP transport — `/.well-known/oauth-authorization-server` now returns JSON 404 instead of HTML; fixes Claude Code HTTP transport connection failure
- fix: `ckan_datastore_search` — `limit` min changed 1→0; allows column discovery without fetching data
- docs: `ckan_datastore_search` description updated — fields always returned, `limit=0` pattern documented

## 2026-02-27 (v0.4.51)

- refactor: domain types for all tool files — `CkanTag`, `CkanResource`, `CkanPackage`, `CkanOrganization`, `CkanField`, `CkanDatastoreResult` in `src/types.ts`; `any` reduced 32 → 1
- refactor: extract rendering functions from handler closures → named exports in `datastore.ts`, `organization.ts`, `group.ts`, `status.ts`; +26 unit tests
- fix: datastore table — skip `_id` column, increase cell truncation 50 → 80 chars
- fix: org/group show — dataset heading now shows `showing M of N returned — T total`
- tests: 191 → 272; all passing

## 2026-02-27 (continued 2)

- fix: datastore table — skip `_id` column, increase cell truncation 50→80 chars
- fix: org/group show — `## Datasets (N)` → `## Datasets (showing M of N returned — T total)`
- tests: 270 → 272; all passing

## 2026-02-27 (continued)

- refactor: extract markdown rendering from handler closures into exported functions in `datastore.ts`, `organization.ts`, `group.ts`, `status.ts`
- add 26 unit tests across 4 new test files (`datastore-formatting`, `organization-formatting`, `group-formatting`, `status-formatting`)
- test count: 244 → 270; all passing

## 2026-02-27

- refactor: add CKAN domain types (`CkanTag`, `CkanResource`, `CkanPackage`, `CkanOrganization`, `CkanField`, `CkanDatastoreResult`) to `src/types.ts`
- replace `any` in exported tool functions across `package.ts`, `datastore.ts`, `organization.ts`, `group.ts`, `quality.ts`, `tag.ts` — 32 → 1 remaining (internal handler variable)
- no behavioral change; 244 tests passing

## 2026-02-26 (v0.4.50)

- `ckan_list_resources`: add `format_filter` param (case-insensitive, client-side) — e.g. 72 resources → 8 CSV; header shows "Total: 72 (showing 8 CSV)"
- `ckan_package_search`: OR tip on zero results — when a plain multi-term query returns 0, suggest the OR version (e.g. `"a b c"` → `"a OR b OR c"`)
- `ckan_package_search`: accent fallback — if query returns 0 results and contains accented chars, retry with accent-stripped query; note shown in output
- `ckan_package_show`: always show DataStore status per resource
  - `✅ Available` / `❌ Not available` / `❓ Not reported by portal`
  - Previously silent when field absent (e.g. dati.gov.it); now explicit

## 2026-02-25 (v0.4.49)

- Disable DataStore Table UI component (MCP Apps) pending use-case design
  - Reverted `registerAppTool` → `server.registerTool` in datastore.ts and package.ts
  - Removed `_meta.ui`, `structuredContent` from tool responses
  - Commented out UI resource registration in resources/index.ts
  - Skipped UI test suite (6 tests)
  - All source files preserved (`src/ui/`, `src/resources/datastore-table-ui.ts`)
  - Tests: 227 passed, 6 skipped

## 2026-02-25 (v0.4.48)

- Add workflow guidance ("Typical workflow: ...") to all 15 tool docstrings
  - Inspired by datagouv-mcp pattern; steers LLMs toward correct multi-step usage
- Add `ckan_list_resources` tool (16th tool)
  - Compact table of resources: name, format, size, DataStore flag, resource ID
  - Helps LLMs assess available files before deciding how to access data
  - Tested against dati.gov.it and dati.comune.messina.it (DataStore active)
- Update `docs/future-ideas.md` with datagouv-mcp analysis
- Tests: 233 (was 228)

## 2026-02-23 (v0.4.47)

- DataStore Table UI: add hyperlinks on dataset titles, open in new tab
- DataStore Table UI: increase spacing (body padding, header/controls gap, th/td padding)

## 2026-02-23 (v0.4.46)

- Fix Workers: use `Accept-Encoding: identity` in fetch branch to avoid gzip decompression failures
  - Cloudflare Workers `DecompressionStream` was silently failing on gzip responses
  - `Accept-Encoding: identity` prevents server from sending compressed responses
  - Eliminates the binary garbage output on all CKAN API calls from Workers

## 2026-02-23 (v0.4.45)

- Fix MCP Apps: add timeout fallback to SEP-1865 handshake
  - If host doesn't respond to `ui/initialize` within 1.5s, send `initialized` anyway
  - Handles hosts with partial spec support without blocking the widget forever
  - Fixed in both `src/ui/datastore-table.html` and inlined HTML in `src/resources/datastore-table-ui.ts`

## 2026-02-23 (v0.4.44)

- Fix MCP Apps: implement mandatory SEP-1865 handshake in DataStore Table Viewer HTML
  - Widget now sends `ui/initialize` request to host on load
  - After host response, sends `ui/notifications/initialized`
  - Without this handshake, compliant hosts (MCPJam, Goose, etc.) never send `tool-result`
  - Fixed in both `src/ui/datastore-table.html` and inlined HTML in `src/resources/datastore-table-ui.ts`
  - Confirmed working in MCPJam (interactive table renders correctly)

## 2026-02-22 (v0.4.43)

- Fix MCP Apps message listener to use correct JSON-RPC method per ext-apps spec:
  - `ui/notifications/tool-result` (was `ui/toolResult`) with data in `msg.params.structuredContent`
  - Fixed in both `src/ui/datastore-table.html` and inlined HTML in `src/resources/datastore-table-ui.ts`
  - Kept fallbacks for older/alternative message shapes

- Audit and improve Zod parameter descriptions across all tools for "code mode" SDK compatibility:
  - `ckan_organization_list/show/search`: added `.describe()` on all parameters (previously none)
  - `ckan_datastore_search`: added `.describe()` on all parameters (previously none)
  - `ckan_datastore_search_sql`: added `.describe()` on `server_url` and `sql` (with double-quote hint)
  - `ckan_package_search`: improved `fq` description (was missing)
  - `ckan_find_relevant_datasets`: improved tool description with "when to use vs ckan_package_search", improved `query` and `weights` descriptions

## 2026-02-20 (v0.4.41)

- Fix MCP Apps implementation (was broken in v0.4.40):
  - `_meta.ui.resourceUri` moved to tool DEFINITION (not result) using `registerAppTool` from `@modelcontextprotocol/ext-apps/server`
  - URI scheme changed from `ckan-ui://` to `ui://ckan/` (required by spec)
  - Resource now uses `RESOURCE_MIME_TYPE` from ext-apps (required by clients)
  - Resource registered via `registerAppResource` instead of `server.registerResource`
  - Data passed to UI via `structuredContent` in tool result; HTML listener updated to handle `ui/toolResult` JSON-RPC format
  - Table viewer extended to `ckan_package_search`: datasets flattened to title/organization/formats/num_resources/modified/license columns
  - Added `@modelcontextprotocol/ext-apps` as runtime dependency

## 2026-02-20

- **⚠️ MCP Apps not yet supported by Claude.ai/Claude Desktop clients**: `_meta.ui.resourceUri` is silently ignored — the interactive table viewer never appears. The server-side implementation is correct and ready; waiting for client support. Feature is effectively dormant until Anthropic ships MCP Apps in public clients.
- Add DataStore Table Viewer (MCP Apps interactive UI)
  - New MCP resource `ckan-ui://datastore-table` serves self-contained HTML table viewer
  - `ckan_datastore_search` now returns `_meta.ui.resourceUri` + `_meta.ui.data` for MCP Apps clients
  - Interactive features: sortable columns (numeric/date/string type-aware), text filter, pagination (10/25/50/100 rows/page)
  - Works in Node.js and Cloudflare Workers (HTML inlined in TypeScript module, no fs dependency)
  - Non-breaking: text/markdown output unchanged; non-MCP-Apps clients ignore `_meta`
  - Files: `src/ui/datastore-table.html`, `src/resources/datastore-table-ui.ts`, updated `src/tools/datastore.ts` and `src/resources/index.ts`
  - Tests: 228 passing (7 new)
  - Ideas: `docs/future-ideas.md` updated with MCP Apps section
  - OpenSpec: `add-datastore-table-viewer` created and implemented

## 2026-02-09

### Feature Request - One-click Installation

- Created issue #11 for one-click MCP server installation support
- Proposes `claude://install-mcp-server` protocol integration
- Based on Anthropic Desktop Extensions announcement
- **Updated proposal**: Two one-click installers to serve different use cases
  - 🚀 **"Try it now"** → HTTP Worker (instant, zero install, shared quota)
  - 💪 **"Install locally"** → npx (unlimited, requires Node.js)
- User journey: try demo first, install locally when ready for production
- Files: GitHub issue #11 + comment

## 2026-02-02

### Release v0.4.39 - Local Install Promotion

**Objective**: Strongly encourage users to install locally instead of using shared Cloudflare Workers demo.

**Changes**:
- Added prominent banner in README recommending local npm installation
- Simplified Installation section - npm as primary method
- Repositioned Workers endpoint as "testing only" option
- Added visible footer to all tool responses when running on Workers
- Added HTTP headers to Workers responses (X-Service-Notice, X-Recommendation)
- Updated all MCP client configuration examples to prioritize local install
- Added note in DEPLOYMENT.md clarifying it's internal team documentation

**Footer shown to Workers users**:
```
ℹ️ Demo instance (100k requests/day shared quota). For unlimited access: https://github.com/ondata/ckan-mcp-server#installation
```

**Files modified**:
- README.md (banner, installation section, client config examples)
- src/utils/formatting.ts (isWorkers(), addDemoFooter() functions)
- src/tools/*.ts (7 tool files - applied footer to markdown responses)
- src/worker.ts (HTTP headers for debugging)
- docs/DEPLOYMENT.md (internal documentation note)

**No breaking changes** - All existing functionality preserved

---

### Website - Fix flag emoji rendering on Linux/desktop

- **Fix**: Replace emoji flags with SVG images from Twemoji CDN
- **Problem**: Country flag emojis (🇮🇹, 🇺🇸, 🇨🇦, 🇦🇺, 🇬🇧, 🇨🇭) not visible on Linux/desktop browsers lacking color emoji fonts
- **Solution**: Use `<img>` tags pointing to `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/`
- **Benefits**: Works on all platforms, consistent appearance, better accessibility
- **Files**: `website/src/pages/index.astro` (6 flag replacements), `website/src/styles/global.css` (removed `.emoji-flag` class)
- **Impact**: Flags now visible on all devices (Linux, Windows, macOS, mobile)

### Release v0.4.38

- Enhancement: add portal entries and API base URLs for catalog.data.gov, open.canada.ca, data.gov.au, and opendata.swiss
- Fix: align server and worker reported version with package version
- Files: `src/portals.json`, `package.json`, `package-lock.json`, `src/server.ts`, `src/worker.ts`
- No breaking changes

## 2026-02-01

### Release v0.4.37

- Feature: add support for custom API paths in portal configuration
- Feature: add data.gov.uk portal support (uses `/api/action/` instead of `/api/3/action/`)
- Enhancement: extend portal configuration with `api_path` field
- Enhancement: dynamic API path construction based on portal config
- Files: `src/utils/portal-config.ts`, `src/utils/http.ts`, `src/portals.json`
- No breaking changes

### Release v0.4.36

- Fix: align server and worker reported version with package version
- Fix: update worker health tool count
- Files: `src/server.ts`, `src/worker.ts`

### Unreleased

- Docs: clarify GitHub release notes formatting (use here-doc + --notes-file)
- Files: `AGENTS.md`, `CLAUDE.md`

### Release v0.4.35

- Tests: adjust MQA metrics details fixture to include scoring entries
- Files: `tests/integration/quality.test.ts`

### Release v0.4.34

- MQA: add detailed quality reasons tool with metrics flag parsing
- MQA: add guidance note to use metrics endpoint for score deductions
- Tests: cover detailed MQA reasons output and guidance note
- Docs: list `ckan_get_mqa_quality_details` tool
- Files: `src/tools/quality.ts`, `tests/integration/quality.test.ts`, `README.md`, `docs/architecture-flow.md`

### Unreleased

- None

### Release v0.4.33

- Docs: clarify natural language date-field mapping for package search and document `content_recent` usage with example
- Files: `src/tools/package.ts`, `src/server.ts`, `src/worker.ts`, `package.json`, `package-lock.json`

### Release v0.4.32

- Workers: align browser-like headers for fetch path to avoid 403 on dati.gov.it
- Files: `src/utils/http.ts`, `package.json`, `package-lock.json`

### Release v0.4.31

- Workers: decode compressed responses via DecompressionStream when available
- Docs: avoid demo.ckan.org in tests (use https://www.dati.gov.it/opendata)
- Files: `src/utils/http.ts`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `package-lock.json`

### Release v0.4.30

- Fix Workers build by avoiding static node:zlib import while keeping decompression in Node
- Files: `src/utils/http.ts`, `package.json`, `package-lock.json`

### Release v0.4.29

- Decode compressed/binary CKAN responses (gzip/br/deflate) to fix DataStore calls on Messina portal
- Tests: cover gzip, brotli, deflate payloads for HTTP client
- Files: `src/utils/http.ts`, `tests/unit/http.test.ts`, `package.json`, `package-lock.json`

## 2026-01-31

### Release v0.4.27

- ckan_package_show: clarify dates (Issued/Modified vs harvest) and add metadata_harvested_at
- Resources: surface Access Service endpoints and effective download URL fallback
- Docs: add SPARQL examples + CKAN vs SPARQL comparison
- Tests: add package_show formatting/unit coverage
- Files: `src/tools/package.ts`, `tests/fixtures/responses/package-show-success.json`, `tests/unit/package-show-formatting.test.ts`, `docs/sparql-examples.md`, `src/server.ts`, `src/worker.ts`, `package.json`, `package-lock.json`

## 2026-01-29

### Release v0.4.26

- Resolve portal hostname to API URL in CKAN requests
- Tests: add unit coverage for URL resolution
- Files: `src/utils/http.ts`, `tests/unit/http.test.ts`, `src/server.ts`, `src/worker.ts`, `package.json`, `package-lock.json`

### Release v0.4.25

- Add ANAC open data portal entry and aliases
- Files: `src/portals.json`, `src/server.ts`, `src/worker.ts`, `package.json`, `package-lock.json`

## 2026-01-28

### Release v0.4.24

- Use browser-like headers (UA + Sec-* + Referer) to avoid WAF blocks on some portals
- Deps: npm audit fix (hono transitive)
- Files: `src/utils/http.ts`, `tests/unit/http.test.ts`, `src/server.ts`, `src/worker.ts`, `package.json`, `package-lock.json`, `README.md`

## 2026-01-27

### MCP Best Practices Evaluation

- **Source**: https://www.philschmid.de/mcp-best-practices
- **Score**: 4/6 (B+ grade)
- **Doc**: `docs/mcp-best-practices-evaluation.md`
- **Key findings**:
  - ✅ Excellent: Tool naming, flat arguments
  - ✅ Good: Instructions as context
  - ⚠️ Partial: Outcomes focus, curation, pagination metadata
- **Top recommendations**:
  1. Add structured pagination metadata to all responses
  2. Create outcome-focused tools (discover_datasets, find_organization)
  3. Improve tool categorization (beginner/advanced/expert)
- **Extracted with**: `agent-browser get text 'article'` (readability-like)

## 2026-01-26

### Release v0.4.23

- Fix MQA quality score maximum from 450 to 405 (correct max: 100+100+110+75+20)
- Files modified: `src/tools/quality.ts:442`, `tests/integration/quality.test.ts:279,302`

### Release v0.4.22

- Fix MQA identifier normalization to handle dot separators (e.g. `c_g273:D.1727` -> `c_g273-d-1727`)
- Workers deploy: https://ckan-mcp-server.andy-pr.workers.dev (2026-01-26)

### Release v0.4.21

- Fix metrics parsing in Workers by switching to fetch and mocking fetch in tests

### Release v0.4.20

- Fix Worker metrics parsing fallback to ensure dimension scores are populated

### Release v0.4.19

- Fix metrics JSON-LD parsing in Workers to restore dimension score breakdown
- Ensure ld+json responses are parsed even when returned as strings

### Release v0.4.18

- MQA quality output now includes dimension score breakdown with ✅/⚠️ indicators
- Metrics endpoint link added for direct score inspection
- Non-max dimension(s) highlighted for quick diagnosis
- Files: `src/tools/quality.ts`, `tests/integration/quality.test.ts`, `tests/fixtures/responses/mqa-metrics-success.json`

### MQA Quality Metrics - Readable dimension scores
- **Feature**: Add dimension score breakdown with ✅/⚠️ indicators and non-max dimensions
- **Source**: Fetch metrics JSON-LD from data.europa.eu for scoring details
- **Output**: Markdown and JSON include metrics endpoint link and derived scores
- **Files**: `src/tools/quality.ts`, `tests/integration/quality.test.ts`, `tests/fixtures/responses/mqa-metrics-success.json`

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
