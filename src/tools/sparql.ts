/**
 * Generic SPARQL query tool for any public HTTPS SPARQL endpoint
 */

import { z } from "zod";
import { ResponseFormatSchema, ResponseFormat } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface SparqlBinding {
  type: string;
  value: string;
  datatype?: string;
  "xml:lang"?: string;
}

interface SparqlResults {
  head: { vars: string[] };
  results: { bindings: Record<string, SparqlBinding>[] };
}

export async function querySparqlEndpoint(endpointUrl: string, query: string): Promise<SparqlResults> {
  const url = new URL(endpointUrl);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS endpoints are allowed");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json"
      },
      body: query
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`SPARQL endpoint error (${response.status}): ${response.statusText}`);
  }

  return response.json() as Promise<SparqlResults>;
}

export function formatSparqlMarkdown(data: SparqlResults, endpointUrl: string): string {
  const vars = data.head.vars;
  const bindings = data.results.bindings;

  let md = `# SPARQL Query Results\n\n`;
  md += `**Endpoint**: ${endpointUrl}\n`;
  md += `**Rows**: ${bindings.length}\n\n`;

  if (bindings.length === 0) {
    return md + "_No results_\n";
  }

  // Table header
  md += `| ${vars.join(" | ")} |\n`;
  md += `| ${vars.map(() => "---").join(" | ")} |\n`;

  // Table rows
  for (const row of bindings) {
    const cells = vars.map(v => {
      const val = row[v]?.value ?? "";
      return val.replace(/\|/g, "\\|");
    });
    md += `| ${cells.join(" | ")} |\n`;
  }

  return md;
}

export function formatSparqlJson(data: SparqlResults): object {
  const vars = data.head.vars;
  const rows = data.results.bindings.map(row => {
    const obj: Record<string, string> = {};
    for (const v of vars) {
      obj[v] = row[v]?.value ?? "";
    }
    return obj;
  });
  return { count: rows.length, columns: vars, rows };
}

export function registerSparqlTools(server: McpServer) {
  server.registerTool(
    "sparql_query",
    {
      title: "SPARQL Query",
      description: `Execute a SPARQL SELECT query against any public HTTPS SPARQL endpoint.

Useful for querying open data portals and knowledge graphs that expose SPARQL endpoints, including:
- data.europa.eu (European open data portal)
- publications.europa.eu (EU Publications Office)
- DBpedia, Wikidata
- Any DCAT-AP compliant data catalog

Only HTTPS endpoints are allowed. Queries timeout after 15 seconds.
Only SELECT queries are supported (read-only).

Args:
  - endpoint_url (string): HTTPS URL of the SPARQL endpoint
  - query (string): SPARQL SELECT query to execute
  - response_format ('markdown' | 'json'): Output format

Examples:
  - Count Italian HVD datasets by publisher on data.europa.eu
  - Query Wikidata for entities related to a dataset topic
  - Explore EU controlled vocabularies on publications.europa.eu

Typical workflow: sparql_query (explore schema) → sparql_query (targeted query) → ckan_package_search (get dataset details)`,
      inputSchema: z.object({
        endpoint_url: z.string().url().describe("HTTPS URL of the SPARQL endpoint"),
        query: z.string().min(1).describe("SPARQL SELECT query to execute"),
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
        const data = await querySparqlEndpoint(params.endpoint_url, params.query);

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: JSON.stringify(formatSparqlJson(data), null, 2) }],
            structuredContent: formatSparqlJson(data)
          };
        }

        return {
          content: [{ type: "text", text: formatSparqlMarkdown(data, params.endpoint_url) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `SPARQL query failed:\n${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
