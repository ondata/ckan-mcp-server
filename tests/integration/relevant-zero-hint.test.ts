import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerPackageTools } from "../../src/tools/package.js";

vi.mock("axios");

const SERVER_URL = "https://www.dati.gov.it/opendata";

async function callRelevant(query: string): Promise<string> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerPackageTools(server);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const result = await client.callTool({
    name: "ckan_find_relevant_datasets",
    arguments: { server_url: SERVER_URL, query }
  });
  return (result.content as { text: string }[])[0].text;
}

// From the worker telemetry (2026-11-03, dati.comune.milano.it): the query below
// returned 0 because two of its five terms are in no dataset, while the first three
// alone returned 142. ckan_package_search already suggested the OR rewrite.
describe("ckan_find_relevant_datasets zero-result hint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({
      data: { success: true, result: { count: 0, results: [], facets: {} } }
    });
  });

  it("suggests the OR rewrite for a plain multi-term query", async () => {
    const text = await callRelevant("popolazione residente cittadinanza cinese Cina");
    expect(text).toContain("No datasets matched the query terms.");
    expect(text).toContain('`query: "popolazione OR residente OR cittadinanza OR cinese OR Cina"`');
  });

  it("gives no tip for a single term", async () => {
    const text = await callRelevant("zzqxnonesiste");
    expect(text).not.toContain("Tip");
  });
});
