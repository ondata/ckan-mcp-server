/**
 * Portal Discovery tool — finds CKAN portals via datashades.info registry
 */

import { z } from "zod";
import axios from "axios";
import { addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DATASHADES_URL = "https://datashades.info/api/portal/list";

interface DatashadesPortal {
  Href: string;
  SiteInfo: { site_title: string; locale_default: string };
  Coordinates: { country_name: string };
  Version: string;
  Plugins: string[];
  DatasetsNumber: number;
  OrgNumber: number;
  status: string;
}

async function fetchPortals(): Promise<DatashadesPortal[]> {
  const resp = await axios.get<{ portals: DatashadesPortal[] }>(DATASHADES_URL, {
    timeout: 15000,
    headers: { "User-Agent": "CKAN-MCP-Server/1.0" }
  });
  return resp.data.portals;
}

function filterPortals(
  portals: DatashadesPortal[],
  params: {
    country?: string;
    query?: string;
    min_datasets?: number;
    language?: string;
    has_datastore?: boolean;
    limit: number;
  }
): DatashadesPortal[] {
  return portals
    .filter(p => p.status === "active" && p.Href)
    .filter(p => !params.country || p.Coordinates.country_name.toLowerCase().includes(params.country.toLowerCase()))
    .filter(p => !params.query || p.SiteInfo.site_title.toLowerCase().includes(params.query.toLowerCase()))
    .filter(p => params.min_datasets === undefined || p.DatasetsNumber >= params.min_datasets)
    .filter(p => !params.language || p.SiteInfo.locale_default.toLowerCase().startsWith(params.language.toLowerCase()))
    .filter(p => !params.has_datastore || (p.Plugins || []).includes("datastore"))
    .sort((a, b) => b.DatasetsNumber - a.DatasetsNumber)
    .slice(0, params.limit);
}

function formatMarkdown(portals: DatashadesPortal[], total: number, limit: number): string {
  if (portals.length === 0) return "No CKAN portals found matching the given filters.";

  const rows = portals.map(p =>
    `| [${p.SiteInfo.site_title || p.Href}](${p.Href}) | ${p.Coordinates.country_name} | ${p.Version} | ${p.DatasetsNumber.toLocaleString()} | ${p.SiteInfo.locale_default} | ${(p.Plugins || []).includes("datastore") ? "✅" : "❌"} |`
  ).join("\n");

  return `# CKAN Portals

**Source**: [datashades.info](https://datashades.info/portals) — live registry of ${total} active portals
**Showing**: ${portals.length} of ${total} (filtered, sorted by dataset count)

| Portal | Country | CKAN | Datasets | Locale | DataStore |
|--------|---------|------|----------|--------|-----------|
${rows}

---
💡 Use the portal URL as \`server_url\` in any CKAN tool.`;
}

export function registerPortalDiscoveryTools(server: McpServer) {
  server.registerTool(
    "ckan_find_portals",
    {
      title: "Find CKAN Portals",
      description: `Search the live datashades.info registry of ~950 CKAN portals worldwide.

Use this tool to discover which CKAN portals exist for a country, language, or topic
before querying them with other CKAN tools.

**IMPORTANT — country parameter**: always pass country name in English.
If the user writes in another language (e.g. "Italia", "España", "Brasil"),
translate to English ("Italy", "Spain", "Brazil") before calling this tool.

Args:
  - country (string): Country name in English (e.g. "Italy", "Brazil", "France")
  - query (string): Keyword to match against portal title (e.g. "transport", "health")
  - min_datasets (number): Minimum number of datasets (e.g. 100)
  - language (string): Portal default locale code (e.g. "it", "en", "pt_BR", "fr")
  - has_datastore (boolean): If true, return only portals with DataStore enabled (supports SQL queries)
  - limit (number): Max results to return (default 10, max 50)

Returns:
  Ranked list of matching portals with URL, country, CKAN version, dataset count, and DataStore status.

Typical workflow: ckan_find_portals (discover portal URL) → ckan_status_show (verify) → ckan_package_search (search datasets)`,
      inputSchema: z.object({
        country: z.string().optional().describe("Country name in English (e.g. 'Italy', 'Brazil'). Translate from any language before passing."),
        query: z.string().optional().describe("Keyword matched against portal title (case-insensitive)"),
        min_datasets: z.coerce.number().int().min(0).optional().describe("Minimum number of datasets"),
        language: z.string().optional().describe("Portal default locale code (e.g. 'it', 'en', 'pt_BR')"),
        has_datastore: z.boolean().optional().describe("If true, return only portals with DataStore plugin (required for SQL queries)"),
        limit: z.coerce.number().int().min(1).max(50).optional().default(10).describe("Max results (default 10, max 50)")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const all = await fetchPortals();
        const active = all.filter(p => p.status === "active");
        const results = filterPortals(all, {
          country: params.country,
          query: params.query,
          min_datasets: params.min_datasets,
          language: params.language,
          has_datastore: params.has_datastore,
          limit: params.limit
        });

        const markdown = formatMarkdown(results, active.length, params.limit);

        return {
          content: [{ type: "text", text: addDemoFooter(markdown) }],
          structuredContent: { portals: results.map(p => ({
            url: p.Href,
            title: p.SiteInfo.site_title,
            country: p.Coordinates.country_name,
            version: p.Version,
            datasets: p.DatasetsNumber,
            locale: p.SiteInfo.locale_default,
            has_datastore: (p.Plugins || []).includes("datastore")
          }))}
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Could not fetch portal list from datashades.info:\n${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
