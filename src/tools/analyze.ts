/**
 * CKAN Analyze Datasets tool
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema, CkanPackage, CkanField } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface CkanFieldWithInfo extends CkanField {
  info?: {
    label?: string;
    notes?: string;
    type_override?: string;
  };
}

interface DatastoreSchemaResult {
  fields: CkanFieldWithInfo[];
  total: number;
}

interface PackageSearchResult {
  count: number;
  results: CkanPackage[];
}

interface AnalyzedResource {
  resource: { id: string; name?: string; format?: string };
  schema: DatastoreSchemaResult | null;
  error?: string;
}

interface AnalyzedDataset {
  dataset: CkanPackage;
  datastoreResources: AnalyzedResource[];
  nonDatastoreResources: Array<{ name?: string; format?: string }>;
}

export function formatAnalyzeDatasetsMarkdown(
  serverUrl: string,
  query: string,
  total: number,
  datasets: AnalyzedDataset[]
): string {
  let md = `# Dataset Analysis\n\n`;
  md += `**Server**: ${serverUrl}\n`;
  md += `**Query**: ${query}\n`;
  md += `**Total datasets found**: ${total}\n`;
  md += `**Datasets analyzed**: ${datasets.length}\n\n`;

  for (const { dataset, datastoreResources, nonDatastoreResources } of datasets) {
    md += `---\n\n`;
    md += `## ${dataset.title || dataset.name}\n\n`;
    md += `- **ID**: \`${dataset.id}\`\n`;
    md += `- **Name**: \`${dataset.name}\`\n`;
    if (dataset.organization) {
      md += `- **Organization**: ${dataset.organization.title || dataset.organization.name}\n`;
    }

    if (datastoreResources.length > 0) {
      md += `\n### DataStore Resources\n\n`;
      for (const { resource, schema, error } of datastoreResources) {
        md += `#### ${resource.name || resource.id}\n\n`;
        md += `- **Resource ID**: \`${resource.id}\`\n`;
        if (resource.format) md += `- **Format**: ${resource.format}\n`;
        if (error) {
          md += `- **Error**: ${error}\n`;
        } else if (schema) {
          md += `- **Total Records**: ${schema.total}\n`;
          const fields = schema.fields.filter(f => f.id !== '_id');
          if (fields.length > 0) {
            md += `\n**Fields** (${fields.length}):\n\n`;
            for (const f of fields) {
              let line = `- \`${f.id}\` (${f.type})`;
              if (f.info?.label) line += ` — ${f.info.label}`;
              if (f.info?.notes) line += `: ${f.info.notes}`;
              md += line + '\n';
            }
          }
        }
        md += '\n';
      }
    }

    if (nonDatastoreResources.length > 0) {
      md += `### Other Resources (not queryable)\n\n`;
      for (const r of nonDatastoreResources) {
        md += `- ${r.name || '(unnamed)'}${r.format ? ` (${r.format})` : ''}\n`;
      }
      md += '\n';
    }

    if (datastoreResources.length === 0 && nonDatastoreResources.length === 0) {
      md += `_No resources available._\n\n`;
    }
  }

  return md;
}

export function registerAnalyzeTools(server: McpServer): void {
  server.registerTool(
    "ckan_analyze_datasets",
    {
      title: "Analyze CKAN Datasets and DataStore Schema",
      description: `Search datasets and inspect the DataStore schema of queryable resources.

For each dataset found, lists all resources. For DataStore-enabled resources, fetches the full
field schema (name, type, and label/notes when available) plus total record count — all in one call.

Use this before ckan_datastore_search to understand what fields are available and what data to expect.

Args:
  - server_url (string): Base URL of CKAN server
  - q (string): Solr search query (e.g. "incidenti", "title:ambiente")
  - rows (number): Max datasets to analyze (default 5, max 20)
  - response_format ('markdown' | 'json'): Output format

Returns:
  For each dataset: title, ID, organization, and per DataStore resource: field schema with
  label/notes (when available from DataStore Dictionary) and record count.

Typical workflow: ckan_analyze_datasets → ckan_datastore_search (with known field names)`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.comune.messina.it)"),
        q: z.string().min(1).describe("Solr search query (e.g. 'incidenti', 'title:ambiente')"),
        rows: z.number().int().min(1).max(20).optional().default(5).describe("Max datasets to analyze (default 5, max 20)"),
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
        const searchResult = await makeCkanRequest<PackageSearchResult>(
          params.server_url,
          'package_search',
          { q: params.q, rows: params.rows }
        );

        const datasets = searchResult.results || [];

        const analyzed: AnalyzedDataset[] = await Promise.all(datasets.map(async (dataset) => {
          const resources = dataset.resources || [];
          const datastoreResources: AnalyzedResource[] = [];
          const nonDatastoreResources: Array<{ name?: string; format?: string }> = [];

          for (const resource of resources) {
            if (resource.datastore_active === true) {
              try {
                const schema = await makeCkanRequest<DatastoreSchemaResult>(
                  params.server_url,
                  'datastore_search',
                  { resource_id: resource.id, limit: 0 }
                );
                datastoreResources.push({
                  resource: { id: resource.id, name: resource.name, format: resource.format },
                  schema
                });
              } catch (err) {
                datastoreResources.push({
                  resource: { id: resource.id, name: resource.name, format: resource.format },
                  schema: null,
                  error: err instanceof Error ? err.message : String(err)
                });
              }
            } else {
              nonDatastoreResources.push({ name: resource.name, format: resource.format });
            }
          }

          return { dataset, datastoreResources, nonDatastoreResources };
        }));

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text" as const, text: truncateText(JSON.stringify({ total: searchResult.count, datasets: analyzed }, null, 2)) }]
          };
        }

        const markdown = formatAnalyzeDatasetsMarkdown(
          params.server_url,
          params.q,
          searchResult.count,
          analyzed
        );
        return {
          content: [{ type: "text" as const, text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error analyzing datasets: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}

export function formatCatalogStatsMarkdown(
  serverUrl: string,
  total: number,
  facets: Record<string, Record<string, number>>
): string {
  const LABELS: Record<string, string> = {
    groups: "Categories",
    res_format: "Formats",
    organization: "Organizations"
  };

  let md = `# CKAN Portal Statistics\n\n`;
  md += `**Server**: ${serverUrl}\n`;
  md += `**Total datasets**: ${total}\n`;

  for (const [field, label] of Object.entries(LABELS)) {
    const values = facets[field];
    if (!values || Object.keys(values).length === 0) continue;
    const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
    md += `\n## ${label}\n\n`;
    for (const [name, count] of sorted) {
      md += `- **${name}**: ${count}\n`;
    }
  }

  return md;
}

export function registerCatalogStatsTools(server: McpServer): void {
  server.registerTool(
    "ckan_catalog_stats",
    {
      title: "Get CKAN Portal Statistics",
      description: `Get a statistical overview of a CKAN portal: total dataset count and breakdown by category, format, and organization.

Single CKAN call (package_search with rows=0 and facets). No query needed.

Args:
  - server_url (string): Base URL of the CKAN server
  - facet_limit (number): Max entries per facet section (default 20)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Total dataset count, categories ranked by count, file formats ranked by count, organizations ranked by count.

Typical workflow: ckan_catalog_stats (understand the portal) → ckan_package_search (query specific data)`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.comune.messina.it)"),
        facet_limit: z.number().int().min(1).max(100).optional().default(20).describe("Max entries per facet section (default 20)"),
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
        const result = await makeCkanRequest<{ count: number; facets: Record<string, Record<string, number>> }>(
          params.server_url,
          'package_search',
          {
            q: '*:*',
            rows: 0,
            'facet.field': JSON.stringify(['groups', 'res_format', 'organization']),
            'facet.limit': params.facet_limit
          }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text" as const, text: truncateText(JSON.stringify({ total: result.count, facets: result.facets }, null, 2)) }]
          };
        }

        const markdown = formatCatalogStatsMarkdown(params.server_url, result.count, result.facets);
        return {
          content: [{ type: "text" as const, text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving catalog stats: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
