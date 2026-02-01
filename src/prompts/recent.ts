import { z } from "zod";
import { createTextPrompt } from "./types.js";
import type { PromptResult } from "./types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const RECENT_PROMPT_NAME = "ckan-recent-datasets";

export const buildRecentPromptText = (serverUrl: string, rows: number): string => `# Guided search: recent datasets

Use \`ckan_package_search\` sorted by metadata modification date (CKAN record updates,
publish time on source portals, harvest time on aggregators):

ckan_package_search({
  server_url: "${serverUrl}",
  q: "*:*",
  sort: "metadata_modified desc",
  rows: ${rows}
})

Optional: add a date filter for the last N days (record metadata):

ckan_package_search({
  server_url: "${serverUrl}",
  q: "metadata_modified:[NOW-30DAYS TO *]",
  sort: "metadata_modified desc",
  rows: ${rows}
})

If the user asks for recent content publication dates, prefer \`issued\` (or \`modified\`)
from the publisher and use explicit ISO date ranges:

ckan_package_search({
  server_url: "${serverUrl}",
  q: "issued:[2025-01-01T00:00:00Z TO *]",
  sort: "issued desc",
  rows: ${rows}
})

Or use the helper flag to apply issued with a metadata_created fallback:

ckan_package_search({
  server_url: "${serverUrl}",
  content_recent: true,
  content_recent_days: 30,
  rows: ${rows}
})`;

export const registerRecentPrompt = (server: McpServer): void => {
  server.registerPrompt(
    RECENT_PROMPT_NAME,
    {
      title: "Find recently updated datasets",
      description: "Guided prompt to list recently updated datasets on a CKAN portal.",
      argsSchema: {
        server_url: z.string().url().describe("Base URL of the CKAN server"),
        rows: z.coerce.number().int().positive().default(10).describe("Max results to return")
      }
    },
    async ({ server_url, rows }): Promise<PromptResult> =>
      createTextPrompt(buildRecentPromptText(server_url, rows))
  );
};
