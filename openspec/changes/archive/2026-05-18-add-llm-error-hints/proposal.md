# Proposal: add-llm-error-hints

## Summary

Replace generic HTTP error strings in tool catch blocks with structured, actionable hints for the LLM.

When `makeCkanRequest` fails today, tools surface bare error strings like:
> `Error querying DataStore: CKAN API error (404): Not Found`

The LLM receives no guidance on how to recover. After this change, errors will read:
> `CKAN API error 404 on datastore_search: resource not found.
> → Get a valid resource_id first: call ckan_package_show on a dataset, then pick a resource where datastore_active is true.`

## Motivation

Inspired by datagouv-mcp PR #94 ("handle Tabular API 4xx/5xx with LLM hints"), which demonstrated that replacing raw HTTP errors with short, actionable copy measurably improves agent self-correction — the LLM knows what to call next instead of stopping.

## Current Behavior

- `makeCkanRequest` throws plain `Error` objects with strings like `CKAN API error (404): ...`
- Tool catch blocks use `error.message` directly: `Error querying DataStore: ${error.message}`
- One ad-hoc workaround exists in `organization.ts` (string-matching `'CKAN API error (500)'`)

## Proposed Behavior

### 1. `CkanApiError` — structured error class (`src/utils/http.ts`)

A new error class carrying `status` (HTTP code or `undefined`) and `action` (CKAN action name):

```
class CkanApiError extends Error {
  readonly status: number | undefined;
  readonly action: string;
}
```

`makeCkanRequest` throws `CkanApiError` instead of plain `Error` for:
- HTTP 4xx/5xx responses (axios path and fetch path)
- `success=false` responses (status `undefined`)

Network-level errors (timeout, ENOTFOUND) remain plain `Error` — they already produce clear messages.

### 2. `formatCkanError` — hint formatter (`src/utils/http.ts`)

A helper exported from `http.ts`:

```
function formatCkanError(error: unknown, toolName: string): string
```

Maps `(status, action)` → actionable hint sentence, falls back to `error.message` for non-`CkanApiError`.

**Hint table**:

| Status | Action pattern | Hint |
|--------|---------------|------|
| 404 | `datastore_search*` | "resource_id not found — call `ckan_package_show` on a dataset, then pick a resource where `datastore_active` is true" |
| 404 | `package_show` | "dataset not found — use `ckan_package_search` to find a valid dataset name or ID" |
| 404 | `organization_show` | "organization not found — use `ckan_organization_list` or `ckan_organization_search` to discover names" |
| 400 | `datastore_search*` | "bad request — likely an invalid field name or filter syntax; check column names with a `SELECT *` query first" |
| 400 | `datastore_search_sql` | "invalid SQL syntax or unknown column — check column names with `ckan_datastore_search` before writing SQL" |
| 409/422 | any | "portal rejected the request — parameters may conflict; simplify filters and retry" |
| 503/502/504 | any | "portal temporarily unavailable — retry in a few seconds" |
| 500 | any | "portal internal error — try a different portal or retry later" |
| `undefined` | any | "CKAN API returned success=false — the portal may not support this action" |
| fallback | any | original `error.message` unchanged |

### 3. Tool catch blocks updated

Every tool handler's `catch` block replaces:
```ts
text: `Error querying DataStore: ${error instanceof Error ? error.message : String(error)}`
```
with:
```ts
text: formatCkanError(error, "ckan_datastore_search")
```

The ad-hoc string-match in `organization.ts:183` is removed; the 500-fallback logic it guards can remain but now uses `CkanApiError.status === 500`.

## Scope

- `src/utils/http.ts`: add `CkanApiError` class, update throw sites, export `formatCkanError`
- `src/tools/datastore.ts`, `package.ts`, `organization.ts`, `group.ts`, `analyze.ts`, `portal-discovery.ts`, `quality.ts`: update catch blocks
- `tests/unit/http.test.ts`: unit tests for `CkanApiError` and `formatCkanError`
- `tests/integration/*.test.ts`: update fixtures/assertions for new error text where needed

## Out of scope

- Network-level errors (timeout, ENOTFOUND) — messages already clear
- Retry logic — not requested
- Analytics / Matomo tracking — separate concern
