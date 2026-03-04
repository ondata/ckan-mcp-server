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

export interface EuropaSearchResult {
  count: number;
  results: EuropaDataset[];
}

export async function makeEuropaSearchRequest(
  params: EuropaSearchParams
): Promise<EuropaSearchResult> {
  const isNode =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;

  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
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

  const envelope = data as { result?: { count?: number; results?: EuropaDataset[] } };
  return {
    count: envelope?.result?.count ?? 0,
    results: envelope?.result?.results ?? []
  };
}
