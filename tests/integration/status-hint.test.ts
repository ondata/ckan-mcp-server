import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerStatusTools } from "../../src/tools/status.js";

vi.mock("axios");

async function callStatus(serverUrl: string) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerStatusTools(server);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client.callTool({ name: "ckan_status_show", arguments: { server_url: serverUrl } }) as Promise<{
    isError?: boolean;
    content: { type: string; text: string }[];
  }>;
}

describe("ckan_status_show on a site that is not the CKAN API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
  });

  it.each([
    ["timeout", { code: "ECONNABORTED" }, "Request timeout"],
    ["404", { response: { status: 404, data: {} } }, "CKAN API error (404)"]
  ])("on %s points at discovery, not at itself", async (_label, axiosError, message) => {
    vi.mocked(axios.get).mockRejectedValue(axiosError);

    const result = await callStatus("https://open.ottawa.ca");
    const text = result.content[0].text;

    expect(result.isError).toBe(true);
    expect(text).toContain(message);
    expect(text).toContain("ckan_find_portals");
    expect(text).not.toContain("call `ckan_status_show`");
  });

  it("routes open.toronto.ca to its CKAN API host", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { success: true, result: { ckan_version: "2.10", site_title: "Toronto", site_url: "https://open.toronto.ca" } }
    });

    const result = await callStatus("https://open.toronto.ca");

    expect(result.isError).toBeFalsy();
    expect(String(vi.mocked(axios.get).mock.calls[0][0])).toContain("ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/status_show");
  });
});
