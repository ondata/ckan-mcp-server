## ADDED Requirements
### Requirement: Analyze dataset structure
The system SHALL provide a `ckan_analyze_dataset_structure` tool that accepts `server_url`, a `resource_id` or `dataset_id`, and optional `sample_size`, returning column names and types; when a DataStore is available it MUST compute per-column null rates from a sampled query.

#### Scenario: Schema summary with null rates
- **WHEN** the tool is invoked for a DataStore-enabled resource
- **THEN** the system returns columns, types, and null-rate statistics
