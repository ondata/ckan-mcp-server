# Cite the source of every DataStore result

## Why

`ckan_datastore_search` and `ckan_datastore_search_sql` are the tools that return the numbers an answer is built on, and they are the only ones that do not say where those numbers come from. The Markdown output carries `**Server**` and the bare `Resource ID` (search) or the SQL text (SQL); there is no link to the resource, to its dataset, or to a call that reproduces the result. A reader cannot check a figure against the portal without first rebuilding the path to it.

The OKFN MCP Labs platform (https://mcp.okfn.org/docs/plugins/tool-results/) makes this a registration condition: a tool that does not declare `structuredContent.sources` is not exposed at all. Their field guide adds that traceability is the property testers relied on most to judge an answer. Our search and metadata tools already link datasets; the DataStore tools are the gap.

## What Changes

- Both DataStore tools resolve each queried resource with `resource_show` (cached, run in parallel with the data query) to obtain its dataset and file URL.
- Markdown output gains a **Sources** section near the top, before the records, so truncation of the table cannot cut it.
- Both formats return `structuredContent.sources`: in JSON mode `sources` is a field of the compact object (and so reaches `structuredContent` through `jsonToolResult`); in Markdown mode `structuredContent` is `{ sources }` alongside the text.
- `ckan_datastore_search` JSON mode switches from `truncateJson` to `jsonToolResult`, so it returns `structuredContent` like the SQL tool already does.
- For SQL, resources are the UUID-shaped double-quoted table names in the query (deduplicated). Metadata lookups stop at 5 per call; the other ids are cited with `resource_id` and `api_url` only.
- A failed `resource_show` never fails the tool: the source falls back to the reproducible API URL.

## Impact

- Affected specs: new capability `datastore-source-citation`
- Affected code: `src/tools/datastore.ts` (formatters, `compactDatastoreResult`, both handlers), possibly a small helper in `src/utils/url-generator.ts`; `docs/JSON-OUTPUT.md`
- One extra upstream call per uncached resource (`resource_show`, metadata TTL 300 s), in parallel with the data query. On a portal whose custom dataset template uses `{name}`, a second call (`package_show`, same TTL) follows it, which can lengthen the wait for the response
- Backwards compatible: additive Markdown section and additive JSON field. Error responses are unchanged.
