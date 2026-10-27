import { describe, it, expect } from "vitest";
import { summarizeToolError } from "../../src/utils/error-telemetry.js";

describe("summarizeToolError", () => {
  it.each([
    ["MCP error -32602: Input validation error: Invalid arguments for tool ckan_status_show: [\n  {\n    \"message\": \"Invalid url\"", "validation"],
    ["Domain \"evil.example\" is not in the allowed list (CKAN_ALLOWED_DOMAINS).", "not_allowed"],
    ["Server appears to be offline or not a valid CKAN instance:\nRequest timeout connecting to https://open.toronto.ca", "timeout"],
    ["Error retrieving quality metrics: MQA API error: The operation was aborted due to timeout", "timeout"],
    ["Server appears to be offline or not a valid CKAN instance:\nCKAN API error (404): Not Found", "upstream_http"],
    ["Could not fetch portal list from datashades.info:\ndatashades.info returned 503 Service Unavailable", "upstream_http"],
    ["Server not found: https://no-such-portal.example", "unreachable"],
    ["Could not fetch portal list from datashades.info:\nThe 'cache' field on 'RequestInitializerDict' is not implemented.", "other"]
  ])("classifies %j as %s", (text, kind) => {
    expect(summarizeToolError(text).error_kind).toBe(kind);
  });

  it("keeps the message on one line, capped at 200 characters", () => {
    const { error_message } = summarizeToolError(`first line\n\n  second   line ${"x".repeat(300)}`);
    expect(error_message).toMatch(/^first line second line x+$/);
    expect(error_message).toHaveLength(200);
  });
});
