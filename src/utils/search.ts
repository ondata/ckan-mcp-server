import { getPortalSearchConfig } from "./portal-config.js";

export type QueryParserOverride = "default" | "text" | undefined;

const DEFAULT_SEARCH_QUERY = "*:*";
const FIELD_QUERY_PATTERN = /\b[a-zA-Z_][\w-]*:/;
const SOLR_SPECIAL_CHARS = /[+\-!(){}[\]^~*?:\\/|&]/g;

function isFieldedQuery(query: string): boolean {
  return FIELD_QUERY_PATTERN.test(query);
}

export function escapeSolrQuery(query: string): string {
  return query.replace(SOLR_SPECIAL_CHARS, "\\$&");
}

/**
 * Convert NOW-based date expressions to ISO dates for fields that don't support them.
 * CKAN Solr date math (NOW-XDAYS) only works on metadata_modified and metadata_created.
 * For 'modified' and 'issued' fields, explicit ISO dates are required.
 *
 * Note on semantics:
 * - issued/modified are publisher content dates (best for "created/updated" when present).
 * - metadata_created/metadata_modified are CKAN record timestamps (publish time for source portals,
 *   harvest time for aggregators).
 */
export function convertDateMathForUnsupportedFields(query: string): string {
  const now = new Date();
  const nowIso = now.toISOString();

  const pattern = /\b(?!metadata_)(modified|issued):\[NOW-(\d+)(DAYS?|MONTHS?|YEARS?)\s+TO\s+NOW\]/gi;

  return query.replace(pattern, (match, field, amount, unit) => {
    const amountNum = parseInt(amount, 10);
    const startDate = new Date(now);

    const normalizedUnit = unit.toLowerCase().replace(/s$/, '');
    switch (normalizedUnit) {
      case 'day':
        startDate.setDate(startDate.getDate() - amountNum);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - amountNum);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - amountNum);
        break;
      default:
        return match;
    }

    const startIso = startDate.toISOString();
    return `${field}:[${startIso} TO ${nowIso}]`;
  });
}

const EXPLICIT_BOOL_PATTERN = /\b(AND|OR|NOT)\b|[+\-!]/;

export function isPlainMultiTermQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed === "*:*" || trimmed === "") return false;
  if (FIELD_QUERY_PATTERN.test(trimmed)) return false;
  if (EXPLICIT_BOOL_PATTERN.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 1;
}

export function buildOrQuery(query: string): string {
  return query.trim().split(/\s+/).filter(Boolean).join(" OR ");
}

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function hasAccents(text: string): boolean {
  return text !== stripAccents(text);
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
    const trimmedQuery = query.trim();
    forceTextField = trimmedQuery !== DEFAULT_SEARCH_QUERY && !isFieldedQuery(trimmedQuery);
  } else if (parserOverride === "default") {
    forceTextField = false;
  } else if (portalForce) {
    const trimmedQuery = query.trim();
    forceTextField = trimmedQuery !== DEFAULT_SEARCH_QUERY && !isFieldedQuery(trimmedQuery);
  }

  let effectiveQuery = forceTextField ? `text:(${escapeSolrQuery(query)})` : query;
  effectiveQuery = convertDateMathForUnsupportedFields(effectiveQuery);

  return { effectiveQuery, forcedTextField: forceTextField };
}
