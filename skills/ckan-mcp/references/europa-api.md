# data.europa.eu API Reference

European open data portal — API patterns for multi-country and EU-wide queries.

## When to Use

- User asks for EU-wide or multi-country data
- User mentions France (data.gouv.fr is NOT CKAN — use data.europa.eu)
- User wants to compare datasets across countries
- User needs structured/linked data queries via SPARQL

## REST API (Default Path)

Base URL: `https://data.europa.eu/api/hub/search/`

### Search Endpoint

```
GET https://data.europa.eu/api/hub/search/search?q=QUERY&...
```

### Key Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Full-text query | `q=pollution` |
| `filter` | Document type filter | `filter=dataset` |
| `facets` | JSON object for filtering by facets (see below) | `facets={"country":["pt"]}` |
| `facetOperator` | How **values within the same facet** combine (`AND`/`OR`, default `OR`) | Use `OR` for multi-country/multi-catalog; `AND` always returns 0 with multiple values |
| `facetGroupOperator` | How **different facet groups** combine (`AND`/`OR`, default `AND`) | `AND` = intersection across facet types (e.g. country AND catalog); `OR` = union |
| `lang` | Language preference | `lang=it` |
| `page` | Page number (0-based) | `page=0` |
| `limit` | Results per page (max 1000) | `limit=10` |
| `sort` | Sort order | `sort=relevance+desc` or `sort=issued+desc` |

**facetOperator / facetGroupOperator rules (verified)**:
- `facetOperator=AND` with multiple values in the same facet **always returns 0** — never use with multi-country or multi-catalog
- `facetOperator=OR` (or omitted) for multiple values within one facet: returns union ✅
- `facetGroupOperator=AND` (default) when combining different facets (e.g. country + catalog): returns intersection ✅
- Single value in a facet: `facetOperator` has no effect — safe to omit

### Country Filtering — Two-Step Recommended Approach

For reliable country-filtered searches, use a two-step approach:

**Step 1 — Find catalogues for the country** (`filter=catalogue`):

```bash
# Find all catalogues for Denmark
curl "https://data.europa.eu/api/hub/search/search?q=&filter=catalogue&facets=%7B%22superCatalog%22%3A%5B%5D%2C%22country%22%3A%5B%22dk%22%5D%7D&limit=20"
```

Response includes `id` (catalog ID), `title`, `count` (number of datasets), `country`.
Discovered by intercepting UI network calls — not officially documented.

**Step 2 — Search datasets filtered by catalog ID**:

```bash
# Search datasets in Danish catalog "datavejviser"
curl "https://data.europa.eu/api/hub/search/search?q=QUERY&filter=dataset&facets=%7B%22catalog%22%3A%5B%22datavejviser%22%5D%7D&limit=10"

# Multiple catalogs from same country (facetOperator=OR to union them)
curl "https://data.europa.eu/api/hub/search/search?q=QUERY&filter=dataset&facetOperator=OR&facets=%7B%22catalog%22%3A%5B%22datavejviser%22%2C%22open-data-dk%22%5D%7D&limit=10"
```

**Multi-country searches — run one query per country**:
When searching across countries from different catalogues, do NOT combine catalogue IDs in a single query with a mixed-language query string — it returns 0 results.
Instead, run one query per country using native language terms:

```bash
# DE: use German terms, GovData catalogue
curl "https://data.europa.eu/api/hub/search/search?q=erneuerbare+energie&filter=dataset&facets=%7B%22catalog%22%3A%5B%22govdata%22%5D%7D&limit=10"

# PL: use Polish terms, dane.gov.pl catalogue
curl "https://data.europa.eu/api/hub/search/search?q=energia+odnawialna&filter=dataset&facets=%7B%22catalog%22%3A%5B%22dane-gov-pl%22%5D%7D&limit=10"
```

### Direct Country Filter (simpler, works for many countries)

For countries well-represented on the portal (IT, FR, ES, DE, etc.) the single-step
`country` facet on datasets works:

```bash
# Single country (no facetOperator needed — single value)
curl "https://data.europa.eu/api/hub/search/search?q=acidentes+rodoviarios&filter=dataset&facets=%7B%22country%22%3A%5B%22pt%22%5D%7D&limit=10"

# Single country
curl "https://data.europa.eu/api/hub/search/search?q=qualite+eau&filter=dataset&facets=%7B%22country%22%3A%5B%22fr%22%5D%7D&limit=10"

# Multiple countries (facetOperator=OR to union them)
curl "https://data.europa.eu/api/hub/search/search?q=environment&filter=dataset&facetOperator=OR&facets=%7B%22country%22%3A%5B%22it%22%2C%22es%22%5D%7D&limit=10"
```

If country filter returns 0 datasets, fall back to the two-step catalogue approach above.

### Query Syntax (Elasticsearch / Lucene)

The `q` parameter uses **Elasticsearch query string syntax** (Lucene-based). Verified patterns:

| Pattern | Syntax | Results | Notes |
|---------|--------|---------|-------|
| Implicit AND | `youth unemployment` | broad | default, space = AND |
| Exact phrase | `"youth unemployment"` | precise | use for multi-word concepts |
| OR between words | `desempleo OR paro` | union | works without parentheses |
| OR between phrases | `("desempleo juvenil" OR "paro juvenil")` | precise | **parentheses mandatory** — without them OR is applied at token level and returns garbage |
| AND explicit | `term1 AND term2` | strict | more restrictive than implicit |
| NOT | `desempleo NOT agrario` | filtered | excludes term |
| Wildcard | `trasport*` | broad | suffix wildcard |
| Proximity | `"youth unemployment"~5` | targeted | terms within 5 words of each other — very effective for multi-word topics |
| Fuzzy | `groundwter~1` | typo-tolerant | allows 1 edit distance — use carefully, can return millions of results |
| Date range | `term AND issued:[2023-01-01 TO *]` | time-filtered | filters by publication date in `q` string |
| Boosting | `groundwater^3 OR water` | ranked | boosts relevance of first term |
| Field-specific | `title:groundwater` | ❌ broken | returns 0 — ES fields not exposed via `q` |

**Key rules**:
- OR between quoted phrases **always requires parentheses**: `("a b" OR "c d")`
- Fuzzy (`~N`) on short queries can match millions — prefer exact or proximity instead
- Date range works in `q` string: `groundwater AND issued:[2023-01-01 TO *]`
- `minDate` API parameter returns HTTP 400 — use date range in `q` instead
- `fields=title` API parameter returns 0 — field-specific search is not supported

**Recommended patterns for open data searches**:
```bash
# Exact topic, recent only
q=groundwater+AND+issued:%5B2023-01-01+TO+%2A%5D

# Two native-language synonyms for same concept
q=%28%22desempleo+juvenil%22+OR+%22paro+juvenil%22%29

# Proximity: terms near each other (more precise than implicit AND)
q=%22renewable+energy%22~3

# Broad topic + NOT to exclude noise
q=unemployment+NOT+agrario
```

### Parsing Results with jq

Use this verified template to extract key fields from any search response:

```bash
curl -s "https://data.europa.eu/api/hub/search/search?q=QUERY&filter=dataset&limit=10" | \
  jq '[.result.results[] | {
    title: (.title | if type=="object" then (.en // .it // .fr // (to_entries[0].value)) else . end),
    publisher: .publisher.name,
    country: .country.id,
    id: .id,
    formats: ([.distributions[]?.format.label] | unique)
  }]'
```

Notes:
- `country.id` is always lowercase — use it directly for filtering
- `title` is always a multilingual object — extract `.en` first, then fall back
- `distributions` may be absent — use `[]?` to avoid errors
- `catalog.id` (for publisher page link) is nested as `.catalog.id`

### Publisher Catalog URL

Each dataset result contains `catalog.id`. Use it to build a direct link to the publisher's
datasets on data.europa.eu:

```
https://data.europa.eu/data/datasets?locale=en&catalog={catalog.id}
```

Always show this link when presenting results — e.g. `catalog.id = "eige"` →
`https://data.europa.eu/data/datasets?locale=en&catalog=eige`

### Response Structure

```json
{
  "result": {
    "count": 1234,
    "results": [
      {
        "id": "...",
        "title": {"en": "Dataset Title", "it": "Titolo Dataset"},
        "description": {"en": "..."},
        "issued": "2024-01-15",
        "modified": "2024-06-01",
        "country": {"id": "it", "label": "Italy", "resource": "http://publications.europa.eu/resource/authority/country/ITA"},
        "publisher": {"name": "Ministero dell'Ambiente", "type": "Agent", "homepage": "..."},
        "resource": "http://data.europa.eu/88u/dataset/...",
        "distributions": [
          {
            "access_url": ["https://..."],
            "format": {"id": "CSV", "label": "CSV"},
            "media_type": "text/csv",
            "id": "...",
            "issued": "2024-01-15",
            "modified": "2024-06-01"
          }
        ]
      }
    ],
    "facets": {
      "country": [{"id": "it", "count": 456}, {"id": "es", "count": 312}],
      "theme": [{"id": "ENVI", "count": 1200}]
    }
  }
}
```

**Field notes (verified)**:
- `country.id` is always **lowercase** (e.g. `"it"`, `"fr"`, `"gb"`) — never uppercase
- `country` is always an **object**, never an array
- `distributions` is an array when present, but **may be absent** on some datasets (e.g. aggregated/Copernicus entries) — always check with `select(has("distributions"))`
- `distributions[].access_url` is an **array** of strings, not a single string
- `distributions[].format` is an **object** `{id, label}`, not a plain string
- `resource` is a string URL (the dataset's canonical URI on data.europa.eu) — always present

## CKAN-Compatible API

A CKAN-compatible endpoint exists at:

```
GET https://data.europa.eu/api/hub/search/ckan/package_search
GET https://data.europa.eu/api/hub/search/ckan/package_show?id=DATASET_ID
```

**Cannot be used via `ckan_package_search` MCP tool** — the tool appends `/api/3/action/package_search` which does not exist on this portal (returns 404).

**Country filtering does not work** — `fq=country:FR` returns 0 results. Country info is nested inside `organization.country` in the response, not a top-level filterable field.

To use this endpoint, call it directly via Bash:

```bash
curl "https://data.europa.eu/api/hub/search/ckan/package_search?q=water+quality&rows=10"
```

For country-filtered searches, use the REST API instead (see above).

## SPARQL Endpoint

For structured linked-data queries using RDF/DCAT vocabulary.

```
Endpoint: https://data.europa.eu/sparql
Method: POST
```

Use via MCP tool: `sparql_query(query="...", endpoint="https://data.europa.eu/sparql")`

**SPARQL limitations**:
- Country filtering via `dct:spatial` + `skos:exactMatch` does **NOT** work — spatial values on datasets are blank nodes, not country URIs
- For country-filtered searches, use the REST API via Bash (the only reliable method)
- SPARQL is useful for: theme filtering, file type filtering, specific dataset/distribution lookup

### Common Prefixes

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct:  <http://purl.org/dc/terms/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
```

### Example Queries (tested and working)

```sparql
-- Datasets by EU theme (Environment), with publisher and keywords
SELECT DISTINCT ?datasetURI ?datasetTitle ?publisher (GROUP_CONCAT(?keyword; SEPARATOR = " | ") AS ?keywords)
WHERE {
  ?datasetURI a dcat:Dataset;
    dct:publisher/rdfs:label|dct:publisher/skos:prefLabel ?publisher;
    dcat:theme <http://publications.europa.eu/resource/authority/data-theme/ENVI>;
    dcat:keyword ?keyword;
    dct:title ?datasetTitle.
  FILTER(LANG(?datasetTitle)= "" || LANG(?datasetTitle) = "en").
  FILTER (LANG(?publisher) = "" || LANG(?publisher) = "en").
}
ORDER BY ?datasetURI
LIMIT 10
```

```sparql
-- Distributions of a specific file type (e.g. XML)
SELECT DISTINCT ?datasetURI ?accessURL ?OPLabel
WHERE {
  ?datasetURI a dcat:Dataset;
    dcat:distribution ?distributionURI.
  ?distributionURI dcat:accessURL ?accessURL;
    dct:format ?OPFileType. FILTER(?OPFileType=<http://publications.europa.eu/resource/authority/file-type/XML>)
  ?OPFileType skos:prefLabel ?OPLabel. FILTER(LANGMATCHES(LANG(?OPLabel),"en"))
}
ORDER BY ?datasetURI
LIMIT 10
```

### What does NOT work in SPARQL

```sparql
-- BROKEN: country filter via skos:exactMatch — returns 0 results
-- dct:spatial on datasets uses blank nodes, not country URIs
SELECT ?dataset ?title WHERE {
  ?dataset a dcat:Dataset ;
           dct:spatial ?spatial .
  ?spatial skos:exactMatch <http://publications.europa.eu/resource/authority/country/ITA> .
}
```

## EU Data Themes

| Code | Theme |
|------|-------|
| ENVI | Environment |
| ENER | Energy |
| TRAN | Transport |
| HEAL | Health |
| AGRI | Agriculture, Fisheries, Forestry, Food |
| ECON | Economy and Finance |
| EDUC | Education, Culture, Sport |
| JUST | Justice, Legal System, Public Safety |
| GOVE | Government and Public Sector |
| REGI | Regions and Cities |
| SOCI | Population and Society |
| TECH | Science and Technology |

Full URI pattern: `http://publications.europa.eu/resource/authority/data-theme/{CODE}`

## Country Codes (ISO 3166-1 alpha-2)

| Country | Code | Country | Code |
|---------|------|---------|------|
| Italy | IT | Portugal | PT |
| France | FR | Greece | GR |
| Spain | ES | Netherlands | NL |
| Germany | DE | Belgium | BE |
| Poland | PL | Romania | RO |
| Austria | AT | Sweden | SE |
| Denmark | DK | Finland | FI |
| Ireland | IE | Hungary | HU |
| Croatia | HR | Bulgaria | BG |
