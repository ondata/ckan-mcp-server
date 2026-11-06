## ADDED Requirements
### Requirement: Analyze dataset updates
The system SHALL provide a `ckan_analyze_dataset_updates` tool that accepts `server_url`, `dataset_id`, and optional `stale_days`, and returns update cadence based on `metadata_modified` and resource `last_modified`, including a `stale` flag when the most recent update exceeds the threshold.

#### Scenario: Update cadence and stale flag
- **WHEN** the tool is invoked with a dataset id and stale threshold
- **THEN** the system returns last update timestamps, cadence summary, and a stale flag
