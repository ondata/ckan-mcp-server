## ADDED Requirements

### Requirement: Group Datasets Resource Template
The system SHALL expose a resource template for accessing CKAN datasets by group via the URI pattern `ckan://{server}/group/{name}/datasets`.

#### Scenario: Read datasets by group
- **WHEN** client reads `ckan://dati.gov.it/group/governo/datasets`
- **THEN** server returns JSON with the matching datasets from `package_search`

### Requirement: Organization Datasets Resource Template
The system SHALL expose a resource template for accessing CKAN datasets by organization via the URI pattern `ckan://{server}/organization/{name}/datasets`.

#### Scenario: Read datasets by organization
- **WHEN** client reads `ckan://dati.gov.it/organization/regione-toscana/datasets`
- **THEN** server returns JSON with the matching datasets from `package_search`

### Requirement: Tag Datasets Resource Template
The system SHALL expose a resource template for accessing CKAN datasets by tag via the URI pattern `ckan://{server}/tag/{name}/datasets`.

#### Scenario: Read datasets by tag
- **WHEN** client reads `ckan://dati.gov.it/tag/turismo/datasets`
- **THEN** server returns JSON with the matching datasets from `package_search`

### Requirement: Format Datasets Resource Template
The system SHALL expose a resource template for accessing CKAN datasets by resource format via the URI pattern `ckan://{server}/format/{format}/datasets`.

#### Scenario: Read datasets by format
- **WHEN** client reads `ckan://dati.gov.it/format/csv/datasets`
- **THEN** server returns JSON with the matching datasets from `package_search` filtered by resource format

## MODIFIED Requirements

### Requirement: Resource Discovery
The system SHALL list available resource templates when client requests resource list, including dataset, resource, organization, and dataset filter templates (group, organization, tag, format).

#### Scenario: List resource templates
- **WHEN** client calls `resources/listTemplates`
- **THEN** server returns list of available URI templates with descriptions, including the dataset filter templates
