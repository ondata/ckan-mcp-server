/**
 * CKAN Dataset Filter Resource Templates
 *
 * URIs:
 * - ckan://{server}/group/{name}/datasets
 * - ckan://{server}/organization/{name}/datasets
 * - ckan://{server}/tag/{name}/datasets
 * - ckan://{server}/format/{format}/datasets
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText } from "../utils/formatting.js";
import { parseCkanUri } from "./uri.js";

type FilterConfig = {
  name: string;
  template: string;
  title: string;
  description: string;
  buildFq: (variables: Record<string, string>) => string;
};

const escapeSolrTerm = (value: string): string => value.replace(/["\\]/g, "\\$&");

const buildFormatFilter = (rawFormat: string): string => {
  const format = rawFormat.trim();
  const variants = [format];
  const upper = format.toUpperCase();
  if (upper !== format) {
    variants.push(upper);
  }

  const fields = ["res_format", "distribution_format"];
  const clauses = fields.flatMap((field) =>
    variants.map((value) => `${field}:"${escapeSolrTerm(value)}"`)
  );

  return `(${clauses.join(" OR ")})`;
};

const registerDatasetFilterResource = (server: McpServer, config: FilterConfig) => {
  server.registerResource(
    config.name,
    new ResourceTemplate(config.template, { list: undefined }),
    {
      title: config.title,
      description: config.description,
      mimeType: "application/json",
    },
    async (uri, variables) => {
      try {
        const { server: serverUrl } = parseCkanUri(uri);
        const fq = config.buildFq(variables as Record<string, string>);

        const result = await makeCkanRequest<any>(serverUrl, "package_search", {
          q: "*:*",
          fq,
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
              text: `Error fetching datasets: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );
};

export function registerGroupDatasetsResource(server: McpServer) {
  registerDatasetFilterResource(server, {
    name: "ckan-group-datasets",
    template: "ckan://{server}/group/{name}/datasets",
    title: "CKAN Group Datasets",
    description:
      "List datasets in a CKAN group (theme). URI format: ckan://{server}/group/{name}/datasets",
    buildFq: (variables) => `groups:"${escapeSolrTerm(variables.name)}"`,
  });
}

export function registerOrganizationDatasetsResource(server: McpServer) {
  registerDatasetFilterResource(server, {
    name: "ckan-organization-datasets",
    template: "ckan://{server}/organization/{name}/datasets",
    title: "CKAN Organization Datasets",
    description:
      "List datasets for a CKAN organization. URI format: ckan://{server}/organization/{name}/datasets",
    buildFq: (variables) => `organization:"${escapeSolrTerm(variables.name)}"`,
  });
}

export function registerTagDatasetsResource(server: McpServer) {
  registerDatasetFilterResource(server, {
    name: "ckan-tag-datasets",
    template: "ckan://{server}/tag/{name}/datasets",
    title: "CKAN Tag Datasets",
    description:
      "List datasets matching a CKAN tag. URI format: ckan://{server}/tag/{name}/datasets",
    buildFq: (variables) => `tags:"${escapeSolrTerm(variables.name)}"`,
  });
}

export function registerFormatDatasetsResource(server: McpServer) {
  registerDatasetFilterResource(server, {
    name: "ckan-format-datasets",
    template: "ckan://{server}/format/{format}/datasets",
    title: "CKAN Format Datasets",
    description:
      "List datasets by resource format. URI format: ckan://{server}/format/{format}/datasets",
    buildFq: (variables) => buildFormatFilter(variables.format),
  });
}
