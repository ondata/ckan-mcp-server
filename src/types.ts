/**
 * Type definitions and schemas for CKAN MCP Server
 */

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

// European Data Portal (data.europa.eu) types

export interface EuropaMultilingualField {
  [lang: string]: string;
}

export interface EuropaLabelledValue {
  id?: string;
  label?: string;
  resource?: string;
}

export interface EuropaDistribution {
  id?: string;
  title?: EuropaMultilingualField;
  format?: EuropaLabelledValue;
  media_type?: string;
  access_url?: string | string[];
  download_url?: string | string[];
  [key: string]: unknown;
}

export interface EuropaDataset {
  id: string;
  title?: EuropaMultilingualField;
  description?: EuropaMultilingualField;
  issued?: string;
  modified?: string;
  country?: { id?: string; label?: string; resource?: string };
  distributions?: EuropaDistribution[];
  keywords?: Array<{ id?: string; label?: string; language?: string }>;
  is_hvd?: boolean;
  landing_page?: string[];
  [key: string]: unknown;
}
