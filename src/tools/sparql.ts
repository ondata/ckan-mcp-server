/**
 * Generic SPARQL query tool for any public HTTPS SPARQL endpoint
 */

import { z } from "zod";
import { ResponseFormatSchema, ResponseFormat } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSparqlConfig } from "../utils/portal-config.js";
import { validateServerUrl, assertHostnameResolvesSafe, safeFetch } from "../utils/http.js";
import { truncateText, formatError, jsonToolResult } from "../utils/formatting.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 1000;
const TIMEOUT_MS = 15000;
const ERROR_HEAD_BYTES = 4 * 1024;
const MAX_REASON_LENGTH = 300;

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
  // A `#` starts a comment only outside IRIs and string literals: namespace IRIs such as
  // rdf-schema# end in one, and a PREFIX on the same line as SELECT must not hide it.
  const stripped = query.replace(
    /<[^<>"{}|^`\\\s]*>|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|#[^\n]*/g,
    match => (match.startsWith("#") ? "" : match)
  );
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
  validateServerUrl(endpointUrl);
  const url = new URL(endpointUrl);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS endpoints are allowed");
  }
  // SSRF: block hostnames that resolve to private/internal addresses (DNS-name bypass)
  await assertHostnameResolvesSafe(url.hostname);

  const sparqlConfig = getSparqlConfig(endpointUrl);
  const method = sparqlConfig?.method ?? "POST";

  const commonHeaders = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "Mozilla/5.0 (compatible; CKAN-MCP-Server/1.0)"
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response: Response;
    if (method === "GET") {
      const getUrl = new URL(endpointUrl);
      getUrl.searchParams.set("query", query);
      response = await safeFetch(getUrl.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: commonHeaders
      }, { httpsOnly: true });
    } else {
      response = await safeFetch(endpointUrl, {
        method: "POST",
        signal: controller.signal,
        headers: { ...commonHeaders, "Content-Type": "application/sparql-query; charset=utf-8" },
        body: query
      }, { httpsOnly: true });
      // Fallback to GET if POST is rejected
      if (response.status === 403 || response.status === 405) {
        const getUrl = new URL(endpointUrl);
        getUrl.searchParams.set("query", query);
        response = await safeFetch(getUrl.toString(), {
          method: "GET",
          signal: controller.signal,
          headers: commonHeaders
        }, { httpsOnly: true });
      }
    }

    // The deadline covers the body too: an endpoint can send its headers and then stall.
    if (!response.ok) {
      const reason = await readErrorReason(response, controller.signal);
      throw new Error(
        `SPARQL endpoint error (${response.status}): ${response.statusText}${reason ? `: ${reason}` : ""}`
      );
    }

    return (await response.json()) as SparqlResults;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `The endpoint did not answer within ${TIMEOUT_MS / 1000} seconds (timeout). Simplify the query (fewer VALUES, a LIMIT, no OPTIONAL over large sets) or retry later.`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * The first `maxBytes` of a body; the rest is never downloaded. Stops with what it has
 * when `signal` aborts.
 */
async function readHead(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const stop = () => { reader.cancel().catch(() => undefined); };
  if (signal.aborted) stop();
  signal.addEventListener("abort", stop, { once: true });
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - total);
      total += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", stop);
    await reader.cancel().catch(() => undefined);
  }
  return text;
}

/**
 * The endpoint's own explanation of a failed query, as one short line. Wikidata answers
 * a parse error with an echo of the (possibly multiline) query and a Java stack trace;
 * Virtuoso puts the message first. Without it the caller sees only "Bad Request" and retries blind.
 * HTML pages (gateways, proxies) carry nothing useful and are left out.
 */
async function readErrorReason(response: Response, signal: AbortSignal): Promise<string> {
  try {
    if (/html/i.test(response.headers?.get?.("content-type") ?? "")) return "";
    const text = await readHead(response, ERROR_HEAD_BYTES, signal);
    if (!text || /^\s*</.test(text)) return "";
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // Wikidata echoes the query first, one line per query line, then the exception.
    const line = lines[0]?.startsWith("SPARQL-QUERY:")
      ? lines.find(l => /^[\w$.]+(?:Exception|Error): /.test(l))
      : lines[0];
    if (!line) return "";
    const reason = line
      .replace(/^(?:[\w$.]+(?:Exception|Error): )+/, "")
      .replace(/[\u0000-\u001f\u007f]/g, "");
    return reason.length > MAX_REASON_LENGTH ? `${reason.slice(0, MAX_REASON_LENGTH)}…` : reason;
  } catch {
    return "";
  }
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
          return jsonToolResult(result);
        }

        return {
          content: [{ type: "text", text: truncateText(formatSparqlMarkdown(data, params.endpoint_url)) }]
        };
      } catch (error) {
        const message = `SPARQL query failed:\n${error instanceof Error ? error.message : String(error)}`;
        return {
          content: [{
            type: "text",
            text: formatError(message, params.response_format === ResponseFormat.JSON)
          }],
          isError: true
        };
      }
    }
  );
}
