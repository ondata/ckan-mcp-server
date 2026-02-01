import { z } from "zod";
import { createTextPrompt } from "./types.js";
import type { PromptResult } from "./types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const FORMAT_PROMPT_NAME = "ckan-search-by-format";

export const buildFormatPromptText = (serverUrl: string, format: string, rows: number): string => `# Guided search: datasets by resource format

Use \`ckan_package_search\` with a format filter:

ckan_package_search({
  server_url: "${serverUrl}",
  fq: "res_format:${format}",
  sort: "metadata_modified desc",
  rows: ${rows}
})

Tip: try uppercase (CSV/JSON) or common variants if results are sparse.
Note: metadata_modified is a CKAN record timestamp (publish time on source portals,
harvest time on aggregators). If the user asks for
content publication dates, prefer issued (or modified) with explicit ISO ranges.`;

export const registerFormatPrompt = (server: McpServer): void => {
  server.registerPrompt(
    FORMAT_PROMPT_NAME,
    {
      title: "Search datasets by resource format",
      description: "Guided prompt to find datasets with a given resource format.",
      argsSchema: {
        server_url: z.string().url().describe("Base URL of the CKAN server"),
        format: z.string().min(1).describe("Resource format (e.g., CSV, JSON)"),
        rows: z.coerce.number().int().positive().default(10).describe("Max results to return")
      }
    },
    async ({ server_url, format, rows }): Promise<PromptResult> =>
      createTextPrompt(buildFormatPromptText(server_url, format, rows))
  );
};
