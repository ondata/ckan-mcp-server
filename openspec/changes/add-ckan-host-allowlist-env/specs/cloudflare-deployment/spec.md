## ADDED Requirements
### Requirement: Workers allowlist configuration
The system SHALL allow configuring an allowlist of CKAN hosts for Workers deployments via environment variable.

#### Scenario: Wrangler allowlist configuration
- **WHEN** `wrangler.toml` sets `ALLOWED_CKAN_HOSTS` to a comma-separated list of hostnames
- **THEN** the Workers runtime reads the variable and restricts CKAN requests to those hosts

#### Scenario: Allowlist not set
- **WHEN** `ALLOWED_CKAN_HOSTS` is unset or empty in the Workers environment
- **THEN** the Workers runtime allows requests to any CKAN host
