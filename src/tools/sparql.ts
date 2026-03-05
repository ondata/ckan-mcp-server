/**
 * Generic SPARQL query tool for any public HTTPS SPARQL endpoint
 */

import { z } from "zod";
import { ResponseFormatSchema, ResponseFormat, CHARACTER_LIMIT } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSparqlConfig } from "../utils/portal-config.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 1000;

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

/**
 * Validates that the query is a SELECT statement.
 * Throws if it contains write operations or no SELECT keyword.
 */
export function validateSelectQuery(query: string): void {
  const stripped = query.replace(/#[^\n]*/g, "");
  if (!/\bSELECT\b/i.test(stripped)) {
    throw new Error(
      "Only SELECT queries are supported (not CONSTRUCT, ASK, DESCRIBE, or write operations)."
    );
  }
}

/**
 * Appends LIMIT to query if not already present (case-insensitive check).
 */
export function injectLimit(query: string, limit: number): string {
  if (/\bLIMIT\b/i.test(query)) return query;
  return `${query.trimEnd()}\nLIMIT ${limit}`;
}

export async function querySparqlEndpoint(endpointUrl: string, query: string): Promise<SparqlResults> {
  const url = new URL(endpointUrl);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS endpoints are allowed");
  }

  const sparqlConfig = getSparqlConfig(endpointUrl);
  const method = sparqlConfig?.method ?? "POST";

  const commonHeaders = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "Mozilla/5.0 (compatible; CKAN-MCP-Server/1.0)"
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    if (method === "GET") {
      const getUrl = new URL(endpointUrl);
      getUrl.searchParams.set("query", query);
      response = await fetch(getUrl.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: commonHeaders
      });
    } else {
      response = await fetch(endpointUrl, {
        method: "POST",
        signal: controller.signal,
        headers: { ...commonHeaders, "Content-Type": "application/sparql-query" },
        body: query
      });
      // Fallback to GET if POST is rejected
      if (response.status === 403 || response.status === 405) {
        const getUrl = new URL(endpointUrl);
        getUrl.searchParams.set("query", query);
        response = await fetch(getUrl.toString(), {
          method: "GET",
          signal: controller.signal,
          headers: commonHeaders
        });
      }
    }
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

export function formatSparqlJson(data: SparqlResults): { count: number; columns: string[]; rows: Record<string, string>[] } {
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

If the query does not contain a LIMIT clause, one is injected automatically (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT}).

Args:
  - endpoint_url (string): HTTPS URL of the SPARQL endpoint
  - query (string): SPARQL SELECT query to execute
  - limit (number): Max rows to return (default: ${DEFAULT_LIMIT}). Ignored if query already contains LIMIT.
  - response_format ('markdown' | 'json'): Output format

Examples:
  - Count Italian HVD datasets by publisher on data.europa.eu
  - Query Wikidata for entities related to a dataset topic
  - Explore EU controlled vocabularies on publications.europa.eu

Typical workflow: sparql_query (explore schema) → sparql_query (targeted query) → ckan_package_search (get dataset details)`,
      inputSchema: z.object({
        endpoint_url: z.string().url().describe("HTTPS URL of the SPARQL endpoint"),
        query: z.string().min(1).describe("SPARQL SELECT query to execute"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
          .describe(`Max rows to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT}). Injected as SPARQL LIMIT if not already present in query.`),
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
        validateSelectQuery(params.query);
        const limitedQuery = injectLimit(params.query, params.limit);
        const data = await querySparqlEndpoint(params.endpoint_url, limitedQuery);

        if (params.response_format === ResponseFormat.JSON) {
          const result = formatSparqlJson(data);
          let text = JSON.stringify(result, null, 2);
          if (text.length > CHARACTER_LIMIT) {
            text = text.slice(0, CHARACTER_LIMIT) + "\n/* output truncated */";
          }
          return {
            content: [{ type: "text", text }],
            structuredContent: result
          };
        }

        let text = formatSparqlMarkdown(data, params.endpoint_url);
        if (text.length > CHARACTER_LIMIT) {
          text = text.slice(0, CHARACTER_LIMIT) + "\n\n_Output truncated._";
        }
        return { content: [{ type: "text", text }] };
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
