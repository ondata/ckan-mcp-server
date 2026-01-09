/**
 * CKAN Package (Dataset) tools
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, formatDate } from "../utils/formatting.js";
import { getDatasetViewUrl } from "../utils/url-generator.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPackageTools(server: McpServer) {
  /**
   * Search for datasets on a CKAN server
   */
  server.registerTool(
    "ckan_package_search",
    {
      title: "Search CKAN Datasets",
      description: `Search for datasets (packages) on a CKAN server using Solr query syntax.

Supports full Solr search capabilities including filters, facets, and sorting.
Use this to discover datasets matching specific criteria.

Args:
  - server_url (string): Base URL of CKAN server (e.g., "https://dati.gov.it")
  - q (string): Search query using Solr syntax (default: "*:*" for all)
  - fq (string): Filter query (e.g., "organization:comune-palermo")
  - rows (number): Number of results to return (default: 10, max: 1000)
  - start (number): Offset for pagination (default: 0)
  - sort (string): Sort field and direction (e.g., "metadata_modified desc")
  - facet_field (array): Fields to facet on (e.g., ["organization", "tags"])
  - facet_limit (number): Max facet values per field (default: 50)
  - include_drafts (boolean): Include draft datasets (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Search results with:
  - count: Number of results found
  - results: Array of dataset objects
  - facets: Facet counts (if facet_field specified)
  - search_facets: Detailed facet information

Query Syntax (parameter q):
  Boolean operators:
    - AND / &&: "water AND climate"
    - OR / ||: "health OR sanità"
    - NOT / !: "data NOT personal"
    - +required -excluded: "+title:water -title:sea"
    - Grouping: "(title:water OR title:climate) AND tags:environment"

  Wildcards:
    - *: "title:environment*" (matches environmental, environments, etc.)
    - Note: Left truncation (*water) not supported

  Fuzzy search (edit distance):
    - ~: "title:rest~" or "title:rest~1" (finds "test", "best", "rest")

  Proximity search (words within N positions):
    - "phrase"~N: "title:\"climate change\"~5"

  Range queries:
    - Inclusive [a TO b]: "num_resources:[5 TO 10]"
    - Exclusive {a TO b}: "num_resources:{0 TO 100}"
    - One side open: "metadata_modified:[2024-01-01T00:00:00Z TO *]"

  Date math:
    - NOW-1YEAR, NOW-6MONTHS, NOW-7DAYS, NOW-1HOUR
    - NOW/DAY, NOW/MONTH (round down)
    - Combined: "metadata_modified:[NOW-2MONTHS TO NOW]"
    - Example: "metadata_created:[NOW-1YEAR TO *]"

  Field existence:
    - Exists: "field:*" or "field:[* TO *]"
    - Not exists: "NOT field:*" or "-field:*"

  Boosting (relevance scoring):
    - Boost term: "title:water^2 OR notes:water" (title matches score higher)
    - Constant score: "title:water^=1.5"

Examples:
  - Search all: { q: "*:*" }
  - By tag: { q: "tags:sanità" }
  - Boolean: { q: "(title:water OR title:climate) AND NOT title:sea" }
  - Wildcard: { q: "title:environment*" }
  - Fuzzy: { q: "title:health~2" }
  - Proximity: { q: "notes:\"open data\"~3" }
  - Date range: { q: "metadata_modified:[2024-01-01T00:00:00Z TO 2024-12-31T23:59:59Z]" }
  - Date math: { q: "metadata_modified:[NOW-6MONTHS TO *]" }
  - Field exists: { q: "organization:* AND num_resources:[1 TO *]" }
  - Boosting: { q: "title:climate^2 OR notes:climate" }
  - Filter org: { fq: "organization:regione-siciliana" }
  - Get facets: { facet_field: ["organization"], rows: 0 }`,
      inputSchema: z.object({
        server_url: z.string()
          .url("Must be a valid URL")
          .describe("Base URL of the CKAN server"),
        q: z.string()
          .optional()
          .default("*:*")
          .describe("Search query in Solr syntax"),
        fq: z.string()
          .optional()
          .describe("Filter query in Solr syntax"),
        rows: z.number()
          .int()
          .min(0)
          .max(1000)
          .optional()
          .default(10)
          .describe("Number of results to return"),
        start: z.number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Offset for pagination"),
        sort: z.string()
          .optional()
          .describe("Sort field and direction (e.g., 'metadata_modified desc')"),
        facet_field: z.array(z.string())
          .optional()
          .describe("Fields to facet on"),
        facet_limit: z.number()
          .int()
          .min(1)
          .optional()
          .default(50)
          .describe("Maximum facet values per field"),
        include_drafts: z.boolean()
          .optional()
          .default(false)
          .describe("Include draft datasets"),
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
        const apiParams: Record<string, any> = {
          q: params.q,
          rows: params.rows,
          start: params.start,
          include_private: params.include_drafts
        };

        if (params.fq) apiParams.fq = params.fq;
        if (params.sort) apiParams.sort = params.sort;
        if (params.facet_field && params.facet_field.length > 0) {
          apiParams['facet.field'] = JSON.stringify(params.facet_field);
          apiParams['facet.limit'] = params.facet_limit;
        }

        const result = await makeCkanRequest<any>(
          params.server_url,
          'package_search',
          apiParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(result, null, 2)) }],
            structuredContent: result
          };
        }

        // Markdown format
        let markdown = `# CKAN Package Search Results

**Server**: ${params.server_url}
**Query**: ${params.q}
${params.fq ? `**Filter**: ${params.fq}\n` : ''}
**Total Results**: ${result.count}
**Showing**: ${result.results.length} results (from ${params.start})

`;

        // Show facets if available
        if (result.facets && Object.keys(result.facets).length > 0) {
          markdown += `## Facets\n\n`;
          for (const [field, values] of Object.entries(result.facets)) {
            markdown += `### ${field}\n\n`;
            const facetValues = values as Record<string, number>;
            const sorted = Object.entries(facetValues)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10);
            for (const [value, count] of sorted) {
              markdown += `- **${value}**: ${count}\n`;
            }
            markdown += '\n';
          }
        }

        // Show results
        if (result.results && result.results.length > 0) {
          markdown += `## Datasets\n\n`;
          for (const pkg of result.results) {
            markdown += `### ${pkg.title || pkg.name}\n\n`;
            markdown += `- **ID**: \`${pkg.id}\`\n`;
            markdown += `- **Name**: \`${pkg.name}\`\n`;
            if (pkg.organization) {
              markdown += `- **Organization**: ${pkg.organization.title || pkg.organization.name}\n`;
            }
            if (pkg.notes) {
              const notes = pkg.notes.substring(0, 200);
              markdown += `- **Description**: ${notes}${pkg.notes.length > 200 ? '...' : ''}\n`;
            }
            if (pkg.tags && pkg.tags.length > 0) {
              const tags = pkg.tags.slice(0, 5).map((t: any) => t.name).join(', ');
              markdown += `- **Tags**: ${tags}${pkg.tags.length > 5 ? ', ...' : ''}\n`;
            }
            markdown += `- **Resources**: ${pkg.num_resources || 0}\n`;
            markdown += `- **Modified**: ${formatDate(pkg.metadata_modified)}\n`;
            markdown += `- **Link**: ${getDatasetViewUrl(params.server_url, pkg)}\n\n`;
          }
        } else {
          markdown += `No datasets found matching your query.\n`;
        }

        if (result.count > params.start + params.rows) {
          const nextStart = params.start + params.rows;
          markdown += `\n---\n**More results available**: Use \`start: ${nextStart}\` to see next page.\n`;
        }

        return {
          content: [{ type: "text", text: truncateText(markdown) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching packages: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * Get details of a specific dataset
   */
  server.registerTool(
    "ckan_package_show",
    {
      title: "Show CKAN Dataset Details",
      description: `Get complete metadata for a specific dataset (package).

Returns full details including resources, organization, tags, and all metadata fields.

Args:
  - server_url (string): Base URL of CKAN server
  - id (string): Dataset ID or name (machine-readable slug)
  - include_tracking (boolean): Include view/download statistics (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Complete dataset object with all metadata and resources

Examples:
  - { server_url: "https://dati.gov.it", id: "dataset-name" }
  - { server_url: "...", id: "abc-123-def", include_tracking: true }`,
      inputSchema: z.object({
        server_url: z.string()
          .url()
          .describe("Base URL of the CKAN server"),
        id: z.string()
          .min(1)
          .describe("Dataset ID or name"),
        include_tracking: z.boolean()
          .optional()
          .default(false)
          .describe("Include tracking statistics"),
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
          'package_show',
          {
            id: params.id,
            include_tracking: params.include_tracking
          }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(result, null, 2)) }],
            structuredContent: result
          };
        }

        // Markdown format
        let markdown = `# Dataset: ${result.title || result.name}\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Link**: ${getDatasetViewUrl(params.server_url, result)}\n\n`;

        markdown += `## Basic Information\n\n`;
        markdown += `- **ID**: \`${result.id}\`\n`;
        markdown += `- **Name**: \`${result.name}\`\n`;
        if (result.author) markdown += `- **Author**: ${result.author}\n`;
        if (result.author_email) markdown += `- **Author Email**: ${result.author_email}\n`;
        if (result.maintainer) markdown += `- **Maintainer**: ${result.maintainer}\n`;
        if (result.maintainer_email) markdown += `- **Maintainer Email**: ${result.maintainer_email}\n`;
        markdown += `- **License**: ${result.license_title || result.license_id || 'Not specified'}\n`;
        markdown += `- **State**: ${result.state}\n`;
        markdown += `- **Created**: ${formatDate(result.metadata_created)}\n`;
        markdown += `- **Modified**: ${formatDate(result.metadata_modified)}\n\n`;

        if (result.organization) {
          markdown += `## Organization\n\n`;
          markdown += `- **Name**: ${result.organization.title || result.organization.name}\n`;
          markdown += `- **ID**: \`${result.organization.id}\`\n\n`;
        }

        if (result.notes) {
          markdown += `## Description\n\n${result.notes}\n\n`;
        }

        if (result.tags && result.tags.length > 0) {
          markdown += `## Tags\n\n`;
          markdown += result.tags.map((t: any) => `- ${t.name}`).join('\n') + '\n\n';
        }

        if (result.groups && result.groups.length > 0) {
          markdown += `## Groups\n\n`;
          for (const group of result.groups) {
            markdown += `- **${group.title || group.name}** (\`${group.name}\`)\n`;
          }
          markdown += '\n';
        }

        if (result.resources && result.resources.length > 0) {
          markdown += `## Resources (${result.resources.length})\n\n`;
          for (const resource of result.resources) {
            markdown += `### ${resource.name || 'Unnamed Resource'}\n\n`;
            markdown += `- **ID**: \`${resource.id}\`\n`;
            markdown += `- **Format**: ${resource.format || 'Unknown'}\n`;
            if (resource.description) markdown += `- **Description**: ${resource.description}\n`;
            markdown += `- **URL**: ${resource.url}\n`;
            if (resource.size) {
              const formatBytes = (bytes: number) => {
                if (!bytes || bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
              };
              markdown += `- **Size**: ${formatBytes(resource.size)}\n`;
            }
            if (resource.mimetype) markdown += `- **MIME Type**: ${resource.mimetype}\n`;
            markdown += `- **Created**: ${formatDate(resource.created)}\n`;
            if (resource.last_modified) markdown += `- **Modified**: ${formatDate(resource.last_modified)}\n`;
            if (resource.datastore_active !== undefined) {
              markdown += `- **DataStore**: ${resource.datastore_active ? '✅ Available' : '❌ Not available'}\n`;
            }
            markdown += '\n';
          }
        }

        if (result.extras && result.extras.length > 0) {
          markdown += `## Extra Fields\n\n`;
          for (const extra of result.extras) {
            markdown += `- **${extra.key}**: ${extra.value}\n`;
          }
          markdown += '\n';
        }

        return {
          content: [{ type: "text", text: truncateText(markdown) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching package: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
