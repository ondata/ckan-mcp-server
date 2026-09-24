# Change: Expose dct:temporal coverage in ckan_package_show

## Why
`ckan_package_show` did not surface `dct:temporal` (`dcat:startDate` / `dcat:endDate`): nothing in JSON, and in markdown only when the portal happened to put it in extras. On dati.gov.it 17,860 datasets carry `temporal_start`, in two serializations: root `temporal_coverage` (JSON string, ckanext-dcat) and extras `temporal_start` / `temporal_end` / `temporal_coverage` (dcatapit harvests). A caller asking "what period do these data cover" got no answer. PR #554.

## What Changes
- `ckan_package_show` reads every `dct:temporal` period from either serialization and renders it in markdown (**Temporal Coverage (dct:temporal)**: `start → end`, `open` when no end) and JSON (`temporal_coverage: [{start, end, start_equals_issued}]`, empty when absent).
- Each period carries a factual flag `start_equals_issued` (start = `issued`, no end). A full scan of dati.gov.it found a third of the datasets with `temporal_start` in that shape; on the origin dcatapit portals the field is empty in the CKAN API while the DCAT-AP_IT RDF export emits `startDate` = `dct:issued`, so it is an export default rather than a data period. The tool reports the fact and leaves the judgement to the caller.

## Impact
- Affected specs: `ckan-package-metadata` (new)
- Affected code: `src/tools/package.ts`, `tests/unit/package-show-formatting.test.ts`, `docs/JSON-OUTPUT.md`, LOG
