# Design: DataStore source citation

## Context

`datastore_search` returns `resource_id` but not the dataset. `resource_show` returns `package_id`, `name` and `url` (the file). Checked 2026-10-26 on `dati.comune.messina.it`, resource `fce8cc08-6654-4c00-bf94-e3157d5da534` → `package_id 08f64302-…`, `url …/download/indirizzario.csv`.

## Decisions

### Source shape

```json
{
  "resource_id": "fce8cc08-…",
  "resource_name": "Indirizzario – formato CSV",
  "dataset_url": "https://dati.comune.messina.it/dataset/08f64302-…",
  "download_url": "https://dati.comune.messina.it/dataset/…/download/indirizzario.csv",
  "api_url": "https://dati.comune.messina.it/api/3/action/datastore_search?resource_id=fce8cc08-…"
}
```

`resource_id` and `api_url` are always present (built locally, using the portal API path from `getPortalApiPath`). The other fields are present only when `resource_show` succeeded and returned them. `api_url` points to the resource, not to the exact filtered call: the SQL text is already printed, and encoding filters into a URL would add length without adding a source.

### Dataset URL

Built with `getDatasetViewUrl`, so per-portal templates in `portals.json` apply. The default template is `{server_url}/dataset/{name}`: CKAN core resolves `/dataset/<uuid>` as well as `/dataset/<name>` (checked 2026-10-26, `https://dati.comune.messina.it/dataset/08f64302-54e3-4d77-be2b-e9f2abaa1194` → 200), so the default case passes `package_id` as both id and name, with no extra call. Only a portal whose custom template uses `{name}` gets a `package_show` (cached) to obtain the real name; if that fails, the dataset URL is omitted rather than built wrong.

### Latency

`resource_show` runs in `Promise.all` with the data query. Errors are caught per resource and never propagate. On a portal whose custom template uses `{name}`, `package_show` has to follow `resource_show`, so a cold lookup there costs two upstream requests and the response waits for the slower of the data query and that sequence. No extra call on the error path of the data query.

### SQL resources

Resource ids are taken from double-quoted identifiers matching the UUID pattern and deduplicated. Metadata lookups are capped at 5 per call, to bound upstream requests; ids beyond the cap still get a source with `resource_id` and `api_url`, which need no call, so no queried UUID goes uncited. Non-UUID aliases are not cited: CKAN resource ids are UUIDs in practice, and parsing SQL properly is out of scope.

### Channels (user decision 2026-10-26)

`structuredContent.sources` is returned in both formats, OKFN-style. Risk recorded: an MCP client that prefers `structuredContent` over text when both are present could show `{ sources }` instead of the Markdown table. Mitigation: the Markdown text is unchanged apart from the added section, and the spec requires the text channel to remain complete; if a client is found to drop the text, revisit.

### Truncation

Portal-provided strings are untrusted and unbounded. `resource_name` goes through `cleanText` (and `sanitizeInline` in Markdown), which also caps its length; `dataset_url` and `download_url` are kept only if they are http(s) and within a fixed length, otherwise omitted.

Markdown: the Sources section sits before Fields and Records, so `truncateText` (which cuts the tail) keeps it. JSON: `sources` is not in `SHRINKABLE_KEYS`, so records go first.

If the response still does not fit, sources degrade in steps, in both channels: first every source is reduced to `resource_id` and `api_url`, then only the sources that fit are kept and `sources_omitted` gives the count of the others. The limit always wins over the citation, and the omission is always stated.

## Non-goals

- No source contract enforced at registration for every tool (OKFN-style). Other tools already link datasets; this change closes the DataStore gap only.
- No MCP App UI changes.
