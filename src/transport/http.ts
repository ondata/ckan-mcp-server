/**
 * Transport: HTTP
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, registerAll } from "../server.js";
import { assertHttpAllowlistConfigured } from "../utils/http.js";

export async function runHTTP() {
  // Network-exposed transport: require a domain allowlist (fail-fast) unless
  // explicitly opted out via CKAN_HTTP_ALLOW_ALL=true.
  assertHttpAllowlistConfigured();

  const port = parseInt(process.env.PORT || '3000');

  // Bind to loopback by default so the endpoint is not exposed on the LAN.
  // Opt into a public bind explicitly via CKAN_HTTP_HOST (e.g. "0.0.0.0").
  const host = process.env.CKAN_HTTP_HOST || '127.0.0.1';

  // DNS-rebinding / cross-origin protection: reject requests whose Host/Origin
  // headers are not in the allowlist. Defaults cover the loopback bind; when a
  // public bind or custom hostname is used, list it in CKAN_HTTP_ALLOWED_HOSTS
  // (comma-separated Host header values) and CKAN_HTTP_ALLOWED_ORIGINS.
  const defaultHosts = [
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ];
  const extraHosts = (process.env.CKAN_HTTP_ALLOWED_HOSTS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const allowedHosts = [...defaultHosts, ...extraHosts];
  const allowedOrigins = (process.env.CKAN_HTTP_ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const app = express();
  app.use(express.json());

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.status(404).json({ error: 'authorization_not_supported', error_description: 'This server does not require authentication' });
  });

  app.post('/mcp', async (req, res) => {
    // Create server + transport per request (stateless mode requirement)
    const server = createServer();
    registerAll(server);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts,
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {})
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, host, () => {
    console.error(`CKAN MCP server running on http://${host}:${port}/mcp`);
  });
}
