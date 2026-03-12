# High Value Datasets (HVD)

EU Implementing Regulation 2023/138 mandates a set of "High Value Datasets" that
member states must publish as open data, free of charge, in machine-readable format,
via API where applicable.

## When to use this reference

Read this file when the user:
- Asks about "high value datasets", "HVD", or "dati ad alto valore"
- Wants to find datasets mandated by EU regulation
- Asks which datasets a country must publish by law
- Wants to compare HVD coverage across EU countries

## API filter on data.europa.eu

Each dataset result has two HVD-specific fields:

- **`is_hvd`** — boolean, `true` if the dataset is classified as HVD
- **`hvd_category`** — array of thematic categories (see below)

**Filter HVD-only datasets** (add `"is_hvd":[true]` to facets):
```bash
curl "https://data.europa.eu/api/hub/search/search?q=TERM&filter=dataset&facets=%7B%22is_hvd%22%3A%5Btrue%5D%7D&limit=10"
```

**Combine HVD filter with country**:
```bash
# Direct country filter — reliable for most countries (e.g. Italy: confirmed same count as catalogue filter)
curl "https://data.europa.eu/api/hub/search/search?q=&filter=dataset&facets=%7B%22is_hvd%22%3A%5Btrue%5D%2C%22country%22%3A%5B%22it%22%5D%7D&limit=0"
```

For countries where direct filter returns 0 (e.g. Denmark, Germany, Poland), use the two-step
catalogue approach instead — see `references/europa-api.md`.

## The 6 HVD thematic categories

The Regulation defines 6 themes. Each dataset belongs to one or more sub-categories
under these themes. The `hvd_category` field in the API response contains the
**sub-category**, not the top-level theme.

| Theme | Sub-category | Sub-category ID |
|-------|-------------|-----------------|
| **Geospatial** | Geospatial (generic) | `c_ac64a52d` |
| | Addresses | `c_c3de25e4` |
| | Cadastral parcels | `c_6a3f6896` |
| | Buildings | `c_60182062` |
| | Geographical names | `c_6c2bb82d` |
| | Elevation | `c_315692ad` |
| | Land cover | `c_b21e1296` |
| | Land use | `c_ad9ae929` |
| | Orthoimagery | `c_91185a85` |
| | Protected sites | `c_83aa10a6` |
| | Official aids-to-navigation | `c_b24028d7` |
| **Earth observation and environment** | Earth observation and environment | `c_dd313021` |
| | Production and industrial facilities | `c_59c93ba5` |
| | Energy resources | `c_b7de66cd` |
| **Meteorological** | Meteorological | `c_164e0bf5` |
| **Statistics** | Statistics | `c_e1da4e07` |
| **Companies and company ownership** | Companies and company ownership | `c_a9135398` |
| **Mobility** | Mobility | `c_b79e35eb` |
| | Transport networks | `c_4b74ea13` |

## Counting and filtering by sub-category

**When querying data.europa.eu for counts or breakdowns, always prefer SPARQL (Option A).**
The REST API requires downloading up to 500 records and filtering client-side; SPARQL returns
server-side aggregates with no payload, no 500-record ceiling, and a single query.

### Option A — SPARQL (preferred for category breakdown)

The SPARQL endpoint on data.europa.eu supports server-side `COUNT(DISTINCT) + GROUP BY`,
returning only aggregates — no payload download, no client-side filtering, no 500-record limit.

**Country filtering via catalogue** (the only reliable method — `dct:spatial` does NOT work):

```sparql
PREFIX dcatap: <http://data.europa.eu/r5r/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?categoryLabel (COUNT(DISTINCT ?dataset) AS ?count)
WHERE {
  VALUES ?catalogue {
    <http://data.europa.eu/88u/catalogue/dati-gov-it>
    <http://data.europa.eu/88u/catalogue/rndt>
  }
  ?catalogue dcat:dataset ?dataset .
  ?dataset dcatap:applicableLegislation <http://data.europa.eu/eli/reg_impl/2023/138/oj> ;
           dcatap:hvdCategory ?category .
  ?category skos:prefLabel ?categoryLabel .
  FILTER(LANG(?categoryLabel) = "en")
}
GROUP BY ?categoryLabel
ORDER BY DESC(?count)
```

**How to find catalogue URIs for a country** — query the triplestore:

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?catalogue ?title WHERE {
  ?catalogue a dcat:Catalog ;
             dct:title ?title ;
             dct:spatial <http://publications.europa.eu/resource/authority/country/ITA> .
  FILTER(LANG(?title) = "en" || LANG(?title) = "it" || LANG(?title) = "")
}
```

Country URI pattern: `http://publications.europa.eu/resource/authority/country/{ISO3}` (e.g. `ITA`, `DEU`, `FRA`).

**Known Italian catalogues** (verified):
- `http://data.europa.eu/88u/catalogue/dati-gov-it` — dati.gov.it
- `http://data.europa.eu/88u/catalogue/rndt` — Italian Catalogue of Spatial Data

**SPARQL limitations**:
- `dct:spatial` + `skos:exactMatch` on datasets does NOT work (spatial values are blank nodes)
- Country filtering must go through the catalogue URI (see query above)
- Use `sparql_query` tool or `curl` POST to `https://data.europa.eu/sparql`

### Option B — REST API + jq (fallback, limited to 500 records)

The API does not expose `hvd_category` as a facet filter — you must filter client-side
with `jq` after fetching results. Use `limit=500` (max) and count matches:

```bash
# Count Italian HVDs in Geospatial category
curl -s "https://data.europa.eu/api/hub/search/search?q=&filter=dataset&facets=%7B%22is_hvd%22%3A%5Btrue%5D%2C%22country%22%3A%5B%22it%22%5D%7D&limit=500" \
  | jq '[.result.results[] | select(.hvd_category[]?.id == "c_ac64a52d")] | length'

# Full sub-category breakdown for a country (use single quotes around jq expression to avoid shell issues)
curl -s "https://data.europa.eu/api/hub/search/search?q=&filter=dataset&facets=%7B%22is_hvd%22%3A%5Btrue%5D%2C%22country%22%3A%5B%22it%22%5D%7D&limit=500" \
  | jq '[.result.results[].hvd_category[]? | .label.en] | group_by(.) | map({category: .[0], count: length}) | sort_by(-.count)'
```

**jq note**: always wrap jq expressions in single quotes in bash — the `//` alternative operator
inside double quotes causes syntax errors.

If total HVD count for a country exceeds 500, use SPARQL (Option A) or paginate with `&offset=N`.

**Interpreting category gaps**: if a country shows 0 datasets in a mandatory category, this may
indicate either real non-compliance OR a harvesting/indexing gap on data.europa.eu. To confirm
non-compliance, also check the national CKAN portal directly (see section below).

## HVD on national CKAN portals

National CKAN portals that implement DCAT-AP (e.g. dati.gov.it) store HVD metadata
as standard extra fields. Verified on dati.gov.it (445 HVD datasets):

- **`hvd_category`** extra field — value is a **full URI**, not a short ID:
  `http://data.europa.eu/bna/c_ac64a52d` (Geospatial)
  URI pattern: `http://data.europa.eu/bna/{sub-category-id}`

- **`applicable_legislation`** extra field — URI of the EU regulation:
  `http://data.europa.eu/eli/reg_impl/2023/138/oj`

- **Tag**: `high-value-dataset` consistently present in tags

**Filter HVD datasets on a CKAN portal**:
```
# All HVDs (any category)
ckan_package_search(server_url=..., fq="extras_hvd_category:*")

# HVDs in a specific category (use full URI)
ckan_package_search(server_url=..., fq='extras_hvd_category:"http://data.europa.eu/bna/c_ac64a52d"')

# By tag (fallback if extras not indexed)
ckan_package_search(server_url=..., fq="tags:high-value-dataset")
```

**URI → sub-category ID mapping**: strip the prefix `http://data.europa.eu/bna/` to get
the ID used in the table above (e.g. `c_ac64a52d` = Geospatial).

Note: the count on dati.gov.it (445) is slightly higher than data.europa.eu (443) —
minimal harvesting lag, not a structural gap.

## Examples

```
"How many HVD datasets does Italy have?"
-> curl with is_hvd:true + country:it, limit=0 → read .result.count

"How many Italian HVDs per category?"
-> SPARQL (Option A): find Italian catalogue URIs, then COUNT(DISTINCT ?dataset) GROUP BY ?categoryLabel
-> returns server-side aggregates, no payload download

"Find Italian HVD datasets on geospatial data"
-> curl with is_hvd:true + country:it, limit=500
-> jq filter by hvd_category.id == "c_ac64a52d"

"Which EU countries publish the most HVD datasets?"
-> curl with is_hvd:true, no country filter, limit=500
-> jq group_by(.country[].id) | sort_by(-.count)

"Are there HVD meteorological datasets in Germany?"
-> SPARQL (Option A): find German catalogue URI (ISO3: DEU), then COUNT with dcatap:hvdCategory filter
```
