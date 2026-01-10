# Tasks: Add Cloudflare Workers Deployment

## Overview
Implementation broken into 4 phases with small, verifiable steps. Each task includes validation criteria.

---

## Phase 1: Environment Setup (Prerequisites)

### Task 1.1: Install Wrangler CLI
**Description**: Install Cloudflare's official CLI tool globally

**Steps**:
```bash
npm install -g wrangler
wrangler --version
```

**Validation**:
- `wrangler --version` shows version >= 3.0.0
- Command `wrangler` available in PATH

**Duration**: 2 minutes

---

### Task 1.2: Create Cloudflare Account
**Description**: Sign up for free Cloudflare account (if not already registered)

**Steps**:
1. Visit https://dash.cloudflare.com/sign-up
2. Create account with email/password
3. Verify email address

**Validation**:
- Can log into https://dash.cloudflare.com
- Workers section visible in dashboard

**Duration**: 5 minutes

**Note**: If you already have a Cloudflare account, skip to Task 1.3

---

### Task 1.3: Authenticate Wrangler
**Description**: Connect local Wrangler CLI to Cloudflare account

**Steps**:
```bash
wrangler login
```

**What happens**:
- Browser opens with Cloudflare login
- Click "Allow" to grant Wrangler access
- Terminal shows "Successfully logged in"

**Validation**:
```bash
wrangler whoami
```
Shows your Cloudflare account email

**Duration**: 2 minutes

---

### Task 1.4: Install Wrangler as Dev Dependency
**Description**: Add Wrangler to project dependencies for reproducible builds

**Steps**:
```bash
npm install --save-dev wrangler
```

**Validation**:
- `package.json` devDependencies includes `"wrangler": "^3.x.x"`
- `node_modules/.bin/wrangler` exists

**Duration**: 1 minute

---

## Phase 2: Workers Configuration

### Task 2.1: Create wrangler.toml
**Description**: Create Cloudflare Workers configuration file

**Steps**:
Create `wrangler.toml` in project root:

```toml
name = "ckan-mcp-server"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

[build]
command = "npm run build:worker"

[env.production]
name = "ckan-mcp-server"
```

**Validation**:
- File exists at project root
- `wrangler.toml` syntax is valid (no errors when running `wrangler dev`)

**Duration**: 2 minutes

**Dependencies**: Task 1.4 complete

---

### Task 2.2: Add Build Scripts to package.json
**Description**: Add npm scripts for building and deploying Workers

**Steps**:
Add to `package.json` scripts section:

```json
"build:worker": "node esbuild.worker.js",
"dev:worker": "wrangler dev",
"deploy": "npm run build:worker && wrangler deploy"
```

**Validation**:
- `npm run build:worker` command recognized (may fail until worker.ts exists)
- All 3 scripts visible in `npm run`

**Duration**: 2 minutes

**Dependencies**: Task 2.1 complete

---

### Task 2.3: Create esbuild.worker.js Configuration
**Description**: Separate build config for Workers bundle (different from Node.js bundle)

**Steps**:
Create `esbuild.worker.js`:

```javascript
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/worker.ts'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: [],  // Bundle everything for Workers
  minify: false,
  sourcemap: false,
});

console.log('✓ Workers build complete');
```

**Validation**:
- File exists in project root
- Running `node esbuild.worker.js` shows error about missing `src/worker.ts` (expected at this stage)

**Duration**: 3 minutes

**Dependencies**: Task 2.2 complete

---

## Phase 3: Code Implementation

### Task 3.1: Create src/worker.ts Entry Point
**Description**: Minimal Workers adapter that handles HTTP requests

**Steps**:
Create `src/worker.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export default {
  async fetch(request: Request): Promise<Response> {
    // Respond to health checks
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '0.4.0' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // TODO: Implement MCP protocol handling
    return new Response('CKAN MCP Server - Workers Mode', { status: 200 });
  }
};
```

**Validation**:
- `npm run build:worker` succeeds
- `dist/worker.js` created
- File size < 100KB

**Duration**: 5 minutes

**Dependencies**: Task 2.3 complete

---

### Task 3.2: Test Local Development Server
**Description**: Run Workers locally to verify basic setup

**Steps**:
```bash
npm run dev:worker
```

**What happens**:
- Wrangler starts local server on http://localhost:8787
- Terminal shows "Ready on http://localhost:8787"

**Validation**:
```bash
curl http://localhost:8787/health
```
Returns: `{"status":"ok","version":"0.4.0"}`

**Duration**: 2 minutes

**Dependencies**: Task 3.1 complete

**Note**: Keep wrangler dev running for next tasks

---

### Task 3.3: Implement MCP Protocol Handler
**Description**: Full Workers implementation with MCP server integration

**Steps**:
This is a larger task - update `src/worker.ts` to:
1. Import MCP server and all tool registrations
2. Handle POST /mcp endpoint
3. Process MCP JSON-RPC requests
4. Return JSON-RPC responses

**Validation**:
```bash
# Test with curl (wrangler dev still running)
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```
Returns list of 7 CKAN tools

**Duration**: 15-20 minutes

**Dependencies**: Task 3.2 complete

**Note**: We'll implement this together step-by-step

---

### Task 3.4: Test All MCP Tools Locally
**Description**: Verify each tool works in Workers environment

**Steps**:
Test each tool via curl:
1. `ckan_status_show` - server connectivity
2. `ckan_package_search` - basic search
3. `ckan_package_show` - dataset details
4. `ckan_organization_list` - list orgs
5. `ckan_organization_show` - org details
6. `ckan_organization_search` - search orgs
7. `ckan_datastore_search` - datastore query

**Validation**:
- All 7 tools return expected responses
- No HTTP 500 errors
- Response times < 30 seconds

**Duration**: 10 minutes

**Dependencies**: Task 3.3 complete

---

## Phase 4: Deployment and Documentation

### Task 4.1: Deploy to Cloudflare Workers
**Description**: First deployment to production Workers environment

**Steps**:
```bash
npm run deploy
```

**What happens**:
- Build runs (`npm run build:worker`)
- Wrangler uploads to Cloudflare
- Deployment URL shown: `https://ckan-mcp-server.<account>.workers.dev`

**Validation**:
```bash
curl https://ckan-mcp-server.<account>.workers.dev/health
```
Returns: `{"status":"ok","version":"0.4.0"}`

**Duration**: 3 minutes

**Dependencies**: Task 3.4 complete, Tasks 1.1-1.3 complete

---

### Task 4.2: Test Production Deployment
**Description**: Verify all tools work in production Workers environment

**Steps**:
Same as Task 3.4, but using production URL:
```bash
curl -X POST https://ckan-mcp-server.<account>.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Test all 7 tools with real CKAN portals:
- dati.gov.it
- demo.ckan.org
- catalog.data.gov

**Validation**:
- All tools return correct results
- HTTPS works (no certificate errors)
- Global access (test from different network if possible)

**Duration**: 10 minutes

**Dependencies**: Task 4.1 complete

---

### Task 4.3: Create Deployment Documentation
**Description**: Write comprehensive deployment guide for contributors

**Steps**:
Create `docs/DEPLOYMENT.md` with:
1. Prerequisites (Cloudflare account, wrangler CLI)
2. Step-by-step deployment instructions
3. Environment configuration
4. Troubleshooting common issues
5. Monitoring and logs access

**Validation**:
- File exists at `docs/DEPLOYMENT.md`
- Includes code examples for all steps
- Links to Cloudflare documentation

**Duration**: 20 minutes

**Dependencies**: Task 4.2 complete

---

### Task 4.4: Update README.md
**Description**: Add Workers deployment option to main README

**Steps**:
Add new "Deployment Options" section:

```markdown
## Deployment Options

### Option 1: Local Installation (stdio mode)
[existing instructions]

### Option 2: Self-Hosted HTTP Server
[existing instructions]

### Option 3: Cloudflare Workers ⭐ NEW
Deploy to Cloudflare's global edge network for public HTTP access.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

**Quick start**:
```bash
npm install -g wrangler
wrangler login
npm run deploy
```

Public endpoint: `https://ckan-mcp-server.<account>.workers.dev`
```

**Validation**:
- Section added after "Installation"
- Links to DEPLOYMENT.md work
- Code examples tested

**Duration**: 10 minutes

**Dependencies**: Task 4.3 complete

---

### Task 4.5: Update LOG.md
**Description**: Document deployment capability in changelog

**Steps**:
Add entry for today's date:

```markdown
## 2026-01-10

### Cloudflare Workers Deployment
- **Production deployment**: Server now available on Cloudflare Workers
  - Public endpoint: `https://ckan-mcp-server.<account>.workers.dev`
  - Global edge deployment (low latency worldwide)
  - Free tier: 100k requests/day
- **New files**: `src/worker.ts`, `wrangler.toml`, `esbuild.worker.js`
- **New scripts**: `build:worker`, `dev:worker`, `deploy`
- **Documentation**: Created DEPLOYMENT.md with step-by-step guide
- **Testing**: All 7 MCP tools verified in Workers environment
- **No breaking changes**: stdio and self-hosted HTTP modes still supported
```

**Validation**:
- Entry added at top of LOG.md
- Date is 2026-01-10
- Includes deployment URL

**Duration**: 3 minutes

**Dependencies**: Task 4.4 complete

---

### Task 4.6: Final Validation
**Description**: End-to-end test with Claude Desktop

**Steps**:
1. Configure Claude Desktop to use Workers endpoint
2. Test MCP integration with all tools
3. Verify response formatting (markdown/json)
4. Check error handling

**Validation**:
- Claude Desktop successfully connects to Workers endpoint
- All tools accessible from Claude interface
- Responses properly formatted
- No unexpected errors

**Duration**: 10 minutes

**Dependencies**: All previous tasks complete

---

## Total Estimated Time

- **Phase 1**: 10 minutes (setup)
- **Phase 2**: 7 minutes (configuration)
- **Phase 3**: 32-37 minutes (implementation)
- **Phase 4**: 56 minutes (deployment + docs)

**Total**: ~1.5 - 2 hours (excluding breaks and troubleshooting)

---

## Dependencies Graph

```
Phase 1: Setup
├─ 1.1 Install Wrangler CLI
├─ 1.2 Create Cloudflare Account (optional)
├─ 1.3 Authenticate Wrangler (requires 1.2)
└─ 1.4 Install Wrangler Locally (requires 1.1)

Phase 2: Configuration (requires 1.4)
├─ 2.1 Create wrangler.toml
├─ 2.2 Add Build Scripts (requires 2.1)
└─ 2.3 Create esbuild.worker.js (requires 2.2)

Phase 3: Implementation (requires 2.3)
├─ 3.1 Create src/worker.ts
├─ 3.2 Test Local Dev Server (requires 3.1)
├─ 3.3 Implement MCP Handler (requires 3.2)
└─ 3.4 Test All Tools (requires 3.3)

Phase 4: Deployment (requires 3.4 + 1.1-1.3)
├─ 4.1 Deploy to Workers
├─ 4.2 Test Production (requires 4.1)
├─ 4.3 Create DEPLOYMENT.md (requires 4.2)
├─ 4.4 Update README.md (requires 4.3)
├─ 4.5 Update LOG.md (requires 4.4)
└─ 4.6 Final Validation (requires 4.5)
```

---

## Parallel Work Opportunities

These tasks can be done in parallel to save time:

- **During Phase 1**: While waiting for Cloudflare account verification (1.2), install Wrangler CLI (1.1)
- **During Phase 3.2**: While wrangler dev is running, can start writing worker.ts implementation (3.3)
- **During Phase 4**: Documentation tasks (4.3, 4.4, 4.5) can be drafted while deployment is in progress

---

## Rollback Plan

If deployment fails or issues arise:

1. **Workers deployment fails**: Keep using stdio/http modes (no breaking changes)
2. **Bundle too large**: Analyze with `esbuild --metafile` and remove unused code
3. **Runtime errors**: Use `wrangler tail` to view live logs and debug
4. **Rate limit exceeded**: User deploys own Workers instance (fork + deploy)

Each task is reversible - can revert by:
- Deleting new files (worker.ts, wrangler.toml, esbuild.worker.js)
- Removing npm scripts from package.json
- Running `wrangler delete` to remove Workers deployment
