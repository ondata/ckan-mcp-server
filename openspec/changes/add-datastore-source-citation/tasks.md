## 1. Implementation

- [ ] 1.1 Add a helper that builds a source from `(serverUrl, resourceId, resourceShowResult | null)`, using `getPortalApiPath` and `getDatasetViewUrl`, with `cleanText` on the name and an http(s) and length check on URLs → verify: unit tests for success, missing fields, null metadata, portal with custom `dataset_view_url`, oversized name, non-http URL
- [ ] 1.2 Add SQL resource-id extraction (double-quoted UUIDs, dedup, metadata lookups capped at 5) → verify: unit tests with single table, JOIN, repeated id, non-UUID alias; six ids give six sources and at most five `resource_show` calls
- [ ] 1.3 `package_show` only for custom templates using `{name}`; default template uses `package_id` → verify: unit test for both paths; dataset links on `dati.comune.messina.it` and `open.canada.ca/data` answer HTTP 200
- [ ] 1.4 In both handlers, run `resource_show` lookups in parallel with the data query; catch per-resource errors → verify: integration test with mocked `resource_show` failure still returns records
- [ ] 1.5 Markdown: Sources section before Fields/Records in both formatters; `structuredContent: { sources }` → verify: rendering tests
- [ ] 1.6 JSON: add `sources` to the compact object; `ckan_datastore_search` uses `jsonToolResult` → verify: integration test asserts `structuredContent` equals parsed text
- [ ] 1.7 Degrade `sources` in steps when the response does not fit (reduce to `resource_id` and `api_url`, then keep what fits and add `sources_omitted`), in both channels → verify: unit tests with oversized records and with oversized sources, output always within the limit

## 2. Validation

- [ ] 2.1 `npm run build && npm test` green
- [ ] 2.2 HTTP end-to-end: both tools on `https://dati.comune.messina.it` and `https://open.canada.ca/data`, both formats; check links resolve
- [ ] 2.3 One MCP client check that the Markdown table is still shown when `structuredContent` is present (design risk)

## 3. Documentation

- [ ] 3.1 `docs/JSON-OUTPUT.md`: `sources` field for both DataStore tools
- [ ] 3.2 `LOG.md` entry
