## ADDED Requirements

### Requirement: MQA Quality Score Retrieval
The system SHALL provide a tool to retrieve MQA (Metadata Quality Assurance) quality metrics from data.europa.eu for datasets published on dati.gov.it.

#### Scenario: Successful quality score retrieval
- **GIVEN** a valid dataset ID from dati.gov.it
- **WHEN** user requests quality metrics
- **THEN** system SHALL fetch identifier field from CKAN package_show
- **AND** system SHALL query data.europa.eu MQA API
- **AND** system SHALL return quality score and detailed metrics (accessibility, reusability, interoperability, findability)

#### Scenario: Identifier fallback to name
- **GIVEN** a dataset with empty identifier field
- **WHEN** user requests quality metrics
- **THEN** system SHALL use the name field as fallback identifier for MQA API query

#### Scenario: Dataset not found
- **GIVEN** an invalid or non-existent dataset ID
- **WHEN** user requests quality metrics
- **THEN** system SHALL return clear error message indicating dataset not found

#### Scenario: MQA API unavailable
- **GIVEN** data.europa.eu MQA API is unavailable or returns error
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
  - Overall quality score
  - Breakdown by dimension (accessibility, reusability, interoperability, findability)
  - Key findings and recommendations

#### Scenario: JSON format
- **GIVEN** user specifies response_format as "json"
- **WHEN** quality metrics are retrieved
- **THEN** system SHALL return complete MQA API response as structured JSON

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
