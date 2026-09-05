import { getPortalSearchConfig } from "./portal-config.js";

export type QueryParserOverride = "default" | "text" | undefined;

const DEFAULT_SEARCH_QUERY = "*:*";
const FIELD_QUERY_PATTERN = /\b[a-zA-Z_][\w-]*:/;
const EXPLICIT_BOOL_PATTERN = /\b(AND|OR|NOT)\b|[+\-!]/;
/** AND/OR/NOT: dismax has no syntax for these and swallows them. */
const BOOL_KEYWORD_PATTERN = /\b(AND|OR|NOT)\b/;
/** The same characters inside a word: `e-government`, `COVID-19`. */
const INTRAWORD_PUNCT_PATTERN = /\S[+\-!]\S/;
const SOLR_SPECIAL_CHARS = /[+\-!(){}[\]^~*?:\\/|&]/g;

function isFieldedQuery(query: string): boolean {
  return FIELD_QUERY_PATTERN.test(query);
}

/**
 * True when the query asks for boolean semantics: the AND/OR/NOT keywords, or a
 * leading +/-/! operator. This is the only case where `text:(...)` wrapping earns
 * its keep.
 *
 * Why: `package_search` sends a colon-free query to Solr's **dismax** parser with
 * `q.op=AND`, `mm='2<-1 5<80%'` and `qf='name^4 title^4 tags^2 groups^2 text'`
 * (ckan/lib/search/query.py). dismax has no boolean syntax, so `OR` is swallowed
 * and `q.op=AND` takes over: on dati.gov.it `aria OR Milano` returns 59 results,
 * exactly what `aria AND Milano` returns. A colon in the query makes CKAN leave
 * dismax, which is what the wrapper exploits — `text:(aria OR Milano)` returns 3421.
 *
 * The same switch is what makes the wrapper harmful everywhere else: it drops the
 * `qf` boosts that put titles and tags first, searches the catch-all `text` field
 * alone, and ANDs every term instead of applying `mm`. `defibrillatori Comune di
 * Lecce` goes from 678 results to 1, `musei roma arte opere catalogo` from 9 to 0.
 *
 * Measured 2026-09-05 on 40 real queries from the public deployment's telemetry:
 * with a boolean operator the wrapper helped 8 times and hurt none; without one it
 * helped none and hurt 10, six of them down to zero results.
 */
export function hasExplicitBooleanOperator(query: string): boolean {
  const trimmed = query.trim();

  // dismax already honours a `+`/`-`/`!` in operator position, so a query carrying
  // nothing else has no reason to pay for a probe — `escapeForTextWrapping` keeps
  // those characters intact, so a mixed query like `aria OR acqua -rifiuti` can be
  // wrapped without losing the exclusion.
  if (BOOL_KEYWORD_PATTERN.test(trimmed)) return true;

  // The same characters inside a word are not operators to the caller but are to
  // dismax, which reads `e-government` as `e` NOT `government`: 58919 of ~65000
  // datasets, against 278 for the escaped literal. `COVID-19`: 9963 against 69.
  return INTRAWORD_PUNCT_PATTERN.test(trimmed);
}

/**
 * True when wrapping could still change this query's meaning: it is not `*:*`, it is
 * not already fielded (a colon has taken it off dismax on its own), and it carries a
 * boolean operator. Everything else is left to the portal's own parser, so it must not
 * pay for the probe either.
 */
export function mayNeedTextWrapping(query: string): boolean {
  const trimmed = query.trim();
  return (
    trimmed !== DEFAULT_SEARCH_QUERY &&
    !isFieldedQuery(trimmed) &&
    hasExplicitBooleanOperator(trimmed)
  );
}

export function escapeSolrQuery(query: string): string {
  return query.replace(SOLR_SPECIAL_CHARS, "\\$&");
}

/** True when the parenthesis at `offset` was escaped by the caller, so it is a literal. */
function isEscaped(query: string, offset: number): boolean {
  let backslashes = 0;
  for (let i = offset - 1; i >= 0 && query[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

/**
 * Parentheses that pair up can be trusted as grouping rather than stray input.
 * Escaped ones are the caller asking for the character itself and do not count.
 */
function hasBalancedParens(query: string): boolean {
  let depth = 0;
  for (let i = 0; i < query.length; i++) {
    if (isEscaped(query, i)) continue;
    if (query[i] === "(") depth++;
    else if (query[i] === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Escape for `text:(...)` wrapping, keeping the syntax the caller actually meant.
 *
 * A `+`/`-`/`!` in operator position stays: escaping it inverts the caller's intent.
 * On dati.gov.it `ambiente` returns 8047 and `ambiente -rifiuti` returns 7649, but
 * `text:(ambiente \-rifiuti)` returns 398 — exactly the 398 the caller asked to leave
 * out. Unescaped, `text:(ambiente -rifiuti)` returns 7649, the same answer dismax
 * gives, which is what lets a mixed query keep both halves: `text:(aria OR acqua
 * -rifiuti)` returns 1349 against 1389 for the disjunction alone.
 *
 * Balanced parentheses stay too, since escaping turns grouping into literal tokens.
 * On `(aria OR "qualità dell'aria") AND Milano`, a real query from the telemetry:
 * dismax returns 0, escaped parentheses return 51, and preserved ones 59. Unbalanced
 * parentheses are escaped as before — stray input must not become a syntax error, and
 * a parenthesis the caller escaped is a literal, not a group.
 */
export function escapeForTextWrapping(query: string): string {
  const keepGroups = hasBalancedParens(query);

  return query.replace(
    SOLR_SPECIAL_CHARS,
    (char, offset: number, whole: string) => {
      if (keepGroups && (char === "(" || char === ")") && !isEscaped(whole, offset)) {
        return char;
      }

      const isUnary = char === "+" || char === "-" || char === "!";
      const previous = offset === 0 ? "" : whole[offset - 1]!;
      // A group opener is a term boundary as much as a space is, but only when the
      // parenthesis itself survives: after an escaped one the operator would bind to
      // the backslash.
      const atTermStart =
        offset === 0 || /\s/.test(previous) || (keepGroups && previous === "(");
      const followedByTerm = offset + 1 < whole.length && !/\s/.test(whole[offset + 1]!);
      return isUnary && atTermStart && followedByTerm ? char : `\\${char}`;
    }
  );
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
    forceTextField =
      trimmedQuery !== DEFAULT_SEARCH_QUERY &&
      !isFieldedQuery(trimmedQuery) &&
      hasExplicitBooleanOperator(trimmedQuery);
  }

  let effectiveQuery = forceTextField ? `text:(${escapeForTextWrapping(query)})` : query;
  effectiveQuery = convertDateMathForUnsupportedFields(effectiveQuery);

  return { effectiveQuery, forcedTextField: forceTextField };
}
