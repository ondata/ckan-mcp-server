# Change: Add portal discovery tool

## Why
Users need to know which CKAN portals exist for a given country or topic before querying them. The datashades.info registry tracks ~950 live CKAN portals worldwide with metadata (country, dataset count, version, plugins).

## What Changes
- New tool `ckan_find_portals`: queries datashades.info API, filters by country and/or keyword, returns ranked list of portals
- No new dependencies (plain HTTP via existing `makeCkanRequest`-style axios call)
- No breaking changes

## Impact
- Affected specs: portal-discovery (new)
- Affected code: `src/tools/` (new file `portals.ts`), `src/server.ts` (register tool)
