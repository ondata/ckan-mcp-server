# ckan-search Specification

## Purpose
How this server turns a caller's query into a CKAN `package_search` request: which Solr
parser it reaches, how the query is escaped, and how results are ranked.
## Requirements
### Requirement: Solr parser selection

Every tool that builds a Solr query for `package_search` SHALL resolve the parser through
`resolveSearchQuery`, and SHALL use the same portal probe when the query may need wrapping.
This is a property of the query-building path, not of one tool: today the path is shared by
`ckan_package_search` and `ckan_find_relevant_datasets`, any tool added later belongs on
that list, and a change touching the parser SHALL be verified against every tool on it.

Background: CKAN sends a colon-free query to Solr's dismax parser with `q.op=AND`,
`mm='2<-1 5<80%'` and `qf='name^4 title^4 tags^2 groups^2 text'`. dismax has no boolean
syntax, so `A OR B` collapses into `A AND B`; a colon takes the query off dismax, which is
what `text:(...)` exploits. The same switch discards the `qf` boosts and ANDs every term on
one field, so the wrapper helps a boolean query and harms every other shape.

#### Scenario: Boolean query on a portal that ignores booleans
- **WHEN** a query carries `AND`, `OR` or `NOT`, or punctuation inside a word, and the
  portal probe finds the default parser does not honour a disjunction
- **THEN** the query is wrapped in `text:(...)` with its content escaped
- **AND** the wrapper is applied identically by `ckan_package_search` and
  `ckan_find_relevant_datasets`

#### Scenario: Plain keyword query
- **WHEN** a query carries no boolean operator, which is the shape an LLM client generates
  from a user's request
- **THEN** the query reaches the portal's own parser unwrapped, keeping the `qf` boosts
  and `mm`, and no probe is issued

#### Scenario: Unary operator
- **WHEN** a query carries a `+`, `-` or `!` in operator position
- **THEN** the character survives the escaping, because dismax honours it natively and
  escaping it inverts the caller's intent

#### Scenario: Request override applies
- **WHEN** a client explicitly requests the text-field parser
- **THEN** the wrapper is applied regardless of what the probe found

#### Scenario: Portal where the wrapper does not work
- **WHEN** the probe finds the wrapped form returns fewer results than the plain one
- **THEN** no wrapping is applied on that portal, and the verdict is cached only if it was
  actually measured

### Requirement: Relevance ranking

`ckan_find_relevant_datasets` ranks locally over candidates fetched from `package_search`.
The tool SHALL fetch candidates first with every query term required (`mm=100%`) whenever
the query is neither fielded nor wrapped, SHALL fill from a default pass when those are
fewer than the requested limit, and SHALL award datasets from the strict pass a `coverage`
bonus visible in the score breakdown. It SHALL score a field by the share of query terms it
carries, SHALL treat a term and a word as matching when they are equal or share a stem
(final vowel stripped from words of five letters or more), SHALL match on Unicode word
boundaries, and SHALL score at least 50 candidates whatever the requested limit.

#### Scenario: Every term present in the catalog
- **WHEN** the portal returns datasets for the query with every term required
- **THEN** those datasets carry the `coverage` bonus and lead the ranking, with the strict
  count reported as `all_terms_results`

#### Scenario: Strict pass comes up short
- **WHEN** fewer datasets than the limit carry every term, or none do
- **THEN** the default pass fills the remaining places, without the bonus

#### Scenario: Fielded or boolean query
- **WHEN** the query carries a colon, or was wrapped for a portal that ignores booleans
- **THEN** no strict pass is made and `all_terms_results` is `null`

#### Scenario: Field scoring
- **WHEN** a field contains some of the query's terms
- **THEN** it scores in proportion to the share it carries, never the full weight for a
  single term

#### Scenario: Singular and plural
- **WHEN** a query term and a word in a field differ only by a final vowel
- **THEN** they match; `immobilità` and `mobilità` do not

#### Scenario: Non-English text
- **WHEN** a query term ends in an accented letter, is a stopword of the catalog's
  language, or is an elided article such as `dell'`
- **THEN** term matching respects Unicode word boundaries, and the stopword does not
  contribute to any field's score

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

### Requirement: Executed query visible in JSON output

When the server rewrites a caller's query before sending it to Solr, `ckan_package_search`
SHALL report the executed query in its JSON output, so that a JSON caller can tell which
query actually ran. The field SHALL be omitted when the query ran unchanged.

#### Scenario: Query rewritten
- **WHEN** a JSON caller sends a query the server wraps in `text:(...)`
- **THEN** the response carries `effective_query` with the query as executed

#### Scenario: Query unchanged
- **WHEN** a JSON caller sends a query that reaches Solr as written
- **THEN** the response carries no `effective_query`, and its shape is unchanged

