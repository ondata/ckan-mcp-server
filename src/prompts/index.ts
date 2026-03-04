/**
 * MCP Prompt registration
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerThemePrompt } from "./theme.js";
import { registerOrganizationPrompt } from "./organization.js";
import { registerFormatPrompt } from "./format.js";
import { registerRecentPrompt } from "./recent.js";
import { registerDatasetAnalysisPrompt } from "./dataset-analysis.js";
import { registerHvdPrompt } from "./hvd.js";

export const registerAllPrompts = (server: McpServer): void => {
  registerThemePrompt(server);
  registerOrganizationPrompt(server);
  registerFormatPrompt(server);
  registerRecentPrompt(server);
  registerDatasetAnalysisPrompt(server);
  registerHvdPrompt(server);
};
