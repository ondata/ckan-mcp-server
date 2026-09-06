# Tell the caller when a portal has left CKAN

## Why

`catalog.data.gov` stopped being a CKAN portal in 2025. Every CKAN request to it now
returns a bare 404, and this server reported that as `CKAN API error (404): Unknown error`
— false in the way that matters, since the server is up and the data exists, just behind
a different API. 47 calls reached it through the public deployment between April and
September 2026, each answered with nothing useful, while our own README, examples and tool
descriptions kept presenting it as a working CKAN portal.

The status-based hints in `formatCkanError` cannot help here: a migrated portal answers
every action alike, so no hint keyed on status or action can be right for it.

## What Changes

- `portals.json` entries gain an optional `migrated` block (`notice`, `docs_url`). The
  entry for `catalog.data.gov` is kept and marked, rather than deleted, so the hint keeps
  firing for the callers who still try it.
- `CkanApiError` carries the portal URL the request went to, so the formatter knows the
  error's origin. Additive: `status` and `action` are unchanged.
- `formatCkanError` returns the migration notice for a migrated portal, whatever the
  status, ahead of the status-based hints.
- `ckan_status_show` routes its error through `formatCkanError`, so the notice appears
  there too instead of "offline or not a valid CKAN instance".
- Every document that listed `catalog.data.gov` as a CKAN example says the opposite.

## Impact

- Affected specs: `ckan-error-hints`
- Affected code: `src/utils/portal-config.ts`, `src/utils/http.ts`, `src/tools/status.ts`,
  `src/portals.json`, `src/tools/organization.ts` (description only)
- Backwards compatible: no input changes; error text for migrated portals becomes
  informative, error text for every other portal is unchanged.
- A v4 adapter for data.gov is out of scope and would be its own proposal (#540).
