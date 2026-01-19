## ADDED Requirements
### Requirement: CKAN host allowlist validation
The system SHALL validate every CKAN request target against an optional allowlist configured via `ALLOWED_CKAN_HOSTS`.

#### Scenario: Allowed host
- **WHEN** a tool or resource is called with a `server_url` whose hostname is in `ALLOWED_CKAN_HOSTS`
- **THEN** the request proceeds as normal

#### Scenario: Disallowed host
- **WHEN** a tool or resource is called with a `server_url` whose hostname is not in `ALLOWED_CKAN_HOSTS`
- **THEN** the request is rejected with a clear error indicating the host is not allowed

#### Scenario: Allowlist not set
- **WHEN** `ALLOWED_CKAN_HOSTS` is unset or empty
- **THEN** the system accepts any valid `server_url`
