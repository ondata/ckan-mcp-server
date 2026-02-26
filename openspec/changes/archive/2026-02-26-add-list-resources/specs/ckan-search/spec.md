## ADDED Requirements

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
