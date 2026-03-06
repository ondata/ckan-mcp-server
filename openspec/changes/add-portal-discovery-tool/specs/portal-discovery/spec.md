## ADDED Requirements

### Requirement: Portal Discovery Tool
The system SHALL provide a `ckan_find_portals` tool that fetches the live registry from datashades.info and returns a filtered, ranked list of active CKAN portals.

Parameters (all optional):
- `country` (string): country name **in English**; LLM MUST translate from any language before passing
- `query` (string): case-insensitive keyword matched against portal title
- `min_datasets` (number): minimum dataset count
- `language` (string): IETF locale code of portal default language (e.g. "it", "en", "pt_BR")
- `has_datastore` (boolean): if true, return only portals with the `datastore` plugin active
- `limit` (number): max results (default 10, max 50)

Only portals with `status: "active"` are returned.
Results are sorted by `DatasetsNumber` descending.

#### Scenario: Search by country
- **WHEN** user calls `ckan_find_portals` with `country: "Italy"`
- **THEN** returns active portals whose `country_name` contains "Italy" (case-insensitive), sorted by dataset count desc

#### Scenario: Search by keyword
- **WHEN** user calls `ckan_find_portals` with `query: "transport"`
- **THEN** returns portals whose title contains "transport" (case-insensitive)

#### Scenario: Filter by min_datasets
- **WHEN** user calls `ckan_find_portals` with `min_datasets: 200`
- **THEN** returns only portals with at least 200 datasets

#### Scenario: Filter by language
- **WHEN** user calls `ckan_find_portals` with `language: "it"`
- **THEN** returns only portals with locale_default matching "it"

#### Scenario: Filter has_datastore
- **WHEN** user calls `ckan_find_portals` with `has_datastore: true`
- **THEN** returns only portals that have "datastore" in their Plugins list

#### Scenario: No filters
- **WHEN** user calls `ckan_find_portals` with no params
- **THEN** returns top 10 active portals by dataset count

#### Scenario: datashades.info unreachable
- **WHEN** the datashades.info API is unavailable
- **THEN** tool returns a clear error message instead of crashing

#### Scenario: LLM country translation
- **WHEN** a user asks in Italian "portali italiani"
- **THEN** the LLM translates to `country: "Italy"` before calling the tool
