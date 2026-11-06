## 1. Implementation

- [x] 1.1 Add the optional `effectiveQuery` parameter to `compactSearchResult()`
- [x] 1.2 Pass it from the `ckan_package_search` JSON branch only when it differs from the
      caller's `q`
- [x] 1.3 Document the field in `docs/JSON-OUTPUT.md`, stating that it is absent when the
      query ran unchanged

## 2. Verification

- [x] 2.1 `npm test` green
- [x] 2.2 Release gate asserts both branches: `wrapped` on a boolean query where the portal
      needs it, `not_wrapped` on a plain query
- [x] 2.3 Confirmed against a live portal that a plain query carries no `effective_query`
      and `aria OR acqua` on dati.comune.milano.it carries `text:(aria OR acqua)`
