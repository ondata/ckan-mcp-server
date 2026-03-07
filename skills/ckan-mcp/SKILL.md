---
name: ckan-mcp
description: >
  MCP server for interacting with CKAN-based open data portals. Search datasets,
  organizations, resources, and other objects on any CKAN server (dati.gov.it,
  data.gov, demo.ckan.org, etc.) using natural language.
  Trigger when: user asks about open data, datasets, portals, data catalogs,
  or mentions specific data portals by country or name.
---

# CKAN MCP Skill

Natural-language exploration of CKAN open data portals via MCP tools.

## Decision Tree

```
User asks about data
  |
  +-- Knows the portal URL? ---------> Flow B (Named Portal)
  |
  +-- Mentions a country? -----------> Flow A (Country Search)
  |
  +-- EU / multi-country / France? --> Flow C (European Portal)
  |
  +-- Asks about dataset content? ---> Flow D (Dataset Detail + DataStore)
  |
  +-- Asks about publishers/groups? -> Flow E (Orgs / Groups)
  |
  +-- Asks about data quality? ------> Flow F (Quality)
```

## Flows

### Flow A — Country Search

Use when: user mentions a country but no specific portal URL.

1. `ckan_find_portals(country=COUNTRY)` to discover known CKAN portals
2. Identify the most authoritative portal (usually national/federal, largest dataset count)
3. `ckan_status_show` to verify it is reachable
   - If it **fails**: tell the user explicitly — e.g. _"The national portal (X) is unreachable or not a valid CKAN instance. Trying alternative portals..."_ — then try the next portals from the list
   - If `ckan_find_portals` returns no national portal: tell the user — e.g. _"No national CKAN portal was found for this country. Searching available regional/local portals..."_
4. `ckan_package_search(q="TERM_NATIVE OR TERM_EN")` on the first reachable portal
5. Always summarize which portal was actually used and why (national vs fallback)

```
Example: "Quali dati sull'inquinamento in Canada?"
-> ckan_find_portals(country="Canada")
-> ckan_status_show(server_url="https://open.canada.ca/data")
-> ckan_package_search(server_url=..., q="pollution OR inquinamento OR air quality")

Example: national portal unreachable
-> ckan_find_portals(country="Argentina")
-> ckan_status_show(national_portal) -> FAIL
-> [tell user] "Il portale nazionale (X) non è raggiungibile. Provo i portali regionali disponibili..."
-> ckan_status_show(next_portal) -> OK
-> ckan_package_search(server_url=next_portal, ...)
-> [tell user] "Ho trovato risultati sul portale della Provincia di Buenos Aires (non il portale nazionale)."
```

### Flow B — Named Portal

Use when: user provides a specific portal URL or a well-known portal name.

1. `ckan_status_show` to verify the portal
2. `ckan_package_search(q="TERM_NATIVE OR TERM_EN")`
3. If >100 results, guide refinement with `fq` filters or a narrower query

```
Example: "Cerca dati sui trasporti su data.gov.uk"
-> ckan_status_show(server_url="https://data.gov.uk")
-> ckan_package_search(server_url="https://data.gov.uk", q="transport OR transportation OR trasporti")
```

### Flow C — European Portal

Use when: user mentions EU-wide data, multi-country comparison, OR France
(data.gouv.fr is NOT CKAN — always redirect to data.europa.eu).

**IMPORTANT — tool choice**:
- `ckan_package_search` does **NOT** work on data.europa.eu (returns 404) — never use it here
- For text search: use `Bash` with the REST API `https://data.europa.eu/api/hub/search/search`
- For precise/structured queries: use `sparql_query(endpoint="https://data.europa.eu/sparql")`

See [references/europa-api.md](references/europa-api.md) for full API patterns.

**REST API known limitations**:
- `country=XX` filter is not strict — results may include nearby countries (e.g. BE, CH when filtering FR)
- Many datasets lack English titles → use `lang=XX` matching the target country
- Filter results post-fetch by `country.id` to remove off-target countries

**SPARQL limitations on data.europa.eu**:
- The endpoint is reachable and returns results for generic queries
- Country filtering via `dct:spatial` + `skos:exactMatch` does **NOT** work — spatial values are blank nodes, not URIs
- Do not use `sparql_query` for country-filtered searches on this portal
- `sparql_query` is only useful for schema exploration or generic graph queries

**Default tool: always REST API via Bash**:
- REST is the only reliable method for country-filtered searches on data.europa.eu

```
Example: "Trova dati ambientali per Italia e Spagna"
-> Bash: curl "https://data.europa.eu/api/hub/search/search?q=ambiente+environment&country=IT,ES&limit=10"

Example: "Dati aperti francesi sull'energia"
-> NOTE: data.gouv.fr is NOT CKAN
-> Bash: curl "https://data.europa.eu/api/hub/search/search?q=energie+energy&country=FR&lang=fr&limit=10"
-> Filter post-fetch: keep only items where country.id == "fr"
```

### Flow D — Dataset Detail + DataStore

Use when: user asks about the content of a specific dataset or wants to query tabular data.

1. `ckan_package_show(id=DATASET_ID)` — full metadata
2. `ckan_list_resources(dataset_id=DATASET_ID)` — list files/resources
3. Check `datastore_active: true` on resources
4. If DataStore is available:
   - `ckan_datastore_search(resource_id=..., limit=0)` — discover columns
   - `ckan_datastore_search(resource_id=..., q=..., limit=100)` — query data
5. If no DataStore: extract resource URL and offer download / DuckDB analysis

```
Example: "Mostrami i dati del dataset clima-2024"
-> ckan_package_show(server_url=..., id="clima-2024")
-> ckan_list_resources(server_url=..., dataset_id="clima-2024")
-> [if datastore_active] ckan_datastore_search(resource_id=..., limit=0)
-> ckan_datastore_search(resource_id=..., q="...", limit=100)
```

### Flow E — Organizations and Groups

Use when: user asks about publishers, organizations, thematic categories, or groups.

```
# Discover publishers
ckan_organization_list(server_url=...)

# Find a specific publisher
ckan_organization_search(server_url=..., query="ministero")

# Show publisher + their datasets
ckan_organization_show(server_url=..., id="org-name")

# Thematic categories
ckan_group_list(server_url=...)
ckan_group_search(server_url=..., query="ambiente")
ckan_group_show(server_url=..., id="group-name")
```

### Flow F — Data Quality

Use when: user asks about data quality, MQA score, or metadata completeness.

1. `ckan_get_mqa_quality(dataset_id=..., server_url=...)` — overall score
2. `ckan_get_mqa_quality_details(dataset_id=..., server_url=...)` — dimension breakdown

```
Example: "Com'e la qualita dei metadati di questo dataset?"
-> ckan_get_mqa_quality(server_url=..., dataset_id="...")
-> ckan_get_mqa_quality_details(server_url=..., dataset_id="...")
```

## Key Rules

### Query Construction

- Always use bilingual queries: `q="TERM_NATIVE OR TERM_EN"`
- Example: `q="ambiente OR environment OR pollution OR inquinamento"`
- Use Solr `fq` for hard filters: `fq="organization:regione-toscana"`
- Wildcard for broad match: `q="trasport*"` (matches trasporto, trasporti, transport...)

**Long OR queries — parser issue**: some portals use a restrictive default parser that silently breaks multi-term `OR` queries (returns 0 results). If a complex `OR` query returns 0, retry with `query_parser: "text"`:
```
ckan_package_search(server_url=..., q="hotel OR alberghi OR ospitalita", query_parser="text")
```

**`fq` OR syntax — critical**: OR on the same field must use `field:(val1 OR val2)`, NOT `field:val1 OR field:val2` (the latter silently returns the entire catalog).
```
# Correct
fq: "res_format:(CSV OR JSON)"
fq: "organization:(comune-palermo OR comune-roma)"

# Wrong — silently ignored, returns entire catalog
fq: "res_format:CSV OR res_format:JSON"
```

### Portal Verification

- Call `ckan_status_show` before searching any portal not previously confirmed
- If it fails, call `ckan_find_portals` to find the correct URL

### Country-to-Portal Mapping

| Country/Scope | Portal | Note |
|--------------|--------|------|
| Italy | dati.gov.it | Primary |
| France | data.europa.eu | data.gouv.fr is NOT CKAN |
| USA | catalog.data.gov | |
| Canada | open.canada.ca/data | |
| UK | data.gov.uk | |
| EU / multi-country | data.europa.eu | Default for cross-border |

### Date Semantics

| User says | Field to use |
|-----------|-------------|
| "recent", "latest" (ambiguous) | `content_recent: true` or sort `metadata_modified desc` |
| "published after DATE" | `fq="issued:[DATE TO *]"` |
| "added to portal after DATE" | `fq="metadata_created:[DATE TO *]"` |

### Result Volume

- >100 results: guide user to refine — add `fq` filter, format, org, date range
- 0 results: broaden query, remove filters, try synonyms, try different portal

### Data Integrity

- Never invent dataset names, IDs, URLs, or statistics
- Report only what MCP tools return
- If DataStore is absent on a portal, say so and offer the resource download URL

## Tool Quick Reference

| Tool | Purpose |
|------|---------|
| `ckan_find_portals` | Find known CKAN portals by country |
| `ckan_status_show` | Verify portal reachability and version |
| `ckan_package_search` | Search datasets (Solr syntax) |
| `ckan_package_show` | Full dataset metadata |
| `ckan_list_resources` | List files/resources in a dataset |
| `ckan_find_relevant_datasets` | Smart relevance-ranked search |
| `ckan_analyze_datasets` | Analyze and compare datasets |
| `ckan_catalog_stats` | Portal-level statistics |
| `ckan_datastore_search` | Query tabular data by filters |
| `ckan_datastore_search_sql` | SQL on tabular DataStore data |
| `ckan_organization_list` | List all publishers |
| `ckan_organization_show` | Publisher details + their datasets |
| `ckan_organization_search` | Find publishers by name pattern |
| `ckan_group_list` | List thematic groups/categories |
| `ckan_group_show` | Group details + datasets |
| `ckan_group_search` | Find groups by name pattern |
| `ckan_tag_list` | List available tags on a portal |
| `ckan_get_mqa_quality` | MQA overall quality score |
| `ckan_get_mqa_quality_details` | MQA dimension-by-dimension breakdown |
| `sparql_query` | SPARQL on data.europa.eu |
