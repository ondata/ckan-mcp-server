## ADDED Requirements

### Requirement: Migrated portal notice

`CkanApiError` SHALL carry the portal URL the failed request went to, and `formatCkanError`
SHALL return that portal's migration notice, whatever the HTTP status, when `portals.json`
marks the portal as migrated. A migrated portal answers every CKAN action alike, so the
notice MUST take precedence over the status-based hints.

#### Scenario: Call to a migrated portal
- **WHEN** a request to a portal marked `migrated` fails with any status
- **THEN** the formatted error carries the portal's notice and its `docs_url`
- **AND** no status-based hint is appended

#### Scenario: Call to any other portal
- **WHEN** a request to a portal not marked `migrated` fails
- **THEN** the formatted error is unchanged from before this requirement

#### Scenario: Status tool
- **WHEN** `ckan_status_show` is called on a migrated portal
- **THEN** its error carries the same notice
