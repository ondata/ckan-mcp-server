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
    vi.restoreAllMocks();
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

  // datashades.info lists active portals with no default locale (3 of 945 on
  // 2026-11-15): the language filter crashed on them, for every language.
  it("filters by language when a portal has no locale", async () => {
    const noLocale = { ...portal("https://ckan.example.org", "No locale", "Italy"), SiteInfo: { site_title: "No locale", locale_default: null } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ portals: [
        noLocale,
        portal("https://dati.comune.milano.it", "Open Data Comune di Milano", "Italy")
      ] }), { status: 200, headers: { "content-type": "application/json" } })
    ));

    const result = await callFindPortals({ language: "it" });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("dati.comune.milano.it");
    expect(result.content[0].text).not.toContain("ckan.example.org");
  });

  it("reports a non-2xx registry answer as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 503, statusText: "Service Unavailable" })));

    const result = await callFindPortals({ country: "Italy" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("503");
  });

  // Every other tool takes response_format; clients sent it here too and the strict
  // schema rejected the call (2 events on 2026-11-17).
  describe("response_format", () => {
    const registry = () => new Response(JSON.stringify({ portals: [
      portal("https://dati.comune.milano.it", "Open Data Comune di Milano", "Italy")
    ] }), { status: 200, headers: { "content-type": "application/json" } });

    it("json returns the portal list as parseable JSON", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(registry()));

      const result = await callFindPortals({ country: "Italy", response_format: "json" }) as Awaited<ReturnType<typeof callFindPortals>> & { structuredContent?: unknown };

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.portals[0].url).toBe("https://dati.comune.milano.it");
      expect(parsed.portals[0].has_datastore).toBe(true);
      expect(result.structuredContent).toEqual(parsed);
    });

    it("markdown keeps the table", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(registry()));

      const result = await callFindPortals({ country: "Italy", response_format: "markdown" });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain("| Portal |");
    });

    it("json errors stay JSON", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 503, statusText: "Service Unavailable" })));

      const result = await callFindPortals({ country: "Italy", response_format: "json" });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed._error).toBe(true);
      expect(parsed.error).toContain("503");
    });
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

    it("serves the last good portal list with a stale-date line when a refresh fails", async () => {
      let now = Date.parse("2026-11-18T00:00:00Z");
      vi.spyOn(Date, "now").mockImplementation(() => now);

      const fetchMock = vi.fn()
        .mockResolvedValueOnce(registry())
        .mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
      vi.stubGlobal("fetch", fetchMock);

      const fresh = await callFindPortals({ country: "Italy" });
      expect(fresh.isError).toBeFalsy();
      expect(fresh.content[0].text).not.toContain("datashades.info did not answer");

      // Advance past the 6 h fresh TTL while staying within the 7 d last-good TTL
      now += 7 * 3600 * 1000;

      const staleMd = await callFindPortals({ country: "Italy" });
      expect(staleMd.isError).toBeFalsy();
      expect(staleMd.content[0].text).toContain("dati.comune.milano.it");
      expect(staleMd.content[0].text).toContain("portal list from 2026-11-18, datashades.info did not answer");

      const staleJson = await callFindPortals({ country: "Italy", response_format: "json" });
      expect(staleJson.isError).toBeFalsy();
      const parsed = JSON.parse(staleJson.content[0].text);
      expect(parsed.portals[0].url).toBe("https://dati.comune.milano.it");
      expect(parsed.note).toBe("portal list from 2026-11-18, datashades.info did not answer");
    });

    // A 200 with no usable list must not overwrite the last good copy with an empty one.
    it.each([
      ["no portals field", { error: "maintenance" }],
      ["null portals", { portals: null }],
      ["no active portals", { portals: [] }]
    ])("keeps the last good portal list when a refresh answers 200 with %s", async (_label, body) => {
      let now = Date.parse("2026-11-18T00:00:00Z");
      vi.spyOn(Date, "now").mockImplementation(() => now);

      const fetchMock = vi.fn()
        .mockResolvedValueOnce(registry())
        .mockImplementation(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
      vi.stubGlobal("fetch", fetchMock);

      await callFindPortals({ country: "Italy" });
      now += 7 * 3600 * 1000;

      const stale = await callFindPortals({ country: "Italy" });
      expect(stale.isError).toBeFalsy();
      expect(stale.content[0].text).toContain("dati.comune.milano.it");
      expect(stale.content[0].text).toContain("portal list from 2026-11-18, datashades.info did not answer");

      // The fallback did not overwrite the last good copy: a later failure still finds it.
      const again = await callFindPortals({ country: "Italy" });
      expect(again.content[0].text).toContain("dati.comune.milano.it");
    });

    it("fails when fetch rejects and no last good copy exists", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      );

      const result = await callFindPortals({ country: "Italy" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Could not fetch portal list from datashades.info");
    });

    it("shares one in-flight fetch across concurrent calls during a refresh", async () => {
      const fetchMock = vi.fn().mockImplementation(async () => registry());
      vi.stubGlobal("fetch", fetchMock);

      const [italy, canada] = await Promise.all([
        callFindPortals({ country: "Italy" }),
        callFindPortals({ country: "Canada" })
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(italy.content[0].text).toContain("dati.comune.milano.it");
      expect(canada.content[0].text).toContain("open.canada.ca");
    });
  });
});
