/**
 * European Data Portal (data.europa.eu) search tool
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import type { EuropaMultilingualField, EuropaDataset } from "../types.js";
import { makeEuropaSearchRequest } from "../utils/europa-http.js";
import type { EuropaFacet, EuropaRawFacet } from "../utils/europa-http.js";
import { truncateText, formatDate, addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Replace control characters (U+0000–U+001F except \n \r \t) with a space.
 * Newlines are normalised to a single space so descriptions stay on one line
 * in JSON output (avoids raw 0x0A inside JSON strings after jq -r).
 */
function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, " ").replace(/[\r\n]+/g, " ");
}

/**
 * Extract a value from a multilingual field, with fallback chain:
 * requested lang → "en" → first available → ""
 */
export function pickLang(
  obj: EuropaMultilingualField | undefined,
  lang: string
): string {
  if (!obj || typeof obj !== "object") return "";
  const raw = obj[lang] || (lang !== "en" ? obj["en"] : undefined);
  if (raw) return sanitizeText(raw);
  const keys = Object.keys(obj);
  return keys.length > 0 ? sanitizeText(obj[keys[0]]) : "";
}

/**
 * Extract unique format labels from distributions
 */
function extractFormats(dataset: EuropaDataset): string[] {
  if (!Array.isArray(dataset.distributions)) return [];
  const formats = new Set<string>();
  for (const dist of dataset.distributions) {
    const label = dist.format?.label;
    if (label) formats.add(label.toUpperCase());
  }
  return Array.from(formats).sort();
}

/**
 * Extract keyword labels from dataset
 */
function extractKeywords(
  dataset: EuropaDataset,
  lang: string
): string[] {
  if (!Array.isArray(dataset.keywords)) return [];
  const kws: string[] = [];
  for (const kw of dataset.keywords) {
    if (kw.language === lang && kw.label) {
      kws.push(kw.label);
    }
  }
  if (kws.length === 0) {
    for (const kw of dataset.keywords) {
      if (kw.language === "en" && kw.label) {
        kws.push(kw.label);
      }
    }
  }
  if (kws.length === 0) {
    for (const kw of dataset.keywords) {
      if (kw.label) kws.push(kw.label);
    }
  }
  return [...new Set(kws)];
}

interface CompactDistribution {
  format: string;
  url: string;
}

/**
 * Extract compact distribution list: format + best URL
 */
function extractDistributions(dataset: EuropaDataset): CompactDistribution[] {
  if (!Array.isArray(dataset.distributions)) return [];
  const dists: CompactDistribution[] = [];
  for (const dist of dataset.distributions) {
    const format = dist.format?.label?.toUpperCase() || "UNKNOWN";
    const rawDownload = dist.download_url;
    const rawAccess = dist.access_url;
    const download = Array.isArray(rawDownload) ? rawDownload[0] : rawDownload;
    const access = Array.isArray(rawAccess) ? rawAccess[0] : rawAccess;
    const url = download || access || "";
    if (url) dists.push({ format, url });
  }
  return dists;
}

export interface EuropaSearchRenderParams {
  q: string;
  country?: string[];
  lang: string;
  page: number;
  page_size: number;
}

/**
 * Render Europa search results as markdown
 */
export function renderEuropaSearchMarkdown(
  results: EuropaDataset[],
  count: number,
  params: EuropaSearchRenderParams
): string {
  const { q, country, lang, page, page_size } = params;

  let md = `# European Data Portal — Search Results\n\n`;
  md += `**Query**: ${q}`;
  if (country && country.length > 0) {
    md += ` | **Country**: ${country.map((c) => c.toUpperCase()).join(", ")}`;
  }
  md += ` | **Results**: ${count} (page ${page}, ${page_size} per page)\n\n`;

  if (results.length === 0) {
    md += `No datasets found matching your query.\n`;
    return md;
  }

  md += `---\n\n`;

  results.forEach((dataset, i) => {
    const title = pickLang(dataset.title, lang) || dataset.id;
    const description = pickLang(dataset.description, lang);
    const formats = extractFormats(dataset);
    const keywords = extractKeywords(dataset, lang);
    const countryLabel = dataset.country?.id?.toUpperCase() || "";

    md += `### ${i + 1}. ${title}\n\n`;
    md += `| Field | Value |\n|---|---|\n`;
    if (countryLabel) md += `| Country | ${countryLabel} |\n`;
    if (dataset.issued) md += `| Issued | ${formatDate(dataset.issued)} |\n`;
    if (dataset.modified) md += `| Modified | ${formatDate(dataset.modified)} |\n`;
    if (formats.length > 0) md += `| Formats | ${formats.join(", ")} |\n`;
    if (keywords.length > 0) md += `| Keywords | ${keywords.slice(0, 8).join(", ")}${keywords.length > 8 ? ", ..." : ""} |\n`;
    if (dataset.is_hvd) md += `| HVD | Yes |\n`;
    md += `\n`;

    if (description) {
      const truncated = description.length > 200
        ? description.substring(0, 200) + "..."
        : description;
      md += `${truncated}\n\n`;
    }

    md += `Link: https://data.europa.eu/data/datasets/${dataset.id}\n\n`;

    const dists = extractDistributions(dataset);
    if (dists.length > 0) {
      md += `**Resources** (${dists.length}):\n`;
      for (const d of dists.slice(0, 5)) {
        md += `- ${d.format}: ${d.url}\n`;
      }
      if (dists.length > 5) {
        md += `- ... and ${dists.length - 5} more\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  });

  if (count > page * page_size) {
    md += `> More results available — use \`page: ${page + 1}\`\n`;
  }

  return md;
}

const MAX_FACET_ITEMS = 15;

/** Facets to keep in output (others are discarded) */
const ALLOWED_FACETS = new Set([
  "country", "categories", "format", "is_hvd",
  "scoring", "language", "subject", "hvdCategory", "publisher"
]);

/**
 * Resolve a raw facet title (string or multilingual object) to a single string
 */
function resolveFacetTitle(
  title: string | Record<string, string>,
  lang: string
): string {
  if (typeof title === "string") return title;
  return title[lang] || title["en"] || Object.values(title)[0] || "";
}

/**
 * Filter and normalize raw API facets: keep only allowed facets,
 * resolve multilingual titles, cap items.
 */
export function resolveRawFacets(rawFacets: EuropaRawFacet[], lang: string): EuropaFacet[] {
  const result: EuropaFacet[] = [];
  for (const raw of rawFacets) {
    if (!ALLOWED_FACETS.has(raw.id)) continue;
    if (!raw.items || raw.items.length === 0) continue;
    const items = raw.items
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_FACET_ITEMS)
      .map((item) => ({
        id: item.id,
        title: resolveFacetTitle(item.title, lang),
        count: item.count
      }));
    result.push({ id: raw.id, title: raw.title, items });
  }
  return result;
}

/**
 * Render facets as markdown tables
 */
export function renderFacetsMarkdown(facets: EuropaFacet[]): string {
  if (!facets || facets.length === 0) return "";

  let md = `## Facets\n\n`;
  for (const facet of facets) {
    if (!facet.items || facet.items.length === 0) continue;
    md += `### ${facet.title || facet.id}\n\n`;
    md += `| Value | Count |\n|---|---:|\n`;
    for (const item of facet.items) {
      md += `| ${item.title || item.id} | ${item.count} |\n`;
    }
    md += `\n`;
  }
  return md;
}

/**
 * Convert facets array to compact JSON object keyed by facet id
 */
export function facetsToCompactJson(facets: EuropaFacet[]): Record<string, { id: string; title: string; count: number }[]> {
  const result: Record<string, { id: string; title: string; count: number }[]> = {};
  for (const facet of facets) {
    if (!facet.items || facet.items.length === 0) continue;
    result[facet.id] = facet.items.map((item) => ({
      id: item.id, title: item.title, count: item.count
    }));
  }
  return result;
}

export function registerEuropaTools(server: McpServer) {
  server.registerTool(
    "europa_dataset_search",
    {
      title: "Search European Data Portal",
      description: `Search datasets on the European Data Portal (data.europa.eu), which aggregates 1.7M+ datasets from all EU countries.

This is NOT a CKAN portal. Use this tool specifically for EU-wide open data discovery.

Args:
  - q (string): Search query
  - country (string[]): ISO 3166-1 alpha-2 country codes (e.g., ["IT", "DE"])
  - is_hvd (boolean): Filter only High Value Datasets
  - lang (string): Language for multilingual fields (default "en")
  - sort (enum): Sort by "relevance", "issued", "modified", "title"
  - order (enum): Sort direction "asc" or "desc" (default "desc")
  - page (number): Page number, 1-based (default 1)
  - page_size (number): Results per page (default 10, max 50)
  - response_format: "markdown" or "json" (JSON is compact: description truncated, max 3 distributions)

Available facets (fixed — returned automatically): country, categories, format, language, is_hvd, hvdCategory, scoring.
Publisher/organization breakdown is NOT available as a facet here. Use sparql_query on https://data.europa.eu/sparql for that.

When to use sparql_query instead of this tool:
  - Count or list datasets grouped by publisher/organization
  - Query any property not exposed as a facet (e.g., license URI, spatial coverage, themes)
  - Cross-join datasets with EU controlled vocabularies (publications.europa.eu)
  - Any aggregation or filter not supported by the search API

Examples:
  - { q: "environment", country: ["IT"], page_size: 5 }
  - { q: "transport", sort: "modified", order: "desc" }
  - { q: "health data", lang: "it" }
  - { q: "transport", is_hvd: true }`,
      inputSchema: z.object({
        q: z.string()
          .min(1)
          .describe("Search query"),
        country: z.array(z.string().length(2))
          .optional()
          .describe("ISO 3166-1 alpha-2 country codes"),
        is_hvd: z.boolean()
          .optional()
          .describe("Filter only High Value Datasets (HVD)"),
        lang: z.string()
          .optional()
          .default("en")
          .describe("Language for multilingual fields"),
        sort: z.enum(["relevance", "issued", "modified", "title"])
          .optional()
          .describe("Sort field"),
        order: z.enum(["asc", "desc"])
          .optional()
          .default("desc")
          .describe("Sort direction"),
        page: z.number()
          .int()
          .min(1)
          .optional()
          .default(1)
          .describe("Page number (1-based)"),
        page_size: z.number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Results per page"),
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
        const filterFacets: Record<string, string[]> = {};
        if (params.country && params.country.length > 0) {
          filterFacets.country = params.country.map((c) => c.toLowerCase());
        }
        if (params.is_hvd) {
          filterFacets.is_hvd = ["true"];
        }

        let sortParam: string | undefined;
        if (params.sort && params.sort !== "relevance") {
          sortParam = `${params.sort}+${params.order}`;
        }

        const { count, results, rawFacets } = await makeEuropaSearchRequest({
          q: params.q,
          page: params.page - 1,
          limit: params.page_size,
          facets: Object.keys(filterFacets).length > 0 ? filterFacets : undefined,
          sort: sortParam
        });

        const facets = resolveRawFacets(rawFacets, params.lang);

        if (params.response_format === ResponseFormat.JSON) {
          // Compact JSON: single language, truncated description, limited distributions
          const filtered = results.map((d) => {
            const desc = pickLang(d.description, params.lang);
            const dists = extractDistributions(d);
            return {
              id: d.id,
              title: pickLang(d.title, params.lang),
              description: desc.length > 200 ? desc.substring(0, 200) + "..." : desc,
              issued: d.issued ?? null,
              modified: d.modified ?? null,
              country: d.country?.id?.toUpperCase() || null,
              formats: extractFormats(d),
              keywords: extractKeywords(d, params.lang).slice(0, 5),
              is_hvd: d.is_hvd ?? false,
              link: `https://data.europa.eu/data/datasets/${d.id}`,
              distributions: dists.slice(0, 3)
            };
          });
          const compactFacets = facetsToCompactJson(facets);
          return {
            content: [{
              type: "text",
              text: truncateText(JSON.stringify({ count, results: filtered, facets: compactFacets }, null, 2))
            }]
          };
        }

        let markdown = renderEuropaSearchMarkdown(results, count, {
          q: params.q,
          country: params.country,
          lang: params.lang,
          page: params.page,
          page_size: params.page_size
        });

        markdown += renderFacetsMarkdown(facets);

        return {
          content: [{ type: "text", text: truncateText(addDemoFooter(markdown)) }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching European Data Portal: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}
