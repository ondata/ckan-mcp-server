/**
 * CKAN MCP Server - Cloudflare Workers Entry Point
 *
 * Provides MCP tools via HTTP for global edge deployment.
 */

import { createServer, registerAll } from "./server.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// Create and configure MCP server (singleton for Workers)
const server = createServer();
registerAll(server);

// Create transport (stateless mode for Workers)
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,  // Stateless mode
  enableJsonResponse: true         // Use JSON instead of SSE for simplicity
});

// Connect server to transport
await server.connect(transport);

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Root endpoint - README
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CKAN MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2563eb;
      margin-bottom: 0.5rem;
      font-size: 2rem;
    }
    .subtitle {
      color: #666;
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }
    h2 {
      color: #1e40af;
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-size: 1.5rem;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.5rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #10b981;
      color: white;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    code {
      background: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }
    pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    pre code {
      background: none;
      color: inherit;
      padding: 0;
    }
    ul {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    li {
      margin-bottom: 0.5rem;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .endpoints {
      display: grid;
      gap: 1rem;
      margin: 1rem 0;
    }
    .endpoint {
      background: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      border-left: 4px solid #2563eb;
    }
    .endpoint-method {
      font-weight: 700;
      color: #059669;
    }
    .endpoint-path {
      font-family: 'Courier New', monospace;
      color: #1f2937;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      color: #666;
      font-size: 0.9rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 CKAN MCP Server</h1>
    <p class="subtitle">Model Context Protocol server for CKAN open data portals</p>
    <div class="badge">✓ Online</div>

    <h2>📡 Available Endpoints</h2>
    <div class="endpoints">
      <div class="endpoint">
        <div><span class="endpoint-method">GET</span> <span class="endpoint-path">/</span></div>
        <div>This page - API documentation</div>
      </div>
      <div class="endpoint">
        <div><span class="endpoint-method">GET</span> <span class="endpoint-path">/health</span></div>
        <div>Health check and server status</div>
      </div>
      <div class="endpoint">
        <div><span class="endpoint-method">POST</span> <span class="endpoint-path">/mcp</span></div>
        <div>MCP protocol endpoint (JSON-RPC 2.0)</div>
      </div>
    </div>

    <h2>🚀 Quick Start</h2>
    <p>Add this server to your Claude Desktop configuration:</p>
    <pre><code>{
  "mcpServers": {
    "ckan": {
      "url": "${url.origin}/mcp"
    }
  }
}</code></pre>

    <h2>🔧 Available Tools</h2>
    <ul>
      <li><code>ckan_status_show</code> - Check CKAN portal status</li>
      <li><code>ckan_package_search</code> - Search datasets with filters</li>
      <li><code>ckan_package_show</code> - Get dataset details</li>
      <li><code>ckan_resource_show</code> - Get resource metadata</li>
      <li><code>ckan_datastore_search</code> - Query DataStore data</li>
      <li><code>ckan_datastore_search_sql</code> - Execute SQL queries</li>
      <li><code>ckan_organization_list</code> - List organizations</li>
      <li><code>ckan_group_list</code> - List groups</li>
      <li><code>ckan_tag_list</code> - List tags</li>
      <li><code>ckan_find_relevant_datasets</code> - AI-powered dataset discovery</li>
    </ul>

    <h2>📚 Resources</h2>
    <ul>
      <li><a href="https://github.com/aborruso/ckan-mcp-server" target="_blank">GitHub Repository</a></li>
      <li><a href="https://www.npmjs.com/package/@aborruso/ckan-mcp-server" target="_blank">npm Package</a></li>
      <li><a href="https://modelcontextprotocol.io/" target="_blank">MCP Documentation</a></li>
      <li><a href="https://docs.ckan.org/en/latest/api/" target="_blank">CKAN API Reference</a></li>
    </ul>

    <h2>🧪 Test the Health Endpoint</h2>
    <pre><code>curl ${url.origin}/health</code></pre>

    <div class="footer">
      Version 0.4.7 • Running on Cloudflare Workers • <a href="https://github.com/aborruso/ckan-mcp-server/blob/main/LICENSE.txt" target="_blank">MIT License</a>
    </div>
  </div>
</body>
</html>`, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Health check endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '0.4.7',
        tools: 13,
        resources: 3,
        runtime: 'cloudflare-workers'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // MCP protocol endpoint - delegate to transport
    if (url.pathname === '/mcp') {
      try {
        const response = await transport.handleRequest(request);

        // Add CORS headers
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        console.error('Worker error:', error);
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: null
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 404 for all other routes
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
