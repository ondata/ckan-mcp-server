/**
 * CKAN Organization tools
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, formatDate, addDemoFooter } from "../utils/formatting.js";
import { getOrganizationViewUrl } from "../utils/url-generator.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerOrganizationTools(server: McpServer) {
  /**
   * List all organizations
   */
  server.registerTool(
    "ckan_organization_list",
    {
      title: "List CKAN Organizations",
      description: `List all organizations on a CKAN server.

Organizations are entities that publish and manage datasets.

Args:
  - server_url (string): Base URL of CKAN server
  - all_fields (boolean): Return full objects vs just names (default: false)
  - sort (string): Sort field (default: "name asc")
  - limit (number): Maximum results (default: 100). Use 0 to get only the count via faceting
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of organizations with metadata. When limit=0, returns only the count of organizations with datasets.`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        all_fields: z.boolean().optional().default(false).describe("Return full organization objects (true) or just name slugs (false)"),
        sort: z.string().optional().default("name asc").describe("Sort field and direction (e.g., 'name asc', 'package_count desc')"),
        limit: z.number().int().min(0).optional().default(100).describe("Max organizations to return. Use 0 to get only the count via faceting"),
        offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
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
        // Special case: limit=0 means only return count using faceting
        if (params.limit === 0) {
          const searchResult = await makeCkanRequest<any>(
            params.server_url,
            'package_search',
            {
              rows: 0,
              'facet.field': JSON.stringify(['organization']),
              'facet.limit': -1
            }
          );

          const orgCount = searchResult.search_facets?.organization?.items?.length || 0;

          if (params.response_format === ResponseFormat.JSON) {
            return {
              content: [{ type: "text", text: JSON.stringify({ count: orgCount }, null, 2) }],
              structuredContent: { count: orgCount }
            };
          }

          const markdown = `# CKAN Organizations Count\n\n**Server**: ${params.server_url}\n**Total organizations (with datasets)**: ${orgCount}\n`;

          return {
            content: [{ type: "text", text: markdown }]
          };
        }

        // Normal case: list organizations
        let result: any;
        try {
          result = await makeCkanRequest<any>(
            params.server_url,
            'organization_list',
            {
              all_fields: params.all_fields,
              sort: params.sort,
              limit: params.limit,
              offset: params.offset
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('CKAN API error (500)')) {
            const searchResult = await makeCkanRequest<any>(
              params.server_url,
              'package_search',
              {
                rows: 0,
                'facet.field': JSON.stringify(['organization']),
                'facet.limit': -1
              }
            );

            const items = searchResult.search_facets?.organization?.items || [];
            const sortValue = params.sort?.toLowerCase() ?? 'name asc';
            const sortedItems = [...items].sort((a: any, b: any) => {
              if (sortValue.includes('package_count') || sortValue.includes('count')) {
                return b.count - a.count;
              }
              if (sortValue.includes('name desc')) {
                return String(b.name).localeCompare(String(a.name));
              }
              return String(a.name).localeCompare(String(b.name));
            });

            const pagedItems = sortedItems.slice(params.offset, params.offset + params.limit);
            const organizations = pagedItems.map((item: any) => ({
              id: item.name,
              name: item.name,
              title: item.display_name || item.name,
              package_count: item.count
            }));

            if (params.response_format === ResponseFormat.JSON) {
              const output = { count: items.length, organizations };
              return {
                content: [{ type: "text", text: truncateText(JSON.stringify(output, null, 2)) }],
                structuredContent: output
              };
            }

            let markdown = `# CKAN Organizations\n\n`;
            markdown += `**Server**: ${params.server_url}\n`;
            markdown += `**Total**: ${items.length}\n`;
            markdown += `\nNote: organization_list returned 500; using package_search facets.\n\n`;
            for (const org of organizations) {
              markdown += `## ${org.title || org.name}\n\n`;
              markdown += `- **Name**: \`${org.name}\`\n`;
              markdown += `- **Datasets**: ${org.package_count || 0}\n`;
              markdown += `- **Link**: ${getOrganizationViewUrl(params.server_url, org)}\n\n`;
            }

            return {
              content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
            };
          }
          throw error;
        }

        if (params.response_format === ResponseFormat.JSON) {
          const output = Array.isArray(result)
            ? { count: result.length, organizations: result }
            : result;
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(output, null, 2)) }],
            structuredContent: output
          };
        }

        let markdown = `# CKAN Organizations\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Total**: ${Array.isArray(result) ? result.length : 'Unknown'}\n\n`;

        if (Array.isArray(result)) {
          if (params.all_fields) {
            for (const org of result) {
              markdown += `## ${org.title || org.name}\n\n`;
              markdown += `- **ID**: \`${org.id}\`\n`;
              markdown += `- **Name**: \`${org.name}\`\n`;
              if (org.description) markdown += `- **Description**: ${org.description.substring(0, 200)}\n`;
              markdown += `- **Datasets**: ${org.package_count || 0}\n`;
              markdown += `- **Created**: ${formatDate(org.created)}\n`;
              markdown += `- **Link**: ${getOrganizationViewUrl(params.server_url, org)}\n\n`;
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
            text: `Error listing organizations: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * Show organization details
   */
  server.registerTool(
    "ckan_organization_show",
    {
      title: "Show CKAN Organization Details",
      description: `Get details of a specific organization.

Args:
  - server_url (string): Base URL of CKAN server
  - id (string): Organization ID or name
  - include_datasets (boolean): Include list of datasets (default: true)
  - include_users (boolean): Include list of users (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Organization details with optional datasets and users`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        id: z.string().min(1).describe("Organization ID (UUID) or machine-readable name slug (e.g., 'regione-siciliana')"),
        include_datasets: z.boolean().optional().default(true).describe("Include the list of datasets published by this organization"),
        include_users: z.boolean().optional().default(false).describe("Include the list of users belonging to this organization"),
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
          'organization_show',
          {
            id: params.id,
            include_datasets: params.include_datasets,
            include_users: params.include_users
          }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(result, null, 2)) }],
            structuredContent: result
          };
        }

        let markdown = `# Organization: ${result.title || result.name}\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Link**: ${getOrganizationViewUrl(params.server_url, result)}\n\n`;

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

        if (result.users && result.users.length > 0) {
          markdown += `## Users (${result.users.length})\n\n`;
          for (const user of result.users) {
            markdown += `- **${user.name}** (${user.capacity})\n`;
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
            text: `Error fetching organization: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * Search organizations by name pattern
   */
  server.registerTool(
    "ckan_organization_search",
    {
      title: "Search CKAN Organizations by Name",
      description: `Search for organizations by name pattern.

This tool provides a simpler interface than package_search for finding organizations.
Wildcards are automatically added around the search pattern.

Args:
  - server_url (string): Base URL of CKAN server
  - pattern (string): Search pattern (e.g., "toscana", "salute")
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of matching organizations with dataset counts

Examples:
  - { server_url: "https://www.dati.gov.it/opendata", pattern: "toscana" }
  - { server_url: "https://catalog.data.gov", pattern: "health" }`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        pattern: z.string().min(1).describe("Name pattern to search for (wildcards added automatically, e.g., 'toscana', 'health')"),
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
        // Build Solr query with wildcards
        const query = `organization:*${params.pattern}*`;

        // Search using package_search with faceting
        const result = await makeCkanRequest<any>(
          params.server_url,
          'package_search',
          {
            q: query,
            rows: 0,
            'facet.field': JSON.stringify(['organization']),
            'facet.limit': 500
          }
        );

        // Extract organization facets
        const orgFacets = result.search_facets?.organization?.items || [];
        const totalDatasets = result.count || 0;

        if (params.response_format === ResponseFormat.JSON) {
          const jsonResult = {
            count: orgFacets.length,
            total_datasets: totalDatasets,
            organizations: orgFacets.map((item: any) => ({
              name: item.name,
              display_name: item.display_name,
              dataset_count: item.count
            }))
          };

          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(jsonResult, null, 2)) }],
            structuredContent: jsonResult
          };
        }

        // Markdown format
        let markdown = `# CKAN Organization Search Results\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Pattern**: "${params.pattern}"\n`;
        markdown += `**Organizations Found**: ${orgFacets.length}\n`;
        markdown += `**Total Datasets**: ${totalDatasets}\n\n`;

        if (orgFacets.length === 0) {
          markdown += `No organizations found matching pattern "${params.pattern}".\n`;
        } else {
          markdown += `## Matching Organizations\n\n`;
          markdown += `| Organization | Datasets |\n`;
          markdown += `|--------------|----------|\n`;

          for (const org of orgFacets) {
            markdown += `| ${org.display_name || org.name} | ${org.count} |\n`;
          }
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching organizations: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
