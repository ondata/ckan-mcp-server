# Source Code Documentation

## `portals.json`

Configuration file for CKAN portal-specific behaviors and URL patterns.

### Structure

```json
{
  "portals": [...],
  "defaults": {...}
}
```

### Portal Entry Fields

Each entry in `portals` array supports:

#### Required Fields

- **`id`** (string): Unique identifier for the portal (e.g., `"dati-gov-it"`)
- **`name`** (string): Human-readable portal name (e.g., `"dati.gov.it"`)
- **`api_url`** (string): Primary CKAN API base URL (e.g., `"https://www.dati.gov.it/opendata"`)

#### Optional Fields

- **`api_url_aliases`** (string[]): Alternative API URLs that should map to this portal
  - Used for matching when users provide different URL variants
  - Example: `["https://dati.gov.it/opendata", "http://www.dati.gov.it/opendata"]`

- **`api_path`** (string): Custom API endpoint path
  - Default: `"/api/3/action"` (standard CKAN v3 API)
  - Use this for portals with non-standard API paths
  - Example: `"/api/action"` (for portals like data.gov.uk that omit the version number)
  - **Added in v0.4.37** to support portals with custom API structures

- **`dataset_view_url`** (string): Custom URL template for viewing datasets
  - Placeholders: `{id}`, `{name}`, `{server_url}`
  - Default if omitted: `"{server_url}/dataset/{name}"`
  - Example: `"https://www.dati.gov.it/view-dataset/dataset?id={id}"`

- **`organization_view_url`** (string): Custom URL template for viewing organizations
  - Placeholders: `{name}`, `{server_url}`
  - Default if omitted: `"{server_url}/organization/{name}"`
  - Example: `"https://www.dati.gov.it/view-dataset?organization={name}"`

- **`normalize`** (string): Response normalization mode for portals with non-standard field structures
  - Omit for standard CKAN portals (default behavior, no normalization applied)
  - `"multilingual"`: enables normalization for portals that return multilingual fields as objects
    instead of plain strings (e.g. `title: {"en": "...", "fr": "..."}`) and store dataset title
    in a `translation` object rather than the `title` field directly
  - Example: data.europa.eu requires this due to its DCAT-AP based field structure

- **`search`** (object): Search behavior configuration
  - **`force_text_field`** (boolean): forces `text:(...)` wrapping on non-fielded queries.
    Still honoured if present, but **no portal sets it any more** and new ones should not:
    the decision is measured at runtime by `probePortalParser()` in `src/tools/package.ts`.
    The stored values went stale and were removed on 2026-09-05.

### Defaults

The `defaults` object provides fallback values when a portal is not found in the registry:

```json
{
  "dataset_view_url": "{server_url}/dataset/{name}",
  "organization_view_url": "{server_url}/organization/{name}",
  "search": {
    "force_text_field": false
  }
}
```

### Query parser: when `text:(...)` wrapping is applied

`package_search` sends a colon-free query to Solr's **dismax** parser with `q.op=AND`,
`mm='2<-1 5<80%'` and `qf='name^4 title^4 tags^2 groups^2 text'` (`ckan/lib/search/query.py`).
dismax has no boolean syntax, so `A OR B` collapses into `A AND B`. A colon in the query
takes it off dismax, which is what wrapping it as `text:(A OR B)` exploits.

The same switch is why wrapping hurts everything else: it drops the `qf` boosts that rank
titles and tags first, searches the catch-all `text` field alone, and ANDs every term
instead of applying `mm`. Measured on dati.gov.it, 2026-09-05:

| query | plain | `text:(...)` |
|---|---|---|
| `ambiente` | 8047 | 8047 |
| `qualità aria Milano` | 650 | 51 |
| `defibrillatori Comune di Lecce` | 678 | 1 |
| `musei roma arte opere catalogo` | 9 | 0 |
| `aria OR Milano` | 59 | 3421 |

So the wrapper is applied **only to queries carrying a boolean operator**
(`mayNeedTextWrapping` in `src/utils/search.ts`), and only when the portal needs it.

`probePortalParser()` decides that per portal: it picks two terms that occur in the
catalog — single-word tag facets between 0.5% and 30% of the catalog, falling back to
frequent title words — and compares `A`, `B`, `A OR B` and `text:(A OR B)`. An `A OR B`
returning fewer hits than `A` or `B` alone is not being honoured; the wrapper is the answer
only if the wrapped form returns more. On `data.stadt-zuerich.ch` the `text` field returns 0
for every query, so the probe correctly declines to wrap there.

Cost: nothing for a plain query, 5 extra `rows=0` calls the first time a boolean query hits
a portal in a session, nothing afterwards (cached, negative verdicts included).

### Adding a New Portal

1. Add entry to `portals` array
2. Set `id`, `name`, and `api_url` (required)
3. Add `api_url_aliases` if the portal has multiple URL variants
4. Set `api_path` if the portal uses non-standard API path (e.g., `/api/action/` instead of `/api/3/action/`)
5. Customize `dataset_view_url` and/or `organization_view_url` only if non-standard
6. Leave `search.force_text_field` unset: the runtime probe decides
7. Set `normalize: "multilingual"` if the portal uses multilingual/DCAT-AP field structures

**Note**: To determine the correct `api_path`, test the portal's API endpoints:
```bash
# Test standard CKAN v3 path (default)
curl "https://portal.example.com/api/3/action/package_search?q=test&rows=1"

# Test alternative path (if above fails with 404)
curl "https://portal.example.com/api/action/package_search?q=test&rows=1"
```

### Examples

#### Standard CKAN Portal

```json
{
  "id": "my-portal",
  "name": "My Custom Portal",
  "api_url": "https://data.example.com/api",
  "api_url_aliases": [
    "http://data.example.com/api"
  ],
  "search": {
    "force_text_field": false
  },
  "dataset_view_url": "https://portal.example.com/datasets/{name}",
  "organization_view_url": "https://portal.example.com/orgs/{name}"
}
```

#### Portal with Custom API Path (e.g., data.gov.uk)

```json
{
  "id": "data-gov-uk",
  "name": "data.gov.uk",
  "api_url": "https://data.gov.uk",
  "api_url_aliases": [
    "https://www.data.gov.uk",
    "http://data.gov.uk",
    "http://www.data.gov.uk"
  ],
  "api_path": "/api/action",
  "dataset_view_url": "https://data.gov.uk/dataset/{name}",
  "organization_view_url": "https://data.gov.uk/publisher/{name}"
}
```

#### Portal with Multilingual Field Structure (e.g., data.europa.eu)

```json
{
  "id": "data-europa-eu",
  "name": "data.europa.eu",
  "api_url": "https://data.europa.eu",
  "api_path": "/api/hub/search/ckan",
  "normalize": "multilingual",
  "dataset_view_url": "https://data.europa.eu/data/datasets/{id}"
}
```

### URL Placeholder Reference

| Placeholder | Description | Available In |
|-------------|-------------|--------------|
| `{id}` | Dataset UUID | `dataset_view_url` |
| `{name}` | Dataset/organization slug | Both URLs |
| `{server_url}` | Original API base URL | Both URLs |

### Known Portal Configurations

The following portals have been tested and verified (as of v0.4.37):

#### ✅ Working with Standard API Path (`/api/3/action/`)

| Portal | Country | CKAN Version | Notes |
|--------|---------|--------------|-------|
| dati.gov.it/opendata | 🇮🇹 Italy | 2.10.3 | Custom `dataset_view_url` and `organization_view_url` |
| dati.anticorruzione.it/opendata | 🇮🇹 Italy | — | Standard configuration |
| catalog.data.gov | 🇺🇸 USA | 2.11.4 | Standard configuration |
| open.canada.ca/data | 🇨🇦 Canada | 2.10.8 | Standard configuration |
| data.gov.au | 🇦🇺 Australia | 2.11.4 | Custom `dataset_view_url` and `organization_view_url` |
| ckan.opendata.swiss | 🇨🇭 Switzerland | — | Standard configuration |
| data.stadt-zuerich.ch | 🇨🇭 Switzerland | — | Custom `organization_view_url` (CKAN backend: `ckan-prod.zurich.datopian.com`) |
| ckan.govdata.de | 🇩🇪 Germany | — | Custom `dataset_view_url` and `organization_view_url` |

#### ✅ Working with Custom API Path

| Portal | Country | API Path | Notes |
|--------|---------|----------|-------|
| data.gov.uk | 🇬🇧 UK | `/api/action/` | `status_show` blocked, but search works |

#### ❌ Known Issues

| Portal | Country | Issue | Reason |
|--------|---------|-------|--------|
| data.europa.eu | 🇪🇺 EU | Poor search relevance, timeouts, no DataStore | DCAT-AP aggregator with CKAN-like endpoint — search scoring is non-standard, `name` fields are UUIDs, API response times are unpredictable |
| data.opentransportdata.swiss | 🇨🇭 Switzerland | — | API on separate domain (`api.opentransportdata.swiss/ckan-api/`) and requires API key — not publicly accessible |
| datos.gob.es | 🇪🇸 Spain | — | Not CKAN — uses Linked Data API (`/apidata/`) with SPARQL endpoint |
| data.gouv.fr | 🇫🇷 France | — | Not CKAN — uses own API (`/api/1/`) |

### Related Code

- **URL Generation**: `src/utils/url-generator.ts`
- **Search Query Resolution**: `src/utils/search.ts`
- **Portal Matching**: Uses exact match on `api_url` or any `api_url_aliases`
- **API Path Resolution**: `src/utils/portal-config.ts` (`getPortalApiPath()`)
- **Multilingual Normalization**: `src/utils/portal-config.ts` (`requiresMultilingualNormalization()`), applied in `src/tools/package.ts`
- **HTTP Client**: `src/utils/http.ts` (uses dynamic API paths)
