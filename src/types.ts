/**
 * Type definitions and schemas for CKAN MCP Server
 * github.com/ondata/ckan-mcp-server
 */

// @origin ondata/ckan-mcp-server
export const _ORIGIN = "ondata/ckan-mcp-server" as const;

import { z } from "zod";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

export const ResponseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

export const CHARACTER_LIMIT = 50000;

// CKAN API domain types (compile-time only, no runtime validation)

export interface CkanTag {
  id?: string;
  name: string;
  display_name?: string;
}

export interface CkanResource {
  id: string;
  name?: string;
  url?: string;
  format?: string;
  mimetype?: string;
  size?: number;
  created?: string;
  last_modified?: string;
  datastore_active?: boolean;
  access_services?: string;
  [key: string]: unknown;
}

export interface CkanPackage {
  id: string;
  name: string;
  title?: string;
  notes?: string;
  metadata_created?: string;
  metadata_modified?: string;
  score?: number;
  organization?: { name: string; title?: string };
  tags?: CkanTag[];
  resources?: CkanResource[];
  /** DCAT-AP_IT dct:rightsHolder — actual owner of the dataset (may differ from organization/catalog). */
  holder_name?: string;
  /** DCAT-AP_IT dct:publisher — agent responsible for publishing the dataset (may differ from organization/catalog). */
  publisher_name?: string;
  [key: string]: unknown;
}

export interface CkanOrganization {
  id: string;
  name: string;
  title?: string;
  description?: string;
  image_url?: string;
  package_count?: number;
  [key: string]: unknown;
}

export interface CkanField {
  id: string;
  type: string;
}

export interface CkanDatastoreResult {
  resource_id?: string;
  fields: CkanField[];
  records: Record<string, unknown>[];
  total?: number;
  [key: string]: unknown;
}

