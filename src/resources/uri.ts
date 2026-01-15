/**
 * URI parsing utilities for ckan:// scheme
 */

import { getPortalApiUrlForHostname } from "../utils/portal-config.js";

export interface ParsedCkanUri {
  server: string;
  type: string;
  id: string;
}

/**
 * Parse a ckan:// URI and extract server, type, and ID
 *
 * URI format: ckan://{server}/{type}/{id}
 * Example: ckan://dati.gov.it/dataset/vaccini-covid
 *
 * @param uri - The URL object to parse
 * @returns Parsed components with HTTPS server URL
 * @throws Error if URI is malformed
 */
export function parseCkanUri(uri: URL): ParsedCkanUri {
  const hostname = uri.hostname;
  if (!hostname) {
    throw new Error("Invalid ckan:// URI: missing server hostname");
  }

  const pathParts = uri.pathname.split("/").filter((p) => p.length > 0);

  if (pathParts.length < 2) {
    throw new Error(
      `Invalid ckan:// URI: expected /{type}/{id}, got ${uri.pathname}`
    );
  }

  const [type, ...idParts] = pathParts;
  const id = idParts.join("/");

  if (!type || !id) {
    throw new Error("Invalid ckan:// URI: missing type or id");
  }

  const server = getPortalApiUrlForHostname(hostname) || `https://${hostname}`;

  return { server, type, id };
}

/**
 * Parse a ckan:// URI and extract server and path segments
 *
 * URI format: ckan://{server}/{segment1}/{segment2}/...
 * Example: ckan://dati.gov.it/group/ambiente/datasets
 */
export function parseCkanPath(uri: URL): { server: string; pathParts: string[] } {
  const hostname = uri.hostname;
  if (!hostname) {
    throw new Error("Invalid ckan:// URI: missing server hostname");
  }

  const pathParts = uri.pathname.split("/").filter((p) => p.length > 0);

  if (pathParts.length === 0) {
    throw new Error(`Invalid ckan:// URI: missing path, got ${uri.pathname}`);
  }

  const server = getPortalApiUrlForHostname(hostname) || `https://${hostname}`;

  return { server, pathParts };
}

/**
 * Validate that a string looks like a valid CKAN server hostname
 */
export function isValidCkanServer(hostname: string): boolean {
  // Basic validation: must have at least one dot, no spaces
  return hostname.includes(".") && !hostname.includes(" ");
}
