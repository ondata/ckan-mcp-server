/**
 * CKAN Group tools
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, formatDate, addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type GroupFacetItem = {
  name: string;
  display_name?: string;
  count: number;
};

function getGroupViewUrl(serverUrl: string, group: { name?: string }): string {
  const cleanServerUrl = serverUrl.replace(/\/$/, '');
  return `${cleanServerUrl}/group/${group.name}`;
}

function normalizeGroupFacets(result: any): GroupFacetItem[] {
  const items = result?.search_facets?.groups?.items;
  if (Array.isArray(items)) {
    return items.map((item: any) => ({
      name: item?.name || item?.display_name || String(item),
      display_name: item?.display_name,
      count: typeof item?.count === 'number' ? item.count : 0
    }));
  }

  const facets = result?.facets?.groups;
  if (Array.isArray(facets)) {
    if (facets.length > 0 && typeof facets[0] === 'object') {
      return facets.map((item: any) => ({
        name: item?.name || item?.display_name || String(item),
        display_name: item?.display_name,
        count: typeof item?.count === 'number' ? item.count : 0
      }));
    }
    return facets.map((name: string) => ({ name, count: 0 }));
  }

  if (facets && typeof facets === 'object') {
    return Object.entries(facets).map(([name, count]) => ({
      name,
      count: typeof count === 'number' ? count : Number(count) || 0
    }));
  }

  return [];
}

export function registerGroupTools(server: McpServer) {
  server.registerTool(
    "ckan_group_list",
    {
      title: "List CKAN Groups",
      description: `List all groups on a CKAN server.

Groups are thematic collections of datasets.

Args:
  - server_url (string): Base URL of CKAN server
  - all_fields (boolean): Return full objects vs just names (default: false)
  - sort (string): Sort field (default: "name asc")
  - limit (number): Maximum results (default: 100). Use 0 to get only the count via faceting
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of groups with metadata. When limit=0, returns only the count of groups with datasets.

Typical workflow: ckan_group_list → ckan_group_show (inspect one) → ckan_package_search with fq="groups:name" (browse its datasets)`,
      inputSchema: z.object({
        server_url: z.string().url(),
        all_fields: z.boolean().optional().default(false),
        sort: z.string().optional().default("name asc"),
        limit: z.number().int().min(0).optional().default(100),
        offset: z.number().int().min(0).optional().default(0),
        response_format: ResponseFormatSchema
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
        if (params.limit === 0) {
          const searchResult = await makeCkanRequest<any>(
            params.server_url,
            'package_search',
            {
              rows: 0,
              'facet.field': JSON.stringify(['groups']),
              'facet.limit': -1
            }
          );

          const groupCount = searchResult.search_facets?.groups?.items?.length || 0;

          if (params.response_format === ResponseFormat.JSON) {
            return {
              content: [{ type: "text", text: JSON.stringify({ count: groupCount }, null, 2) }],
              structuredContent: { count: groupCount }
            };
          }

          const markdown = `# CKAN Groups Count\n\n**Server**: ${params.server_url}\n**Total groups (with datasets)**: ${groupCount}\n`;

          return {
            content: [{ type: "text", text: markdown }]
          };
        }

        const result = await makeCkanRequest<any>(
          params.server_url,
          'group_list',
          {
            all_fields: params.all_fields,
            sort: params.sort,
            limit: params.limit,
            offset: params.offset
          }
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = Array.isArray(result)
            ? { count: result.length, groups: result }
            : result;
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(output, null, 2)) }],
            structuredContent: output
          };
        }

        let markdown = `# CKAN Groups\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Total**: ${Array.isArray(result) ? result.length : 'Unknown'}\n\n`;

        if (Array.isArray(result)) {
          if (params.all_fields) {
            for (const group of result) {
              markdown += `## ${group.title || group.name}\n\n`;
              markdown += `- **ID**: \`${group.id}\`\n`;
              markdown += `- **Name**: \`${group.name}\`\n`;
              if (group.description) markdown += `- **Description**: ${group.description.substring(0, 200)}\n`;
              markdown += `- **Datasets**: ${group.package_count || 0}\n`;
              markdown += `- **Created**: ${formatDate(group.created)}\n`;
              markdown += `- **Link**: ${getGroupViewUrl(params.server_url, group)}\n\n`;
            }
          } else {
            markdown += result.map((name: string) => `- ${name}`).join('\n');
          }
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing groups: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "ckan_group_show",
    {
      title: "Show CKAN Group Details",
      description: `Get details of a specific group.

Args:
  - server_url (string): Base URL of CKAN server
  - id (string): Group ID or name
  - include_datasets (boolean): Include list of datasets (default: true)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Group details with optional datasets

Typical workflow: ckan_group_show → ckan_package_show (inspect a dataset) → ckan_datastore_search (query its data)`,
      inputSchema: z.object({
        server_url: z.string().url(),
        id: z.string().min(1),
        include_datasets: z.boolean().optional().default(true),
        response_format: ResponseFormatSchema
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
        const result = await makeCkanRequest<any>(
          params.server_url,
          'group_show',
          {
            id: params.id,
            include_datasets: params.include_datasets
          }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(result, null, 2)) }],
            structuredContent: result
          };
        }

        let markdown = `# Group: ${result.title || result.name}\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Link**: ${getGroupViewUrl(params.server_url, result)}\n\n`;

        markdown += `## Details\n\n`;
        markdown += `- **ID**: \`${result.id}\`\n`;
        markdown += `- **Name**: \`${result.name}\`\n`;
        markdown += `- **Datasets**: ${result.package_count || 0}\n`;
        markdown += `- **Created**: ${formatDate(result.created)}\n`;
        markdown += `- **State**: ${result.state}\n\n`;

        if (result.description) {
          markdown += `## Description\n\n${result.description}\n\n`;
        }

        if (result.packages && result.packages.length > 0) {
          markdown += `## Datasets (${result.packages.length})\n\n`;
          for (const pkg of result.packages.slice(0, 20)) {
            markdown += `- **${pkg.title || pkg.name}** (\`${pkg.name}\`)\n`;
          }
          if (result.packages.length > 20) {
            markdown += `\n... and ${result.packages.length - 20} more datasets\n`;
          }
          markdown += '\n';
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching group: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "ckan_group_search",
    {
      title: "Search CKAN Groups by Name",
      description: `Search for groups by name pattern.

This tool provides a simpler interface than package_search for finding groups.
Wildcards are automatically added around the search pattern.

Args:
  - server_url (string): Base URL of CKAN server
  - pattern (string): Search pattern (e.g., "energia", "salute")
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of matching groups with dataset counts

Typical workflow: ckan_group_search → ckan_group_show (get details) → ckan_package_search with fq="groups:name"`,
      inputSchema: z.object({
        server_url: z.string().url(),
        pattern: z.string().min(1).describe("Search pattern (wildcards added automatically)"),
        response_format: ResponseFormatSchema
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
        const query = `groups:*${params.pattern}*`;

        const result = await makeCkanRequest<any>(
          params.server_url,
          'package_search',
          {
            q: query,
            rows: 0,
            'facet.field': JSON.stringify(['groups']),
            'facet.limit': 500
          }
        );

        const groupFacets = normalizeGroupFacets(result);
        const totalDatasets = result.count || 0;

        if (params.response_format === ResponseFormat.JSON) {
          const jsonResult = {
            count: groupFacets.length,
            total_datasets: totalDatasets,
            groups: groupFacets.map(group => ({
              name: group.name,
              display_name: group.display_name,
              dataset_count: group.count
            }))
          };

          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(jsonResult, null, 2)) }],
            structuredContent: jsonResult
          };
        }

        let markdown = `# CKAN Group Search Results\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Pattern**: "${params.pattern}"\n`;
        markdown += `**Groups Found**: ${groupFacets.length}\n`;
        markdown += `**Total Datasets**: ${totalDatasets}\n\n`;

        if (groupFacets.length === 0) {
          markdown += `No groups found matching pattern "${params.pattern}".\n`;
        } else {
          markdown += `## Matching Groups\n\n`;
          markdown += `| Group | Datasets |\n`;
          markdown += `|-------|----------|\n`;

          for (const group of groupFacets) {
            markdown += `| ${group.display_name || group.name} | ${group.count} |\n`;
          }
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching groups: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
