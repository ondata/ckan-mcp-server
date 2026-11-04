/**
 * Error summary for worker telemetry
 *
 * A failed tool call used to reach the log as a bare `status: error`, which hid a tool
 * failing on every call for weeks (ckan_find_portals on Workers). The log line now
 * carries a short, single-line message and a coarse class to group failures by.
 */

const MAX_MESSAGE_LENGTH = 200;

export type ErrorKind = "validation" | "not_allowed" | "timeout" | "upstream_http" | "unreachable" | "other";

export interface ErrorTelemetry {
  error_message: string;
  error_kind: ErrorKind;
}

// First match wins. An HTTP status comes first: it is written by this server, while the
// text after it can be the portal's own reason, with any words in it ("timeout",
// "not allowed", "Invalid URL"). Then an input rejected before any request is
// "validation" even when its message mentions a URL, and a timeout is reported as such
// whatever wraps it.
const KINDS: [ErrorKind, RegExp][] = [
  ["upstream_http", /(?:API error|returned) \(?\d{3}\b/i],
  ["validation", /-32602|Input validation error|Invalid URL|Disallowed protocol/i],
  ["not_allowed", /not allowed|allowed list|SSRF/i],
  ["timeout", /timeout|timed out/i],
  ["unreachable", /Server not found|Network error|fetch failed|ENOTFOUND|ECONNREFUSED/i]
];

export function summarizeToolError(text: string): ErrorTelemetry {
  const message = text.replace(/\s+/g, " ").trim();
  const kind = KINDS.find(([, pattern]) => pattern.test(message))?.[0] ?? "other";
  return {
    error_message: message.slice(0, MAX_MESSAGE_LENGTH),
    error_kind: kind
  };
}
