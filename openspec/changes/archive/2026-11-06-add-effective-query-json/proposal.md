# Expose the executed query in JSON search output

## Why

The server rewrites a caller's query before sending it to Solr: a boolean query on a
portal whose default parser ignores booleans is wrapped as `text:(...)`, with its content
escaped. The Markdown format has always reported this as **Effective Query**. The JSON
format does not, so a JSON caller cannot tell whether the query it wrote is the query that
ran.

That gap cost real time on 2026-09-05. Diagnosing why `bonifica siti contaminati Piemonte`
returned 5 datasets instead of 22 meant reproducing calls by hand against the portal,
because the tool's own JSON answer did not say which query it had executed. The release
gate added in the same change (`npm run smoke`) cannot assert the parser behaviour without
it either.

## What Changes

- `ckan_package_search` JSON output gains `effective_query`, present **only when the
  server rewrote the query** and absent when it ran unchanged.
- No change to the Markdown format, which already carries the same information.
- No change to any input, and no change to which datasets are returned.

## Impact

- Affected specs: `ckan-search`
- Affected code: `compactSearchResult()` and its call site in `src/tools/package.ts`
- Backwards compatible: the field is additive and optional. A client reading `count` and
  `results` is unaffected.
- Documented in `docs/JSON-OUTPUT.md`.
