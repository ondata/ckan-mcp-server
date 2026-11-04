import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { __resetCacheForTests } from "../../src/utils/cache.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerPortalDiscoveryTools } from "../../src/tools/portal-discovery.js";

const portal = (href: string, title: string, country: string) => ({
  Href: href,
  SiteInfo: { site_title: title, locale_default: "it" },
  Coordinates: { country_name: country },
  Version: "2.10",
  Plugins: ["datastore"],
  DatasetsNumber: 100,
  OrgNumber: 5,
  status: "active"
});

async function callFindPortals(args: Record<string, unknown>) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerPortalDiscoveryTools(server);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client.callTool({ name: "ckan_find_portals", arguments: args }) as Promise<{
    isError?: boolean;
    content: { type: string; text: string }[];
  }>;
}

describe("ckan_find_portals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The Workers runtime has fetch but not axios's fetch adapter, so the registry is
  // read through fetch: stubbing it is enough to serve the tool.
  it("reads the datashades.info registry through fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ portals: [
        portal("https://dati.comune.milano.it", "Open Data Comune di Milano", "Italy"),
        portal("https://open.canada.ca/data", "Open Canada", "Canada")
      ] }), { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callFindPortals({ country: "Italy" });

    expect(result.isError).toBeFalsy();
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://datashades.info/api/portal/list");
    expect(result.content[0].text).toContain("dati.comune.milano.it");
    expect(result.content[0].text).not.toContain("open.canada.ca");
  });

  it("reports a non-2xx registry answer as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 503, statusText: "Service Unavailable" })));

    const result = await callFindPortals({ country: "Italy" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("503");
  });

  describe("registry cache", () => {
    const originalEnv = process.env.CKAN_CACHE_ENABLED;
    const registry = () => new Response(JSON.stringify({ portals: [
      portal("https://dati.comune.milano.it", "Open Data Comune di Milano", "Italy"),
      portal("https://open.canada.ca/data", "Open Canada", "Canada")
    ] }), { status: 200, headers: { "content-type": "application/json" } });

    beforeEach(() => {
      __resetCacheForTests();
      process.env.CKAN_CACHE_ENABLED = "true";
    });

    afterEach(() => {
      if (originalEnv === undefined) delete process.env.CKAN_CACHE_ENABLED;
      else process.env.CKAN_CACHE_ENABLED = originalEnv;
      __resetCacheForTests();
    });

    // The registry is 22 MB: on the Worker every call paid 5 s median to download it
    // (telemetry 2026-10-04 to 2026-11-04). Filters change, the list does not.
    it("downloads the registry once for calls with different filters", async () => {
      const fetchMock = vi.fn().mockImplementation(async () => registry());
      vi.stubGlobal("fetch", fetchMock);

      const italy = await callFindPortals({ country: "Italy" });
      const canada = await callFindPortals({ country: "Canada" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(italy.content[0].text).toContain("dati.comune.milano.it");
      expect(canada.content[0].text).toContain("open.canada.ca");
      expect(canada.content[0].text).not.toContain("dati.comune.milano.it");
      expect(canada.content[0].text).toContain("| ✅ |");
    });

    it("downloads every time when the cache is disabled", async () => {
      process.env.CKAN_CACHE_ENABLED = "false";
      const fetchMock = vi.fn().mockImplementation(async () => registry());
      vi.stubGlobal("fetch", fetchMock);

      await callFindPortals({ country: "Italy" });
      await callFindPortals({ country: "Italy" });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
