## ADDED Requirements

### Requirement: Interactive Table UI for DataStore Search

When `ckan_datastore_search` is called by an MCP Apps-capable client, the tool SHALL include `_meta.ui.resourceUri` in its response pointing to the DataStore Table Viewer UI asset.

#### Scenario: MCP Apps client receives interactive table

- **WHEN** `ckan_datastore_search` is called and the client has negotiated `experimental.mcpApps` support
- **THEN** the response includes both the standard text output and `_meta.ui.resourceUri: "ckan-ui://datastore-table"`

#### Scenario: Non-MCP-Apps client receives unchanged text

- **WHEN** `ckan_datastore_search` is called and the client has NOT negotiated MCP Apps support
- **THEN** the response contains only the standard markdown or JSON text output, with no `_meta` field

---

### Requirement: Table Rendering

The DataStore Table Viewer UI SHALL render the tool result as a table with one column per field and one row per record, preserving the original field order from the CKAN DataStore response.

#### Scenario: Data renders as table

- **WHEN** the UI receives a `ckan_datastore_search` result with `records` and `fields`
- **THEN** each field appears as a column header and each record appears as a row

#### Scenario: Empty result set

- **WHEN** the tool returns zero records
- **THEN** the UI displays the column headers and an empty-state message ("No records found")

---

### Requirement: Column Sorting

The UI SHALL allow the user to sort the table by any column with a single click; clicking the same column again SHALL reverse the sort direction.

#### Scenario: Sort ascending

- **WHEN** the user clicks a column header for the first time
- **THEN** rows are sorted ascending by that column's values; a visual indicator (▲) is shown

#### Scenario: Sort descending

- **WHEN** the user clicks an already-sorted column header
- **THEN** rows are sorted descending; the indicator changes to (▼)

#### Scenario: Numeric sort for numeric columns

- **WHEN** the column contains numeric values (detected from first 20 rows)
- **THEN** sort is numeric (10 > 9), not lexicographic (10 < 9)

---

### Requirement: Client-side Text Filter

The UI SHALL provide a text input that filters visible rows by a substring match across all columns.

#### Scenario: Filter narrows rows

- **WHEN** the user types in the filter input
- **THEN** only rows containing the typed substring in any column are displayed; the row count updates accordingly

#### Scenario: Filter cleared

- **WHEN** the user clears the filter input
- **THEN** all rows are shown again

---

### Requirement: Pagination

The UI SHALL paginate results and allow the user to navigate pages.

#### Scenario: Small dataset — client-side pagination

- **WHEN** the total record count is ≤ 500
- **THEN** all records are held in the UI and pagination is handled client-side without additional tool calls

#### Scenario: Large dataset — server-side pagination via tool call

- **WHEN** the total record count is > 500
- **THEN** the UI calls `ckan_datastore_search` via MCP JSON-RPC with the appropriate `offset` and `limit` when the user navigates to a new page

#### Scenario: Page size

- **WHEN** the UI loads
- **THEN** the default page size is 25 rows; the user can change it to 10, 25, 50, or 100

---

### Requirement: UI Asset Served as MCP Resource

The DataStore Table Viewer HTML file SHALL be registered as a static MCP Resource at URI `ckan-ui://datastore-table` and served without authentication.

#### Scenario: Resource resolves

- **WHEN** an MCP client reads resource `ckan-ui://datastore-table`
- **THEN** the server returns the full HTML content of `src/ui/datastore-table.html`

---

### Requirement: Graceful Degradation

The feature SHALL NOT break existing clients or transports. Text output MUST always be present.

#### Scenario: Text output always present

- **WHEN** `ckan_datastore_search` is called with any client
- **THEN** the `content` array always contains the text/markdown result regardless of MCP Apps support

#### Scenario: Works across all transports

- **WHEN** the server runs in stdio, HTTP, or Cloudflare Workers mode
- **THEN** the MCP resource `ckan-ui://datastore-table` is resolvable and the `_meta.ui.resourceUri` is included when the client supports MCP Apps
