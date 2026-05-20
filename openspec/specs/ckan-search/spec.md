# ckan-search Specification

## Purpose
TBD - created by archiving change update-search-parser-config. Update Purpose after archive.
## Requirements
### Requirement: Package search parser override
The system SHALL support a per-portal default and a per-request override to force package search queries through the `text` field when needed, and SHALL escape Solr/Lucene special characters when wrapping queries in `text:(...)`.

#### Scenario: Portal default applies
- **WHEN** a portal is configured to force the text-field parser
- **THEN** `ckan_package_search` uses `text:(...)` for non-fielded queries by default with escaped query content

#### Scenario: Request override applies
- **WHEN** a client explicitly requests the text-field parser
- **THEN** `ckan_package_search` uses `text:(...)` regardless of portal defaults with escaped query content

### Requirement: List Dataset Resources

The system SHALL provide a `ckan_list_resources` tool that returns a compact summary of all resources belonging to a dataset.

The tool SHALL accept:
- `server_url` (string, required): Base URL of the CKAN server
- `id` (string, required): Dataset ID or name
- `response_format` (enum, optional): `markdown` (default) or `json`

The tool SHALL return for each resource:
- Resource name (or "Unnamed Resource" fallback)
- Resource ID
- Format (e.g., CSV, JSON, XML)
- Size in human-readable format (when available)
- DataStore availability flag (`datastore_active`)
- Download URL (effective URL resolution: download_url > access_url > url)

The markdown output SHALL use a table format for quick scanning.

The tool description SHALL include workflow guidance pointing to `ckan_datastore_search` as the next step for DataStore-enabled resources.

#### Scenario: Dataset with multiple resources
- **WHEN** user calls `ckan_list_resources` with a valid dataset ID
- **THEN** returns a table with one row per resource showing name, format, size, DataStore flag, and URL

#### Scenario: Dataset with DataStore-enabled resources
- **WHEN** a resource has `datastore_active: true`
- **THEN** the DataStore column shows a clear indicator and the resource ID is highlighted for use with `ckan_datastore_search`

#### Scenario: Dataset not found
- **WHEN** user calls `ckan_list_resources` with an invalid dataset ID
- **THEN** returns an error message indicating the dataset was not found

### Requirement: Source Portal DataStore Fallback

The tool SHALL inspect each resource's download URL when `datastore_active` is false or null. If the URL domain differs from `server_url`, the tool SHALL attempt to verify DataStore availability on the source portal using the resource ID extracted from the URL path, and SHALL report the result alongside the original resource metadata.

#### Scenario: Source portal has DataStore active

- **WHEN** `ckan_list_resources` is called on an aggregator portal (e.g. dati.gov.it)
- **AND** a resource has `datastore_active: false`
- **AND** the resource download URL points to a different CKAN domain (e.g. dati.comune.milano.it)
- **THEN** the tool calls the source portal's DataStore API with the extracted resource ID
- **AND** the response includes `source_datastore_active: true` and `source_portal_url: "https://dati.comune.milano.it"`

#### Scenario: Source portal has no DataStore

- **WHEN** the source portal check returns `datastore_active: false` or fails
- **THEN** `source_datastore_active: false` is reported
- **AND** the tool does not raise an error

#### Scenario: Resource URL on same domain

- **WHEN** the resource download URL domain matches `server_url`
- **THEN** no source portal check is performed
- **AND** `source_datastore_active` and `source_portal_url` are absent from the response

#### Scenario: check_source_portal disabled

- **WHEN** `check_source_portal: false` is passed by the caller
- **THEN** no source portal check is performed for any resource
- **AND** the response is identical to the current behavior

#### Scenario: Source portal unreachable

- **WHEN** the HTTP call to the source portal times out or returns a network error
- **THEN** `source_datastore_active: false` is reported with a note
- **AND** the tool completes normally without throwing

