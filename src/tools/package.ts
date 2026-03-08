/**
 * CKAN Package (Dataset) tools
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema, CkanTag, CkanResource, CkanPackage } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { truncateText, truncateJson, formatDate, formatBytes, addDemoFooter } from "../utils/formatting.js";
import { getDatasetViewUrl } from "../utils/url-generator.js";
import { resolveSearchQuery, stripAccents, hasAccents, isPlainMultiTermQuery, buildOrQuery } from "../utils/search.js";
import { getPortalHvdConfig, getPortalApiPath, requiresMultilingualNormalization } from "../utils/portal-config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type RelevanceWeights = {
  title: number;
  notes: number;
  tags: number;
  organization: number;
};

type RelevanceBreakdown = {
  title: number;
  notes: number;
  tags: number;
  organization: number;
  total: number;
};

const DEFAULT_RELEVANCE_WEIGHTS: RelevanceWeights = {
  title: 4,
  notes: 2,
  tags: 3,
  organization: 1
};

const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those"
]);

export const extractQueryTerms = (query: string): string[] => {
  const matches = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = matches.filter((term) => term.length > 1 && !QUERY_STOPWORDS.has(term));
  return Array.from(new Set(terms));
};

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const textMatchesTerms = (text: string | undefined, terms: string[]): boolean => {
  if (!text || terms.length === 0) return false;
  const normalized = text.toLowerCase().replace(/_/g, " ");
  return terms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(normalized));
};

export const scoreTextField = (text: string | undefined, terms: string[], weight: number): number => {
  return textMatchesTerms(text, terms) ? weight : 0;
};

export const scoreDatasetRelevance = (
  query: string,
  dataset: CkanPackage,
  weights: RelevanceWeights = DEFAULT_RELEVANCE_WEIGHTS
): { total: number; breakdown: RelevanceBreakdown; terms: string[] } => {
  const terms = extractQueryTerms(query);
  const titleText = dataset.title || dataset.name || "";
  const notesText = dataset.notes || "";
  const orgText = dataset.organization?.title || dataset.organization?.name || dataset.owner_org || "";

  const breakdown = {
    title: scoreTextField(titleText, terms, weights.title),
    notes: scoreTextField(notesText, terms, weights.notes),
    tags: 0,
    organization: scoreTextField(orgText, terms, weights.organization),
    total: 0
  };

  if (Array.isArray(dataset.tags) && dataset.tags.length > 0 && terms.length > 0) {
    const tagMatch = dataset.tags.some((tag: CkanTag) => {
      const tagValue = typeof tag === "string" ? tag : tag?.name;
      return textMatchesTerms(tagValue, terms);
    });
    breakdown.tags = tagMatch ? weights.tags : 0;
  }

  breakdown.total = breakdown.title + breakdown.notes + breakdown.tags + breakdown.organization;

  return { total: breakdown.total, breakdown, terms };
};

export const parseAccessServices = (resource: CkanResource): Array<Record<string, unknown>> => {
  if (!resource || resource.access_services == null) return [];
  const raw = resource.access_services;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const extractServiceEndpoints = (services: Array<Record<string, unknown>>): string[] => {
  const endpoints: string[] = [];
  for (const service of services) {
    const urls = service.endpoint_url;
    if (Array.isArray(urls)) {
      for (const url of urls) {
        if (typeof url === "string" && url.trim().length > 0) endpoints.push(url.trim());
      }
    } else if (typeof urls === "string" && urls.trim().length > 0) {
      endpoints.push(urls.trim());
    }
  }
  return Array.from(new Set(endpoints));
};

export const resolveDownloadUrl = (resource: CkanResource): string | null => {
  if (!resource) return null;
  const downloadUrl = typeof resource.download_url === "string" ? resource.download_url.trim() : "";
  const accessUrl = typeof resource.access_url === "string" ? resource.access_url.trim() : "";
  const url = typeof resource.url === "string" ? resource.url.trim() : "";
  return downloadUrl || accessUrl || url || null;
};

export const enrichPackageShowResult = (result: CkanPackage): CkanPackage => ({
  ...result,
  metadata_harvested_at: result.metadata_modified ?? null,
  resources: Array.isArray(result.resources)
    ? result.resources.map((resource: CkanResource) => {
      const accessServices = parseAccessServices(resource);
      const accessEndpoints = extractServiceEndpoints(accessServices);
      const effectiveDownloadUrl = resolveDownloadUrl(resource);
      if (accessEndpoints.length === 0 && !effectiveDownloadUrl) return resource;
      return {
        ...resource,
        ...(accessEndpoints.length > 0 ? { access_service_endpoints: accessEndpoints } : {}),
        ...(effectiveDownloadUrl ? { effective_download_url: effectiveDownloadUrl } : {})
      };
    })
    : result.resources
});

export const formatPackageShowMarkdown = (result: CkanPackage, serverUrl: string): string => {
  let markdown = `# Dataset: ${result.title || result.name}\n\n`;
  markdown += `**Server**: ${serverUrl}\n`;
  markdown += `**Link**: ${getDatasetViewUrl(serverUrl, result)}\n`;
  markdown += `**Full JSON metadata**: ${serverUrl.replace(/\/$/, '')}${getPortalApiPath(serverUrl)}/package_show?id=${result.id}\n\n`;

  markdown += `## Basic Information\n\n`;
  markdown += `- **ID**: \`${result.id}\`\n`;
  markdown += `- **Name**: \`${result.name}\`\n`;
  if (result.author) markdown += `- **Author**: ${result.author}\n`;
  if (result.author_email) markdown += `- **Author Email**: ${result.author_email}\n`;
  if (result.maintainer) markdown += `- **Maintainer**: ${result.maintainer}\n`;
  if (result.maintainer_email) markdown += `- **Maintainer Email**: ${result.maintainer_email}\n`;
  markdown += `- **License**: ${result.license_title || result.license_id || 'Not specified'}\n`;
  markdown += `- **State**: ${result.state}\n`;
  markdown += `- **Created**: ${formatDate(result.metadata_created)}\n`;
  if (result.issued) {
    markdown += `- **Issued**: ${formatDate(result.issued)}\n`;
  } else {
    markdown += `- **Issued**: (missing in CKAN; downstream RDF may default to metadata_created, which is a record timestamp)\n`;
  }
  if (result.modified) markdown += `- **Modified (Content)**: ${formatDate(result.modified)}\n`;
  markdown += `- **Metadata Modified (Record)**: ${formatDate(result.metadata_modified)}\n\n`;

  if (result.organization) {
    markdown += `## Organization\n\n`;
    markdown += `- **Name**: ${result.organization.title || result.organization.name}\n`;
    markdown += `- **ID**: \`${result.organization.id}\`\n\n`;
  }

  if (result.notes) {
    markdown += `## Description\n\n${result.notes}\n\n`;
  }

  if (result.tags && result.tags.length > 0) {
    markdown += `## Tags\n\n`;
    markdown += result.tags.map((t: CkanTag) => `- ${t.name}`).join('\n') + '\n\n';
  }

  if (result.groups && result.groups.length > 0) {
    markdown += `## Groups\n\n`;
    for (const group of result.groups) {
      markdown += `- **${group.title || group.name}** (\`${group.name}\`)\n`;
    }
    markdown += '\n';
  }

  if (result.resources && result.resources.length > 0) {
    markdown += `## Resources (${result.resources.length})\n\n`;
    for (const resource of result.resources) {
      markdown += `### ${resource.name || 'Unnamed Resource'}\n\n`;
      markdown += `- **ID**: \`${resource.id}\`\n`;
      markdown += `- **Format**: ${resource.format || 'Unknown'}\n`;
      if (resource.description) markdown += `- **Description**: ${resource.description}\n`;
      markdown += `- **URL**: ${resource.url}\n`;
      const accessServices = parseAccessServices(resource);
      const accessEndpoints = extractServiceEndpoints(accessServices);
      if (accessEndpoints.length > 0) {
        markdown += `- **Access Service Endpoints**: ${accessEndpoints.join(', ')}\n`;
      }
      const effectiveDownloadUrl = resolveDownloadUrl(resource);
      if (effectiveDownloadUrl) {
        markdown += `- **Effective Download URL**: ${effectiveDownloadUrl}\n`;
      }
      if (resource.size) {
        const formatBytes = (bytes: number) => {
          if (!bytes || bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        markdown += `- **Size**: ${formatBytes(resource.size)}\n`;
      }
      if (resource.mimetype) markdown += `- **MIME Type**: ${resource.mimetype}\n`;
      markdown += `- **Created**: ${formatDate(resource.created)}\n`;
      if (resource.last_modified) markdown += `- **Modified**: ${formatDate(resource.last_modified)}\n`;
      if (resource.datastore_active === true) {
        markdown += `- **DataStore**: ✅ Available\n`;
      } else if (resource.datastore_active === false) {
        markdown += `- **DataStore**: ❌ Not available\n`;
      } else {
        markdown += `- **DataStore**: ❓ Not reported by portal\n`;
      }
      markdown += `- **Full JSON metadata**: ${serverUrl.replace(/\/$/, '')}${getPortalApiPath(serverUrl)}/resource_show?id=${resource.id}\n`;
      markdown += '\n';
    }
  }

  if (result.extras && result.extras.length > 0) {
    markdown += `## Extra Fields\n\n`;
    for (const extra of result.extras) {
      markdown += `- **${extra.key}**: ${extra.value}\n`;
    }
    markdown += '\n';
  }

  return markdown;
};

export function resolvePageParams(
  page: number | undefined,
  pageSize: number,
  start: number,
  rows: number
): { effectiveStart: number; effectiveRows: number } {
  if (page !== undefined) {
    return { effectiveStart: (page - 1) * pageSize, effectiveRows: pageSize };
  }
  return { effectiveStart: start, effectiveRows: rows };
}

/**
 * Resolve a single Solr NOW expression to an ISO 8601 datetime string.
 * Handles: NOW, NOW±Nunit, NOW/DAY, NOW/MONTH.
 * Used to convert date math for CKAN extra fields (issued, modified) that
 * are not native Solr fields and do not support NOW syntax.
 */
function resolveNowExpr(nowExpr: string): string {
  const upper = nowExpr.toUpperCase();
  const now = new Date();
  if (upper === 'NOW') return now.toISOString();
  const floorMatch = upper.match(/^NOW\/(DAY|MONTH)$/);
  if (floorMatch) {
    if (floorMatch[1] === 'DAY') now.setUTCHours(0, 0, 0, 0);
    else { now.setUTCDate(1); now.setUTCHours(0, 0, 0, 0); }
    return now.toISOString();
  }
  const arithMatch = upper.match(/^NOW([+-])(\d+)(YEARS?|MONTHS?|DAYS?|HOURS?|MINUTES?|SECONDS?)$/);
  if (arithMatch) {
    const sign = arithMatch[1] === '+' ? 1 : -1;
    const n = parseInt(arithMatch[2]);
    const unit = arithMatch[3].replace(/S$/, '');
    switch (unit) {
      case 'YEAR':   now.setUTCFullYear(now.getUTCFullYear() + sign * n); break;
      case 'MONTH':  now.setUTCMonth(now.getUTCMonth() + sign * n); break;
      case 'DAY':    now.setUTCDate(now.getUTCDate() + sign * n); break;
      case 'HOUR':   now.setUTCHours(now.getUTCHours() + sign * n); break;
      case 'MINUTE': now.setUTCMinutes(now.getUTCMinutes() + sign * n); break;
      case 'SECOND': now.setUTCSeconds(now.getUTCSeconds() + sign * n); break;
    }
    return now.toISOString();
  }
  return nowExpr;
}

/**
 * Convert NOW date math to ISO dates for CKAN extra fields (issued, modified).
 * These fields are not native Solr date fields and do not support NOW syntax.
 * Leaves metadata_modified and metadata_created untouched (they are native Solr fields).
 */
function convertNowForExtraFields(str: string): string {
  return str.replace(
    /\b(issued|modified):\[([^\]]*)\]/gi,
    (_match, field, range) => {
      const converted = range.replace(
        /\bNOW(?:[+-]\d+(?:YEARS?|MONTHS?|DAYS?|HOURS?|MINUTES?|SECONDS?)|\/(?:DAY|MONTH))?\b/gi,
        (now: string) => resolveNowExpr(now)
      );
      return `${field}:[${converted}]`;
    }
  );
}

/**
 * Normalize a package from portals with non-standard field structure (e.g. data.europa.eu).
 * Falls back to translation fields when title/name are null, and handles organization.title
 * as a multilingual object.
 */
function normalizePackage(pkg: CkanPackage): CkanPackage {
  const translation = pkg.translation as Record<string, Record<string, string>> | undefined;

  if (!pkg.title && translation) {
    pkg = { ...pkg, title: translation.en?.title || Object.values(translation)[0]?.title };
  }
  if (!pkg.name) {
    pkg = { ...pkg, name: pkg.id };
  }
  if (pkg.organization?.title && typeof pkg.organization.title === 'object') {
    const titleObj = pkg.organization.title as Record<string, string>;
    pkg = { ...pkg, organization: { ...pkg.organization, title: titleObj.en || Object.values(titleObj)[0] } };
  }
  if (pkg.tags) {
    pkg = { ...pkg, tags: pkg.tags.map((t: CkanTag) => t.name ? t : { ...t, name: t.id || t['display-name'] || '' }) };
  }
  return pkg;
}

/**
 * Compact JSON representation of package_search results.
 * Keeps only essential fields to reduce token usage (~80% reduction).
 */
export function compactSearchResult(result: any, serverUrl?: string): object {
  return {
    count: result.count,
    results: (result.results || []).map((rawPkg: CkanPackage) => {
      const pkg = serverUrl && requiresMultilingualNormalization(serverUrl) ? normalizePackage(rawPkg) : rawPkg;
      return {
      id: pkg.id,
      name: pkg.name,
      title: pkg.title || pkg.name,
      notes: pkg.notes ? pkg.notes.substring(0, 200) + (pkg.notes.length > 200 ? '...' : '') : null,
      organization: pkg.organization?.title || pkg.organization?.name || null,
      tags: (pkg.tags || []).map((t: CkanTag) => t.name),
      num_resources: pkg.num_resources ?? 0,
      metadata_modified: pkg.metadata_modified,
      ...(serverUrl ? { view_url: getDatasetViewUrl(serverUrl, pkg) } : {})
      };
    }),
    ...(result.facets && Object.keys(result.facets).length > 0 ? { facets: result.facets } : {}),
    ...(result.search_facets && Object.keys(result.search_facets).length > 0 ? { search_facets: result.search_facets } : {})
  };
}

/**
 * Compact JSON representation of package_show results.
 * Keeps metadata + slim resources, drops extras/relationships/tracking.
 */
export function compactPackageShow(result: CkanPackage, serverUrl?: string): object {
  return {
    id: result.id,
    name: result.name,
    title: result.title || result.name,
    notes: result.notes || null,
    organization: result.organization ? {
      name: result.organization.name,
      title: result.organization.title
    } : null,
    tags: (result.tags || []).map((t: CkanTag) => t.name),
    state: result.state,
    license_title: result.license_title || result.license_id || null,
    metadata_created: result.metadata_created,
    metadata_modified: result.metadata_modified,
    issued: result.issued || null,
    modified: result.modified || null,
    author: result.author || null,
    maintainer: result.maintainer || null,
    frequency: result.frequency || null,
    language: result.language || null,
    publisher_name: result.publisher_name || null,
    holder_name: result.holder_name || null,
    hvd_category: result.hvd_category || null,
    applicable_legislation: result.applicable_legislation || null,
    resources: (result.resources || []).map((r: CkanResource) => ({
      id: r.id,
      name: r.name || null,
      format: r.format || null,
      url: r.url || null,
      size: r.size || null,
      datastore_active: r.datastore_active ?? null,
      created: r.created || null,
      last_modified: r.last_modified || null,
      ...(serverUrl ? { api_json_url: `${serverUrl.replace(/\/$/, '')}${getPortalApiPath(serverUrl)}/resource_show?id=${r.id}` } : {})
    })),
    ...(serverUrl ? {
      view_url: getDatasetViewUrl(serverUrl, result),
      api_json_url: `${serverUrl.replace(/\/$/, '')}${getPortalApiPath(serverUrl)}/package_show?id=${result.id}`
    } : {})
  };
}

export function registerPackageTools(server: McpServer) {
  /**
   * Search for datasets on a CKAN server
   */
  server.registerTool(
    "ckan_package_search",
    {
      title: "Search CKAN Datasets",
      description: `Search for datasets (packages) on a CKAN server using Solr query syntax.

Supports full Solr search capabilities including filters, facets, and sorting.
Use this to discover datasets matching specific criteria.

Note on parser behavior:
Some CKAN portals use a restrictive default query parser that can break long OR queries.
For those portals, this tool may force the query into 'text:(...)' based on per-portal config.
You can override with 'query_parser' to force or disable this behavior per request.

Important - Date field semantics:
  - issued: publisher's content publish date when available (best proxy for "created/published")
  - modified: publisher's content update date when available
  - metadata_created: CKAN record creation timestamp (publish time on source portals,
    harvest time on aggregators; fallback for "created" if issued missing)
  - metadata_modified: CKAN record update timestamp (publish time on source portals,
    harvest time on aggregators; use for "updated/modified in last X")

Natural language mapping (important for tool callers):
  - "created"/"published" -> prefer issued; fallback to metadata_created
  - "updated"/"modified" -> prefer modified; fallback to metadata_modified
  - For "recent in last X", consider using content_recent (issued with metadata_created fallback)

Content-recent helper:
  - content_recent: if true, rewrites the query to use issued with a fallback to
    metadata_created when issued is missing.
  - content_recent_days: window for content_recent (default 30 days).

Args:
  - server_url (string): Base URL of CKAN server (e.g., "https://dati.gov.it/opendata")
  - q (string): Search query using Solr syntax (default: "*:*" for all)
  - fq (string): Filter query (e.g., "organization:comune-palermo")
    IMPORTANT — Solr fq syntax rules:
    1. OR inside a single field: use field:(val1 OR val2), NOT field:val1 OR field:val2.
       Wrong: fq=type:"A" OR type:"B"  → silently ignored, returns entire catalog.
       Right:  fq=type:("A" OR "B")
    2. CKAN extras fields are indexed as extras_fieldname, not fieldname.
       e.g. to filter on extra field "hvd_category" use fq=extras_hvd_category:"<value>"
  - rows (number): Number of results to return (default: 10, max: 1000)
  - start (number): Offset for pagination (default: 0)
  - page (number): Page number (1-based); alias for start. Overrides start if provided.
  - page_size (number): Results per page when using page (default: 10, max: 1000)
  - sort (string): Sort field and direction (e.g., "metadata_modified desc")
  - facet_field (array): Fields to facet on (e.g., ["organization", "tags"])
  - facet_limit (number): Max facet values per field (default: 50)
  - include_drafts (boolean): Include draft datasets (default: false)
  - query_parser ('default' | 'text'): Override search parser behavior
  - response_format ('markdown' | 'json'): Output format

Returns:
  Search results with:
  - count: Number of results found
  - results: Array of dataset objects
  - facets: Facet counts (if facet_field specified)
  - search_facets: Detailed facet information

Query Syntax (parameter q):
  Boolean operators:
    - AND / &&: "water AND climate"
    - OR / ||: "health OR sanità"
    - NOT / !: "data NOT personal"
    - +required -excluded: "+title:water -title:sea"
    - Grouping: "(title:water OR title:climate) AND tags:environment"

  Wildcards:
    - *: "title:environment*" (matches environmental, environments, etc.)
    - Note: Left truncation (*water) not supported

  Fuzzy search (edit distance):
    - ~: "title:rest~" or "title:rest~1" (finds "test", "best", "rest")

  Proximity search (words within N positions):
    - "phrase"~N: "title:\"climate change\"~5"

  Range queries:
    - Inclusive [a TO b]: "num_resources:[5 TO 10]"
    - Exclusive {a TO b}: "num_resources:{0 TO 100}"
    - One side open: "metadata_modified:[2024-01-01T00:00:00Z TO *]"

  Date math:
    - NOW-1YEAR, NOW-6MONTHS, NOW-7DAYS, NOW-1HOUR
    - NOW/DAY, NOW/MONTH (round down)
    - Combined: "metadata_modified:[NOW-2MONTHS TO NOW]"
    - Example: "metadata_created:[NOW-1YEAR TO *]"
    - IMPORTANT: NOW syntax works on metadata_modified and metadata_created fields
    - For 'modified' and 'issued' fields, NOW syntax is auto-converted to ISO dates
    - Manual ISO dates always work: "modified:[2026-01-15T00:00:00Z TO *]"

  Field existence:
    - Exists: "field:*" or "field:[* TO *]"
    - Not exists: "NOT field:*" or "-field:*"

  Boosting (relevance scoring):
    - Boost term: "title:water^2 OR notes:water" (title matches score higher)
    - Constant score: "title:water^=1.5"

Examples:
  - Search all: { q: "*:*" }
  - By tag: { q: "tags:sanità" }
  - Boolean: { q: "(title:water OR title:climate) AND NOT title:sea" }
  - Wildcard: { q: "title:environment*" }
  - Fuzzy: { q: "title:health~2" }
  - Proximity: { q: "notes:\"open data\"~3" }
  - Date range: { q: "metadata_modified:[2024-01-01T00:00:00Z TO 2024-12-31T23:59:59Z]" }
  - Date math: { q: "metadata_modified:[NOW-6MONTHS TO *]" }
  - Date math (auto-converted): { q: "modified:[NOW-30DAYS TO NOW]" }
  - Published in 2025 (content date): { fq: "issued:[2025-01-01T00:00:00Z TO 2025-12-31T23:59:59Z]" }
  - First appeared on portal in 2025: { fq: "metadata_created:[2025-01-01T00:00:00Z TO 2025-12-31T23:59:59Z]" }
  - Recent content (issued w/ fallback): { q: "*:*", content_recent: true, content_recent_days: 180 }
  - Field exists: { q: "organization:* AND num_resources:[1 TO *]" }
  - Boosting: { q: "title:climate^2 OR notes:climate" }
  - Filter org: { fq: "organization:regione-siciliana" }
  - Filter extras field (correct): { fq: "extras_hvd_category:\"http://data.europa.eu/bna/c_ac64a52d\"" }
  - Filter extras OR (correct): { fq: "extras_hvd_category:(\"http://data.europa.eu/bna/c_ac64a52d\" OR \"http://data.europa.eu/bna/c_dd313021\")" }
  - Get facets: { facet_field: ["organization"], rows: 0 }

Typical workflow: ckan_package_search → ckan_package_show (get full metadata + resource IDs) → ckan_datastore_search (query tabular data)`,
      inputSchema: z.object({
        server_url: z.string()
          .url("Must be a valid URL")
          .describe("Base URL of the CKAN server"),
        q: z.string()
          .optional()
          .default("*:*")
          .describe("Search query in Solr syntax"),
        fq: z.string()
          .optional()
          .describe("Filter query in Solr syntax; applied after scoring, does not affect relevance. CKAN extras fields use prefix 'extras_' (e.g. extras_hvd_category). For OR on same field use field:(val1 OR val2), never field:val1 OR field:val2 (silently breaks). Examples: 'organization:comune-palermo', 'res_format:CSV', 'extras_hvd_category:(\"uri1\" OR \"uri2\")'."),
        rows: z.coerce.number()
          .int()
          .min(0)
          .max(1000)
          .optional()
          .default(10)
          .describe("Number of results to return"),
        start: z.coerce.number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Offset for pagination"),
        sort: z.string()
          .optional()
          .describe("Sort field and direction (e.g., 'metadata_modified desc')"),
        facet_field: z.array(z.string())
          .optional()
          .describe("Fields to facet on"),
        facet_limit: z.coerce.number()
          .int()
          .min(1)
          .optional()
          .default(50)
          .describe("Maximum facet values per field"),
        page: z.coerce.number()
          .int()
          .min(1)
          .optional()
          .describe("Page number (1-based); alias for start. Overrides start if provided."),
        page_size: z.coerce.number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .default(10)
          .describe("Results per page when using page (default: 10)"),
        include_drafts: z.boolean()
          .optional()
          .default(false)
          .describe("Include draft datasets"),
        content_recent: z.boolean()
          .optional()
          .default(false)
          .describe("Use issued date with fallback to metadata_created for recent content"),
        content_recent_days: z.coerce.number()
          .int()
          .min(1)
          .optional()
          .default(30)
          .describe("Day window for content_recent (default 30)"),
        query_parser: z.enum(["default", "text"])
          .optional()
          .describe("Override search parser ('text' forces text:(...) on non-fielded queries)"),
        response_format: ResponseFormatSchema
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const userQuery = params.q;
        let query = userQuery;
        let effectiveSort = params.sort;

        if (params.content_recent) {
          const days = params.content_recent_days ?? 30;
          const daysAgo = new Date();
          daysAgo.setUTCDate(daysAgo.getUTCDate() - days);
          const daysAgoIso = daysAgo.toISOString();
          const nowIso = new Date().toISOString();
          const recentClause = `(issued:[${daysAgoIso} TO ${nowIso}]) OR (-issued:* AND metadata_created:[NOW-${days}DAYS TO NOW])`;
          query = userQuery && userQuery !== "*:*" ? `(${userQuery}) AND (${recentClause})` : recentClause;
          if (!effectiveSort) effectiveSort = "issued desc, metadata_created desc";
        }

        const { effectiveQuery } = resolveSearchQuery(
          params.server_url,
          query,
          params.query_parser
        );

        const { effectiveRows, effectiveStart } = resolvePageParams(params.page, params.page_size, params.start, params.rows);

        const apiParams: Record<string, any> = {
          q: convertNowForExtraFields(effectiveQuery),
          rows: effectiveRows,
          start: effectiveStart,
          include_private: params.include_drafts
        };

        if (params.fq) apiParams.fq = convertNowForExtraFields(params.fq);
        if (effectiveSort) apiParams.sort = effectiveSort;
        if (params.facet_field && params.facet_field.length > 0) {
          apiParams['facet.field'] = JSON.stringify(params.facet_field);
          apiParams['facet.limit'] = params.facet_limit;
        }

        let result = await makeCkanRequest<any>(
          params.server_url,
          'package_search',
          apiParams
        );

        let accentFallbackUsed = false;
        if (result.count === 0 && hasAccents(params.q)) {
          const strippedQuery = stripAccents(params.q);
          const { effectiveQuery: strippedEffective } = resolveSearchQuery(
            params.server_url,
            strippedQuery,
            params.query_parser
          );
          const fallbackResult = await makeCkanRequest<any>(
            params.server_url,
            'package_search',
            { ...apiParams, q: strippedEffective }
          );
          if (fallbackResult.count > 0) {
            result = fallbackResult;
            accentFallbackUsed = true;
          }
        }

        if (params.response_format === ResponseFormat.JSON) {
          const compact = compactSearchResult(result, params.server_url);
          return {
            content: [{ type: "text", text: truncateJson(compact) }]
          };
        }

        // HVD note: only on synthesis queries (q=*:* + facets or rows=0) in markdown mode
        let hvdNote = '';
        const isSynthesisQuery = (params.q === '*:*' || params.q === undefined) &&
          (effectiveRows === 0 ||
            (params.facet_field && params.facet_field.some((f) =>
              ['organization', 'tags', 'groups', 'res_format'].includes(f)
            )));
        if (isSynthesisQuery) {
          const hvdConfig = getPortalHvdConfig(params.server_url);
          if (hvdConfig) {
            try {
              const hvdResult = await makeCkanRequest<any>(
                params.server_url,
                'package_search',
                { q: `${hvdConfig.category_field}:*`, rows: 0 }
              );
              if (hvdResult.count > 0) {
                hvdNote = `> **High Value Datasets (HVD)**: This portal contains **${hvdResult.count} datasets** classified as High Value Datasets under EU Regulation 2023/138.\n\n`;
              }
            } catch {
              // silently skip if HVD query fails
            }
          }
        }

        // Markdown format
        let markdown = `# CKAN Package Search Results

**Server**: ${params.server_url}
**Query**: ${userQuery}
${params.content_recent ? `**Content Recent**: last ${params.content_recent_days ?? 30} days (issued with metadata_created fallback)\n` : ''}
${effectiveQuery !== userQuery ? `**Effective Query**: ${effectiveQuery}\n` : ''}
${accentFallbackUsed ? `**Note**: Original query returned 0 results; retried with accent-stripped query "${stripAccents(params.q)}".\n` : ''}
${params.fq ? `**Filter**: ${params.fq}\n` : ''}
**Total Results**: ${result.count}
**Showing**: ${result.results.length} results (from ${effectiveStart})

${hvdNote}`;

        // Show facets if available
        if (result.facets && Object.keys(result.facets).length > 0) {
          markdown += `## Facets\n\n`;
          for (const [field, values] of Object.entries(result.facets)) {
            markdown += `### ${field}\n\n`;
            const facetValues = values as Record<string, number>;
            const sorted = Object.entries(facetValues)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10);
            for (const [value, count] of sorted) {
              markdown += `- **${value}**: ${count}\n`;
            }
            if (Object.keys(facetValues).length > sorted.length) {
              markdown += `\nNote: showing top ${sorted.length} only. Use \`response_format: json\` or increase \`facet_limit\`.\n`;
            } else {
              markdown += `\nNote: showing top ${sorted.length} only. Use \`response_format: json\` for full list.\n`;
            }
            markdown += '\n';
          }
        }

        // Show results
        if (result.results && result.results.length > 0) {
          markdown += `## Datasets\n\n`;
          for (const rawPkg of result.results) {
            const pkg = requiresMultilingualNormalization(params.server_url) ? normalizePackage(rawPkg) : rawPkg;
            markdown += `### ${pkg.title || pkg.name}\n\n`;
            markdown += `- **ID**: \`${pkg.id}\`\n`;
            markdown += `- **Name**: \`${pkg.name}\`\n`;
            if (pkg.organization) {
              markdown += `- **Organization**: ${pkg.organization.title || pkg.organization.name}\n`;
            }
            if (pkg.notes) {
              const notes = pkg.notes.substring(0, 200);
              markdown += `- **Description**: ${notes}${pkg.notes.length > 200 ? '...' : ''}\n`;
            }
            if (pkg.tags && pkg.tags.length > 0) {
              const tags = pkg.tags.slice(0, 5).map((t: CkanTag) => t.name).join(', ');
              markdown += `- **Tags**: ${tags}${pkg.tags.length > 5 ? ', ...' : ''}\n`;
            }
            markdown += `- **Resources**: ${pkg.num_resources || 0}\n`;
            markdown += `- **Modified**: ${formatDate(pkg.metadata_modified)}\n`;
            markdown += `- **Link**: ${getDatasetViewUrl(params.server_url, pkg)}\n\n`;
          }
        } else {
          markdown += `No datasets found matching your query.\n`;
          markdown += `\n> **Note**: No data was found on this portal. Do not use information from other sources to supplement this result.\n`;
          if (isPlainMultiTermQuery(params.q)) {
            markdown += `\n> **Tip**: Multi-term queries use AND by default (all terms must match). Try OR to broaden the search:\n`;
            markdown += `> \`q: "${buildOrQuery(params.q)}"\`\n`;
          }
        }

        if (result.count > effectiveStart + effectiveRows) {
          if (params.page !== undefined) {
            markdown += `\n---\n**More results available**: Use \`page: ${params.page + 1}\` to see next page.\n`;
          } else {
            const nextStart = effectiveStart + effectiveRows;
            markdown += `\n---\n**More results available**: Use \`start: ${nextStart}\` to see next page.\n`;
          }
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching packages: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * Find relevant datasets with weighted scoring
   */
  server.registerTool(
    "ckan_find_relevant_datasets",
    {
      title: "Find Relevant CKAN Datasets",
      description: `Find and rank datasets by relevance to a query using weighted fields.

Use this instead of ckan_package_search when you want relevance-ranked results with
explicit scoring across title, notes, tags, and organization fields.
Use ckan_package_search instead when you need Solr filter syntax, facets, or pagination.

Uses package_search for discovery and applies a local scoring model.

Args:
  - server_url (string): Base URL of CKAN server (e.g., "https://dati.gov.it/opendata")
  - query (string): Natural language or keyword query (e.g., "mobilità urbana", "air quality")
  - limit (number): Number of datasets to return (default: 10)
  - weights (object): Field weights for scoring — higher weight = more influence on rank
    Default: title=4, tags=3, notes=2, organization=1
  - query_parser ('default' | 'text'): Override search parser behavior
  - response_format ('markdown' | 'json'): Output format

Returns:
  Ranked datasets with relevance scores and per-field score breakdowns

Examples:
  - { server_url: "https://dati.gov.it/opendata", query: "mobilità" }
  - { server_url: "...", query: "trasporti", limit: 5, weights: { title: 5, notes: 2 } }

Typical workflow: ckan_find_relevant_datasets → ckan_package_show (inspect top results) → ckan_datastore_search (query data)`,
      inputSchema: z.object({
        server_url: z.string()
          .url()
          .describe("Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"),
        query: z.string()
          .min(2)
          .describe("Natural language or keyword query to match against dataset title, notes, tags, and organization"),
        limit: z.coerce.number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Number of datasets to return"),
        weights: z.object({
          title: z.coerce.number().min(0).optional().describe("Weight for title match (default 4)"),
          notes: z.coerce.number().min(0).optional().describe("Weight for description match (default 2)"),
          tags: z.coerce.number().min(0).optional().describe("Weight for tag match (default 3)"),
          organization: z.coerce.number().min(0).optional().describe("Weight for organization match (default 1)")
        }).optional().describe("Per-field scoring weights; unspecified fields use defaults"),
        query_parser: z.enum(["default", "text"])
          .optional()
          .describe("Override search parser ('text' forces text:(...) on non-fielded queries)"),
        response_format: ResponseFormatSchema
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const weights = {
          ...DEFAULT_RELEVANCE_WEIGHTS,
          ...(params.weights ?? {})
        };

        const rows = Math.min(Math.max(params.limit * 5, params.limit), 100);
        const { effectiveQuery } = resolveSearchQuery(
          params.server_url,
          params.query,
          params.query_parser
        );

        const searchResult = await makeCkanRequest<any>(
          params.server_url,
          'package_search',
          {
            q: effectiveQuery,
            rows,
            start: 0
          }
        );

        const scored = (searchResult.results || []).map((dataset: CkanPackage) => {
          const { total, breakdown } = scoreDatasetRelevance(
            params.query,
            dataset,
            weights
          );

          return {
            dataset,
            score: total,
            breakdown
          };
        });

        scored.sort((a, b) => b.score - a.score);

        const top = scored.slice(0, params.limit).map((item) => {
          const dataset = item.dataset;
          return {
            id: dataset.id,
            name: dataset.name,
            title: dataset.title || dataset.name,
            organization: dataset.organization?.title || dataset.organization?.name || dataset.owner_org,
            tags: Array.isArray(dataset.tags) ? dataset.tags.map((tag: CkanTag) => tag.name) : [],
            metadata_modified: dataset.metadata_modified,
            score: item.score,
            breakdown: item.breakdown
          };
        });

        const payload = {
          query: params.query,
          terms: extractQueryTerms(params.query),
          weights,
          total_results: searchResult.count ?? 0,
          returned: top.length,
          results: top
        };

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(payload, null, 2)) }],
            structuredContent: payload
          };
        }

        let markdown = `# Relevant CKAN Datasets\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Query**: ${params.query}\n`;
        markdown += `**Terms**: ${payload.terms.length > 0 ? payload.terms.join(', ') : 'n/a'}\n`;
        markdown += `**Total Results**: ${payload.total_results}\n`;
        markdown += `**Returned**: ${payload.returned}\n\n`;

        markdown += `## Weights\n\n`;
        markdown += `- **Title**: ${weights.title}\n`;
        markdown += `- **Notes**: ${weights.notes}\n`;
        markdown += `- **Tags**: ${weights.tags}\n`;
        markdown += `- **Organization**: ${weights.organization}\n\n`;

        if (top.length === 0) {
          markdown += 'No datasets matched the query terms.\n';
          markdown += `\n> **Note**: No data was found on this portal. Do not use information from other sources to supplement this result.\n`;
        } else {
          markdown += `## Results\n\n`;
          markdown += `| Rank | Dataset | Score | Title | Org | Tags |\n`;
          markdown += `| --- | --- | --- | --- | --- | --- |\n`;

          top.forEach((dataset, index) => {
            const tags = dataset.tags.slice(0, 3).join(', ');
            markdown += `| ${index + 1} | ${dataset.name} | ${dataset.score} | ${dataset.title} | ${dataset.organization || '-'} | ${tags || '-'} |\n`;
          });

          markdown += `\n### Score Breakdown\n\n`;
          top.forEach((dataset, index) => {
            markdown += `**${index + 1}. ${dataset.title}**\n`;
            markdown += `- Title: ${dataset.breakdown.title}\n`;
            markdown += `- Notes: ${dataset.breakdown.notes}\n`;
            markdown += `- Tags: ${dataset.breakdown.tags}\n`;
            markdown += `- Organization: ${dataset.breakdown.organization}\n`;
            markdown += `- Total: ${dataset.breakdown.total}\n\n`;
          });
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error ranking datasets: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * Get details of a specific dataset
   */
  server.registerTool(
    "ckan_package_show",
    {
      title: "Show CKAN Dataset Details",
      description: `Get complete metadata for a specific dataset (package).

Returns full details including resources, organization, tags, and all metadata fields.

Notes:
  - metadata_modified is a CKAN record timestamp (publish time on source portals,
    harvest time on aggregators), not the content date.
  - issued/modified are content dates when provided by the publisher.
  - JSON output adds metadata_harvested_at (same as metadata_modified).

Args:
  - server_url (string): Base URL of CKAN server
  - id (string): Dataset ID or name (machine-readable slug)
  - include_tracking (boolean): Include view/download statistics (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns (JSON format):
  id, name, title, notes, organization, tags, state, license_title,
  metadata_created, metadata_modified, issued, modified,
  author, maintainer,
  frequency, language, publisher_name, holder_name,
  hvd_category, applicable_legislation,
  resources (id, name, format, url, size, datastore_active, created, last_modified, api_json_url),
  view_url, api_json_url

Examples:
  - { server_url: "https://dati.gov.it/opendata", id: "dataset-name" }
  - { server_url: "...", id: "abc-123-def", include_tracking: true }

Typical workflow: ckan_package_show → pick a resource with datastore_active=true → ckan_datastore_search (query its data)`,
      inputSchema: z.object({
        server_url: z.string()
          .url()
          .describe("Base URL of the CKAN server"),
        id: z.string()
          .min(1)
          .describe("Dataset ID or name"),
        include_tracking: z.boolean()
          .optional()
          .default(false)
          .describe("Include tracking statistics"),
        response_format: ResponseFormatSchema
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const result = await makeCkanRequest<any>(
          params.server_url,
          'package_show',
          {
            id: params.id,
            include_tracking: params.include_tracking
          }
        );

        if (params.response_format === ResponseFormat.JSON) {
          const compact = compactPackageShow(enrichPackageShowResult(result), params.server_url);
          return {
            content: [{ type: "text", text: truncateJson(compact) }],
            structuredContent: compact
          };
        }

        const markdown = formatPackageShowMarkdown(result, params.server_url);
        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching package: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  /**
   * List resources in a dataset with a compact summary
   */
  server.registerTool(
    "ckan_list_resources",
    {
      title: "List CKAN Dataset Resources",
      description: `List all resources in a dataset with a compact summary.

Returns a focused table of resources showing format, size, DataStore availability, and download URL.
Use this to quickly assess what files a dataset contains before deciding how to access the data.

Args:
  - server_url (string): Base URL of CKAN server
  - id (string): Dataset ID or name
  - format_filter (string): Filter resources by format, case-insensitive (e.g., "CSV", "json", "XLSX")
  - response_format ('markdown' | 'json'): Output format

Returns:
  Compact resource summary with name, ID, format, size, DataStore flag, and URL

Examples:
  - { server_url: "https://dati.gov.it/opendata", id: "dataset-name" }
  - { server_url: "...", id: "dataset-name", format_filter: "CSV" }

Typical workflow: ckan_package_search → ckan_list_resources (assess available files) → ckan_datastore_search (for resources with DataStore=true)`,
      inputSchema: z.object({
        server_url: z.string()
          .url()
          .describe("Base URL of the CKAN server"),
        id: z.string()
          .min(1)
          .describe("Dataset ID or name"),
        format_filter: z.string()
          .optional()
          .describe("Filter resources by format, case-insensitive (e.g., 'CSV', 'json', 'XLSX')"),
        response_format: ResponseFormatSchema
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const result = await makeCkanRequest<any>(
          params.server_url,
          'package_show',
          { id: params.id }
        );

        const resources = Array.isArray(result.resources) ? result.resources : [];
        const formatFilter = params.format_filter?.toUpperCase();

        const summary = resources
          .filter((r: CkanResource) => !formatFilter || (r.format || "").toUpperCase() === formatFilter)
          .map((r: CkanResource) => {
            const effectiveUrl = resolveDownloadUrl(r);
            return {
              name: r.name || "Unnamed Resource",
              id: r.id,
              format: r.format || "Unknown",
              size: r.size ? formatBytes(r.size) : null,
              datastore_active: r.datastore_active === true,
              url: effectiveUrl
            };
          });

        if (params.response_format === ResponseFormat.JSON) {
          const payload = {
            dataset_id: result.id,
            dataset_name: result.name,
            dataset_title: result.title || result.name,
            total_resources: resources.length,
            filtered_resources: summary.length,
            format_filter: formatFilter ?? null,
            resources: summary
          };
          return {
            content: [{ type: "text", text: truncateText(JSON.stringify(payload, null, 2)) }],
            structuredContent: payload
          };
        }

        let markdown = `# Resources: ${result.title || result.name}\n\n`;
        markdown += `**Server**: ${params.server_url}\n`;
        markdown += `**Dataset**: \`${result.name}\` (\`${result.id}\`)\n`;
        markdown += `**Total Resources**: ${resources.length}`;
        if (formatFilter) {
          markdown += ` (showing ${summary.length} ${formatFilter})`;
        }
        markdown += `\n\n`;

        if (summary.length === 0) {
          markdown += `No resources found in this dataset.\n`;
          markdown += `\n> **Note**: No data was found on this portal. Do not use information from other sources to supplement this result.\n`;
        } else {
          markdown += `| Name | Format | Size | DataStore | ID |\n`;
          markdown += `| --- | --- | --- | --- | --- |\n`;

          for (const r of summary) {
            const name = r.name.length > 40 ? r.name.substring(0, 37) + '...' : r.name;
            const ds = r.datastore_active ? 'Yes' : 'No';
            const size = r.size || '-';
            markdown += `| ${name} | ${r.format} | ${size} | ${ds} | \`${r.id}\` |\n`;
          }

          const dsResources = summary.filter((r) => r.datastore_active);
          if (dsResources.length > 0) {
            markdown += `\n**DataStore-enabled resources** (queryable with \`ckan_datastore_search\`):\n`;
            for (const r of dsResources) {
              markdown += `- **${r.name}** (${r.format}): \`${r.id}\`\n`;
            }
          }
        }

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing resources: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
