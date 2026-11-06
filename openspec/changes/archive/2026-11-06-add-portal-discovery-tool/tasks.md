> Reconciled with the code on 2026-11-06. Ticked: verified in the current code, tests or tags. Unticked: not done, or no longer verifiable.

## 1. Implementation
- [x] 1.1 Create `src/tools/portal-discovery.ts` with `registerPortalDiscoveryTools(server)` (name changed from the proposal)
- [x] 1.2 Add `ckan_find_portals` tool with `country` and `query` params
- [x] 1.3 Fetch and cache datashades.info list (now through the shared cache, 6 hours)
- [x] 1.4 Register tool in `src/server.ts`
- [x] 1.5 Add integration tests in `tests/integration/portal-discovery.test.ts`
- [x] 1.6 Build + test

## 2. Docs
- [x] 2.1 Update README tool list
