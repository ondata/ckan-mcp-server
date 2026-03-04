/**
 * HTTP client for European Data Portal (data.europa.eu) Search API
 */

import axios from "axios";
import type { EuropaDataset } from "../types.js";

const EUROPA_SEARCH_URL = "https://data.europa.eu/api/hub/search/search";

export interface EuropaSearchParams {
  q: string;
  page?: number;
  limit?: number;
  facets?: Record<string, string[]>;
  sort?: string;
}

export interface EuropaRawFacetItem {
  id: string;
  title: string | Record<string, string>;
  count: number;
}

export interface EuropaRawFacet {
  id: string;
  title: string;
  items: EuropaRawFacetItem[];
}

export interface EuropaFacetItem {
  id: string;
  title: string;
  count: number;
}

export interface EuropaFacet {
  id: string;
  title: string;
  items: EuropaFacetItem[];
}

export interface EuropaSearchResult {
  count: number;
  results: EuropaDataset[];
  rawFacets: EuropaRawFacet[];
}

export async function makeEuropaSearchRequest(
  params: EuropaSearchParams
): Promise<EuropaSearchResult> {
  const isNode =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;

  const searchParams = new URLSearchParams();
  // Omit q for match-all queries: the API returns all 1.7M+ datasets only when q is absent or empty.
  // With q=* or q=*:* Elasticsearch returns a small subset (~6k).
  const isMatchAll = !params.q || params.q === "*" || params.q === "*:*";
  if (!isMatchAll) {
    searchParams.set("q", params.q);
  }
  searchParams.set("page", String(params.page ?? 0));
  searchParams.set("limit", String(params.limit ?? 10));
  searchParams.set("filters", "dataset");

  if (params.facets && Object.keys(params.facets).length > 0) {
    searchParams.set("facets", JSON.stringify(params.facets));
  }
  if (params.sort) {
    searchParams.set("sort", params.sort);
  }

  const url = `${EUROPA_SEARCH_URL}?${searchParams.toString()}`;

  let data: unknown;

  if (isNode) {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        Accept: "application/json",
        "User-Agent": "CKAN-MCP-Server/1.0"
      }
    });
    data = response.data;
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "CKAN-MCP-Server/1.0"
        }
      });
      if (!response.ok) {
        throw new Error(`Europa API error (${response.status}): ${response.statusText}`);
      }
      data = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const envelope = data as { result?: { count?: number; results?: EuropaDataset[]; facets?: EuropaRawFacet[] } };
  return {
    count: envelope?.result?.count ?? 0,
    results: envelope?.result?.results ?? [],
    rawFacets: envelope?.result?.facets ?? []
  };
}
