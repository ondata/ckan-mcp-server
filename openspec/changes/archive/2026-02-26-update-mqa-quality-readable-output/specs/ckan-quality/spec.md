## MODIFIED Requirements

### Requirement: MQA Quality Score Retrieval
The system SHALL provide a tool to retrieve MQA (Metadata Quality Assurance) quality metrics from data.europa.eu for datasets published on dati.gov.it.

#### Scenario: Successful quality score retrieval
- **GIVEN** a valid dataset ID from dati.gov.it
- **WHEN** user requests quality metrics
- **THEN** system SHALL fetch identifier field from CKAN package_show
- **AND** system SHALL query data.europa.eu MQA API
- **AND** system SHALL query the data.europa.eu metrics endpoint to retrieve dimension scores
- **AND** system SHALL return quality score, dimension scores, and the non-max dimension(s)

#### Scenario: Identifier fallback to name
- **GIVEN** a dataset with empty identifier field
- **WHEN** user requests quality metrics
- **THEN** system SHALL use the name field as fallback identifier for MQA API query

#### Scenario: Dataset not found
- **GIVEN** an invalid or non-existent dataset ID
- **WHEN** user requests quality metrics
- **THEN** system SHALL return clear error message indicating dataset not found

#### Scenario: MQA API unavailable
- **GIVEN** data.europa.eu MQA API or metrics endpoint is unavailable or returns error
- **WHEN** user requests quality metrics
- **THEN** system SHALL return clear error message indicating MQA service unavailability

### Requirement: Output Formats
The system SHALL support both markdown and JSON output formats for quality metrics.

#### Scenario: Markdown format (default)
- **GIVEN** user does not specify response_format or specifies "markdown"
- **WHEN** quality metrics are retrieved
- **THEN** system SHALL return human-readable markdown with:
  - Overall quality score
  - Breakdown by dimension (accessibility, reusability, interoperability, findability, contextuality)
  - The non-max dimension(s) highlighted
  - Direct link to the metrics endpoint used for scoring

#### Scenario: JSON format
- **GIVEN** user specifies response_format as "json"
- **WHEN** quality metrics are retrieved
- **THEN** system SHALL return structured JSON that includes:
  - Raw MQA API response
  - Parsed dimension scores
  - Non-max dimension(s)
  - Metrics endpoint link
