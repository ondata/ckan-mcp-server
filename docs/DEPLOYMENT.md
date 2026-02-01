# Cloudflare Workers Deployment Guide

Complete step-by-step guide to deploy CKAN MCP Server on Cloudflare Workers.

## Prerequisites

- **Cloudflare account** (free): https://dash.cloudflare.com/sign-up
- **Node.js 18+** and npm installed
- **Git** (to clone the repository)

## Why Cloudflare Workers?

The server is ideal for Workers deployment:

- ✅ **Stateless**: No database or persistent state
- ✅ **Read-only**: All operations are GET-only
- ✅ **Lightweight**: Small bundle (~400KB)
- ✅ **Global edge**: Low latency worldwide
- ✅ **Free tier**: 100,000 requests/day

## Step-by-Step Deployment

### Step 1: Install Wrangler CLI

Wrangler is Cloudflare's official CLI tool for Workers.

```bash
npm install -g wrangler
```

Verify installation:

```bash
wrangler --version
```

Expected output: `wrangler 4.x.x` or higher

---

### Step 2: Authenticate with Cloudflare

Connect your local Wrangler to your Cloudflare account:

```bash
wrangler login
```

This will:
1. Open your browser
2. Ask you to log in to Cloudflare
3. Request authorization for Wrangler
4. Show "Successfully logged in" in terminal

Verify authentication:

```bash
wrangler whoami
```

Expected output: Your Cloudflare email and account info

---

### Step 3: Clone Repository

```bash
git clone https://github.com/ondata/ckan-mcp-server.git
cd ckan-mcp-server
```

---

### Step 4: Install Dependencies

```bash
npm install
```

This installs:
- Project dependencies (@modelcontextprotocol/sdk, axios, zod, etc.)
- Wrangler CLI (local copy for reproducible builds)

Note: Packaging exclusions are managed via `.npmignore`, but **do not** exclude `dist/` (the published build). Prefer using the `files` field in `package.json` to whitelist publishable artifacts.

---

### Step 4.5: Security Audit (Recommended)

Before deploying, check for known vulnerabilities:

```bash
npm audit
```

Expected output: `found 0 vulnerabilities`

If vulnerabilities are found:
```bash
# Review the report
npm audit

# Fix automatically if possible
npm audit fix

# Rerun tests after fixing
npm test
```

**Important**: Always run `npm audit` before deploying to production.

---

### Step 5: Test Locally (Optional but Recommended)

Before deploying to production, test the worker locally:

```bash
npm run dev:worker
```

This starts a local Workers server on `http://localhost:8787`

**Test in another terminal**:

```bash
# Health check
curl http://localhost:8787/health

# List MCP tools
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test real CKAN call
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"ckan_status_show","arguments":{"server_url":"https://demo.ckan.org"}},"id":2}'
```

Stop local server: Press `x` or `Ctrl+C`

---

### Step 5.5: Test Local Build via MCP Client (Optional)

If you want to test the current development build before deploying, you can use the Node entrypoint from `dist/` with your MCP client:

1. Build the project:
   ```bash
   npm run build
   ```
2. Point your MCP client to the built entry file:
   - Example absolute path: `/home/aborruso/git/idee/ckan-mcp-server/dist/index.js`
   - This is an example absolute path; adjust it to your local checkout.

---

### Step 6: Deploy to Cloudflare Workers

```bash
npm run deploy
```

This will:
1. Build the worker (`npm run build:worker`)
2. Upload to Cloudflare
3. Show deployment URL

**Expected output**:

```
Total Upload: 541.85 KiB / gzip: 130.26 KiB
Worker Startup Time: 58 ms
Uploaded ckan-mcp-server (6.36 sec)
Deployed ckan-mcp-server triggers (4.40 sec)
  https://ckan-mcp-server.<your-account>.workers.dev
Current Version ID: <version-id>
```

**Your server is now live!** 🎉

---

## **Important: Test Before Release**

To avoid premature releases, always follow this order:

1. **Apply code changes**
2. **Run tests locally**
   ```bash
   npm test
   ```
3. **Deploy to Workers for validation**
   ```bash
   npm run deploy
   ```
4. **Run live smoke tests**
   - `/health`
   - `tools/list`
   - At least one real tool call (e.g. `ckan_get_mqa_quality`)
5. **Only after everything passes**:
   - bump version
   - commit + tag
   - GitHub release
   - npm publish

**Rule of thumb**: *release only when the live deployment is confirmed working.*

---

### Step 7: Test Production Deployment

Test your live Workers endpoint:

```bash
# Health check
curl https://ckan-mcp-server.<your-account>.workers.dev/health

# List tools
curl -X POST https://ckan-mcp-server.<your-account>.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test CKAN call
curl -X POST https://ckan-mcp-server.<your-account>.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"ckan_status_show","arguments":{"server_url":"https://demo.ckan.org"}},"id":2}'
```

---

### Step 8: Configure Claude Desktop

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ckan": {
      "url": "https://ckan-mcp-server.<your-account>.workers.dev/mcp"
    }
  }
}
```

Replace `<your-account>` with your actual Workers subdomain.

Restart Claude Desktop to apply changes.

---

## Configuration

### Custom Worker Name

Edit `wrangler.toml` to change the worker name:

```toml
name = "my-custom-name"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

[build]
command = "npm run build:worker"
```

This changes the URL to: `https://my-custom-name.<account>.workers.dev`

### Environment Variables (Optional)

Add environment variables in `wrangler.toml`:

```toml
[vars]
DEFAULT_CKAN_SERVER = "https://demo.ckan.org"
LOG_LEVEL = "info"
```

Access in `src/worker.ts`:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('Default server:', env.DEFAULT_CKAN_SERVER);
    // ...
  }
}
```

---

## Monitoring and Debugging

### View Live Logs

```bash
wrangler tail
```

Shows real-time logs from your Workers deployment.

### Cloudflare Dashboard

Visit: https://dash.cloudflare.com → Workers & Pages → ckan-mcp-server

View:
- Request count
- Error rate
- CPU time
- Deployment history

---

## Updating Your Deployment

After making code changes:

```bash
npm run deploy
```

Cloudflare automatically:
- Builds new version
- Deploys globally
- Routes traffic to new version
- No downtime

---

## Troubleshooting

### Error: "Not authenticated"

```bash
wrangler logout
wrangler login
```

### Error: "Worker exceeded CPU time limit"

Check if you're making blocking operations. CKAN API calls are async (I/O-bound), so this should be rare.

### Error: "Script too large"

Current bundle: ~400KB (limit: 1MB). If you hit this:

```bash
# Analyze bundle size
npm run build:worker -- --metafile=meta.json
npx esbuild-visualizer --metadata meta.json
```

### Error: 404 on deployment URL

Wait 10-30 seconds after deployment. Cloudflare propagates to edge network.

### CORS errors in browser

Already configured in `src/worker.ts`. If issues persist, check browser console for specific error.

---

## Production Best Practices

### 1. Use Your Own Deployment

Don't rely on public endpoints for production. Deploy your own Workers instance:

```bash
git clone https://github.com/ondata/ckan-mcp-server.git
cd ckan-mcp-server
npm install
wrangler login
npm run deploy
```

### 2. Monitor Usage

Free tier includes 100k requests/day. Monitor in Cloudflare dashboard.

### 3. Set Up Alerts (Optional)

In Cloudflare dashboard:
- Workers & Pages → ckan-mcp-server → Settings → Alerts
- Configure notifications for errors, CPU limits, etc.

### 4. Version Management

Tag deployments in git:

```bash
git tag -a v0.4.0 -m "Cloudflare Workers deployment"
git push origin v0.4.0
```

View deployment versions in Cloudflare dashboard.

---

## Cost Breakdown

**Free Tier** (default):
- 100,000 requests/day
- 10ms CPU time per request
- Workers KV: 1GB storage
- Automatic HTTPS

**Paid Plans** (if needed):
- **Workers Paid** ($5/month): 10M requests/month
- **Workers Unbound**: Pay-per-use beyond free tier

For most users, **free tier is sufficient**.

---

## Rollback

### To Previous Version

In Cloudflare dashboard:
1. Workers & Pages → ckan-mcp-server
2. Deployments tab
3. Select previous version → "Rollback to this deployment"

### Remove Deployment

```bash
wrangler delete ckan-mcp-server
```

**Warning**: This permanently deletes the Workers deployment.

---

## Complete Release Workflow

When releasing a new version with code changes, follow all these steps to ensure complete deployment across GitHub, npm, and Cloudflare.

### Step 1: Update Version

Update the version in these files:

- `package.json`
- `package-lock.json`
- `src/server.ts`
- `src/worker.ts` (health endpoint)

Edit `package.json` and bump version:

```json
{
  "version": "0.5.0"
}
```

### Step 2: Update Changelog

Add entry to `LOG.md` with current date (YYYY-MM-DD format) at the top:

```markdown
## 2026-01-XX

### Version 0.5.0 - Feature Name

- **New feature**: Description
- **Changes**: List of changes
- **Files modified**: List key files
- **No breaking changes**: Confirm backward compatibility
```

### Step 3: Commit Changes

```bash
git add .
git commit -m "Add feature name (v0.5.0)

- Detailed description of changes
- List key improvements
- Note any breaking changes (if any)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Step 4: Push to GitHub

```bash
git push origin main
```

Verify: Check https://github.com/ondata/ckan-mcp-server commits

### Step 5: Create Git Tag

```bash
git tag -a v0.5.0 -m "Feature name

- Key feature 1
- Key feature 2
- Key feature 3
- No breaking changes"
```

### Step 6: Push Tag

```bash
git push origin v0.5.0
```

Verify: Tag appears in https://github.com/ondata/ckan-mcp-server/tags

### Step 7: Create GitHub Release

```bash
gh release create v0.5.0 \
  --title "v0.5.0 - Feature Name" \
  --notes "## What's New

### Features
- Feature 1 description
- Feature 2 description

### Changes
- Change 1
- Change 2

### Documentation
- Updated docs/...
- Added examples/...

### No Breaking Changes
- All existing functionality preserved
- Backward compatible

**Full Changelog**: https://github.com/ondata/ckan-mcp-server/compare/v0.4.0...v0.5.0"
```

Verify: Release appears as "Latest" at https://github.com/ondata/ckan-mcp-server/releases

**Important**: Keep GitHub releases in sync with npm. Do not leave GitHub behind npmjs.

After publishing to npm, verify versions match:

```bash
gh release list
npm view @aborruso/ckan-mcp-server version
```

If npm is ahead, create the missing GitHub release(s) from existing tags:

```bash
gh release create v0.X.Y --generate-notes
```

### Step 8: Publish to npm

```bash
npm publish
```

Verify:
- Check https://www.npmjs.com/package/@aborruso/ckan-mcp-server
- Version updated
- Package installable: `npm install @aborruso/ckan-mcp-server`

### Step 9: Deploy to Cloudflare Workers

**Only if** code affecting Workers was changed (src/worker.ts, src/tools/*, etc.):

```bash
npm run deploy
```

Verify:
- Deployment succeeds
- New version ID shown
- Test endpoint: `curl https://ckan-mcp-server.andy-pr.workers.dev/health`

---

## Release Checklist

Use this checklist to ensure nothing is missed:

### Pre-Release
- [ ] Security audit clean: `npm audit` (0 vulnerabilities)
- [ ] All tests passing: `npm test`
- [ ] Code builds successfully: `npm run build`
- [ ] Workers build works: `npm run build:worker`
- [ ] Local testing complete: `npm run dev:worker`

### Version Update
- [ ] Version bumped in `package.json`
- [ ] `LOG.md` updated with changes
- [ ] `CLAUDE.md` updated if architecture changed
- [ ] `README.md` updated if features added

### Git Operations
- [ ] Changes committed with descriptive message
- [ ] Pushed to GitHub main branch
- [ ] Git tag created (format: v0.X.Y)
- [ ] Tag pushed to GitHub

### Publishing
- [ ] GitHub Release created with notes
- [ ] npm package published (check npmjs.com)
- [ ] GitHub release not behind npm (verify `gh release list` + `npm view @aborruso/ckan-mcp-server version`)
- [ ] Cloudflare Workers deployed (if code changed)

### Verification
- [ ] GitHub shows correct "Latest" release
- [ ] npm shows updated version
- [ ] Workers endpoint responds correctly
- [ ] Claude Desktop config works (if MCP changes)

### Communication (Optional)
- [ ] Update project README with new features
- [ ] Announce on social media (if major release)
- [ ] Notify users of breaking changes (if any)

---

## When to Publish Where

Not every change requires publishing to all platforms:

### Always Required
- **GitHub**: Commit + Push (every change)

### Sometimes Required
- **Git Tag**: Only for versioned releases (v0.X.Y)
- **GitHub Release**: Only for public releases (creates "Latest" badge)
- **npm**: Only when users need updated package
- **Cloudflare**: Only when Workers code changed

### Decision Matrix

| Change Type | GitHub Commit | Git Tag | GitHub Release | npm Publish | Cloudflare Deploy |
|------------|---------------|---------|----------------|-------------|-------------------|
| Bug fix in tools | ✅ | ✅ | ✅ | ✅ | ✅ |
| New tool added | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documentation only | ✅ | ❌ | ❌ | ❌ | ❌ |
| README update | ✅ | ❌ | ❌ | ❌ | ❌ |
| Workers optimization | ✅ | ✅ | ✅ | ✅ (optional) | ✅ |
| Test improvements | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Common Issues

### "npm publish" fails with 403

**Problem**: Already published this version

**Solution**:
1. Check current npm version: `npm view @aborruso/ckan-mcp-server version`
2. Bump version in package.json
3. Try again

### npm cache EACCES in sandboxed environments

**Problem**: `EACCES` errors writing to `~/.npm/_cacache`

**Solution**: Use a writable cache directory:
```bash
NPM_CONFIG_CACHE=/tmp/npm-cache npm pack --dry-run
NPM_CONFIG_CACHE=/tmp/npm-cache npm publish
```

### GitHub Release shows old version as "Latest"

**Problem**: New release not created, only tag pushed

**Solution**:
```bash
gh release create v0.X.Y --title "..." --notes "..."
```

### Cloudflare deployment fails

**Problem**: Wrangler authentication expired

**Solution**:
```bash
wrangler logout
wrangler login
npm run deploy
```

### Workers endpoint returns 404 after deployment

**Problem**: DNS propagation delay

**Solution**: Wait 30-60 seconds, then test again

---

## FAQ

### Q: Can I use a custom domain?

Yes. In `wrangler.toml`:

```toml
routes = [
  { pattern = "ckan-mcp.example.com", custom_domain = true }
]
```

Then configure DNS in Cloudflare dashboard.

### Q: Is my data secure?

- All traffic uses HTTPS
- Server is read-only (no data modification)
- No sensitive data stored
- CKAN portals are public data

### Q: Can multiple people use my deployment?

Yes. Share your Workers URL with team members. Free tier supports 100k requests/day.

### Q: How do I update to a new version?

```bash
git pull origin main
npm install
npm run deploy
```

---

## Support

- **Issues**: https://github.com/ondata/ckan-mcp-server/issues
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **MCP SDK**: https://modelcontextprotocol.io/

---

## Next Steps

- [ ] Test all 7 CKAN tools with your deployment
- [ ] Configure Claude Desktop with Workers URL
- [ ] Monitor usage in Cloudflare dashboard
- [ ] Share endpoint with team members (optional)

**Happy deploying!** 🚀
