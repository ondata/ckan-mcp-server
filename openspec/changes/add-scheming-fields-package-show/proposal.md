# Change: Show ckanext-scheming root fields in ckan_package_show

## Why
`ckan_package_show` carries a fixed list of fields (DCAT-AP_IT in Markdown, a compact list in JSON) and drops the rest. On a portal that uses ckanext-scheming the rest is where the portal's own metadata lives. On open.canada.ca a dataset ("Air quality") has 37 root fields that never reach the caller; keywords, geographic and temporal coverage, subject and contacts among them. The schema (`scheming_dataset_schema_show`) says which fields the portal declares and what each is called. Issue #575.

## What Changes
- `ckan_package_show` asks the portal for the schema of the dataset's own type (`type=<result.type>`) and adds the schema's root fields that have a value as `fields: [{ field, label, value }]` in JSON, and as a **Fields (from the portal's metadata schema)** section in Markdown.
- `label` is the schema's label (English when it gives one per language, else the first, else the field name). `value` is as stored: translated values stay `{ "en": ..., "fr": ... }` and codes stay codes. No `lang` argument, no replacing of codes by labels. A string over 2000 characters is cut and nesting deeper than 4 levels is replaced by a marker; the field then carries `truncated: true` (JSON) or a note (Markdown).
- Left out of `fields`: empty values, fields that same output already shows (title, notes, tags, resources, organization and the DCAT-AP_IT fields; which ones differ between Markdown and JSON, and a field counts as shown only when it is really rendered, for example a `temporal_coverage` the tool cannot parse is still added), names kept in `extras` (Markdown only, since JSON drops `extras`), and fields the schema hides (`display_snippet: null`). A malformed schema entry is skipped.
- Any failure to get the schema (404, 400 "action not known", timeout, 5xx) means "no schema": nothing is added, nothing is reported to the caller. The negative result is cached (an hour for 404 and 400, five minutes otherwise), so the extra request is paid once.
- In JSON, `fields` goes through the existing safe truncation (`fields` is one of the shrinkable keys, shortened after `resources` and `tags`), so the output stays valid JSON under the character limit.
- Every string from the schema or the data is stripped of control characters and capped, and in Markdown goes through `sanitizeInline` / `wrapUntrusted`.

## Impact
- Affected specs: `ckan-package-metadata` (shared with the not yet archived `add-temporal-coverage-package-show`, which introduces it)
- Affected code: `src/utils/scheming.ts` (new), `src/tools/package.ts`, `tests/unit/scheming.test.ts`, `tests/integration/package-show-scheming.test.ts`, `tests/smoke/cases.json`, `scripts/smoke.mjs`, `docs/JSON-OUTPUT.md`, `README.md`, `CLAUDE.md`, `LOG.md`
- One more request per `package_show` on a portal whose schema is not cached.
