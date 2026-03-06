#!/usr/bin/env node
/**
 * ckan-mcp-bridge.js
 * Wrapper that allows Claude Desktop (stdio) to communicate
 * with the ckan-mcp-server container (HTTP/SSE).
 *
 * Claude Desktop <--stdio--> this script <--HTTP--> Docker container
 */

const http = require("http");
const https = require("https");

const MCP_URL = process.env.MCP_URL || "http://localhost:3000/mcp";

const url = new URL(MCP_URL);
const transport = url.protocol === "https:" ? https : http;

function sendToServer(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = transport.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        // Handle both plain JSON responses and SSE (data: {...})
        const lines = raw.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr && jsonStr !== "[DONE]") {
              try {
                resolve(JSON.parse(jsonStr));
                return;
              } catch {}
            }
          } else if (trimmed.startsWith("{")) {
            try {
              resolve(JSON.parse(trimmed));
              return;
            } catch {}
          }
        }
        // Fallback: try to parse the entire body
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error("Cannot parse response: " + raw.slice(0, 200)));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// Read JSON-RPC messages from stdin (one per line)
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop(); // last line may be incomplete

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const message = JSON.parse(trimmed);
      const response = await sendToServer(message);
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch (err) {
      // Send a valid JSON-RPC error on failure
      const errResponse = {
        jsonrpc: "2.0",
        error: { code: -32603, message: err.message },
        id: null,
      };
      process.stdout.write(JSON.stringify(errResponse) + "\n");
    }
  }
});

process.stdin.on("end", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
