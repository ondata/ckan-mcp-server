# Design: Cloudflare Workers Deployment

## Architecture Overview

### Current Architecture (Node.js)

```
┌─────────────────────────────────────────┐
│         CKAN MCP Server (Node.js)       │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │   stdio.ts   │    │   http.ts    │  │
│  │  Transport   │    │  Transport   │  │
│  └──────┬───────┘    └──────┬───────┘  │
│         │                   │          │
│         └──────┬────────────┘          │
│                │                       │
│         ┌──────▼───────┐               │
│         │ MCP Server   │               │
│         │   (SDK)      │               │
│         └──────┬───────┘               │
│                │                       │
│    ┌───────────┴───────────┐           │
│    │   Tool Handlers       │           │
│    │  (7 CKAN tools)       │           │
│    └───────────┬───────────┘           │
│                │                       │
│         ┌──────▼───────┐               │
│         │  HTTP Client │               │
│         │   (axios)    │               │
│         └──────┬───────┘               │
│                │                       │
└────────────────┼───────────────────────┘
                 │
          ┌──────▼───────┐
          │  CKAN API    │
          │  (external)  │
          └──────────────┘
```

### Proposed Architecture (Cloudflare Workers)

```
┌─────────────────────────────────────────┐
│    CKAN MCP Server (Workers Runtime)    │
├─────────────────────────────────────────┤
│                                         │
│         ┌──────────────┐                │
│         │  worker.ts   │                │
│         │ (fetch API)  │                │
│         └──────┬───────┘                │
│                │                       │
│         ┌──────▼───────┐               │
│         │ MCP Server   │               │
│         │   (SDK)      │               │
│         └──────┬───────┘               │
│                │                       │
│    ┌───────────┴───────────┐           │
│    │   Tool Handlers       │           │
│    │  (7 CKAN tools)       │           │
│    │  [REUSED CODE]        │           │
│    └───────────┬───────────┘           │
│                │                       │
│         ┌──────▼───────┐               │
│         │ HTTP Client  │               │
│         │ (fetch API)  │               │
│         └──────┬───────┘               │
│                │                       │
└────────────────┼───────────────────────┘
                 │
          ┌──────▼───────┐
          │  CKAN API    │
          │  (external)  │
          └──────────────┘
```

**Key differences**:
- **Entry point**: `worker.ts` replaces `stdio.ts` and `http.ts`
- **HTTP client**: Native `fetch()` replaces `axios`
- **Runtime**: Cloudflare Workers runtime (V8) instead of Node.js
- **Tool handlers**: Unchanged (100% code reuse)

---

## Component Design

### 1. Worker Entry Point (`src/worker.ts`)

**Purpose**: Handle incoming HTTP requests and route to MCP server

**Interface**:
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response>
}
```

**Responsibilities**:
1. Health check endpoint (`GET /health`)
2. MCP protocol endpoint (`POST /mcp`)
3. Error handling and logging
4. Request/response transformation

**Code structure**:
```typescript
// src/worker.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerPackageTools } from './tools/package.js';
import { registerOrganizationTools } from './tools/organization.js';
import { registerDatastoreTools } from './tools/datastore.js';
import { registerStatusTools } from './tools/status.js';
import { registerResources } from './resources/index.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '0.4.0',
        tools: 7,
        resources: 3
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // MCP endpoint
    if (request.method === 'POST' && url.pathname === '/mcp') {
      return handleMcpRequest(request);
    }

    // 404 for all other routes
    return new Response('Not Found', { status: 404 });
  }
};

async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    // Parse JSON-RPC request
    const body = await request.json();

    // Create MCP server instance
    const server = new Server({
      name: 'ckan-mcp-server',
      version: '0.4.0'
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    // Register all tools
    registerPackageTools(server);
    registerOrganizationTools(server);
    registerDatastoreTools(server);
    registerStatusTools(server);
    registerResources(server);

    // Process MCP request
    const response = await server.handleRequest(body);

    // Return JSON-RPC response
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      },
      id: null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

---

### 2. HTTP Client Adaptation

**Current**: `src/utils/http.ts` uses `axios`
**Problem**: `axios` uses Node.js `http` module, not available in Workers
**Solution**: Replace with native `fetch()`

**Before** (axios):
```typescript
import axios from 'axios';

export async function makeCkanRequest<T>(
  serverUrl: string,
  endpoint: string,
  params?: Record<string, any>
): Promise<T> {
  const response = await axios.get(`${serverUrl}/api/3/action/${endpoint}`, {
    params,
    timeout: 30000,
    headers: { 'User-Agent': 'CKAN-MCP-Server/1.0' }
  });
  return response.data.result;
}
```

**After** (fetch):
```typescript
export async function makeCkanRequest<T>(
  serverUrl: string,
  endpoint: string,
  params?: Record<string, any>
): Promise<T> {
  const url = new URL(`${serverUrl}/api/3/action/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'CKAN-MCP-Server/1.0' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'CKAN API error');
    }

    return data.result;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Changes**:
- Replace `axios.get()` with `fetch()`
- Build URL with `URLSearchParams`
- Implement timeout with `AbortController`
- Manual error handling (no axios interceptors)

**Impact**:
- Remove `axios` dependency from `package.json`
- Workers bundle size decreases (~20KB smaller)
- No changes to tool handlers (same API)

---

### 3. Build System

**Current**: Single build target (Node.js)
```
esbuild.config.js → dist/index.js (CommonJS, Node.js platform)
```

**Proposed**: Dual build targets

```
esbuild.config.js → dist/index.js (CommonJS, Node.js platform)
esbuild.worker.js → dist/worker.js (ESM, browser platform)
```

**New file**: `esbuild.worker.js`
```javascript
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/worker.ts'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',              // Workers require ESM
  platform: 'browser',         // Workers use Web APIs
  target: 'es2022',
  external: [],                // Bundle everything (no node_modules in Workers)
  minify: true,                // Reduce bundle size
  sourcemap: false,
  treeShaking: true,
  mainFields: ['browser', 'module', 'main'],
  conditions: ['worker', 'browser'],
});
```

**Key differences**:
- **format**: ESM (not CommonJS)
- **platform**: browser (not node)
- **external**: empty array (bundle all dependencies)
- **minify**: true (reduce Workers script size)

**Bundle analysis**:
- Current Node.js bundle: ~50KB
- Estimated Workers bundle: ~30-40KB (no axios, smaller MCP SDK)
- Workers limit: 1MB (10x safety margin)

---

### 4. Configuration

**File**: `wrangler.toml`
```toml
name = "ckan-mcp-server"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

# Build configuration
[build]
command = "npm run build:worker"
watch_dir = "src"

# Environment variables (optional)
[vars]
DEFAULT_CKAN_SERVER = "https://demo.ckan.org"

# Production environment
[env.production]
name = "ckan-mcp-server"
routes = [
  { pattern = "ckan-mcp.example.com", custom_domain = true }
]

# Development environment
[env.development]
name = "ckan-mcp-server-dev"
```

**Configuration options**:
- `name`: Workers script name (shows in Cloudflare dashboard)
- `main`: Entry point (must be ESM)
- `compatibility_date`: Workers runtime version
- `build.command`: Runs before deployment
- `vars`: Environment variables accessible in worker
- `env.*`: Multiple environments (dev/staging/prod)

---

## Design Decisions

### Decision 1: Keep Node.js Modes Unchanged

**Options**:
1. Replace Node.js runtime entirely with Workers (breaking change)
2. Support both Node.js and Workers (dual build)

**Choice**: Option 2 (dual build)

**Rationale**:
- **No breaking changes**: Existing users unaffected
- **Flexibility**: Users can choose deployment model
- **Development**: Local testing still uses Node.js (`npm start`)
- **Cost**: Minimal (2 build configs, ~100 lines of adapter code)

**Trade-offs**:
- **Pro**: Zero migration pain
- **Pro**: Supports offline/airgapped usage (stdio mode)
- **Con**: Maintain 2 entry points (worker.ts + index.ts)
- **Con**: Test 2 runtimes (Node.js + Workers)

---

### Decision 2: Replace axios with fetch()

**Options**:
1. Bundle axios for Workers (use polyfill)
2. Replace with native fetch()

**Choice**: Option 2 (native fetch)

**Rationale**:
- **Bundle size**: axios is ~15KB minified, fetch is native (0KB)
- **Compatibility**: fetch is standard across Node.js 18+ and Workers
- **Simplicity**: No polyfills or adapters needed
- **Performance**: fetch is optimized in Workers runtime

**Trade-offs**:
- **Pro**: Smaller bundle, faster cold starts
- **Pro**: Future-proof (fetch is Web standard)
- **Con**: Rewrite HTTP client (~50 lines)
- **Con**: Different error handling (manual checks vs axios interceptors)

**Impact**:
- Modify `src/utils/http.ts` (~30 lines changed)
- No changes to tool handlers (API unchanged)
- Node.js modes continue using axios (or migrate to fetch for consistency)

---

### Decision 3: No Server-Side Caching

**Options**:
1. Add Workers KV cache for CKAN responses
2. No caching (same as Node.js version)

**Choice**: Option 2 (no caching)

**Rationale**:
- **Consistency**: Same behavior as Node.js version
- **Freshness**: Always return latest CKAN data
- **Simplicity**: No cache invalidation logic
- **Free tier**: KV has storage limits (1GB)

**Trade-offs**:
- **Pro**: Simple, consistent, fresh data
- **Con**: Higher latency for repeated queries
- **Con**: More CKAN API requests

**Future enhancement**: Add optional caching with TTL (documented in future-ideas.md)

---

### Decision 4: Single Global Deployment

**Options**:
1. Deploy to single Workers instance (user's account)
2. Provide official public endpoint (Anthropic-hosted)
3. Both

**Choice**: Option 1 (user deploys own instance)

**Rationale**:
- **No hosting cost**: Users deploy to their own free tier
- **No rate limit sharing**: Each user gets 100k req/day
- **No liability**: Anthropic not responsible for uptime/abuse
- **Easy forking**: Users can customize and deploy

**Trade-offs**:
- **Pro**: Zero hosting cost, infinite scalability
- **Pro**: Users control their deployment
- **Con**: Users must create Cloudflare account (5 min)
- **Con**: No "official" endpoint to share

**Future option**: Provide public endpoint in addition to user deployments

---

## Runtime Compatibility

### Node.js APIs → Workers APIs

| Node.js API          | Workers API           | Impact                |
|----------------------|-----------------------|-----------------------|
| `http.createServer`  | `fetch(request)`      | Different entry point |
| `axios`              | `fetch()`             | Rewrite HTTP client   |
| `process.env`        | `env` parameter       | Minimal (no env vars) |
| `console.log`        | `console.log`         | ✅ Compatible          |
| `JSON.*`             | `JSON.*`              | ✅ Compatible          |
| `URL`                | `URL`                 | ✅ Compatible          |
| `AbortController`    | `AbortController`     | ✅ Compatible          |

**Compatibility score**: 95%
- Most code works unchanged
- Only HTTP client and entry point need adaptation

---

## Error Handling

### Workers-Specific Errors

1. **Script exceeded CPU time limit**
   - **Cause**: Worker runs > 10ms CPU time (free tier)
   - **Mitigation**: CKAN API calls are I/O (don't count toward CPU)
   - **Likelihood**: Very low (current tools are I/O-bound)

2. **Script exceeded memory limit**
   - **Cause**: Worker uses > 128MB memory (free tier)
   - **Mitigation**: No large in-memory datasets
   - **Likelihood**: Very low (responses truncated to 50KB)

3. **Subrequest limit exceeded**
   - **Cause**: > 50 subrequests per invocation (free tier)
   - **Mitigation**: Tools make 1-2 CKAN API calls max
   - **Likelihood**: Zero (tools designed for single queries)

4. **Network timeout**
   - **Cause**: CKAN API takes > 30s
   - **Mitigation**: Same as Node.js (30s timeout with AbortController)
   - **Likelihood**: Low (most CKAN queries < 5s)

**Error response format** (JSON-RPC):
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "Error details here"
  },
  "id": null
}
```

---

## Performance Characteristics

### Latency Breakdown

**Total latency** = Cold start + Worker execution + CKAN API + Response

1. **Cold start**: 0-50ms (first request after idle)
   - Workers spin down after ~15 seconds of inactivity
   - Subsequent requests: 0ms (hot start)

2. **Worker execution**: 1-5ms (CPU time)
   - Parse JSON-RPC request
   - Validate parameters
   - Call CKAN API (I/O - doesn't count)
   - Format response

3. **CKAN API**: 500-5000ms (network + server)
   - Depends on CKAN portal load
   - Italy (dati.gov.it): ~3s average
   - US (data.gov): ~2s average

4. **Response serialization**: 1-5ms
   - JSON.stringify()
   - Truncate to 50KB if needed

**Expected total latency**:
- **First request** (cold start): 0.5-5.1s
- **Hot requests**: 0.5-5s
- **Target**: < 5s for 95th percentile

**Comparison to Node.js**:
- Similar (CKAN API dominates latency)
- Slight advantage: Workers edge routing (closer to CKAN servers)

---

## Security Considerations

### 1. Public Access
- **Risk**: Anyone can call Workers endpoint
- **Mitigation**: Read-only operations, no sensitive data
- **Decision**: Acceptable (CKAN portals are public)

### 2. Rate Limiting
- **Risk**: Abuse could exhaust free tier (100k req/day)
- **Mitigation**: Cloudflare automatic rate limiting, user can upgrade
- **Decision**: Monitor usage, add custom limits if needed

### 3. CKAN API Keys
- **Risk**: Some CKAN APIs require authentication
- **Mitigation**: Store API keys in Workers secrets (not implemented yet)
- **Decision**: Document in future-ideas.md (v0.5.0)

### 4. Input Validation
- **Risk**: Malformed requests crash worker
- **Mitigation**: Existing Zod schemas validate all inputs
- **Decision**: No changes needed (already secure)

### 5. CORS
- **Risk**: Browser clients blocked by CORS
- **Mitigation**: Add CORS headers to all responses
- **Decision**: Add `Access-Control-Allow-Origin: *` (public API)

---

## Testing Strategy

### 1. Local Testing (wrangler dev)
```bash
npm run dev:worker
curl http://localhost:8787/health
```

**Validates**:
- Build succeeds
- Worker starts without errors
- Basic routing works

### 2. Integration Testing (all tools)
```bash
# Test each tool locally
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"ckan_status_show","arguments":{"server_url":"https://demo.ckan.org"}},"id":1}'
```

**Validates**:
- All 7 tools work in Workers runtime
- CKAN API integration works
- Response formatting correct

### 3. Production Testing (after deployment)
```bash
# Test on live Workers endpoint
curl -X POST https://ckan-mcp-server.aborruso.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '...'
```

**Validates**:
- Deployment successful
- HTTPS works
- Global routing works

### 4. Claude Desktop Integration
- Configure Claude Desktop with Workers URL
- Test all tools through Claude UI
- Verify markdown formatting

**Validates**:
- End-to-end MCP protocol
- User experience matches local mode

### 5. Load Testing (optional)
```bash
# Use wrk or ab to simulate load
wrk -t4 -c100 -d30s https://ckan-mcp-server.aborruso.workers.dev/health
```

**Validates**:
- Handles concurrent requests
- No rate limit issues
- Stable under load

---

## Monitoring and Debugging

### 1. Cloudflare Dashboard
- **Metrics**: Requests/day, errors, CPU time
- **Access**: https://dash.cloudflare.com → Workers & Pages → ckan-mcp-server

### 2. Real-Time Logs
```bash
wrangler tail
```
Shows live logs from Workers (console.log, errors)

### 3. Error Tracking
- Workers dashboard shows error rate
- Stack traces in tail output
- Sentry integration (future)

### 4. Analytics
- Free tier includes basic analytics
- Paid tier: detailed metrics, alerts

---

## Rollout Plan

### Phase 1: Development (tasks 1-3)
- Set up local environment
- Implement worker.ts
- Test locally with wrangler dev

### Phase 2: Deployment (task 4)
- Deploy to workers.dev
- Test in production
- Verify all tools work

### Phase 3: Documentation (tasks 4.3-4.5)
- Write DEPLOYMENT.md
- Update README.md
- Update LOG.md

### Phase 4: Validation (task 4.6)
- Claude Desktop integration test
- User acceptance

### Rollback Triggers
- Any tool fails in production
- Workers limits exceeded
- Unexpected errors > 1%

**Rollback action**: Keep using Node.js modes, document Workers issues

---

## Future Enhancements

### 1. Response Caching (v0.5.0)
```typescript
// Use Workers KV for caching
const cache = await env.CACHE.get(`ckan:${serverUrl}:${endpoint}:${hash}`);
if (cache) return JSON.parse(cache);

const result = await makeCkanRequest(...);
await env.CACHE.put(`ckan:${serverUrl}:${endpoint}:${hash}`, JSON.stringify(result), {
  expirationTtl: 3600  // 1 hour TTL
});
```

### 2. Custom Domain (v0.5.0)
```toml
# wrangler.toml
routes = [
  { pattern = "ckan-mcp.example.com", custom_domain = true }
]
```

### 3. Analytics Dashboard (v0.6.0)
- Track most used tools
- Monitor CKAN portal health
- Usage statistics

### 4. Multi-Region Deployment (v0.6.0)
- Deploy to specific Cloudflare regions
- Route to nearest CKAN portal
- Reduce latency

---

## Conclusion

This design enables Cloudflare Workers deployment with:
- **Minimal code changes** (~150 lines new code)
- **No breaking changes** (Node.js modes unchanged)
- **95% code reuse** (only entry point + HTTP client adapted)
- **Production-ready** (all 7 tools fully functional)
- **Future-proof** (uses Web standards: fetch, ESM)

**Risk**: Low (well-understood technologies, small scope)
**Reward**: High (global deployment, zero hosting cost, great UX)
