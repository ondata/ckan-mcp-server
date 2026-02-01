import { z } from "zod";
import { createTextPrompt } from "./types.js";
import type { PromptResult } from "./types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const ORGANIZATION_PROMPT_NAME = "ckan-search-by-organization";

export const buildOrganizationPromptText = (serverUrl: string, organization: string, rows: number): string => `# Guided search: datasets by organization

## Step 1: Discover matching organizations
Use \`ckan_package_search\` with an organization wildcard and facets:

ckan_package_search({
  server_url: "${serverUrl}",
  q: "organization:*${organization}*",
  rows: 0,
  facet_field: ["organization"],
  facet_limit: 50
})

## Step 2: Search datasets for the chosen organization
Use \`ckan_package_search\` with a filter query:

ckan_package_search({
  server_url: "${serverUrl}",
  fq: "organization:<org-id>",
  sort: "metadata_modified desc",
  rows: ${rows}
})

Note: metadata_modified is a CKAN record timestamp (publish time on source portals,
harvest time on aggregators). If the user asks for
content publication dates, prefer issued (or modified) with explicit ISO ranges.`;

export const registerOrganizationPrompt = (server: McpServer): void => {
  server.registerPrompt(
    ORGANIZATION_PROMPT_NAME,
    {
      title: "Search datasets by organization",
      description: "Guided prompt to find a publisher and list its datasets.",
      argsSchema: {
        server_url: z.string().url().describe("Base URL of the CKAN server"),
        organization: z.string().min(1).describe("Organization name or keyword"),
        rows: z.coerce.number().int().positive().default(10).describe("Max results to return")
      }
    },
    async ({ server_url, organization, rows }): Promise<PromptResult> =>
      createTextPrompt(buildOrganizationPromptText(server_url, organization, rows))
  );
};
