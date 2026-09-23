## MODIFIED Requirements
### Requirement: MQA quality details tool
The system SHALL provide an MCP tool that returns a detailed MQA quality breakdown for a dataset using data.europa.eu MQA APIs without requiring external tooling, following the current (v2) MQA methodology.

#### Scenario: Markdown list of failing metrics
- **WHEN** the user requests details for a dataset scored with methodology v2 with format `markdown`
- **THEN** the tool lists every failing metric grouped by FAIR dimension (findability, accessibility, interoperability, reusability), with the DCAT-AP property, importance, weight, the entity it applies to, how many entities fail it (e.g. 21 of 24 distributions) and its potential gain on the final score

#### Scenario: JSON structured output
- **WHEN** the user requests details for any dataset id with format `json`
- **THEN** the tool returns a compact structured payload with `methodology`, `metricsVersion`, scores and failing metrics, never the raw MQA payload

#### Scenario: Previous methodology fallback
- **WHEN** the dataset has no v2 metrics yet
- **THEN** the tool returns the previous-methodology dimension scores and non-max reasons (e.g., `knownLicence=false` under reusability), labelled as previous methodology
