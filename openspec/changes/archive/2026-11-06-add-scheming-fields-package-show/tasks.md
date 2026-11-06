## 1. Implementation
- [x] 1.1 `getDatasetSchema()`: schema for the dataset type, any failure is "no schema", negative result cached
- [x] 1.2 `renderSchemaFields()`: root fields with label and stored value, skipping empty, already shown, extras and hidden
- [x] 1.3 JSON `fields` (through `truncateJson`) and Markdown section in `ckan_package_show`
- [x] 1.4 Unit tests: labels, skips, cache and failures, escaping in Markdown, JSON truncation
- [x] 1.4b Handler test through the registered tool (type, JSON and Markdown, 400/404, malformed schema)
- [x] 1.5 Smoke case against open.canada.ca
- [x] 1.6 `docs/JSON-OUTPUT.md`, README, CLAUDE.md
