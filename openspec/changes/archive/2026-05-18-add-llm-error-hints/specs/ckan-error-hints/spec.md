# Spec: ckan-error-hints

## ADDED Requirements

### Requirement: CkanApiError — structured error class

`makeCkanRequest` MUST throw `CkanApiError` (extends `Error`) instead of plain `Error` whenever the CKAN HTTP layer returns a non-success response. The class SHALL carry `status: number | undefined` (HTTP status code, or `undefined` for `success=false` responses) and `action: string` (the CKAN action name).

Network-level failures (timeout, ENOTFOUND) SHALL continue to throw plain `Error` with their existing messages.

#### Scenario: HTTP 404 response throws CkanApiError with status 404

```
Given makeCkanRequest is called with action "datastore_search"
When the CKAN server returns HTTP 404
Then a CkanApiError is thrown
And CkanApiError.status === 404
And CkanApiError.action === "datastore_search"
```

#### Scenario: success=false response throws CkanApiError with status undefined

```
Given makeCkanRequest is called with any action
When the CKAN server returns HTTP 200 with success=false
Then a CkanApiError is thrown
And CkanApiError.status === undefined
And CkanApiError.action equals the requested action
```

#### Scenario: timeout throws plain Error (unchanged)

```
Given makeCkanRequest is called
When the request times out (ECONNABORTED)
Then a plain Error is thrown with message containing "timeout"
And it is NOT an instance of CkanApiError
```

---

### Requirement: formatCkanError — actionable hint formatter

A function `formatCkanError(error: unknown, toolName: string): string` MUST be exported from `src/utils/http.ts`. It SHALL inspect the error and return a single string that:
- For `CkanApiError`: includes the status, action, and a short actionable hint sentence matched from the hint table (see proposal)
- For any other error: returns `error.message` (or `String(error)` if not an Error)

#### Scenario: 404 on datastore_search produces DataStore-specific hint

```
Given a CkanApiError with status=404 and action="datastore_search"
When formatCkanError is called with toolName="ckan_datastore_search"
Then the result contains "ckan_package_show"
And the result contains "datastore_active"
```

#### Scenario: 404 on package_show produces package-specific hint

```
Given a CkanApiError with status=404 and action="package_show"
When formatCkanError is called with toolName="ckan_package_show"
Then the result contains "ckan_package_search"
```

#### Scenario: 400 on datastore_search_sql produces SQL hint

```
Given a CkanApiError with status=400 and action="datastore_search_sql"
When formatCkanError is called with toolName="ckan_datastore_search_sql"
Then the result contains "ckan_datastore_search"
```

#### Scenario: 503 produces retry hint

```
Given a CkanApiError with status=503 and any action
When formatCkanError is called
Then the result contains "retry"
```

#### Scenario: non-CkanApiError returns original message

```
Given a plain Error with message "network failure"
When formatCkanError is called
Then the result equals "network failure"
```

---

### Requirement: Tool handlers use formatCkanError

All tool catch blocks in `src/tools/*` MUST use `formatCkanError(error, "<tool_name>")` to produce the error text returned to the MCP client, replacing raw `error.message` interpolation.

#### Scenario: DataStore tool catch block uses formatCkanError

```
Given ckan_datastore_search is registered
When makeCkanRequest throws a CkanApiError with status=404
Then the MCP response text contains the DataStore-specific hint from formatCkanError
And isError is true
```

#### Scenario: Organization tool 500-fallback uses CkanApiError.status

```
Given ckan_organization_list encounters a CkanApiError with status=500
When the fallback logic in organization.ts runs
Then it checks CkanApiError.status === 500 (not string-matching)
```
