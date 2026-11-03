/**
 * Root fields declared by a ckanext-scheming schema.
 *
 * `package_show` returns every field a portal stores, but the tool output carries a fixed
 * list. On a portal that uses ckanext-scheming the rest (keywords, coverage, subject,
 * contacts, ...) never reached the caller. `renderSchemaFields` adds those fields, each
 * with the label the schema gives it. Values are passed on as stored: translated values
 * stay `{"en": ..., "fr": ...}`, codes stay codes.
 *
 * Portals without scheming get no extra fields and the output stays as it was.
 *
 * Every string here comes from the portal (field names, labels, values), so each one is
 * stripped of control characters and capped; the Markdown renderer escapes them again.
 */

import { makeCkanRequest } from "./http.js";
import { sanitizeInline, wrapUntrusted } from "./formatting.js";

export const MAX_FIELD_TEXT = 2000;
const MAX_LABEL_TEXT = 200;
const MAX_DEPTH = 4;

export interface RenderedField {
  field: string;
  label: string;
  value: unknown;
  /** True when a string in `value` was cut at MAX_FIELD_TEXT or nested data was left out. */
  truncated?: true;
}

type SchemaField = {
  field_name?: string;
  label?: unknown;
  display_snippet?: unknown;
};

export type DatasetSchema = {
  dataset_fields?: SchemaField[];
};

/**
 * Fields never added, whatever the output: CKAN bookkeeping, and translated twins of the
 * title and description. What each output (Markdown, JSON) really shows is passed in by the
 * caller, since the two differ.
 */
const NEVER_ADDED = new Set([
  "id", "name", "type", "url_name", "owner_org", "tag_string", "title_translated", "notes_translated"
]);

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

type Cut = { done: boolean };

export function cleanText(value: unknown, limit: number = MAX_FIELD_TEXT, cut?: Cut): string {
  const text = String(value).replace(CONTROL, "");
  if (text.length <= limit) return text;
  if (cut) cut.done = true;
  return text.slice(0, limit) + "…";
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);
}

/**
 * Copy of a stored value with every string cleaned. The structure is kept as stored (null
 * and empty members stay, so positions in a list do not shift); anything cut or merged on
 * the way is flagged through `cut`.
 */
function plain(value: unknown, cut: Cut, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value) || (value && typeof value === "object")) {
    if (depth >= MAX_DEPTH) {
      cut.done = true;
      return "[nested data omitted]";
    }
    if (Array.isArray(value)) return value.map((v) => plain(v, cut, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      let key = cleanText(k, MAX_LABEL_TEXT, cut);
      // cleaning can make two keys equal; keep both rather than let one overwrite the other
      for (let n = 2; Object.hasOwn(out, key); n++) {
        cut.done = true;
        key = `${cleanText(k, MAX_LABEL_TEXT)}~${n}`;
      }
      out[key] = plain(v, cut, depth + 1);
    }
    return out;
  }
  return cleanText(value, MAX_FIELD_TEXT, cut);
}

/** A schema label is a string, or one string per language: take English, else the first. */
function labelText(label: unknown, fallback: string, cut?: Cut): string {
  let text: unknown = label;
  if (label && typeof label === "object" && !Array.isArray(label)) {
    const dict = label as Record<string, unknown>;
    text = dict.en ?? Object.values(dict).find((v) => typeof v === "string" && v);
  }
  return cleanText(typeof text === "string" && text ? text : fallback, MAX_LABEL_TEXT, cut);
}

/**
 * The schema's root fields that the dataset has a value for and that the output being built
 * does not already show. `shown` names what that output carries (it differs between
 * Markdown and JSON, so the caller knows best); a value the output cannot show is not
 * "shown" and so comes through here.
 */
export function renderSchemaFields(
  pkg: Record<string, any>,
  schema: DatasetSchema,
  shown: ReadonlySet<string> = new Set()
): RenderedField[] {
  const out: RenderedField[] = [];
  const seen = new Set<string>();
  for (const field of schema.dataset_fields ?? []) {
    // a schema is portal input too: one malformed entry must not cost the whole answer
    if (!field || typeof field !== "object") continue;
    const name = field.field_name;
    if (typeof name !== "string" || NEVER_ADDED.has(name) || shown.has(name)) continue;
    // each field once, however often the schema lists it: a repeated name would copy the value again
    if (seen.has(name)) continue;
    seen.add(name);
    // scheming's own way to say "do not show this field"
    if ("display_snippet" in field && field.display_snippet === null) continue;
    const value = Object.hasOwn(pkg, name) ? pkg[name] : undefined;
    if (isEmpty(value)) continue;
    const cut: Cut = { done: false };
    const clean = plain(value, cut);
    if (isEmpty(clean)) continue;
    const item: RenderedField = { field: cleanText(name, MAX_LABEL_TEXT, cut), label: labelText(field.label, name, cut), value: clean };
    if (cut.done) item.truncated = true;
    out.push(item);
  }
  return out;
}

const SHORT_TTL_MS = 5 * 60 * 1000;
const LONG_TTL_MS = 60 * 60 * 1000;
const MAX_NO_SCHEMA = 200;
const noSchema = new Map<string, number>();

export function __resetSchemaCacheForTests(): void {
  noSchema.clear();
}

/**
 * The portal's scheming schema for a dataset type, or null. Any failure means "no schema"
 * and is not reported: portals without scheming answer 404 or 400 ("action not known"),
 * a slow or failing one times out or answers 5xx. Positive answers are cached by
 * `makeCkanRequest`; a missing schema is remembered for an hour (404, 400) or five minutes
 * (anything else), so `package_show` does not pay for a second request on every call.
 */
export async function getDatasetSchema(serverUrl: string, type: string = "dataset"): Promise<DatasetSchema | null> {
  const key = `${cacheOrigin(serverUrl)}|${type}`;
  const until = noSchema.get(key);
  if (until !== undefined && until > Date.now()) return null;
  try {
    const schema = await makeCkanRequest<DatasetSchema>(serverUrl, "scheming_dataset_schema_show", { type });
    if (schema && Array.isArray(schema.dataset_fields)) return schema;
    remember(key, LONG_TTL_MS);
    return null;
  } catch (error) {
    const status = (error as { status?: number }).status;
    remember(key, status === 404 || status === 400 ? LONG_TTL_MS : SHORT_TTL_MS);
    return null;
  }
}

/** Scheme and host are case-insensitive, the path is not: `/Data` and `/data` are two portals. */
function cacheOrigin(serverUrl: string): string {
  try {
    const url = new URL(serverUrl);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return serverUrl.trim();
  }
}

function remember(key: string, ttl: number): void {
  if (noSchema.size >= MAX_NO_SCHEMA) noSchema.clear();
  noSchema.set(key, Date.now() + ttl);
}

/**
 * `sanitizeInline` stops line and table forgery, not links: a portal value like
 * `[Verify account](https://attacker.example)` would render as a live link. Brackets and
 * angle brackets are escaped so links, images and HTML stay text.
 */
const escaped = (value: unknown): string => sanitizeInline(value).replace(/[\[\]<>]/g, "\\$&");

function markdownValue(value: unknown): { inline: string; block?: string } {
  if (typeof value === "string") {
    return value.length > 300 || /[\r\n]/.test(value)
      ? { inline: "", block: wrapUntrusted(value) }
      : { inline: escaped(value) };
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return { inline: value.map((v) => escaped(v)).join(", ") };
  }
  if (value && typeof value === "object") return { inline: escaped(JSON.stringify(value)) };
  return { inline: escaped(value) };
}

/** Markdown bullets for rendered fields: label, then the field name in code, then the value. */
export function formatFieldsMarkdown(fields: RenderedField[]): string {
  let out = "";
  for (const f of fields) {
    const { inline, block } = markdownValue(f.value);
    out += `- **${escaped(f.label)}** (\`${sanitizeInline(f.field)}\`):${block ? "\n\n" + block + "\n" : " " + inline}`;
    if (f.truncated) out += " [shortened here; the full value is in the Full JSON metadata]";
    out += "\n";
  }
  return out;
}
