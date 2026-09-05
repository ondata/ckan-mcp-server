/**
 * CKAN Tag tools
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, addDemoFooter, formatError, jsonToolResult, sanitizeInline } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripAccents } from "../utils/search.js";

type TagItem = {
  name: string;
  count: number;
  display_name?: string;
};

export function normalizeTagFacets(result: unknown): TagItem[] {
  const r = result as Record<string, unknown>;
  const searchFacets = r?.search_facets as Record<string, unknown> | undefined;
  const tagsGroup = searchFacets?.tags as Record<string, unknown> | undefined;
  const searchItems = tagsGroup?.items;
  if (Array.isArray(searchItems)) {
    return searchItems.map((item: TagItem) => ({
      name: item?.name || item?.display_name || String(item),
      count: typeof item?.count === 'number' ? item.count : 0,
      display_name: item?.display_name
    }));
  }

  const facets = (r?.facets as Record<string, unknown>)?.tags;
  if (Array.isArray(facets)) {
    if (facets.length > 0 && typeof facets[0] === 'object') {
      return facets.map((item: TagItem) => ({
        name: item?.name || item?.display_name || String(item),
        count: typeof item?.count === 'number' ? item.count : 0,
        display_name: item?.display_name
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

export function registerTagTools(server: McpServer) {
  server.registerTool(
    "ckan_tag_list",
    {
      title: "List CKAN Tags",
      description: `List tags from a CKAN server using faceting.

This returns tag names with counts, optionally filtered by dataset query or tag substring.

Args:
  - server_url (string): Base URL of CKAN server
  - q (string): Dataset search query (default: "*:*")
  - fq (string): Filter query (optional)
  - tag_query (string): Filter tags by substring (optional)
  - limit (number): Max tags to return (default: 100, max: 1000)
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of tags with counts (from faceting)

Typical workflow: ckan_tag_list → ckan_package_search with fq="tags:tag_name" (find datasets by tag) → ckan_package_show`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        q: z.string().optional().default("*:*").describe("Dataset search query in Solr syntax to scope the tag facet (default: '*:*' for all datasets)"),
        fq: z.string().optional().describe("Filter query in Solr syntax (e.g., 'organization:comune-palermo') to restrict which datasets contribute to tag counts"),
        tag_query: z.string().optional().describe("Substring filter applied to tag names after faceting (e.g., 'acqua' to keep only tags containing 'acqua')"),
        limit: z.number().int().min(1).max(1000).optional().default(100).describe("Max tags to return (default 100, max 1000); tags are sorted by count descending"),
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
          rows: 0,
          'facet.field': JSON.stringify(['tags']),
          // With a tag_query the filter runs on what the facet returned, so asking for
          // only `limit` tags makes it search the most frequent ones alone: on
          // dati.gov.it 53 tags contain "citta" and none is in the top 100, so the
          // filter answered "no tags" while they existed. Widen the facet, then apply
          // the caller's limit to the filtered list.
          'facet.limit': params.tag_query ? Math.max(params.limit, 1000) : params.limit
        };

        if (params.fq) apiParams.fq = params.fq;

        const result = await makeCkanRequest<any>(
          params.server_url,
          'package_search',
          apiParams
        );

        let tags = normalizeTagFacets(result);

        if (params.tag_query) {
          // Both sides accent-folded: CKAN builds tag names as slugs, so `città`
          // would never match `citta-metropolitana` — while portals that do keep
          // accented tags still match either spelling.
          const needle = stripAccents(params.tag_query.toLowerCase());
          tags = tags
            .filter(tag => stripAccents(tag.name.toLowerCase()).includes(needle))
            .slice(0, params.limit);
        }

        tags = tags
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, params.limit);

        if (params.response_format === ResponseFormat.JSON) {
          const output = {
            count: tags.length,
            tags
          };
          return jsonToolResult(output);
        }

        let markdown = `# CKAN Tags\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Query**: ${params.q}\n`;
        if (params.fq) markdown += `**Filter**: ${params.fq}\n`;
        if (params.tag_query) markdown += `**Tag Query**: ${params.tag_query}\n`;
        markdown += `**Count**: ${tags.length}\n\n`;

        if (tags.length === 0) {
          markdown += `No tags found.\n`;
        } else {
          for (const tag of tags) {
            markdown += `- **${sanitizeInline(tag.name)}**: ${tag.count}\n`;
          }
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: formatError(`Error listing tags: ${error instanceof Error ? error.message : String(error)}`, params.response_format === ResponseFormat.JSON)
          }],
          isError: true
        };
      }
    }
  );
}
