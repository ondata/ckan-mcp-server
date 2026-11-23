/**
 * MCP Server configuration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPackageTools } from "./tools/package.js";
import { registerOrganizationTools } from "./tools/organization.js";
import { registerDatastoreTools } from "./tools/datastore.js";
import { registerStatusTools } from "./tools/status.js";
import { registerTagTools } from "./tools/tag.js";
import { registerGroupTools } from "./tools/group.js";
import { registerQualityTools } from "./tools/quality.js";
import { registerAnalyzeTools, registerCatalogStatsTools } from "./tools/analyze.js";
import { registerSparqlTools } from "./tools/sparql.js";
import { registerPortalDiscoveryTools } from "./tools/portal-discovery.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";

/**
 * Sent once at initialize by the public Worker only: the hosted endpoint is a
 * shared free-plan instance (10 ms CPU per request), not meant for bulk work.
 */
export const HOSTED_ENDPOINT_INSTRUCTIONS =
  "This is the free public hosted instance of CKAN MCP Server, shared by all its users and meant for interactive use. " +
  "The limits below apply to this hosted instance only, not to the server itself: a local installation has none. " +
  "Do not use it for bulk work: do not download whole datasets page by page, crawl entire catalogs, or call tools in large automated batches or in parallel. " +
  "Each request on this instance has a small CPU budget, so heavy load makes calls fail for everyone. " +
  "Fetch only what the user's question needs. If the user needs bulk access, suggest installing the server locally " +
  "(https://github.com/ondata/ckan-mcp-server) or calling the portal's CKAN API directly.";

export function createServer(options: { instructions?: string } = {}): McpServer {
  return new McpServer(
    {
      name: "ckan-mcp-server",
      version: "0.4.146"
    },
    options.instructions ? { instructions: options.instructions } : undefined
  );
}

export function registerAll(server: McpServer): void {
  registerPackageTools(server);
  registerOrganizationTools(server);
  registerDatastoreTools(server);
  registerStatusTools(server);
  registerTagTools(server);
  registerGroupTools(server);
  registerQualityTools(server);
  registerAnalyzeTools(server);
  registerCatalogStatsTools(server);
  registerSparqlTools(server);
  registerPortalDiscoveryTools(server);
  registerAllResources(server);
  registerAllPrompts(server);
}
