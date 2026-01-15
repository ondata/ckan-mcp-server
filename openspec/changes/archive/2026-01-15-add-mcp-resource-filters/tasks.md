## 1. Implementation
- [x] Add new resource handlers for group, organization datasets, tag, and format filters under `src/resources/`.
- [x] Register new resource templates in `src/resources/index.ts`.
- [x] Update URI parsing/validation to accept the new dataset filter paths.
- [x] Add tests for each new resource template and error cases.
- [x] Update README/docs with new `ckan://{server}/...` examples.

## 2. Validation
- [x] Run `npm test` (or targeted resource tests).
- [x] Run `openspec validate add-mcp-resource-filters --strict`.
