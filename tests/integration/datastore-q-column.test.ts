import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerDatastoreTools } from "../../src/tools/datastore.js";

vi.mock("axios");

const SERVER = "https://open.canada.ca/data";
const OK = { success: true, result: { records: [{ n: 1 }], fields: [{ id: "n", type: "int8" }], total: 1 } };

// Real body, open.canada.ca 2026-10-31 (HTTP 409, resource with 354,153 rows).
const FTS_LIMIT = {
  success: false,
  error: { message: "Invalid request. Full text search is not supported for data with more than 100000 rows.", __type: "Validation Error" }
};

function sentQ(): unknown {
  const config = vi.mocked(axios.get).mock.calls[0][1] as { params?: Record<string, unknown> } | undefined;
  return config?.params?.q;
}

async function search(args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const mcp = new McpServer({ name: "test", version: "0.0.0" });
  registerDatastoreTools(mcp);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([mcp.connect(b), client.connect(a)]);
  const res = await client.callTool({ name: "ckan_datastore_search", arguments: { server_url: SERVER, resource_id: "big-1", ...args } });
  const content = res.content as Array<{ type: string; text?: string }>;
  const first = content[0];
  if (first?.type !== "text" || typeof first.text !== "string") throw new Error("expected a text content item");
  return { text: first.text, isError: Boolean(res.isError) };
}

describe("ckan_datastore_search q (issue #574)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("keeps a string q as is", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: OK });
    await search({ q: "loan" });
    expect(sentQ()).toBe("loan");
  });

  it("accepts a column-scoped q object and sends it to CKAN as JSON", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: OK });
    const { isError } = await search({ q: { "Data Point Address Label": "loan" } });
    expect(isError).toBe(false);
    expect(sentQ()).toBe('{"Data Point Address Label":"loan"}');
  });

  it("on the full-text row limit, suggests column-scoped q first, then filters or SQL ILIKE", async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 409, statusText: "", data: Buffer.from(JSON.stringify(FTS_LIMIT)), headers: {} } });
    const { text, isError } = await search({ q: "loan" });
    expect(isError).toBe(true);
    expect(text).toContain("Full text search is not supported");
    expect(text).not.toContain("parameters may conflict");
    const col = text.indexOf('{"column":');
    const filters = text.indexOf("`filters`");
    const ilike = text.indexOf("ILIKE");
    expect(col).toBeGreaterThan(-1);
    expect(filters).toBeGreaterThan(col);
    expect(ilike).toBeGreaterThan(col);
  });
});
