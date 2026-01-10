## ADDED Requirements
### Requirement: Audit CKAN portal capabilities
The system SHALL provide a `ckan_audit` tool that accepts `server_url` and returns detected capabilities for DataStore, SQL endpoint availability, and datastore id alias support, plus suggested portal override values.

#### Scenario: Capability probe
- **WHEN** the tool probes a CKAN portal
- **THEN** the response includes datastore availability, SQL support, alias support, and recommended overrides
