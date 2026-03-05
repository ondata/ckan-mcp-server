import { z } from "zod";
import { createTextPrompt } from "./types.js";
import type { PromptResult } from "./types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPortalHvdConfig } from "../utils/portal-config.js";

export const HVD_PROMPT_NAME = "ckan-search-hvd";

export const buildHvdPromptText = (serverUrl: string, rows: number, categoryField: string | null): string => {
  if (!categoryField) {
    return `# High-Value Datasets (HVD) search

The portal **${serverUrl}** does not have a known HVD configuration.

You can try a generic search using the tag or keyword "hvd":

\`\`\`
ckan_package_search({
  server_url: "${serverUrl}",
  q: "hvd",
  rows: ${rows}
})
\`\`\`

If the portal supports HVD classification, look for datasets with fields like \`hvd_category\` or \`applicable_legislation\`.`;
  }

  return `# High-Value Datasets (HVD) search

The portal **${serverUrl}** classifies HVDs using the field \`${categoryField}\`.

## Step 1: Count and list HVD datasets

\`\`\`
ckan_package_search({
  server_url: "${serverUrl}",
  fq: "${categoryField}:*",
  rows: ${rows},
  facet_field: ["${categoryField}"]
})
\`\`\`

This returns all datasets tagged as High-Value Datasets with a breakdown by HVD category.

## Step 2: Filter by specific HVD category (optional)

If the user wants a specific HVD category (e.g. geospatial, statistical), use the URI value from the facets above:

\`\`\`
ckan_package_search({
  server_url: "${serverUrl}",
  fq: "${categoryField}:<category_uri>",
  rows: ${rows}
})
\`\`\`

Note: HVD categories are defined by EU regulation. Common ones on Italian portals:
- Geospatial: \`http://data.europa.eu/bna/c_ac64a52d\`
- Earth observation & environment: \`http://data.europa.eu/bna/c_dd313021\`
- Statistical: \`http://data.europa.eu/bna/c_e1da4e07\`
- Meteorological: \`http://data.europa.eu/bna/c_164e0bf5\``;
};

export const registerHvdPrompt = (server: McpServer): void => {
  server.registerPrompt(
    HVD_PROMPT_NAME,
    {
      title: "Search High-Value Datasets (HVD)",
      description: "Guided prompt to find High-Value Datasets (HVD) on a CKAN portal. Automatically uses the correct filter field from portal configuration.",
      argsSchema: {
        server_url: z.string().url().describe("Base URL of the CKAN server"),
        rows: z.coerce.number().int().positive().default(10).describe("Max results to return")
      }
    },
    async ({ server_url, rows }): Promise<PromptResult> => {
      const hvdConfig = getPortalHvdConfig(server_url);
      return createTextPrompt(buildHvdPromptText(server_url, rows, hvdConfig?.category_field ?? null));
    }
  );
};
