## ADDED Requirements

### Requirement: Executed query visible in JSON output

When the server rewrites a caller's query before sending it to Solr, `ckan_package_search`
SHALL report the executed query in its JSON output, so that a JSON caller can tell which
query actually ran. The field SHALL be omitted when the query ran unchanged.

#### Scenario: Query rewritten
- **WHEN** a JSON caller sends a query the server wraps in `text:(...)`
- **THEN** the response carries `effective_query` with the query as executed

#### Scenario: Query unchanged
- **WHEN** a JSON caller sends a query that reaches Solr as written
- **THEN** the response carries no `effective_query`, and its shape is unchanged
