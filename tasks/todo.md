# Plan: Push Users to Local Node.js Installation

User wants to encourage everyone to install Node.js version locally instead of using Cloudflare Workers demo instance. Workers has 100k requests/day shared limit and may be discontinued.

## Goal

Strongly recommend local npm installation as primary method. Position Cloudflare Workers as demo/testing only.

## Phase 1: README Restructure ✅ COMPLETED

### Task 1.1: Add Banner at Top ✅
- [x] Add prominent banner after Features section
- [x] Format: "🚀 Recommended: Install locally"
- [x] Show command: `npm install -g @aborruso/ckan-mcp-server`
- [x] List benefits: No limits, Faster, Always available, Free
- [x] Note Workers is for testing only

### Task 1.2: Reorganize Installation Section ✅
- [x] Make "From npm" the ONLY method in Installation section
- [x] Move "From source" to Development section
- [x] Remove confusing "Usage Options" section
- [x] Add simple note: "Workers endpoint available for quick testing"

### Task 1.3: Update MCP Client Configuration ✅
- [x] Make npx/global install the primary examples
- [x] Move Workers HTTP config to end as "Testing only" option
- [x] Add warning about 100k/month shared limit in each Workers example

## Phase 2: Worker Response Footer (MOST VISIBLE) ✅ COMPLETED

### Task 2.1: Add Footer to All Tool Responses on Workers ✅
- [x] Detect if running on Workers (via `typeof WorkerGlobalScope !== 'undefined'`)
- [x] Add footer to markdown responses when on Workers:
  ```
  ---
  ℹ️ Demo instance (100k requests/day shared quota). For unlimited access: https://github.com/ondata/ckan-mcp-server#installation
  ```
- [x] Add utility functions `isWorkers()` and `addDemoFooter()` in `src/utils/formatting.ts`
- [x] Apply to all tool handlers (package, organization, datastore, status, tag, group, quality)

### Task 2.2: Add HTTP Headers to Worker (for debugging) ✅
- [x] Edit `src/worker.ts`
- [x] Add `X-Service-Notice: Demo instance - 100k requests/day shared quota`
- [x] Add `X-Recommendation: https://github.com/ondata/ckan-mcp-server#installation`
- [x] Add these headers to /mcp endpoint responses

## Phase 3: Server Info Tool

### Task 3.1: Create `server_info` Tool
- [ ] Create new tool in `src/tools/status.ts` or separate file
- [ ] Return instance type (demo/local)
- [ ] Show installation command
- [ ] List benefits of local install
- [ ] Only show for Workers instances (detect via env)

### Task 3.2: Update Documentation
- [ ] Add `server_info` to Available Tools section in README
- [ ] Document in CLAUDE.md
- [ ] Add test in `tests/integration/status.test.ts`

## Phase 4: Review and Test

### Task 4.1: Check All References
- [ ] Search README for all Workers URL mentions
- [ ] Add warning notes to each mention
- [ ] Verify tone is helpful but firm

### Task 4.2: Test Worker Headers
- [ ] Deploy to Cloudflare
- [ ] Verify headers present in responses
- [ ] Test with curl

## Questions

- Should `server_info` be a separate tool or added to `ckan_status_show`?
- Include "deprecation warning" language or just "recommended local"?
- Add header to health endpoint too?

---

**Priority**: Phase 1 (README) is most important
**Effort**: ~2-3 hours total
**Breaking Changes**: None (only docs + new tool)
