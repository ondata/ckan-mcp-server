# SPARQL Examples (dati.gov.it)

Endpoint: `https://lod.dati.gov.it/sparql/`

Notes:

- Use POST only.
- Encode the query string (URL-encoded).
- Use a real browser User-Agent.
- GET often returns 403.

## Helper for encoding

```bash
python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read()))"
```

## Minimal working query

Human-readable query:

```sparql
SELECT ?s
WHERE {
  ?s a <http://dati.gov.it/onto/dcatapit#Dataset> .
}
LIMIT 5
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=SELECT%20?s%20WHERE%20%7B%20?s%20a%20%3Chttp%3A%2F%2Fdati.gov.it%2Fonto%2Fdcatapit%23Dataset%3E%20%7D%20LIMIT%205"
```

## Messina by title

Human-readable query:

```sparql
PREFIX dcatapit: <http://dati.gov.it/onto/dcatapit#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?dataset ?title
WHERE {
  ?dataset a dcatapit:Dataset ;
           dct:title ?title .
  FILTER(CONTAINS(LCASE(STR(?title)), "messina"))
}
LIMIT 5
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20dcatapit%3A%20%3Chttp%3A%2F%2Fdati.gov.it%2Fonto%2Fdcatapit%23%3E%20PREFIX%20dct%3A%20%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%20SELECT%20?dataset%20?title%20WHERE%20%7B%20?dataset%20a%20dcatapit%3ADataset%20%3B%20dct%3Atitle%20?title%20.%20FILTER%28CONTAINS%28LCASE%28STR%28?title%29%29%2C%20%22messina%22%29%29%20%7D%20LIMIT%205"
```

## Messina by publisher name

Human-readable query:

```sparql
PREFIX dcatapit: <http://dati.gov.it/onto/dcatapit#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT DISTINCT ?dataset ?title ?publisherName
WHERE {
  ?dataset a dcatapit:Dataset ;
           dct:title ?title ;
           dct:publisher ?publisher .
  ?publisher foaf:name ?publisherName .
  FILTER(CONTAINS(LCASE(STR(?publisherName)), "comune di messina"))
}
LIMIT 5
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20dcatapit%3A%20%3Chttp%3A%2F%2Fdati.gov.it%2Fonto%2Fdcatapit%23%3E%20PREFIX%20dct%3A%20%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%20PREFIX%20foaf%3A%20%3Chttp%3A%2F%2Fxmlns.com%2Ffoaf%2F0.1%2F%3E%20SELECT%20DISTINCT%20?dataset%20?title%20?publisherName%20WHERE%20%7B%20?dataset%20a%20dcatapit%3ADataset%20%3B%20dct%3Atitle%20?title%20%3B%20dct%3Apublisher%20?publisher%20.%20?publisher%20foaf%3Aname%20?publisherName%20.%20FILTER%28CONTAINS%28LCASE%28STR%28?publisherName%29%29%2C%20%22comune%20di%20messina%22%29%29%20%7D%20LIMIT%205"
```

## Count datasets by catalog

Human-readable query:

```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX type: <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dcatapit: <http://dati.gov.it/onto/dcatapit#>

SELECT ?catalog (COUNT(?s) AS ?count)
WHERE {
  ?catalog <http://www.w3.org/ns/dcat#dataset> ?s .
}
GROUP BY ?catalog
ORDER BY DESC(?count)
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20rdf%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%3E%20PREFIX%20type%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23type%3E%20PREFIX%20dct%3A%20%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%20PREFIX%20dcatapit%3A%20%3Chttp%3A%2F%2Fdati.gov.it%2Fonto%2Fdcatapit%23%3E%20SELECT%20?catalog%20(COUNT(?s)%20AS%20?count)%20WHERE%20%7B%20?catalog%20<http%3A%2F%2Fwww.w3.org%2Fns%2Fdcat%23dataset>%20?s%20.%20%7D%20GROUP%20BY%20?catalog%20ORDER%20BY%20DESC(?count)"
```

## Example: distributions for a dataset

Human-readable query:

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT DISTINCT ?distributionTitle ?distributionURI
WHERE {
  <http://www.opendataipres.it/dataset/900aae7e-d38d-4181-aaf9-6c332c7fae77>
    a dcat:Dataset ;
    dcat:distribution ?distributionURI .
  OPTIONAL { ?distributionURI dct:title ?distributionTitle . }
}
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20dcat%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2Fns%2Fdcat%23%3E%20PREFIX%20dct%3A%20%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%20SELECT%20DISTINCT%20?distributionTitle%20?distributionURI%20WHERE%20%7B%20<http%3A%2F%2Fwww.opendataipres.it%2Fdataset%2F900aae7e-d38d-4181-aaf9-6c332c7fae77>%20a%20dcat%3ADataset%3B%20dcat%3Adistribution%20?distributionURI%20.%20OPTIONAL%20%7B%20?distributionURI%20dct%3Atitle%20?distributionTitle%20.%20%7D%20%7D"
```

## Count distributions with/without license

Notes:

- Use `COUNT(DISTINCT ?dist)` to avoid double-counting if a distribution has multiple `dct:license` values.

### Total distributions

Human-readable query:

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>

SELECT (COUNT(DISTINCT ?dist) AS ?count)
WHERE {
  ?dataset a dcat:Dataset ;
           dcat:distribution ?dist .
}
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20dcat%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2Fns%2Fdcat%23%3E%20SELECT%20%28COUNT%28DISTINCT%20%3Fdist%29%20AS%20%3Fcount%29%20WHERE%20%7B%20%3Fdataset%20a%20dcat%3ADataset%20%3B%20dcat%3Adistribution%20%3Fdist%20.%20%7D"
```

### Distributions with license

Human-readable query:

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct:  <http://purl.org/dc/terms/>

SELECT (COUNT(DISTINCT ?dist) AS ?count)
WHERE {
  ?dataset a dcat:Dataset ;
           dcat:distribution ?dist .
  ?dist dct:license ?lic .
}
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20dcat%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2Fns%2Fdcat%23%3E%20PREFIX%20dct%3A%20%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%20SELECT%20%28COUNT%28DISTINCT%20%3Fdist%29%20AS%20%3Fcount%29%20WHERE%20%7B%20%3Fdataset%20a%20dcat%3ADataset%20%3B%20dcat%3Adistribution%20%3Fdist%20.%20%3Fdist%20dct%3Alicense%20%3Flic%20.%20%7D"
```

### Distributions without license

Human-readable query:

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct:  <http://purl.org/dc/terms/>

SELECT (COUNT(DISTINCT ?dist) AS ?count)
WHERE {
  ?dataset a dcat:Dataset ;
           dcat:distribution ?dist .
  FILTER NOT EXISTS { ?dist dct:license ?lic . }
}
```

```bash
curl -s -X POST https://lod.dati.gov.it/sparql/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/sparql-results+json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data "query=PREFIX%20dcat%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2Fns%2Fdcat%23%3E%20PREFIX%20dct%3A%20%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%20SELECT%20%28COUNT%28DISTINCT%20%3Fdist%29%20AS%20%3Fcount%29%20WHERE%20%7B%20%3Fdataset%20a%20dcat%3ADataset%20%3B%20dcat%3Adistribution%20%3Fdist%20.%20FILTER%20NOT%20EXISTS%20%7B%20%3Fdist%20dct%3Alicense%20%3Flic%20.%20%7D%20%7D"
```

## Comparison: CKAN vs SPARQL

This section validates notes from the audio against real datasets.

### Case 1: DGA / restricted dataset

CKAN dataset:

- Name: `piattaforma-di-simbiosi-industriale`
- CKAN access_rights: `http://publications.europa.eu/resource/authority/access-right/RESTRICTED`
- Source URI: `https://dati.enea.it/dataset/44102bf9-d86f-4afa-826f-d42e83365189`

SPARQL result:

- Dataset URI not found in `lod.dati.gov.it` (no triples returned)

Conclusion:

- CKAN exposes the DGA dataset, SPARQL does not (at least via `lod.dati.gov.it`).
- This contradicts the note that DGA datasets are visible in SPARQL but not in CKAN.

### Case 2: DataService / API endpoints

There are 942 `dcat:DataService` instances in the LOD (verified 2026-03-05).

Example DataService URI (geodati.gov.it):

- `https://geodati.gov.it/resource/dataService/c_b984:accesso_esterno:1-1`

SPARQL query to explore DataService entries:

```sparql
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT DISTINCT ?s ?title ?endpointURL
WHERE {
  ?s a dcat:DataService ;
     dcat:endpointURL ?endpointURL .
  OPTIONAL { ?s dct:title ?title . }
  FILTER(?s != ?endpointURL)
}
LIMIT 10
```

Findings:

- SPARQL exposes `dcat:DataService` with `endpointURL` as first-class entities, queryable directly.
- CKAN stores the same data inside `resources[*].access_services` as a nested JSON string — not a
  first-class field. To extract all DataService endpoints from CKAN you would need to:
  1. iterate all datasets via `package_search`
  2. call `package_show` for each one
  3. parse the `access_services` string (JSON inside JSON) for each resource

Note: the URI `https://opendata.marche.camcom.it/data/dcat-opendata-catalog.rdf#Cancellazioni-Imprese-Italia`
previously documented here no longer exists in the LOD (verified 2026-03-05).

Conclusion:

- SPARQL makes DataService endpoints trivially queryable in a single query.
- Via CKAN the same information requires iterating thousands of datasets and parsing nested JSON.
- This is one of the cases where the LOD adds real value over the CKAN API.

### Case 3: `issued` defaulted in RDF when missing in CKAN

CKAN dataset:

- Name: `ambiti-territoriali-organizzativi-ottimali-di-protezione-civile`
- CKAN `issued`: missing/empty
- CKAN `metadata_created`: `2025-02-23T20:03:34.427664`
- CKAN URI: `https://geodati.gov.it/resource/id/arlst:2023-12-19T091807`

SPARQL query:

```sparql
SELECT ?issued
WHERE {
  <https://geodati.gov.it/resource/id/arlst:2023-12-19T091807>
    <http://purl.org/dc/terms/issued> ?issued .
}
LIMIT 1
```

SPARQL result:

- `dct:issued` = `2025-02-23T20:03:34.427664`

Conclusion:

- When `issued` is missing in CKAN, the CKAN→RDF transformation appears to default
  `dct:issued` to CKAN `metadata_created` (harvest/record timestamp).
