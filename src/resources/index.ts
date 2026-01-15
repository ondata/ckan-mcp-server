/**
 * MCP Resources - Entry point
 *
 * Registers all CKAN resource templates for direct data access.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDatasetResource } from "./dataset.js";
import { registerResourceResource } from "./resource.js";
import { registerOrganizationResource } from "./organization.js";
import {
  registerFormatDatasetsResource,
  registerGroupDatasetsResource,
  registerOrganizationDatasetsResource,
  registerTagDatasetsResource
} from "./dataset-filters.js";

/**
 * Register all CKAN resource templates
 */
export function registerAllResources(server: McpServer) {
  registerDatasetResource(server);
  registerResourceResource(server);
  registerOrganizationResource(server);
  registerGroupDatasetsResource(server);
  registerOrganizationDatasetsResource(server);
  registerTagDatasetsResource(server);
  registerFormatDatasetsResource(server);
}
