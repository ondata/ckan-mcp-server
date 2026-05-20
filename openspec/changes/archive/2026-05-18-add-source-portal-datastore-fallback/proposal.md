# Change: Source portal DataStore fallback for harvested datasets

## Why

National/regional CKAN aggregators (e.g. dati.gov.it) harvest datasets from
municipal and regional portals but rarely replicate the DataStore. When a user
calls `ckan_list_resources` and sees `datastore_active: false`, the data may
actually be queryable — on the source portal.

The source portal URL, dataset ID, and resource ID are often embedded in the
resource download URL (e.g. `https://dati.comune.milano.it/dataset/ABC/resource/DEF/download/...`).
Today the tool silently reports "no DataStore" without checking the source.

## What Changes

- `ckan_list_resources`: when `datastore_active` is false/null on a resource,
  inspect the resource download URL. If the domain differs from `server_url`,
  attempt a DataStore lookup on the source portal using the extracted resource ID.
- Report the result as a separate column/field: `source_datastore_active` and
  `source_portal_url`, so callers can switch portals transparently.
- New optional parameter `check_source_portal` (boolean, default `true`) to
  enable/disable the fallback check (to avoid extra HTTP calls when not needed).

## Impact

- Affected specs: `ckan-search`
- Affected code: `src/tools/package.ts` (list resources handler)
- No breaking changes: new fields are additive; `check_source_portal` defaults to `true`
