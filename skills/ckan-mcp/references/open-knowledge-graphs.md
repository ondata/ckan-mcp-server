# Open Knowledge Graphs API

Semantic search over 1,800+ ontologies, vocabularies, taxonomies, and semantic
software tools cataloged from Wikidata. Useful for finding existing standards
and schemas when a user wants to model or annotate a dataset.

**Base URL**: `https://api.openknowledgegraphs.com`

## Endpoints

| Endpoint | Description | Key params |
|----------|-------------|------------|
| `GET /` | API info + category list | — |
| `GET /ontologies` | Search ontologies, vocabularies, taxonomies | `q` (required), `category`, `limit` |
| `GET /software` | Search semantic software tools | `q` (required), `limit` |
| `GET /search` | Search across all types | `q`, `category`, `type` (ontology\|software), `limit` |

**Categories**: Life Sciences & Healthcare · Geospatial · Government & Public Sector ·
International Development · Finance & Business · Library & Cultural Heritage ·
Technology & Web · Environment & Agriculture · General / Cross-domain

**Response fields** (per result): `score`, `title`, `wikidataId`, `description`,
`types`, `category`, `homepage`, `licenses`, `partOf`, `latestVersion`, `releaseDate`

## When to use

Use this API when the user:
- Has a dataset and wants to know which standard schema or ontology to adopt
- Asks "is there a vocabulary for X?"
- Wants to make their data more interoperable or linked-data ready
- Needs field names / property URIs aligned with an existing standard

## Complete example — air quality sensor dataset

**Scenario**: user has a CSV with columns `station_id`, `timestamp`, `pm25`,
`pm10`, `no2`, `temperature`, and wants to know which ontology to use.

### Step 1 — search for relevant ontologies

```bash
curl -s "https://api.openknowledgegraphs.com/ontologies?q=sensor+observation+measurement&limit=5" | jq .
```

Result (abridged):

```json
{
  "query": "sensor observation measurement",
  "total": 5,
  "results": [
    {
      "score": 0.6947755,
      "title": "Semantic Sensor Network Ontology",
      "wikidataId": "https://www.wikidata.org/wiki/Q62211950",
      "description": "area of research",
      "types": ["Ontology"],
      "category": "Technology & Web",
      "homepage": "https://www.w3.org/TR/vocab-ssn/"
    },
    {
      "score": 0.6919018,
      "title": "Extensible Observation Ontology",
      "wikidataId": "https://www.wikidata.org/wiki/Q60675025",
      "types": ["Ontology"],
      "category": "General / Cross-domain",
      "homepage": "https://github.com/NCEAS/oboe/"
    }
  ]
}
```

**Top result**: [SSN — Semantic Sensor Network Ontology](https://www.w3.org/TR/vocab-ssn/)
(W3C standard, highest score, Technology & Web).

### Step 2 — refine with a domain-specific query

```bash
curl -s "https://api.openknowledgegraphs.com/ontologies?q=air+quality+environment&category=Environment+%26+Agriculture&limit=3" | jq .
```

```json
{
  "results": [
    {
      "title": "Environment Ontology",
      "homepage": "http://environmentontology.org/",
      "licenses": ["Creative Commons CC0 License"]
    }
  ]
}
```

### Step 3 — follow the homepage to inspect the schema

```bash
# Fetch the W3C SSN spec page and extract key sections
curl -s https://www.w3.org/TR/vocab-ssn/ | grep -oP '(?<=<h[23][^>]*>)[^<]+' | head -30
```

Or fetch and read the raw turtle/OWL namespace to extract classes and properties:

```bash
curl -sL https://www.w3.org/ns/ssn/ -H "Accept: text/turtle" | grep "^ssn:\|^sosa:\|rdfs:label" | head -40
```

Key SSN/SOSA classes and properties relevant to the air quality CSV:

| CSV column | SSN/SOSA term | URI |
|------------|---------------|-----|
| `station_id` | `sosa:Sensor` | `http://www.w3.org/ns/sosa/Sensor` |
| `timestamp` | `sosa:resultTime` | `http://www.w3.org/ns/sosa/resultTime` |
| `pm25`, `pm10`, `no2` | `sosa:hasResult` → `sosa:Result` | `http://www.w3.org/ns/sosa/hasResult` |
| `temperature` | `sosa:observedProperty` | `http://www.w3.org/ns/sosa/observedProperty` |
| (observation row) | `sosa:Observation` | `http://www.w3.org/ns/sosa/Observation` |

### Step 4 — check for software tools (optional)

```bash
curl -s "https://api.openknowledgegraphs.com/software?q=ontology+mapping&limit=3" | jq '.results[] | {title, homepage, latestVersion}'
```

### Complete recommendation to the user

The **W3C SSN/SOSA ontology** (`https://www.w3.org/TR/vocab-ssn/`) is the right
standard for sensor observation data:
- Each row → `sosa:Observation`
- `station_id` → `sosa:madeBySensor` (pointing to a `sosa:Sensor` instance)
- `timestamp` → `sosa:resultTime` (ISO 8601 datetime)
- `pm25` / `pm10` / `no2` → separate `sosa:Observation` instances each with `sosa:hasResult`
- For the pollutants themselves, pair with **ENVO** (Environment Ontology, CC0) for
  observed property URIs

## Tips

- `score` ranges 0–1: results above 0.7 are strong matches, 0.5–0.7 are relevant,
  below 0.5 are loose.
- If `homepage` is absent, use `wikidataId` to find the resource on Wikidata and
  follow its "official website" or "described at URL" statements.
- Use `category` filter to narrow to a domain and avoid off-topic ontologies.
- If the `mcp__schema-gov-it__*` tools are available, cross-check found ontologies
  against schema.gov.it for the Italian public administration context.
