/**
 * MCP Resources - Entry point
 *
 * Registers all CKAN resource templates for direct data access.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDatasetResource } from "./dataset.js";
import { registerResourceResource } from "./resource.js";
import { registerOrganizationResource } from "./organization.js";

/**
 * Register all CKAN resource templates
 */
export function registerAllResources(server: McpServer) {
  registerDatasetResource(server);
  registerResourceResource(server);
  registerOrganizationResource(server);
}
