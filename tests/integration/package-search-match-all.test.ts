import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerPackageTools } from "../../src/tools/package.js";
import { __resetCacheForTests } from "../../src/utils/cache.js";
import packageSearchFixture from "../fixtures/responses/package-search-success.json";

vi.mock("axios");

async function search(q: string) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerPackageTools(server);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client.callTool({
    name: "ckan_package_search",
    arguments: { server_url: "https://www.dati.gov.it/opendata", q, page_size: 1 }
  });
}

const sentQueries = () =>
  vi.mocked(axios.get).mock.calls
    .filter(([url]) => String(url).includes("package_search"))
    .map(([, config]) => (config as { params?: { q?: string } })?.params?.q);

describe("ckan_package_search with a bare wildcard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCacheForTests();
    vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });
  });

  it("sends q=*:* when q is *", async () => {
    await search("*");
    expect(sentQueries()).toContain("*:*");
    expect(sentQueries()).not.toContain("*");
  });

  it("leaves a real query alone", async () => {
    await search("ambiente");
    expect(sentQueries()).toContain("ambiente");
  });
});
