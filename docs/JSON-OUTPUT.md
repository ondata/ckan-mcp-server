# JSON Output Schema

All CKAN MCP tools support `response_format: "json"` as an alternative to the default markdown output.

JSON responses are **compact**: they include only essential fields, dropping extras, relationships, tracking data, and other CKAN internal metadata. This reduces token usage by ~70% compared to raw CKAN API responses.

## Truncation

JSON output uses safe truncation (`truncateJson`): when a response exceeds the 50K character limit, it shrinks known arrays (results, records, resources, packages) instead of cutting mid-string. This guarantees valid JSON output.

---

## ckan_package_search

```json
{
  "count": 11855,
  "results": [
    {
      "id": "uuid",
      "name": "dataset-slug",
      "title": "Human-readable title",
      "notes": "Description truncated to 200 chars...",
      "organization": "Organization title or name",
      "tags": ["tag1", "tag2"],
      "num_resources": 6,
      "metadata_modified": "2026-02-28T10:00:40.659790"
    }
  ],
  "facets": { },
  "search_facets": { }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `count` | number | Total matching datasets |
| `results[].id` | string | Dataset UUID |
| `results[].name` | string | Machine-readable slug |
| `results[].title` | string | Human-readable title (falls back to name) |
| `results[].notes` | string\|null | Description, max 200 chars |
| `results[].organization` | string\|null | Organization title or name |
| `results[].tags` | string[] | Tag names only (no IDs) |
| `results[].num_resources` | number | Resource count |
| `results[].metadata_modified` | string | ISO timestamp |
| `facets` | object | Only present when facet_field was requested |
| `search_facets` | object | Only present when facet_field was requested |

**Dropped**: `extras`, `relationships`, `resources` (full objects), `tracking_summary`, all other CKAN fields.

---

## ckan_package_show

```json
{
  "id": "uuid",
  "name": "dataset-slug",
  "title": "Human-readable title",
  "notes": "Full description",
  "organization": {
    "name": "org-slug",
    "title": "Organization Name"
  },
  "tags": ["tag1", "tag2"],
  "state": "active",
  "license_title": "Creative Commons Attribution",
  "metadata_created": "2024-01-15T10:00:00.000000",
  "metadata_modified": "2026-02-28T10:00:40.659790",
  "issued": "2024-01-15",
  "modified": "2026-02-28",
  "author": "Author Name",
  "maintainer": "Maintainer Name",
  "resources": [
    {
      "id": "uuid",
      "name": "Resource name",
      "format": "CSV",
      "url": "https://...",
      "size": 12345,
      "datastore_active": true,
      "created": "2024-01-15T10:00:00.000000",
      "last_modified": "2026-02-28T10:00:00.000000"
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Dataset UUID |
| `name` | string | Machine-readable slug |
| `title` | string | Human-readable title |
| `notes` | string\|null | Full description (not truncated) |
| `organization` | object\|null | `{ name, title }` |
| `tags` | string[] | Tag names only |
| `state` | string | e.g. "active", "draft" |
| `license_title` | string\|null | License name |
| `metadata_created` | string\|null | ISO timestamp |
| `metadata_modified` | string\|null | ISO timestamp |
| `issued` | string\|null | Content publish date (may be absent) |
| `modified` | string\|null | Content update date (may be absent) |
| `author` | string\|null | |
| `maintainer` | string\|null | |
| `resources[].id` | string | Resource UUID |
| `resources[].name` | string\|null | |
| `resources[].format` | string\|null | e.g. "CSV", "JSON" |
| `resources[].url` | string\|null | Download URL |
| `resources[].size` | number\|null | Bytes |
| `resources[].datastore_active` | boolean\|null | Whether DataStore is enabled |
| `resources[].created` | string\|null | ISO timestamp |
| `resources[].last_modified` | string\|null | ISO timestamp |

**Dropped**: `extras`, `relationships`, `tracking_summary`, resource `mimetype`/`description`/`access_services`, all other CKAN fields.

---

## ckan_organization_list

```json
{
  "count": 150,
  "organizations": [
    {
      "id": "uuid",
      "name": "org-slug",
      "title": "Organization Name",
      "package_count": 42
    }
  ]
}
```

When `all_fields: false`, the array contains plain name strings instead of objects.

| Field | Type | Notes |
|-------|------|-------|
| `count` | number | Total organizations |
| `organizations[].id` | string | Organization UUID |
| `organizations[].name` | string | Machine-readable slug |
| `organizations[].title` | string | Human-readable name |
| `organizations[].package_count` | number | Dataset count |

**Dropped**: `description`, `image_url`, `created`, `users`, `extras`, all other CKAN fields.

---

## ckan_organization_show

```json
{
  "id": "uuid",
  "name": "org-slug",
  "title": "Organization Name",
  "description": "Full description",
  "image_url": "https://...",
  "package_count": 42,
  "created": "2020-01-01T00:00:00.000000",
  "packages": [
    {
      "id": "uuid",
      "name": "dataset-slug",
      "title": "Dataset Title",
      "metadata_modified": "2026-02-28T10:00:40.659790"
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Organization UUID |
| `name` | string | Machine-readable slug |
| `title` | string | Human-readable name |
| `description` | string\|null | |
| `image_url` | string\|null | Logo URL |
| `package_count` | number | Dataset count |
| `created` | string\|null | ISO timestamp |
| `packages[].id` | string | Dataset UUID |
| `packages[].name` | string | Dataset slug |
| `packages[].title` | string | Dataset title |
| `packages[].metadata_modified` | string\|null | ISO timestamp |

**Dropped**: `users`, `extras`, `groups`, full package objects.

---

## ckan_group_list

Same structure as `ckan_organization_list`, with `groups` instead of `organizations`:

```json
{
  "count": 20,
  "groups": [
    {
      "id": "uuid",
      "name": "group-slug",
      "title": "Group Name",
      "package_count": 15
    }
  ]
}
```

---

## ckan_group_show

Same structure as `ckan_organization_show`, without `image_url`:

```json
{
  "id": "uuid",
  "name": "group-slug",
  "title": "Group Name",
  "description": "Full description",
  "package_count": 15,
  "created": "2020-01-01T00:00:00.000000",
  "packages": [
    {
      "id": "uuid",
      "name": "dataset-slug",
      "title": "Dataset Title",
      "metadata_modified": "2026-02-28T10:00:40.659790"
    }
  ]
}
```

---

## ckan_datastore_search

```json
{
  "resource_id": "uuid",
  "fields": [
    { "id": "column_name", "type": "text" },
    { "id": "anno", "type": "int4" }
  ],
  "records": [
    { "column_name": "value", "anno": 2024 }
  ],
  "total": 1500
}
```

| Field | Type | Notes |
|-------|------|-------|
| `resource_id` | string\|null | Resource UUID |
| `fields` | array | Column definitions (`id` + `type`) |
| `records` | array | Row objects keyed by field name |
| `total` | number | Total record count (for pagination) |

**Dropped**: `_id` field (CKAN internal row ID) from both `fields` and `records`.

---

## ckan_datastore_search_sql

Same structure as `ckan_datastore_search`. The `_id` field is filtered out.

---

## Tools with already-compact JSON

These tools already return minimal JSON and were not changed:

- `ckan_find_relevant_datasets` — custom scored payload
- `ckan_list_resources` — slim resource summary
- `ckan_organization_search` — facet-based results
- `ckan_group_search` — facet-based results
- `ckan_tag_list` — plain tag list
- `ckan_analyze_datasets` — statistical summary
- `ckan_catalog_stats` — aggregate counts
- `ckan_status_show` — portal status
