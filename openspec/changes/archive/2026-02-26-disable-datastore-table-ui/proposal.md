# Disable DataStore Table UI

## Summary

Temporarily disable the MCP Apps Table UI component (`datastore-table-ui`) without deleting any code. The UI was added in v0.4.40 but needs use-case design before going further.

## Motivation

The DataStore Table Viewer is feature-complete but the use case needs proper design before evolving it further. Disabling it (rather than deleting) keeps the code intact for future re-activation while removing it from the active tool/resource registration paths.

## Scope

- **Comment out** UI resource registration (not delete files)
- **Revert** `registerAppTool` → `server.tool` in `datastore.ts` and `package.ts` (remove ext-apps dependency from tools)
- **Remove** `_meta.ui` and `structuredContent` from tool responses
- **Skip** UI resource registration in `resources/index.ts`
- **Keep** all source files (`src/ui/`, `src/resources/datastore-table-ui.ts`) untouched
- **Keep** test file but skip UI-specific tests

## Non-goals

- Deleting any files
- Removing `@modelcontextprotocol/ext-apps` from `package.json` (other code may use it later)
- Redesigning the table UI
