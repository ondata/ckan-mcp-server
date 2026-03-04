/**
 * CKAN Status tools
 */

import { z } from "zod";
import { makeCkanRequest } from "../utils/http.js";
import { addDemoFooter } from "../utils/formatting.js";
import { getPortalSparqlConfig, getPortalHvdConfig } from "../utils/portal-config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function formatStatusMarkdown(result: { ckan_version?: string; site_title?: string; site_url?: string }, serverUrl: string, hvdCount?: number): string {
  const sparql = getPortalSparqlConfig(serverUrl);
  const sparqlLine = sparql ? `**SPARQL Endpoint**: ${sparql.endpoint_url}\n` : "";
  const hvdLine = hvdCount !== undefined ? `**HVD Datasets**: ${hvdCount}\n` : "";
  return `# CKAN Server Status\n\n` +
    `**Server**: ${serverUrl}\n` +
    `**Status**: ✅ Online\n` +
    `**CKAN Version**: ${result.ckan_version || 'Unknown'}\n` +
    `**Site Title**: ${result.site_title || 'N/A'}\n` +
    `**Site URL**: ${result.site_url || 'N/A'}\n` +
    sparqlLine +
    hvdLine;
}

export function registerStatusTools(server: McpServer) {
  /**
   * Check CKAN server status
   */
  server.registerTool(
    "ckan_status_show",
    {
      title: "Check CKAN Server Status",
      description: `Check if a CKAN server is available and get version information.

Useful to verify server accessibility before making other requests.

Args:
  - server_url (string): Base URL of CKAN server

Returns:
  Server status and version information

Typical workflow: ckan_status_show (verify server is up) → ckan_package_search (discover datasets)`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const hvdConfig = getPortalHvdConfig(params.server_url);

        const [result, hvdCount] = await Promise.all([
          makeCkanRequest<any>(params.server_url, 'status_show', {}),
          hvdConfig
            ? makeCkanRequest<any>(params.server_url, 'package_search', { fq: `${hvdConfig.category_field}:*`, rows: 0 })
                .then((r) => r.count as number)
                .catch(() => undefined)
            : Promise.resolve(undefined)
        ]);

        const markdown = formatStatusMarkdown(result, params.server_url, hvdCount);

        return {
          content: [{ type: "text", text: addDemoFooter(markdown) }],
          structuredContent: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Server appears to be offline or not a valid CKAN instance:\n${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
