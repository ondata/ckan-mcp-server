/**
 * Transport: HTTP
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, registerAll } from "../server.js";

export async function runHTTP() {
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
      enableJsonResponse: true
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.error(`CKAN MCP server running on http://localhost:${port}/mcp`);
  });
}
