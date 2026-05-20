## ADDED Requirements

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
