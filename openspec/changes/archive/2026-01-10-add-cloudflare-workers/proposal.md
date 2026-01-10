# Proposal: Add Cloudflare Workers Deployment

## Change ID
`add-cloudflare-workers`

## Summary
Enable deployment of CKAN MCP Server to Cloudflare Workers platform, providing global HTTP access to the server without requiring local installation.

## Motivation

### Problem
Currently, CKAN MCP Server can only run:
- Locally via stdio mode (Claude Desktop integration)
- Self-hosted via HTTP mode (requires Node.js runtime, port management, server maintenance)

This limits accessibility for users who want to use the server remotely without managing infrastructure.

### Solution
Deploy to Cloudflare Workers - a serverless platform ideal for this use case:
- **Stateless architecture**: Server makes no persistent state (only API calls to CKAN)
- **Read-only operations**: All tools are GET-only, perfect for edge deployment
- **Lightweight**: Small bundle size (~50KB), fast cold starts
- **Free tier**: 100k requests/day sufficient for typical usage
- **Global edge**: Low latency worldwide
- **Zero maintenance**: No server management required

### Alternatives Considered
- **Railway** ($5/month credit): Overkill for stateless app, requires VM management
- **Fly.io** (3 free VMs): More infrastructure than needed
- **Render** (free tier): Spin-down after inactivity causes poor UX for MCP clients

## Goals

### Primary
- [ ] Deploy server to Cloudflare Workers
- [ ] Preserve all existing functionality (7 MCP tools, 3 resource templates)
- [ ] Provide public HTTPS endpoint: `https://ckan-mcp-server.<account>.workers.dev`
- [ ] Maintain stdio and self-hosted HTTP modes (no breaking changes)

### Secondary
- [ ] Document deployment process for contributors
- [ ] Add deployment scripts to package.json
- [ ] Test with multiple CKAN portals (dati.gov.it, data.gov, demo.ckan.org)

### Non-Goals
- Authentication/authorization (public read-only access is acceptable)
- Custom domain setup (workers.dev subdomain is sufficient)
- Rate limiting beyond Cloudflare's default (100k req/day is adequate)
- WebSocket support (MCP over HTTP uses SSE, which Workers supports)

## Impact Analysis

### Code Changes
- **New files**:
  - `src/worker.ts` (~80-100 lines): Workers entry point
  - `wrangler.toml` (~15 lines): Cloudflare configuration
  - `docs/DEPLOYMENT.md` (~100 lines): Deployment guide
- **Modified files**:
  - `package.json`: Add wrangler scripts and devDependency
  - `esbuild.config.js`: Add Workers build target (or create separate config)
  - `README.md`: Add deployment section
  - `LOG.md`: Document deployment capability

### Build System
- Add `wrangler` CLI as devDependency
- Create separate esbuild config for Workers (different entry point, output format)
- Workers build: `src/worker.ts` → `dist/worker.js` (ESM format, bundled)
- Existing builds unchanged (stdio/http modes still work)

### Testing
- Manual testing required: Deploy to workers.dev and test all 7 tools
- Integration tests already cover tool functionality
- No new automated tests needed (same MCP server logic)

### Documentation
- New `docs/DEPLOYMENT.md`: Step-by-step deployment guide
- Update `README.md`: Add "Deployment" section with 3 options (local, self-hosted, Cloudflare)
- Update `docs/future-ideas.md`: Move item from backlog to implemented

### Dependencies
- **New devDependency**: `wrangler` (Cloudflare CLI)
- **No new runtime dependencies**: Workers runtime provides fetch/Request/Response APIs

## User Experience

### Before
Users must:
1. Install Node.js and npm
2. Clone repository or install via npm
3. Run server locally (stdio or HTTP mode)
4. Configure Claude Desktop with local path

### After (Option 3)
Users can:
1. Use public endpoint directly: `https://ckan-mcp-server.<account>.workers.dev`
2. Configure Claude Desktop with HTTP URL (no local installation)
3. Access from any MCP client supporting HTTP transport

**Benefit**: Zero installation for end users who just want to query CKAN portals.

### For Contributors
Contributors can:
1. Fork repository
2. Run `npm run deploy` (after Cloudflare account setup)
3. Get personal Workers deployment for testing

## Risks and Mitigations

### Risk: API Rate Limits
- **Issue**: Cloudflare free tier limits to 100k req/day
- **Likelihood**: Low (typical usage << 100k/day)
- **Mitigation**: Document rate limits; users can deploy own Workers instance

### Risk: Workers Runtime Compatibility
- **Issue**: Node.js APIs may not work in Workers environment
- **Likelihood**: Low (server uses standard fetch/HTTP APIs)
- **Mitigation**: Test thoroughly; Workers supports most standard Web APIs

### Risk: Bundle Size Limits
- **Issue**: Workers free tier limits script size to 1MB
- **Likelihood**: Very low (current bundle ~50KB)
- **Mitigation**: Bundle analysis, treeshaking with esbuild

### Risk: Cold Start Latency
- **Issue**: First request after idle period may be slower
- **Likelihood**: Medium (Workers spin down after inactivity)
- **Mitigation**: Document expected latency; acceptable for MCP use case

## Success Criteria

### Must Have
- [ ] Server deploys successfully to Cloudflare Workers
- [ ] All 7 MCP tools work identically to local/self-hosted modes
- [ ] Public HTTPS endpoint accessible from Claude Desktop
- [ ] Response times < 5 seconds for typical CKAN queries
- [ ] Documentation complete (DEPLOYMENT.md with screenshots)

### Nice to Have
- [ ] Deployment CI/CD via GitHub Actions
- [ ] Monitoring/analytics dashboard
- [ ] Multiple environment support (dev, staging, prod)

## Timeline Estimate

**Total**: 4-6 hours of focused work (spread over multiple sessions for user learning)

### Phase 1: Setup and Configuration (1-2 hours)
- Install wrangler CLI
- Create Cloudflare account (free)
- Initialize Workers project
- Configure wrangler.toml

### Phase 2: Code Adaptation (1-2 hours)
- Create src/worker.ts adapter
- Update build configuration
- Test local build with `wrangler dev`

### Phase 3: Deployment and Testing (1 hour)
- Deploy to workers.dev
- Test all 7 tools with curl/Claude Desktop
- Verify with multiple CKAN portals

### Phase 4: Documentation (1 hour)
- Write DEPLOYMENT.md
- Update README.md
- Add LOG.md entry

## Open Questions

1. **Cloudflare Account**: Do you already have a Cloudflare account, or do we need to create one?
2. **Workers Subdomain**: Are you okay with `ckan-mcp-server.<account>.workers.dev`, or do you want a custom workers.dev name?
3. **Public Access**: Are you comfortable with the endpoint being publicly accessible (read-only, no auth)?
4. **Environment Variables**: Do we need any configurable settings (e.g., default CKAN server, rate limits)?

## Next Steps

1. User reviews and approves this proposal
2. User answers open questions
3. Create `tasks.md` with ordered, step-by-step work items
4. Create `design.md` with architectural details
5. Create spec delta in `specs/cloudflare-deployment/spec.md`
6. Validate proposal with `openspec validate add-cloudflare-workers --strict`
7. Begin implementation in `openspec:apply` phase (only after approval)
