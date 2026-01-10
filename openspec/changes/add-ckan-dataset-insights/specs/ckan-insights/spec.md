## ADDED Requirements
### Requirement: Dataset insights wrapper
The system SHALL provide a `ckan_dataset_insights` tool that accepts `server_url`, `query`, `limit`, and optional analysis parameters, and returns per-dataset summaries combining relevance scores, update cadence, and structure metrics.

#### Scenario: Combined insights output
- **WHEN** the tool is invoked with a query and limit
- **THEN** the system returns the top N datasets with combined relevance, update, and structure insights
