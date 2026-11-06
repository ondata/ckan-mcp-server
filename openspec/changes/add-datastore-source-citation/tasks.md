## 1. Implementation

- [ ] 1.1 Add a helper that builds a source from `(serverUrl, resourceId, resourceShowResult | null)`, using `getPortalApiPath` and `getDatasetViewUrl` → verify: unit tests for success, missing fields, null metadata, portal with custom `dataset_view_url`
- [ ] 1.2 Add SQL resource-id extraction (double-quoted UUIDs, dedup, cap 5) → verify: unit tests with single table, JOIN, repeated id, non-UUID alias, more than 5 ids
- [ ] 1.3 `package_show` only for custom templates using `{name}`; default template uses `package_id` → verify: unit test for both paths; dataset links on `dati.comune.messina.it` and `open.canada.ca/data` answer HTTP 200
- [ ] 1.4 In both handlers, run `resource_show` lookups in parallel with the data query; catch per-resource errors → verify: integration test with mocked `resource_show` failure still returns records
- [ ] 1.5 Markdown: Sources section before Fields/Records in both formatters; `structuredContent: { sources }` → verify: rendering tests
- [ ] 1.6 JSON: add `sources` to the compact object; `ckan_datastore_search` uses `jsonToolResult` → verify: integration test asserts `structuredContent` equals parsed text
- [ ] 1.7 Keep `sources` in the degraded truncation object → verify: unit test with an oversized result

## 2. Validation

- [ ] 2.1 `npm run build && npm test` green
- [ ] 2.2 HTTP end-to-end: both tools on `https://dati.comune.messina.it` and `https://open.canada.ca/data`, both formats; check links resolve
- [ ] 2.3 One MCP client check that the Markdown table is still shown when `structuredContent` is present (design risk)

## 3. Documentation

- [ ] 3.1 `docs/JSON-OUTPUT.md`: `sources` field for both DataStore tools
- [ ] 3.2 `LOG.md` entry
