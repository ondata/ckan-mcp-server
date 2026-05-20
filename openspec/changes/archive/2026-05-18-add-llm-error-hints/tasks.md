# Tasks: add-llm-error-hints

## Implementation

- [x] **1. Add `CkanApiError` class to `src/utils/http.ts`**
  - Extends `Error`
  - Constructor: `(message: string, status: number | undefined, action: string)`
  - Fields: `readonly status`, `readonly action`

- [x] **2. Update throw sites in `makeCkanRequest` to use `CkanApiError`**
  - Axios path: replace `throw new Error(\`CKAN API error (${status}): ...\`)` with `throw new CkanApiError(..., status, action)`
  - Fetch path: replace `throw new Error(\`CKAN API error (${response.status}): ...\`)` with `throw new CkanApiError(..., response.status, action)`
  - `success=false` path: throw `CkanApiError` with `status=undefined`
  - Keep plain `Error` for ECONNABORTED, ENOTFOUND, network errors

- [x] **3. Implement and export `formatCkanError` in `src/utils/http.ts`**
  - Signature: `export function formatCkanError(error: unknown, toolName: string): string`
  - Implement hint table from proposal (see status/action → hint mapping)
  - Fallback: `error instanceof Error ? error.message : String(error)`

- [x] **4. Update `src/tools/datastore.ts` catch blocks**
  - Replace raw `error.message` interpolation with `formatCkanError(error, "ckan_datastore_search")`
  - Same for `ckan_datastore_search_sql`

- [x] **5. Update `src/tools/package.ts` catch blocks**
  - `ckan_package_search`, `ckan_package_show`, `ckan_list_resources`, `ckan_find_relevant_datasets`, `ckan_rank_datasets`

- [x] **6. Update `src/tools/organization.ts` catch blocks**
  - `ckan_organization_list`, `ckan_organization_show`, `ckan_organization_search`
  - Replace string-match `message.includes('CKAN API error (500)')` with `error instanceof CkanApiError && error.status === 500`

- [x] **7. Update `src/tools/group.ts` catch blocks**
  - `ckan_group_list`, `ckan_group_show`, `ckan_group_search`

- [x] **8. Update `src/tools/analyze.ts` and `src/tools/portal-discovery.ts` catch blocks**

- [x] **9. Update `src/tools/quality.ts` catch blocks**

## Tests

- [x] **10. Unit tests for `CkanApiError` in `tests/unit/http.test.ts`**
  - Verify `instanceof CkanApiError`
  - Verify `status` and `action` fields
  - Verify timeout/ENOTFOUND still throws plain `Error`

- [x] **11. Unit tests for `formatCkanError` in `tests/unit/http.test.ts`**
  - 404 + datastore_search → hint mentions `ckan_package_show` and `datastore_active`
  - 404 + package_show → hint mentions `ckan_package_search`
  - 400 + datastore_search_sql → hint mentions `ckan_datastore_search`
  - 503 + any → hint mentions "retry"
  - plain Error → returns original message

- [x] **12. Update integration fixtures that assert on error text**
  - Scan `tests/integration/` for hardcoded `"Error querying DataStore:"` / `"Error searching packages:"` strings and update expected values

## Validation

- [x] **13. Build**: `npm run build`
- [x] **14. Tests**: `npm test` — all pass
- [x] **15. HTTP end-to-end**: start server on port 3001, call `ckan_datastore_search` with an invalid `resource_id` on `dati.comune.messina.it`, verify response text contains actionable hint
- [x] **16. Update `LOG.md`**
