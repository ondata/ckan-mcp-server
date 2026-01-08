/**
 * CKAN Resource Resource Template
 *
 * URI: ckan://{server}/resource/{id}
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText } from "../utils/formatting.js";
import { parseCkanUri } from "./uri.js";

export function registerResourceResource(server: McpServer) {
  server.registerResource(
    "ckan-resource",
    new ResourceTemplate("ckan://{server}/resource/{id}", { list: undefined }),
    {
      title: "CKAN Resource",
      description:
        "Access resource metadata and download URL from any CKAN server. URI format: ckan://{server}/resource/{id}",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      try {
        const { server: serverUrl } = parseCkanUri(uri);
        const id = variables.id as string;

        const result = await makeCkanRequest<any>(serverUrl, "resource_show", {
          id,
        });

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
              text: `Error fetching resource: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );
}
