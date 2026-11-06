## ADDED Requirements

### Requirement: DataStore results cite their source

`ckan_datastore_search` and `ckan_datastore_search_sql` SHALL return, for every successful call, a list of sources identifying each queried resource. Each source SHALL contain `resource_id` and `api_url`, and SHALL contain `dataset_url`, `download_url` and `resource_name` when the portal's `resource_show` returns the data needed to build them.

#### Scenario: Search result cites resource and dataset

- **WHEN** `ckan_datastore_search` is called on `https://dati.comune.messina.it` with a valid DataStore `resource_id`
- **THEN** the response includes a source with that `resource_id`, an `api_url` for the resource, and a `dataset_url` pointing to the dataset that owns the resource

#### Scenario: SQL result cites every queried resource

- **WHEN** `ckan_datastore_search_sql` is called with a query whose FROM/JOIN clauses name two distinct double-quoted UUID resource ids
- **THEN** the response includes one source per resource id, deduplicated

#### Scenario: SQL query names more resources than the lookup cap

- **WHEN** `ckan_datastore_search_sql` is called with a query naming six distinct double-quoted UUID resource ids
- **THEN** the tool calls `resource_show` for at most five of them, and the response includes six sources, the sixth with `resource_id` and `api_url` only

#### Scenario: Metadata lookup fails

- **WHEN** the data query succeeds but `resource_show` fails or times out for the resource
- **THEN** the tool still returns the records, and the source contains `resource_id` and `api_url` only

#### Scenario: Data query fails

- **WHEN** the DataStore call itself fails
- **THEN** the error response is unchanged and carries no sources

### Requirement: Sources in both output channels

Sources SHALL be present in `structuredContent.sources` in both response formats. In Markdown format they SHALL also appear in a Sources section placed before the Fields and Records sections. In JSON format `sources` SHALL be a top-level field of the JSON object, and `structuredContent` SHALL equal the parsed text as produced by `jsonToolResult`.

#### Scenario: Markdown response

- **WHEN** a DataStore tool is called with `response_format: "markdown"`
- **THEN** the text contains a Sources section with clickable links above the records table, and `structuredContent` is `{ "sources": [...] }`

#### Scenario: JSON response for datastore_search

- **WHEN** `ckan_datastore_search` is called with `response_format: "json"`
- **THEN** the JSON text has a top-level `sources` array and the response carries `structuredContent` identical to the parsed text

#### Scenario: Truncated output keeps sources

- **WHEN** the result exceeds the character limit in either format
- **THEN** the sources are still present in the returned text and in `structuredContent`

#### Scenario: Sources alone exceed the limit

- **WHEN** the sources themselves do not fit within the character limit
- **THEN** the response stays within the limit, each kept source is reduced to `resource_id` and `api_url`, and `sources_omitted` states how many sources were dropped

#### Scenario: Oversized or unsafe portal metadata

- **WHEN** `resource_show` returns a very long `name`, or a `url` that is not http(s) or exceeds the length limit
- **THEN** `resource_name` is cleaned and capped, and `download_url` is omitted
