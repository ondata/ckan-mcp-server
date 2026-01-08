#!/usr/bin/env node
/**
 * CKAN MCP Server - Entry Point
 * 
 * Provides MCP tools to interact with any CKAN-based open data portal.
 * Supports searching datasets, querying metadata, exploring organizations,
 * and accessing the DataStore API.
 */

import { createServer } from "./server.js";
import { registerPackageTools } from "./tools/package.js";
import { registerOrganizationTools } from "./tools/organization.js";
import { registerDatastoreTools } from "./tools/datastore.js";
import { registerStatusTools } from "./tools/status.js";
import { registerAllResources } from "./resources/index.js";
import { runStdio } from "./transport/stdio.js";
import { runHTTP } from "./transport/http.js";

// Create and configure server
const server = createServer();

// Register all tools
registerPackageTools(server);
registerOrganizationTools(server);
registerDatastoreTools(server);
registerStatusTools(server);

// Register all resources
registerAllResources(server);

// Choose transport based on environment
const transport = process.env.TRANSPORT || 'stdio';
if (transport === 'http') {
  runHTTP(server).catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio(server).catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
