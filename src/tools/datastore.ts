/**
 * CKAN DataStore tools
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { DATASTORE_TABLE_RESOURCE_URI } from "../resources/datastore-table-ui.js";

export function registerDatastoreTools(server: McpServer) {
  /**
   * DataStore search
   */
  registerAppTool(
    server,
    "ckan_datastore_search",
    {
      title: "Search CKAN DataStore",
      description: `Query data from a CKAN DataStore resource.

The DataStore allows SQL-like queries on tabular data. Not all resources have DataStore enabled.

Args:
  - server_url (string): Base URL of CKAN server
  - resource_id (string): ID of the DataStore resource
  - q (string): Full-text search query (optional)
  - filters (object): Key-value filters (e.g., { "anno": 2023 })
  - limit (number): Max rows to return (default: 100, max: 32000)
  - offset (number): Pagination offset (default: 0)
  - fields (array): Specific fields to return (optional)
  - sort (string): Sort field with direction (e.g., "anno desc")
  - distinct (boolean): Return distinct values (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns:
  DataStore records matching query

Examples:
  - { server_url: "...", resource_id: "abc-123", limit: 50 }
  - { server_url: "...", resource_id: "...", filters: { "regione": "Sicilia" } }
  - { server_url: "...", resource_id: "...", sort: "anno desc", limit: 100 }`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        resource_id: z.string().min(1).describe("UUID of the DataStore resource (from ckan_package_show resource.id where datastore_active is true)"),
        q: z.string().optional().describe("Full-text search across all fields"),
        filters: z.record(z.any()).optional().describe("Key-value filters for exact matches (e.g., { \"regione\": \"Sicilia\", \"anno\": 2023 })"),
        limit: z.number().int().min(1).max(32000).optional().default(100).describe("Max rows to return (default 100, max 32000)"),
        offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
        fields: z.array(z.string()).optional().describe("Specific field names to return; omit to return all fields"),
        sort: z.string().optional().describe("Sort expression (e.g., 'anno desc', 'nome asc')"),
        distinct: z.boolean().optional().default(false).describe("Return only distinct rows"),
        response_format: ResponseFormatSchema
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: { ui: { resourceUri: DATASTORE_TABLE_RESOURCE_URI } }
    },
    async (params) => {
      try {
        const apiParams: Record<string, any> = {
          resource_id: params.resource_id,
          limit: params.limit,
          offset: params.offset,
          distinct: params.distinct
        };

        if (params.q) apiParams.q = params.q;
        if (params.filters) apiParams.filters = JSON.stringify(params.filters);
        if (params.fields) apiParams.fields = params.fields.join(',');
        if (params.sort) apiParams.sort = params.sort;

        const result = await makeCkanRequest<any>(
          params.server_url,
          'datastore_search',
          apiParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(result, null, 2)) }],
            structuredContent: result
          };
        }

        let markdown = `# DataStore Query Results\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Resource ID**: \`${params.resource_id}\`\n`;
        markdown += `**Total Records**: ${result.total || 0}\n`;
        markdown += `**Returned**: ${result.records ? result.records.length : 0} records\n\n`;

        if (result.fields && result.fields.length > 0) {
          markdown += `## Fields\n\n`;
          markdown += result.fields.map((f: any) => `- **${f.id}** (${f.type})`).join('\n') + '\n\n';
        }

        if (result.records && result.records.length > 0) {
          markdown += `## Records\n\n`;
          
          // Create a simple table
          const fields = result.fields.map((f: any) => f.id);
          const displayFields = fields.slice(0, 8); // Limit columns for readability
          
          // Header
          markdown += `| ${displayFields.join(' | ')} |\n`;
          markdown += `| ${displayFields.map(() => '---').join(' | ')} |\n`;
          
          // Rows (limit to 50 for readability)
          for (const record of result.records.slice(0, 50)) {
            const values = displayFields.map(field => {
              const val = record[field];
              if (val === null || val === undefined) return '-';
              const str = String(val);
              return str.length > 50 ? str.substring(0, 47) + '...' : str;
            });
            markdown += `| ${values.join(' | ')} |\n`;
          }

          if (result.records.length > 50) {
            markdown += `\n... and ${result.records.length - 50} more records\n`;
          }
          markdown += '\n';
        }

        if (result.total && result.total > params.offset + (result.records?.length || 0)) {
          const nextOffset = params.offset + params.limit;
          markdown += `**More results available**: Use \`offset: ${nextOffset}\` for next page.\n`;
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }],
          structuredContent: {
            server_url: params.server_url,
            resource_id: params.resource_id,
            total: result.total || 0,
            fields: result.fields || [],
            records: result.records || []
          }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error querying DataStore: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * DataStore SQL search
   */
  server.registerTool(
    "ckan_datastore_search_sql",
    {
      title: "Search CKAN DataStore with SQL",
      description: `Run SQL queries on a CKAN DataStore resource.

This endpoint is only available on CKAN portals with DataStore enabled and SQL access exposed.

Args:
  - server_url (string): Base URL of CKAN server
  - sql (string): SQL query (e.g., SELECT * FROM "resource_id" LIMIT 10)
  - response_format ('markdown' | 'json'): Output format

Returns:
  SQL query results from DataStore

Examples:
  - { server_url: "...", sql: "SELECT * FROM \"abc-123\" LIMIT 10" }
  - { server_url: "...", sql: "SELECT COUNT(*) AS total FROM \"abc-123\"" }`,
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        sql: z.string().min(1).describe("SQL SELECT query; resource_id is the table name, must be double-quoted (e.g., SELECT * FROM \"abc-123\" LIMIT 10)"),
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
          'datastore_search_sql',
          { sql: params.sql }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(result, null, 2)) }],
            structuredContent: result
          };
        }

        const records = result.records || [];
        const fieldIds = result.fields?.map((field: any) => field.id) || Object.keys(records[0] || {});

        let markdown = `# DataStore SQL Results\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**SQL**: \`${params.sql}\`\n`;
        markdown += `**Returned**: ${records.length} records\n\n`;

        if (result.fields && result.fields.length > 0) {
          markdown += `## Fields\n\n`;
          markdown += result.fields.map((field: any) => `- **${field.id}** (${field.type})`).join('\n') + '\n\n';
        }

        if (records.length > 0 && fieldIds.length > 0) {
          markdown += `## Records\n\n`;

          const displayFields = fieldIds.slice(0, 8);
          markdown += `| ${displayFields.join(' | ')} |\n`;
          markdown += `| ${displayFields.map(() => '---').join(' | ')} |\n`;

          for (const record of records.slice(0, 50)) {
            const values = displayFields.map((field) => {
              const value = record[field];
              if (value === null || value === undefined) return '-';
              const text = String(value);
              return text.length > 50 ? text.substring(0, 47) + '...' : text;
            });
            markdown += `| ${values.join(' | ')} |\n`;
          }

          if (records.length > 50) {
            markdown += `\n... and ${records.length - 50} more records\n`;
          }
          markdown += '\n';
        } else {
          markdown += 'No records returned by the SQL query.\n';
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error querying DataStore SQL: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
