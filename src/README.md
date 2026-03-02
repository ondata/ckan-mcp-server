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

- **`search`** (object): Search behavior configuration
  - **`force_text_field`** (boolean): Force wrapping non-fielded queries in `text:(...)`
    - Default: `false`
    - Set to `true` for portals with restrictive query parsers that break on long OR queries
    - Example: dati.gov.it requires this to handle queries like `"hotel OR alberghi"`

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

### Adding a New Portal

1. Add entry to `portals` array
2. Set `id`, `name`, and `api_url` (required)
3. Add `api_url_aliases` if the portal has multiple URL variants
4. Set `api_path` if the portal uses non-standard API path (e.g., `/api/action/` instead of `/api/3/action/`)
5. Customize `dataset_view_url` and/or `organization_view_url` only if non-standard
6. Set `search.force_text_field: true` if the portal has query parser issues

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

**Note**: The `api_path` field was added in v0.4.37 to support portals like data.gov.uk that use `/api/action/` instead of the standard `/api/3/action/` endpoint.

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
| dati.gov.it/opendata | 🇮🇹 Italy | 2.10.3 | `force_text_field: true`; custom `dataset_view_url` and `organization_view_url` |
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
| data.europa.eu | 🇪🇺 EU | — | Not CKAN — uses proprietary API (`/api/hub/`) |
| data.opentransportdata.swiss | 🇨🇭 Switzerland | — | API on separate domain (`api.opentransportdata.swiss/ckan-api/`) and requires API key — not publicly accessible |
| datos.gob.es | 🇪🇸 Spain | — | Not CKAN — uses Linked Data API (`/apidata/`) with SPARQL endpoint |
| data.gouv.fr | 🇫🇷 France | — | Not CKAN — uses own API (`/api/1/`) |

### Related Code

- **URL Generation**: `src/utils/url-generator.ts`
- **Search Query Resolution**: `src/utils/search.ts`
- **Portal Matching**: Uses exact match on `api_url` or any `api_url_aliases`
- **API Path Resolution**: `src/utils/portal-config.ts` (`getPortalApiPath()`)
- **HTTP Client**: `src/utils/http.ts` (uses dynamic API paths)
