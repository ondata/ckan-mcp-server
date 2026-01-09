# CKAN MCP Query Examples

This file contains practical examples of using the CKAN MCP server.

## Connection Tests

### Verify server status
```typescript
ckan_status_show({
  server_url: "https://demo.ckan.org"
})
```

### List datasets
```typescript
ckan_package_search({
  server_url: "https://demo.ckan.org",
  q: "*:*",
  rows: 10
})
```

## Italy Examples - dati.gov.it

### Search recent datasets
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "*:*",
  sort: "metadata_modified desc",
  rows: 20
})
```

### COVID-19 datasets
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "covid OR coronavirus",
  rows: 20
})
```

### Regione Siciliana datasets
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  sort: "metadata_modified desc",
  rows: 20
})
```

### Search organizations by name (simple method)
```typescript
// Find organizations containing "toscana" in the name
ckan_organization_search({
  server_url: "https://www.dati.gov.it/opendata",
  pattern: "toscana"
})
// → Restituisce: Regione Toscana (10988 dataset), Autorità Idrica Toscana (12 dataset)

// Other examples
ckan_organization_search({
  server_url: "https://www.dati.gov.it/opendata",
  pattern: "salute"
})

ckan_organization_search({
  server_url: "https://www.dati.gov.it/opendata",
  pattern: "comune"
})
```

### Search organizations with wildcard (advanced method)
```typescript
// Alternative method using package_search (more flexible but more complex)
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "organization:*salute*",
  rows: 0,
  facet_field: ["organization"],
  facet_limit: 100
})
```

### Statistics by organization
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["organization"],
  facet_limit: 20,
  rows: 0
})
```

### Statistics by resource format
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["res_format"],
  facet_limit: 50,
  rows: 0
})
```

### List organizations
```typescript
ckan_organization_list({
  server_url: "https://www.dati.gov.it/opendata",
  all_fields: true,
  sort: "package_count desc",
  limit: 20
})
```

### Specific organization details
```typescript
ckan_organization_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "regione-siciliana",
  include_datasets: true
})
```

### CSV format datasets
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "res_format:CSV",
  rows: 20
})
```

## USA Examples - data.gov

### Search government datasets
```typescript
ckan_package_search({
  server_url: "https://catalog.data.gov",
  q: "climate change",
  rows: 20
})
```

### Datasets by tag
```typescript
ckan_package_search({
  server_url: "https://catalog.data.gov",
  q: "tags:health",
  rows: 20
})
```

## CKAN Demo Examples

### Explore demo.ckan.org
```typescript
ckan_status_show({
  server_url: "https://demo.ckan.org"
})
```

```typescript
ckan_organization_list({
  server_url: "https://demo.ckan.org",
  all_fields: true
})
```

```typescript
ckan_package_search({
  server_url: "https://demo.ckan.org",
  q: "*:*",
  facet_field: ["organization", "tags", "res_format"],
  rows: 10
})
```

## DataStore Queries

### Basic query on resource
```typescript
ckan_datastore_search({
  server_url: "https://demo.ckan.org",
  resource_id: "5b3cf3a8-9a58-45ee-8e1a-4d98b8320c9a",
  limit: 100
})
```

### Query with filters
```typescript
ckan_datastore_search({
  server_url: "https://demo.ckan.org",
  resource_id: "5b3cf3a8-9a58-45ee-8e1a-4d98b8320c9a",
  filters: {
    "Country": "Italy"
  },
  limit: 50
})
```

### Query with sorting
```typescript
ckan_datastore_search({
  server_url: "https://demo.ckan.org",
  resource_id: "5b3cf3a8-9a58-45ee-8e1a-4d98b8320c9a",
  sort: "Year desc",
  limit: 100
})
```

## Advanced Solr Searches

### AND combination
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione AND sicilia",
  rows: 20
})
```

### OR combination
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "sanità OR salute OR health",
  rows: 20
})
```

### NOT exclusion
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "dati NOT personali",
  rows: 20
})
```

### Search by title
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:popolazione",
  rows: 20
})
```

### Search by description
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "notes:istat",
  rows: 20
})
```

### Wildcard
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popola*",
  rows: 20
})
```

### Date range filter
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_modified:[2023-01-01T00:00:00Z TO 2023-12-31T23:59:59Z]",
  rows: 20
})
```

### Datasets modified in last month
```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_modified:[NOW-1MONTH TO NOW]",
  sort: "metadata_modified desc",
  rows: 20
})
```

## Advanced Solr Query Features

CKAN uses Apache Solr for search. The `q` parameter supports advanced Solr query syntax including fuzzy matching, proximity search, boosting, and complex boolean logic.

### Fuzzy Search

Find terms with similar spelling (edit distance matching). Useful for typos or variations.

```typescript
// Find datasets with title similar to "environment" (e.g., "enviroment", "environnement")
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:environment~2",
  rows: 20
})
```

```typescript
// Fuzzy search on multiple fields
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:health~1 OR notes:sanità~1",
  rows: 20
})
```

### Proximity Search

Find phrases where words appear within N positions of each other.

```typescript
// Find "climate" and "change" within 5 words of each other in notes
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "notes:\"climate change\"~5",
  rows: 20
})
```

```typescript
// Proximity search in title
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:\"open data\"~3",
  rows: 20
})
```

### Boosting (Relevance Scoring)

Control which terms have more weight in scoring results.

```typescript
// Prioritize matches in title over notes
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:climate^2 OR notes:climate",
  sort: "score desc",
  rows: 20
})
```

```typescript
// Complex boosting with multiple fields
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:water^3 OR notes:water^1.5 OR tags:water",
  sort: "score desc",
  rows: 20
})
```

```typescript
// Constant score boosting
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:environment^=2.0 OR notes:sustainability^=1.0",
  rows: 20
})
```

### Field Existence Checks

Find datasets where specific fields exist or don't exist.

```typescript
// Find datasets that have organization set
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "organization:*",
  rows: 20
})
```

```typescript
// Find datasets with at least one resource
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "num_resources:[1 TO *]",
  rows: 20
})
```

```typescript
// Find datasets WITHOUT a specific field
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "*:* AND NOT author:*",
  rows: 20
})
```

### Date Math

Use relative dates for dynamic queries.

```typescript
// Datasets created in the last year
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "metadata_created:[NOW-1YEAR TO NOW]",
  sort: "metadata_created desc",
  rows: 20
})
```

```typescript
// Datasets modified in the last 6 months
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "metadata_modified:[NOW-6MONTHS TO NOW]",
  rows: 20
})
```

```typescript
// Datasets created today
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "metadata_created:[NOW/DAY TO NOW]",
  rows: 20
})
```

```typescript
// Datasets modified between 2 months ago and 1 month ago
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "metadata_modified:[NOW-2MONTHS TO NOW-1MONTH]",
  rows: 20
})
```

### Complex Nested Queries

Combine multiple operators for sophisticated searches.

```typescript
// Find water or climate datasets, excluding those about sea, with recent modifications
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(title:water^2 OR title:climate^2) AND NOT title:sea AND metadata_modified:[NOW-1YEAR TO *]",
  sort: "metadata_modified desc",
  rows: 20
})
```

```typescript
// Find health datasets with specific resource count range
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(title:health OR title:sanità) AND num_resources:[5 TO 50]",
  rows: 20
})
```

```typescript
// PNRR datasets modified in specific date range with boosting
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(title:pnrr^3 OR notes:pnrr^1.5 OR tags:pnrr) AND metadata_modified:[2025-07-01T00:00:00Z TO 2025-10-31T23:59:59Z]",
  sort: "score desc, metadata_modified desc",
  rows: 50
})
```

### Range Queries with Different Bounds

Use inclusive `[a TO b]` or exclusive `{a TO b}` bounds.

```typescript
// Inclusive range: datasets with 10 to 50 resources (includes 10 and 50)
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "num_resources:[10 TO 50]",
  rows: 20
})
```

```typescript
// Exclusive range: datasets with more than 10 but less than 50 resources
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "num_resources:{10 TO 50}",
  rows: 20
})
```

```typescript
// Mixed bounds: more than 5 resources, up to and including 100
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "num_resources:{5 TO 100]",
  rows: 20
})
```

### Wildcard Patterns

Use `*` for pattern matching within terms.

```typescript
// Find all terms starting with "popola" (popolazione, popolamento, etc.)
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popola*",
  rows: 20
})
```

```typescript
// Wildcard in middle of term
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:env*mental",
  rows: 20
})
```

```typescript
// Combine wildcards with boolean operators
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:ambient* OR title:clima*",
  rows: 20
})
```

### Practical Advanced Examples

```typescript
// Find recent environmental datasets from regional organizations
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "(title:ambiente* OR notes:ambiente*) AND organization:regione* AND metadata_modified:[NOW-6MONTHS TO *]",
  facet_field: ["organization"],
  rows: 50
})
```

```typescript
// High-quality datasets: many resources, recently updated, specific topic
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "title:istat AND num_resources:[5 TO *] AND metadata_modified:[NOW-1YEAR TO *]",
  sort: "num_resources desc, metadata_modified desc",
  rows: 20
})
```

```typescript
// Datasets with CSV resources, excluding drafts, recent updates
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "res_format:CSV AND state:active",
  q: "metadata_modified:[NOW-3MONTHS TO *]",
  sort: "metadata_modified desc",
  rows: 30
})
```

## Complete Workflows

### Workflow 1: Regional Dataset Analysis

```typescript
// Step 1: List regional organizations
ckan_organization_list({
  server_url: "https://www.dati.gov.it/opendata",
  all_fields: true,
  sort: "package_count desc",
  limit: 50
})

// Step 2: Select a region and search its datasets
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "organization:regione-siciliana",
  sort: "metadata_modified desc",
  rows: 50
})

// Step 3: Get details of an interesting dataset
ckan_package_show({
  server_url: "https://www.dati.gov.it/opendata",
  id: "nome-dataset-trovato"
})
```

### Workflow 2: Monitor New Publications

```typescript
// Datasets published in the last 7 days
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_created:[NOW-7DAYS TO NOW]",
  sort: "metadata_created desc",
  rows: 50
})

// Datasets modified in the last 7 days
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  fq: "metadata_modified:[NOW-7DAYS TO NOW]",
  sort: "metadata_modified desc",
  rows: 50
})
```

### Workflow 3: Data Coverage Analysis

```typescript
// Step 1: Statistics by format
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["res_format"],
  facet_limit: 100,
  rows: 0
})

// Step 2: Statistics by license
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["license_id"],
  facet_limit: 50,
  rows: 0
})

// Step 3: Statistics by organization
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["organization"],
  facet_limit: 100,
  rows: 0
})

// Step 4: Most used tags
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  facet_field: ["tags"],
  facet_limit: 50,
  rows: 0
})
```

### Workflow 4: Specific Thematic Search

```typescript
// Example: Environment and climate datasets

// Step 1: General search
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "ambiente OR clima OR inquinamento OR emissioni",
  facet_field: ["organization", "tags"],
  rows: 50
})

// Step 2: Refine with filters
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "ambiente",
  fq: "tags:aria AND res_format:CSV",
  sort: "metadata_modified desc",
  rows: 20
})

// Step 3: Analyze organizations publishing on this theme
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "ambiente",
  facet_field: ["organization"],
  rows: 0
})
```

## Output Formats

### Markdown format (default)
Readable, formatted with tables and sections

### JSON format
For programmatic processing

```typescript
ckan_package_search({
  server_url: "https://www.dati.gov.it/opendata",
  q: "popolazione",
  rows: 10,
  response_format: "json"
})
```

## Notes

- Default pagination is 10 results for `package_search`
- Maximum is 1000 results per call
- For very large datasets, use `start` to paginate
- The DataStore has a limit of 32,000 records per query
- Not all datasets have resources in the DataStore (check `datastore_active`)
