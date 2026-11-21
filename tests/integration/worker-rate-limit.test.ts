import { describe, it, expect, vi } from "vitest";
import worker from "../../src/worker.js";

const INIT = JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } }
});

const mcpRequest = (ip?: string) => new Request("https://example.workers.dev/mcp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    ...(ip ? { "CF-Connecting-IP": ip } : {})
  },
  body: INIT
});

const limiter = (success: boolean) => ({ limit: vi.fn().mockResolvedValue({ success }) });

describe("Worker per-IP rate limit", () => {
  it("answers 429 with a JSON-RPC error when the limiter refuses", async () => {
    const env = { MCP_RATE_LIMITER: limiter(false) };
    const res = await worker.fetch(mcpRequest("203.0.113.7"), env);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toContain("200 per minute");
    expect(env.MCP_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "203.0.113.7" });
  });

  it("serves the request when the limiter allows it", async () => {
    const res = await worker.fetch(mcpRequest("203.0.113.7"), { MCP_RATE_LIMITER: limiter(true) });
    expect(res.status).toBe(200);
  });

  it("serves the request when the binding is missing", async () => {
    const res = await worker.fetch(mcpRequest("203.0.113.7"), {});
    expect(res.status).toBe(200);
  });

  it("serves the request when the limiter throws (fail open)", async () => {
    const env = { MCP_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error("down")) } };
    const res = await worker.fetch(mcpRequest("203.0.113.7"), env);
    expect(res.status).toBe(200);
  });
});
