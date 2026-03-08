# CKAN MCP Tools — Complete CLI Reference

All MCP tools mapped to `ckanapi` CLI commands with full parameter support.

## Table of Contents

1. [ckan_status_show](#1-ckan_status_show)
2. [ckan_package_search](#2-ckan_package_search)
3. [ckan_package_show](#3-ckan_package_show)
4. [ckan_list_resources](#4-ckan_list_resources)
5. [ckan_find_relevant_datasets](#5-ckan_find_relevant_datasets)
6. [ckan_organization_list](#6-ckan_organization_list)
7. [ckan_organization_show](#7-ckan_organization_show)
8. [ckan_organization_search](#8-ckan_organization_search)
9. [ckan_datastore_search](#9-ckan_datastore_search)
10. [ckan_datastore_search_sql](#10-ckan_datastore_search_sql)

---

## 1. ckan_status_show

Check server availability and version.

```bash
ckanapi action status_show -r https://www.dati.gov.it/opendata/
```

**jq formatting**:

```bash
ckanapi action status_show -r https://www.dati.gov.it/opendata/ | jq '{ckan_version, site_title, site_url}'
```

---

## 2. ckan_package_search

Search datasets using Solr query syntax.

### Parameters

| Parameter | ckanapi syntax | Example |
|-----------|---------------|---------|
| q | `q='...'` | `q='ambiente'` |
| fq | `fq='...'` | `fq='organization:regione-toscana'` |
| rows | `rows:N` | `rows:10` |
| start | `start:N` | `start:20` |
| sort | `sort='...'` | `sort='metadata_modified desc'` |
| facet.field | `facet.field:'[...]'` | `facet.field:'["organization","tags"]'` |
| facet.limit | `facet.limit:N` | `facet.limit:50` |
| include_private | `include_private:true` | `include_private:true` |

### Page-based pagination

MCP tool has `page` and `page_size`. Convert to `start` and `rows`:

```bash
# page=3, page_size=10 -> start=20, rows=10
ckanapi action package_search q='ambiente' rows:10 start:20 -r URL/
```

### Examples

```bash
# All datasets count
ckanapi action package_search q='*:*' rows:0 -r https://www.dati.gov.it/opendata/

# Boolean operators
ckanapi action package_search q='(title:water OR title:climate) AND NOT title:sea' rows:10 -r URL/

# Wildcard
ckanapi action package_search q='title:environment*' rows:10 -r URL/

# Fuzzy search
ckanapi action package_search q='title:health~2' rows:10 -r URL/

# Date range
ckanapi action package_search q='metadata_modified:[2024-01-01T00:00:00Z TO 2024-12-31T23:59:59Z]' -r URL/

# Date math (NOW syntax)
ckanapi action package_search q='metadata_modified:[NOW-6MONTHS TO *]' rows:10 -r URL/

# Facets by organization
ckanapi action package_search q='*:*' rows:0 facet.field:'["organization"]' facet.limit:50 -r URL/

# Filter by organization
ckanapi action package_search fq='organization:regione-siciliana' rows:10 -r URL/

# Boosting
ckanapi action package_search q='title:climate^2 OR notes:climate' rows:10 -r URL/

# Field existence
ckanapi action package_search q='organization:* AND num_resources:[1 TO *]' rows:10 -r URL/
```

### jq formatting

```bash
# Compact results table
ckanapi action package_search q='ambiente' rows:10 -r URL/ | jq '.results[] | {name, title, organization: .organization.title, modified: .metadata_modified, resources: .num_resources}'

# Count only
ckanapi action package_search q='ambiente' rows:0 -r URL/ | jq '.count'

# Extract facets
ckanapi action package_search q='*:*' rows:0 facet.field:'["organization"]' -r URL/ | jq '.search_facets.organization.items | sort_by(-.count) | .[:10][] | "\(.display_name // .name): \(.count)"'

# Titles and IDs only
ckanapi action package_search q='trasporti' rows:20 -r URL/ | jq -r '.results[] | "\(.name)\t\(.title)"'
```

---

## 3. ckan_package_show

Get complete metadata for a dataset.

### Parameters

| Parameter | ckanapi syntax | Example |
|-----------|---------------|---------|
| id | `id=...` | `id=dataset-name` or `id=UUID` |
| include_tracking | `include_tracking:true` | `include_tracking:true` |

### Examples

```bash
# By name
ckanapi action package_show id=listino-vaccini -r https://www.dati.gov.it/opendata/

# By UUID
ckanapi action package_show id=abc-123-def -r URL/

# With tracking stats
ckanapi action package_show id=dataset-name include_tracking:true -r URL/
```

### jq formatting

```bash
# Basic info
ckanapi action package_show id=dataset-name -r URL/ | jq '{id, name, title, organization: .organization.title, license: .license_title, state, created: .metadata_created, modified: .metadata_modified, notes: (.notes // "" | .[0:200])}'

# Tags
ckanapi action package_show id=dataset-name -r URL/ | jq '[.tags[].name]'

# Groups
ckanapi action package_show id=dataset-name -r URL/ | jq '[.groups[] | {name, title}]'

# Resources summary
ckanapi action package_show id=dataset-name -r URL/ | jq '[.resources[] | {name, id, format, url, datastore_active, size}]'

# Extras
ckanapi action package_show id=dataset-name -r URL/ | jq '[.extras[] | {(.key): .value}] | add'

# Download URLs
ckanapi action package_show id=dataset-name -r URL/ | jq -r '.resources[].url'
```

---

## 4. ckan_list_resources

List resources in a dataset with compact summary. Uses `package_show` + jq.

### All resources

```bash
ckanapi action package_show id=dataset-name -r URL/ | jq '[.resources[] | {name: (.name // "Unnamed"), id, format: (.format // "Unknown"), datastore_active: (.datastore_active // false), url}]'
```

### Filter by format

```bash
# CSV only
ckanapi action package_show id=dataset-name -r URL/ | jq '[.resources[] | select((.format // "") | ascii_upcase == "CSV") | {name: (.name // "Unnamed"), id, format, datastore_active: (.datastore_active // false), url}]'

# JSON only
ckanapi action package_show id=dataset-name -r URL/ | jq '[.resources[] | select((.format // "") | ascii_upcase == "JSON") | {name: (.name // "Unnamed"), id, format, url}]'
```

### Find DataStore-enabled resources

```bash
ckanapi action package_show id=dataset-name -r URL/ | jq '[.resources[] | select(.datastore_active == true) | {name, id, format}]'
```

### Markdown table output

```bash
ckanapi action package_show id=dataset-name -r URL/ | jq -r '
  "| Name | Format | DataStore | ID |",
  "| --- | --- | --- | --- |",
  (.resources[] | "| \(.name // "Unnamed" | .[0:40]) | \(.format // "?") | \(if .datastore_active then "Yes" else "No" end) | `\(.id)` |")'
```

---

## 5. ckan_find_relevant_datasets

Find and rank datasets by relevance. Requires fetching results + local scoring.

### Two-step approach

```bash
# Step 1: Fetch candidates (5x the desired limit)
ckanapi action package_search q='mobilita urbana' rows:50 -r URL/ > /tmp/ckan_results.json

# Step 2: Score and rank with jq
cat /tmp/ckan_results.json | jq --arg query "mobilita urbana" '
  .results | map({
    name, title, id,
    organization: (.organization.title // .organization.name // ""),
    tags: [(.tags // [])[] | .name],
    modified: .metadata_modified,
    score: (
      (if (.title // "" | test($query; "i")) then 4 else 0 end) +
      (if (.notes // "" | test($query; "i")) then 2 else 0 end) +
      (if ([(.tags // [])[] | .name] | any(test($query; "i"))) then 3 else 0 end) +
      (if (.organization.title // "" | test($query; "i")) then 1 else 0 end)
    )
  }) | sort_by(-.score) | .[:10]'
```

### Single-term scoring (simpler)

```bash
ckanapi action package_search q='trasporti' rows:50 -r URL/ | jq '
  .results | map({
    name, title,
    score: (
      (if (.title // "" | test("trasporti"; "i")) then 4 else 0 end) +
      (if (.notes // "" | test("trasporti"; "i")) then 2 else 0 end) +
      (if ([(.tags // [])[] | .name] | any(test("trasporti"; "i"))) then 3 else 0 end)
    )
  }) | sort_by(-.score) | .[:10] | .[] | "\(.score)\t\(.name)\t\(.title)"'
```

---

## 6. ckan_organization_list

List all organizations on a CKAN portal.

### Parameters

| Parameter | ckanapi syntax | Example |
|-----------|---------------|---------|
| all_fields | `all_fields:true` | Full objects vs names |
| sort | `sort='...'` | `sort='package_count desc'` |
| limit | `limit:N` | `limit:100` |
| offset | `offset:N` | `offset:0` |

### Examples

```bash
# Names only
ckanapi action organization_list -r URL/

# With details
ckanapi action organization_list all_fields:true limit:20 -r URL/

# Sort by dataset count
ckanapi action organization_list all_fields:true sort='package_count desc' limit:10 -r URL/
```

### Count only (limit=0 equivalent)

The MCP tool's `limit=0` mode uses faceting to count organizations with datasets:

```bash
ckanapi action package_search q='*:*' rows:0 facet.field:'["organization"]' facet.limit:-1 -r URL/ | jq '.search_facets.organization.items | length'
```

### jq formatting

```bash
# Compact table
ckanapi action organization_list all_fields:true -r URL/ | jq -r '.[] | "\(.name)\t\(.title // .name)\t\(.package_count // 0) datasets"'

# Top 10 by datasets
ckanapi action organization_list all_fields:true sort='package_count desc' limit:10 -r URL/ | jq '.[] | {name, title, package_count}'
```

---

## 7. ckan_organization_show

Get details for a specific organization.

### Parameters

| Parameter | ckanapi syntax | Example |
|-----------|---------------|---------|
| id | `id=...` | `id=regione-toscana` |
| include_datasets | `include_datasets:true` | Default: true |
| include_users | `include_users:true` | Default: false |

### Examples

```bash
# With datasets
ckanapi action organization_show id=regione-toscana include_datasets:true -r URL/

# With users
ckanapi action organization_show id=regione-toscana include_users:true -r URL/

# Minimal (no datasets)
ckanapi action organization_show id=regione-toscana include_datasets:false -r URL/
```

### jq formatting

```bash
# Summary
ckanapi action organization_show id=regione-toscana -r URL/ | jq '{id, name, title, description: (.description // "" | .[0:200]), package_count, created, state}'

# Dataset list
ckanapi action organization_show id=regione-toscana include_datasets:true -r URL/ | jq '[.packages[:20][] | {name, title}]'

# Users
ckanapi action organization_show id=regione-toscana include_users:true -r URL/ | jq '[.users[] | {name, capacity}]'
```

---

## 8. ckan_organization_search

Search organizations by name pattern. Uses `package_search` faceting.

```bash
# Search for organizations matching "toscana"
ckanapi action package_search q='organization:*toscana*' rows:0 facet.field:'["organization"]' facet.limit:500 -r URL/
```

### jq formatting

```bash
# Extract matching organizations with counts
ckanapi action package_search q='organization:*toscana*' rows:0 facet.field:'["organization"]' -r URL/ | jq '.search_facets.organization.items[] | {name, display_name, count}'

# Markdown table
ckanapi action package_search q='organization:*salute*' rows:0 facet.field:'["organization"]' -r URL/ | jq -r '
  "| Organization | Datasets |",
  "| --- | --- |",
  (.search_facets.organization.items[] | "| \(.display_name // .name) | \(.count) |")'
```

---

## 9. ckan_datastore_search

Query tabular data from DataStore-enabled resources.

**Important**: Not all portals have DataStore. Use `dati.comune.messina.it` or `open.canada.ca/data/` for testing.

### Parameters

| Parameter | ckanapi syntax | Example |
|-----------|---------------|---------|
| resource_id | `resource_id=...` | `resource_id=UUID` |
| q | `q='...'` | `q='Roma'` (full-text) |
| filters | `filters:'{"key":"val"}'` | `filters:'{"anno":2023}'` |
| limit | `limit:N` | `limit:100` (max: 32000) |
| offset | `offset:N` | `offset:0` |
| fields | `fields='a,b,c'` | `fields='nome,anno'` |
| sort | `sort='...'` | `sort='anno desc'` |
| distinct | `distinct:true` | `distinct:true` |

### Find a DataStore resource ID

```bash
ckanapi action package_search q='*:*' rows:20 -r https://dati.comune.messina.it/ | jq -r '[.results[].resources[] | select(.datastore_active==true) | .id][0]'
```

### Examples

```bash
# Discover columns first (limit=0)
ckanapi action datastore_search resource_id=RESOURCE_ID limit:0 -r https://dati.comune.messina.it/

# Fetch data
ckanapi action datastore_search resource_id=RESOURCE_ID limit:100 -r https://dati.comune.messina.it/

# With filters
ckanapi action datastore_search resource_id=RESOURCE_ID limit:50 filters:'{"regione":"Sicilia"}' -r URL/

# With sort
ckanapi action datastore_search resource_id=RESOURCE_ID limit:100 sort='anno desc' -r URL/

# Specific fields
ckanapi action datastore_search resource_id=RESOURCE_ID limit:50 fields='nome,anno,valore' -r URL/

# Full-text search
ckanapi action datastore_search resource_id=RESOURCE_ID q='Roma' limit:50 -r URL/

# Distinct values
ckanapi action datastore_search resource_id=RESOURCE_ID fields='regione' distinct:true -r URL/
```

### jq formatting

```bash
# Column names and types
ckanapi action datastore_search resource_id=RESOURCE_ID limit:0 -r URL/ | jq '[.fields[] | select(.id != "_id") | {id, type}]'

# Records as table
ckanapi action datastore_search resource_id=RESOURCE_ID limit:10 -r URL/ | jq '.records[]'

# Total count
ckanapi action datastore_search resource_id=RESOURCE_ID limit:0 -r URL/ | jq '.total'

# Markdown table
ckanapi action datastore_search resource_id=RESOURCE_ID limit:10 -r URL/ | jq -r '
  (.fields | map(select(.id != "_id")) | map(.id) | join(" | ")) as $header |
  (.fields | map(select(.id != "_id")) | map("---") | join(" | ")) as $sep |
  "| \($header) |", "| \($sep) |",
  (.records[] | [.[] | tostring | .[0:80]] | join(" | ") | "| \(.) |")'
```

---

## 10. ckan_datastore_search_sql

Run SQL queries on DataStore resources.

### Parameters

| Parameter | ckanapi syntax | Example |
|-----------|---------------|---------|
| sql | `sql='...'` | `sql='SELECT * FROM "UUID" LIMIT 10'` |

**Important**: Resource IDs in SQL must be double-quoted.

### Examples

```bash
# Basic select
ckanapi action datastore_search_sql sql='SELECT * FROM "RESOURCE_ID" LIMIT 10' -r URL/

# Count
ckanapi action datastore_search_sql sql='SELECT COUNT(*) AS total FROM "RESOURCE_ID"' -r URL/

# Aggregation
ckanapi action datastore_search_sql sql='SELECT anno, COUNT(*) AS n FROM "RESOURCE_ID" GROUP BY anno ORDER BY anno' -r URL/

# With WHERE
ckanapi action datastore_search_sql sql='SELECT * FROM "RESOURCE_ID" WHERE regione = '"'"'Sicilia'"'"' LIMIT 50' -r URL/
```

### jq formatting

```bash
# Records only
ckanapi action datastore_search_sql sql='SELECT * FROM "RESOURCE_ID" LIMIT 10' -r URL/ | jq '.records'

# Column info
ckanapi action datastore_search_sql sql='SELECT * FROM "RESOURCE_ID" LIMIT 0' -r URL/ | jq '[.fields[] | {id, type}]'
```

---

## Data Analysis with DuckDB

After identifying a resource URL via `package_show`, analyze directly:

```bash
# Get CSV URL
URL=$(ckanapi action package_show id=dataset-name -r URL/ | jq -r '.resources[] | select(.format=="CSV") | .url' | head -1)

# Explore workflow
duckdb -jsonlines -c "DESCRIBE SELECT * FROM '$URL'"
duckdb -jsonlines -c "SUMMARIZE SELECT * FROM '$URL'"
duckdb -jsonlines -c "SELECT * FROM '$URL' USING SAMPLE 10"

# Query
duckdb -jsonlines -c "SELECT column_name, COUNT(*) FROM '$URL' GROUP BY column_name ORDER BY 2 DESC"
```

---

## Solr Query Syntax Cheatsheet

| Syntax | Example | Description |
|--------|---------|-------------|
| `field:value` | `title:water` | Field match |
| `AND` / `OR` / `NOT` | `water AND climate` | Boolean |
| `+required -excluded` | `+title:water -title:sea` | Required/excluded |
| `field:value*` | `title:environment*` | Wildcard |
| `field:value~` | `title:rest~1` | Fuzzy (edit distance) |
| `"phrase"~N` | `title:"climate change"~5` | Proximity |
| `[a TO b]` | `num_resources:[5 TO 10]` | Inclusive range |
| `{a TO b}` | `num_resources:{0 TO 100}` | Exclusive range |
| `[NOW-1YEAR TO *]` | `metadata_modified:[NOW-1YEAR TO *]` | Date math (native Solr fields only: `metadata_modified`, `metadata_created`) |
| `[ISO TO *]` | `issued:[2025-01-01T00:00:00Z TO *]` | Date range for extra fields (`issued`, `modified`) — use explicit ISO dates, NOW not supported |
| `field:*` | `organization:*` | Field exists |
| `-field:*` | `-organization:*` | Field missing |
| `field:value^N` | `title:climate^2` | Boost |
