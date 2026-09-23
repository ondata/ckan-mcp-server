# ckan-quality Specification

## Purpose
TBD - created by archiving change add-mqa-quality-tool. Update Purpose after archive.
## Requirements
### Requirement: MQA Quality Score Retrieval
The system SHALL provide a tool to retrieve MQA (Metadata Quality Assurance) quality metrics from data.europa.eu for datasets published on dati.gov.it, following the current (v2) MQA methodology.

#### Scenario: Successful quality score retrieval
- **GIVEN** a valid dataset ID from dati.gov.it whose metrics were computed with MQA methodology v2
- **WHEN** user requests quality metrics
- **THEN** system SHALL fetch identifier field from CKAN package_show
- **AND** system SHALL query the data.europa.eu MQA cache endpoint
- **AND** system SHALL return the final dataset score (`datasetFinal`) on a 0-7.5 scale with its band (Sufficient below 2.5, Good below 5, Excellent from 5)
- **AND** system SHALL return the dataset score, the distribution average and count, and the data service average and count when present

#### Scenario: Dataset not yet re-evaluated
- **GIVEN** the MQA cache answers 404 with message `No v2 metrics found`
- **WHEN** user requests quality metrics
- **THEN** system SHALL read the data.europa.eu metrics endpoint instead
- **AND** system SHALL label the result as computed with the previous methodology (405 scale)

#### Scenario: Identifier fallback to name
- **GIVEN** a dataset with empty identifier field
- **WHEN** user requests quality metrics
- **THEN** system SHALL use the name field as fallback identifier for MQA API query

#### Scenario: Dataset not found
- **GIVEN** an invalid or non-existent dataset ID, or an identifier for which every candidate answers 404 `DQV of dataset not found`
- **WHEN** user requests quality metrics
- **THEN** system SHALL return clear error message indicating the dataset has no MQA record on data.europa.eu

#### Scenario: MQA API unavailable
- **GIVEN** data.europa.eu MQA API or metrics endpoint is unavailable or returns error
- **WHEN** user requests quality metrics
- **THEN** system SHALL return clear error message indicating MQA service unavailability

### Requirement: Server Validation
The system SHALL restrict MQA quality queries to dati.gov.it server only.

#### Scenario: Valid dati.gov.it server
- **GIVEN** server_url is "https://www.dati.gov.it/opendata" or "https://dati.gov.it/opendata"
- **WHEN** user requests quality metrics
- **THEN** system SHALL proceed with MQA query

#### Scenario: Invalid server URL
- **GIVEN** server_url is not dati.gov.it (e.g., "https://catalog.data.gov")
- **WHEN** user requests quality metrics
- **THEN** system SHALL reject request with error message explaining MQA is only available for dati.gov.it

### Requirement: Output Formats
The system SHALL support both markdown and JSON output formats for quality metrics.

#### Scenario: Markdown format (default)
- **GIVEN** user does not specify response_format or specifies "markdown"
- **WHEN** quality metrics are retrieved
- **THEN** system SHALL return human-readable markdown with:
  - Final score out of 7.5 and band
  - Dataset, distribution and data service scores
  - The metrics with the largest potential gain on the final score
  - Direct link to the data.europa.eu quality page and to the MQA source

#### Scenario: JSON format
- **GIVEN** user specifies response_format as "json"
- **WHEN** quality metrics are retrieved
- **THEN** system SHALL return a compact JSON object whose common fields are `methodology` (`v2` or `v1`), `metricsVersion`, `score`, `maxScore` and the data.europa.eu links
- **AND** a v2 result SHALL also include `band`, `dataset`, `distributions`, `dataServices` and `failing`
- **AND** a v1 (previous methodology) result SHALL instead include `note`, `breakdown` (dimension scores) and `details` (non-max reasons), since that methodology has no bands or per-metric weights
- **AND** the raw MQA payload SHALL NOT be included

### Requirement: Tool Parameters
The system SHALL accept the following parameters for the MQA quality tool:
- server_url (required): Base URL of dati.gov.it portal
- dataset_id (required): Dataset ID or name
- response_format (optional): "markdown" (default) or "json"

#### Scenario: Minimal parameters
- **GIVEN** user provides only server_url and dataset_id
- **WHEN** tool is invoked
- **THEN** system SHALL use default markdown format

#### Scenario: All parameters specified
- **GIVEN** user provides server_url, dataset_id, and response_format
- **WHEN** tool is invoked
- **THEN** system SHALL use specified format for output

