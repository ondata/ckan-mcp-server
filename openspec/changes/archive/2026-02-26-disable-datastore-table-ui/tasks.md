# Tasks: Disable DataStore Table UI

## Ordered work items

1. **`src/tools/datastore.ts`**: Replace `registerAppTool` with `server.tool`, remove `_meta.ui` and `structuredContent`, remove imports from `ext-apps` and `datastore-table-ui`
2. **`src/tools/package.ts`**: Replace `registerAppTool` with `server.tool`, remove `_meta.ui`, remove imports from `ext-apps` and `datastore-table-ui`
3. **`src/resources/index.ts`**: Comment out `registerDatastoreTableUiResource` import and call
4. **`tests/integration/datastore-table-ui.test.ts`**: Skip the entire test suite with `describe.skip`
5. **Update any tests** that assert on `_meta.ui` or `structuredContent` in datastore/package tool responses
6. **`npm run build && npm test`**: Verify build succeeds and all non-skipped tests pass
7. **Update LOG.md** with the change

## Validation

- `npm run build` succeeds
- `npm test` passes (UI tests skipped, all others green)
- No runtime errors when using `ckan_datastore_search` or `ckan_package_search`
- Source files in `src/ui/` and `src/resources/datastore-table-ui.ts` remain untouched
