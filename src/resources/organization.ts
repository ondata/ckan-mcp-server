/**
 * CKAN Organization Resource Template
 *
 * URI: ckan://{server}/organization/{name}
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText } from "../utils/formatting.js";
import { parseCkanUri } from "./uri.js";

export function registerOrganizationResource(server: McpServer) {
  server.registerResource(
    "ckan-organization",
    new ResourceTemplate("ckan://{server}/organization/{name}", {
      list: undefined,
    }),
    {
      title: "CKAN Organization",
      description:
        "Access organization metadata from any CKAN server. URI format: ckan://{server}/organization/{name}",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      try {
        const { server: serverUrl } = parseCkanUri(uri);
        const name = variables.name as string;

        const result = await makeCkanRequest<any>(
          serverUrl,
          "organization_show",
          {
            id: name,
            include_datasets: false,
          }
        );

        const content = truncateText(JSON.stringify(result, null, 2));

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: content,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error fetching organization: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );
}
