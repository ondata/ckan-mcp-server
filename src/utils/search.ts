import { getPortalSearchConfig } from "./portal-config.js";

export type QueryParserOverride = "default" | "text" | undefined;

const DEFAULT_SEARCH_QUERY = "*:*";
const FIELD_QUERY_PATTERN = /\b[a-zA-Z_][\w-]*:/;

function isFieldedQuery(query: string): boolean {
  return FIELD_QUERY_PATTERN.test(query);
}

export function resolveSearchQuery(
  serverUrl: string,
  query: string,
  parserOverride: QueryParserOverride
): { effectiveQuery: string; forcedTextField: boolean } {
  const portalSearchConfig = getPortalSearchConfig(serverUrl);
  const portalForce = portalSearchConfig.force_text_field ?? false;

  let forceTextField = false;

  if (parserOverride === "text") {
    forceTextField = true;
  } else if (parserOverride === "default") {
    forceTextField = false;
  } else if (portalForce) {
    const trimmedQuery = query.trim();
    forceTextField = trimmedQuery !== DEFAULT_SEARCH_QUERY && !isFieldedQuery(trimmedQuery);
  }

  const effectiveQuery = forceTextField ? `text:(${query})` : query;

  return { effectiveQuery, forcedTextField: forceTextField };
}
