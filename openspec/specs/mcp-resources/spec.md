# mcp-resources Specification

## Purpose
TBD - created by archiving change add-mcp-resources. Update Purpose after archive.
## Requirements
### Requirement: Dataset Resource Template

The system SHALL expose a resource template for accessing CKAN dataset metadata via the URI pattern `ckan://{server}/dataset/{id}`.

#### Scenario: Read dataset metadata successfully

- **WHEN** client reads `ckan://dati.gov.it/dataset/vaccini-covid`
- **THEN** server returns JSON with complete dataset metadata including title, description, resources, organization, tags

#### Scenario: Dataset not found

- **WHEN** client reads `ckan://demo.ckan.org/dataset/nonexistent-id`
- **THEN** server returns error indicating dataset not found

#### Scenario: Server unreachable

- **WHEN** client reads `ckan://invalid-server.example/dataset/test`
- **THEN** server returns error indicating server unreachable

### Requirement: Resource Resource Template

The system SHALL expose a resource template for accessing CKAN resource metadata via the URI pattern `ckan://{server}/resource/{id}`.

#### Scenario: Read resource metadata successfully

- **WHEN** client reads `ckan://dati.gov.it/resource/abc-123-def`
- **THEN** server returns JSON with resource metadata including name, format, URL, size, and download link

#### Scenario: Resource not found

- **WHEN** client reads `ckan://demo.ckan.org/resource/invalid-id`
- **THEN** server returns error indicating resource not found

### Requirement: Organization Resource Template

The system SHALL expose a resource template for accessing CKAN organization metadata via the URI pattern `ckan://{server}/organization/{name}`.

#### Scenario: Read organization metadata successfully

- **WHEN** client reads `ckan://dati.gov.it/organization/regione-toscana`
- **THEN** server returns JSON with organization metadata including title, description, and dataset count

#### Scenario: Organization not found

- **WHEN** client reads `ckan://demo.ckan.org/organization/nonexistent-org`
- **THEN** server returns error indicating organization not found

### Requirement: URI Scheme Parsing

The system SHALL parse `ckan://` URIs extracting server hostname and path components.

#### Scenario: Parse standard URI

- **WHEN** URI is `ckan://dati.gov.it/dataset/test-id`
- **THEN** server extracts: server=`https://dati.gov.it`, type=`dataset`, id=`test-id`

#### Scenario: Parse URI with www prefix

- **WHEN** URI is `ckan://www.dati.gov.it/dataset/test-id`
- **THEN** server extracts: server=`https://www.dati.gov.it`, type=`dataset`, id=`test-id`

#### Scenario: Reject malformed URI

- **WHEN** URI is `ckan://invalid` (missing path)
- **THEN** server returns validation error

### Requirement: Resource Response Format

The system SHALL return resource content as JSON with standard MCP resource response structure.

#### Scenario: JSON response structure

- **WHEN** client reads any valid resource URI
- **THEN** response contains `contents` array with `uri`, `mimeType` (application/json), and `text` (JSON string)

#### Scenario: Large response truncation

- **WHEN** resource content exceeds CHARACTER_LIMIT
- **THEN** response is truncated to CHARACTER_LIMIT with truncation indicator

### Requirement: Resource Discovery
The system SHALL list available resource templates when client requests resource list, including dataset, resource, organization, and dataset filter templates (group, organization, tag, format).

#### Scenario: List resource templates
- **WHEN** client calls `resources/listTemplates`
- **THEN** server returns list of available URI templates with descriptions, including the dataset filter templates

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

