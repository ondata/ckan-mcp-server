/**
 * Search results side channel for worker telemetry
 *
 * Search tools record which datasets they returned; the Workers entry point reads
 * them back after the call and adds them to its log line. Keyed by the McpServer
 * instance, which the worker creates per request, so concurrent requests in the
 * same isolate cannot read each other's results (a module-level variable could).
 */

/** Max datasets kept per event: bounds the log line size. */
export const SEARCH_TELEMETRY_MAX_RESULTS = 20;
const MAX_FIELD_LENGTH = 100;

export interface SearchTelemetry {
  result_count: number;
  result_start: number;
  result_ids: string[];
  result_names: string[];
}

const lastResults = new WeakMap<object, SearchTelemetry>();

export function recordSearchResults(
  server: object,
  count: number,
  start: number,
  datasets: { id?: string; name?: string }[]
): void {
  const kept = datasets.slice(0, SEARCH_TELEMETRY_MAX_RESULTS);
  lastResults.set(server, {
    result_count: count,
    result_start: start,
    result_ids: kept.map((d) => String(d.id ?? '').slice(0, MAX_FIELD_LENGTH)),
    result_names: kept.map((d) => String(d.name ?? '').slice(0, MAX_FIELD_LENGTH))
  });
}

/** Returns and clears the results recorded for this server instance, if any. */
export function takeSearchResults(server: object): SearchTelemetry | null {
  const value = lastResults.get(server) ?? null;
  lastResults.delete(server);
  return value;
}
