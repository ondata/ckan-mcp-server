# Review rules for ckan-mcp-server

This is an MCP server: every tool response is consumed by a language model, not by a human reading a screen. Most rules below follow from that.

## Never drop data from a response without saying so

Any cap applied while rendering a tool response — column limits, row limits, character limits, list truncation — must be visible in that same response, with the count that was dropped and how to retrieve it.

A model cannot see what is not there. A table cut from 14 columns to 8 with no notice reads as a complete table, and the model will answer as if the missing columns did not exist. This is a correctness bug, not a cosmetic one.

Flag any new `.slice(0, N)`, `.substring(0, N)` or equivalent on data headed for tool output that has no corresponding notice.

Good: `... and 12 more records`, `Total Records: 5000`, `shows only the first 8 of 14 columns. Columns not shown: ...`.

## `_id` and `_full_text` are reserved CKAN identifiers

The DataStore reserves both. `_id` is a real, queryable column (`sort: "_id asc"`, `filters: {"_id": 5}`) and stays visible in field listings. `_full_text` is a tsvector index that repeats the whole row as one string; it carries no information and is filtered out of both DataStore renderers and the compact JSON result in `src/tools/datastore.ts`.

Only `datastore_search_sql` on `SELECT *` returns `_full_text` — the `datastore_search` action does not, which is why `src/tools/analyze.ts` filters `_id` alone.

Filtering these **by name** is intentional. Do not report it as data loss on the grounds that a query could alias a column to one of those names (`SELECT x AS _full_text`): that is a user deliberately colliding with a reserved identifier, and making the filter conditional on the column type would make it fail silently on portals that report types differently — trading a reproducible bug for a hypothetical one.

## Output format is a contract, including on the error path

Every tool takes `response_format: 'markdown' | 'json'`. Errors must respect it too: a JSON caller gets `{error, _error: true}` via `formatError`, never prose.

The character limit applies to *every* channel. `structuredContent` must carry the same capped payload as the text content (`jsonToolResult`) — a payload that fits one and overflows the other means the limit is bypassable.

JSON truncation must stay valid JSON: shrink known arrays, then degrade to `{_truncated, _error}`. Never cut a serialized string mid-value.

## Portal-controlled strings are untrusted input

Dataset titles, field names, cell values and organization descriptions come from third-party portals and end up in markdown read by a model. A newline in a field name can forge a line that looks like server-authored guidance (`> **Note**: ...`); an unescaped `|` breaks a markdown table.

New code interpolating portal-controlled strings into markdown structure should neutralise newlines and escape pipes. Note the pre-existing exposure in table headers, field lists and cell values is known and tracked separately — flag it in new code, not as a blanket finding on untouched renderers.

## Security invariants

- Every outbound request goes through `makeCkanRequest`, which enforces the SSRF guards (`validateServerUrl`, `isBlockedIp`, connection pinning). New code must not build its own axios/fetch call to a user-supplied URL.
- The HTTP transport refuses to start without `CKAN_ALLOWED_DOMAINS`, unless `CKAN_HTTP_ALLOW_ALL=true`. Do not suggest relaxing this.
- All tools are read-only. Any CKAN action that writes is out of scope.

## Releases touch three version files

`package.json`, `manifest.json` and `server.json` must agree — and `server.json` carries the version **twice** (top-level `version` and `packages[0].version`). A version bump missing any of them ships a registry entry pointing at the wrong build. Flag partial bumps.

## Project conventions

- English everywhere: code, comments, `LOG.md`, commit messages, PR descriptions. No exceptions.
- Build is `npm run build` (esbuild). `build:tsc` exists as a fallback and runs out of memory under WSL — do not suggest it.
- README files must use absolute GitHub URLs; npm cannot resolve relative paths from the tarball.
