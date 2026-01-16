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
4. Customize `dataset_view_url` and/or `organization_view_url` only if non-standard
5. Set `search.force_text_field: true` if the portal has query parser issues

### Example

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

### URL Placeholder Reference

| Placeholder | Description | Available In |
|-------------|-------------|--------------|
| `{id}` | Dataset UUID | `dataset_view_url` |
| `{name}` | Dataset/organization slug | Both URLs |
| `{server_url}` | Original API base URL | Both URLs |

### Related Code

- **URL Generation**: `src/utils/url-generator.ts`
- **Search Query Resolution**: `src/utils/search.ts`
- **Portal Matching**: Uses exact match on `api_url` or any `api_url_aliases`
