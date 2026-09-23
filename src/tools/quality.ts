/**
 * CKAN Quality (MQA) tools for dati.gov.it
 */

import { z } from "zod";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest, formatCkanError, safeFetch } from "../utils/http.js";
import { truncateText, truncateJson, formatError, addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MQA_API_BASE = "https://data.europa.eu/api/mqa/cache/datasets";
const MQA_METRICS_BASE = "https://data.europa.eu/api/hub/repo/datasets";
const ALLOWED_MQA_HOSTS = new Set(["dati.gov.it", "www.dati.gov.it"]);

/**
 * Validate server URL is dati.gov.it. Parses the URL and compares the exact host,
 * so suffix (`dati.gov.it.attacker.com`) and userinfo (`dati.gov.it@attacker.com`)
 * tricks that an unanchored regex would accept are rejected (GHSA-83x6).
 */
export function isValidMqaServer(serverUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(serverUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  return ALLOWED_MQA_HOSTS.has(u.hostname.toLowerCase());
}

function normalizeMqaIdentifier(identifier: string): string {
  return identifier
    .trim()
    .replace(/:/g, "-")
    .replace(/\./g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function buildMqaIdCandidates(identifier: string): string[] {
  const base = normalizeMqaIdentifier(identifier);
  if (!base) {
    return [];
  }

  const candidates = [base];
  if (!base.includes("~~")) {
    candidates.push(`${base}~~1`, `${base}~~2`);
  }

  return candidates;
}

/*
 * Previous MQA methodology (v1): 405-point scale, five dimensions. Still used as a
 * fallback for datasets data.europa.eu has not re-evaluated with v2 yet.
 */
type MqaDimension = "accessibility" | "findability" | "interoperability" | "reusability" | "contextuality";

type MqaScores = Partial<Record<MqaDimension, number>> & {
  total?: number;
};

type MqaBreakdown = {
  scores: MqaScores;
  nonMaxDimensions: MqaDimension[];
  metricsUrl: string;
  mqaUrl: string;
  portalId: string;
};

type MetricValue = boolean | number | string;

type MqaMetricFlag = {
  metricId: string;
  metricKey: string;
  dimension: MqaDimension;
  values: MetricValue[];
};

type MqaMetricDetails = {
  flags: MqaMetricFlag[];
  reasons: Partial<Record<MqaDimension, string[]>>;
};

const DIMENSION_MAX: Record<MqaDimension, number> = {
  accessibility: 100,
  findability: 100,
  interoperability: 110,
  reusability: 75,
  contextuality: 20
};

const DIMENSION_LABELS: Record<MqaDimension, string> = {
  accessibility: "Accessibility",
  findability: "Findability",
  interoperability: "Interoperability",
  reusability: "Reusability",
  contextuality: "Contextuality"
};

const METRIC_DEFINITIONS: Record<string, {
  dimension: MqaDimension;
  reason?: string;
  expectsStatusCode?: boolean;
}> = {
  accessUrlAvailability: { dimension: "accessibility", reason: "accessUrlAvailability=false" },
  downloadUrlAvailability: { dimension: "accessibility", reason: "downloadUrlAvailability=false" },
  accessUrlStatusCode: { dimension: "accessibility", expectsStatusCode: true },
  downloadUrlStatusCode: { dimension: "accessibility", expectsStatusCode: true },
  keywordAvailability: { dimension: "findability", reason: "keywordAvailability=false" },
  categoryAvailability: { dimension: "findability", reason: "categoryAvailability=false" },
  spatialAvailability: { dimension: "findability", reason: "spatialAvailability=false" },
  temporalAvailability: { dimension: "findability", reason: "temporalAvailability=false" },
  dcatApCompliance: { dimension: "interoperability", reason: "dcatApCompliance=false" },
  formatAvailability: { dimension: "interoperability", reason: "formatAvailability=false" },
  mediaTypeAvailability: { dimension: "interoperability", reason: "mediaTypeAvailability=false" },
  formatMediaTypeVocabularyAlignment: { dimension: "interoperability", reason: "formatMediaTypeVocabularyAlignment=false" },
  formatMediaTypeMachineInterpretable: {
    dimension: "interoperability",
    reason: "formatMediaTypeMachineInterpretable=false"
  },
  accessRightsAvailability: { dimension: "reusability", reason: "accessRightsAvailability=false" },
  accessRightsVocabularyAlignment: {
    dimension: "reusability",
    reason: "accessRightsVocabularyAlignment=false"
  },
  licenceAvailability: { dimension: "reusability", reason: "licenceAvailability=false" },
  knownLicence: {
    dimension: "reusability",
    reason: "knownLicence=false (licence not aligned to controlled vocabulary)"
  },
  contactPointAvailability: { dimension: "reusability", reason: "contactPointAvailability=false" },
  publisherAvailability: { dimension: "reusability", reason: "publisherAvailability=false" },
  byteSizeAvailability: { dimension: "contextuality", reason: "byteSizeAvailability=false" },
  rightsAvailability: { dimension: "contextuality", reason: "rightsAvailability=false" },
  dateModifiedAvailability: { dimension: "contextuality", reason: "dateModifiedAvailability=false" },
  dateIssuedAvailability: { dimension: "contextuality", reason: "dateIssuedAvailability=false" }
};

function parseScoreValue(value: unknown): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = (value as Record<string, unknown>)["@value"];
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseMetricValue(value: unknown): MetricValue | undefined {
  if (!value || typeof value !== "object") {
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      return value;
    }
    return undefined;
  }

  const raw = (value as Record<string, unknown>)["@value"];
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const lower = raw.toLowerCase();
    if (lower === "true" || lower === "false") {
      return lower === "true";
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    return raw;
  }

  return undefined;
}

function metricKeyFromId(metricId: string): string {
  const hashIndex = metricId.lastIndexOf("#");
  if (hashIndex >= 0 && hashIndex < metricId.length - 1) {
    return metricId.slice(hashIndex + 1);
  }
  const slashIndex = metricId.lastIndexOf("/");
  if (slashIndex >= 0 && slashIndex < metricId.length - 1) {
    return metricId.slice(slashIndex + 1);
  }
  return metricId;
}

function decodeMetricsPayload(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "@graph" in payload) {
    return payload;
  }
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return undefined;
    }
  }
  if (payload instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(new Uint8Array(payload));
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
  if (ArrayBuffer.isView(payload)) {
    try {
      const view = payload as ArrayBufferView;
      const text = new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
  return payload;
}

function extractMetricsScores(metricsData: unknown): MqaScores {
  const scores: MqaScores = {};
  const parsed = decodeMetricsPayload(metricsData);
  if (!parsed || typeof parsed !== "object") {
    return scores;
  }

  const graph = (parsed as Record<string, unknown>)["@graph"];
  if (!Array.isArray(graph)) {
    return scores;
  }

  for (const node of graph) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const metricRef = (node as Record<string, unknown>)["dqv:isMeasurementOf"];
    if (!metricRef) {
      continue;
    }
    const metricId = typeof metricRef === "string"
      ? metricRef
      : (metricRef as Record<string, unknown>)["@id"];
    if (typeof metricId !== "string") {
      continue;
    }
    const value = parseScoreValue((node as Record<string, unknown>)["dqv:value"]);
    if (value === undefined) {
      continue;
    }

    if (metricId.endsWith("#accessibilityScoring")) {
      scores.accessibility = value;
    } else if (metricId.endsWith("#findabilityScoring")) {
      scores.findability = value;
    } else if (metricId.endsWith("#interoperabilityScoring")) {
      scores.interoperability = value;
    } else if (metricId.endsWith("#reusabilityScoring")) {
      scores.reusability = value;
    } else if (metricId.endsWith("#contextualityScoring")) {
      scores.contextuality = value;
    } else if (metricId.endsWith("#scoring")) {
      scores.total = value;
    }
  }

  return scores;
}

function extractMetricDetails(metricsData: unknown, nonMaxDimensions: MqaDimension[]): MqaMetricDetails {
  const parsed = decodeMetricsPayload(metricsData);
  if (!parsed || typeof parsed !== "object") {
    return { flags: [], reasons: {} };
  }

  const graph = (parsed as Record<string, unknown>)["@graph"];
  if (!Array.isArray(graph)) {
    return { flags: [], reasons: {} };
  }

  const flagsMap = new Map<string, {
    metricId: string;
    metricKey: string;
    dimension: MqaDimension;
    values: Set<MetricValue>;
  }>();

  for (const node of graph) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const metricRef = (node as Record<string, unknown>)["dqv:isMeasurementOf"];
    if (!metricRef) {
      continue;
    }
    const metricId = typeof metricRef === "string"
      ? metricRef
      : (metricRef as Record<string, unknown>)["@id"];
    if (typeof metricId !== "string") {
      continue;
    }

    const metricKey = metricKeyFromId(metricId);
    const definition = METRIC_DEFINITIONS[metricKey];
    if (!definition) {
      continue;
    }

    const value = parseMetricValue((node as Record<string, unknown>)["dqv:value"]);
    if (value === undefined) {
      continue;
    }

    const entry = flagsMap.get(metricKey);
    if (entry) {
      entry.values.add(value);
      continue;
    }
    flagsMap.set(metricKey, {
      metricId,
      metricKey,
      dimension: definition.dimension,
      values: new Set([value])
    });
  }

  const reasons: Partial<Record<MqaDimension, string[]>> = {};
  const reasonSets = new Map<MqaDimension, Set<string>>();
  for (const dimension of nonMaxDimensions) {
    reasonSets.set(dimension, new Set());
  }

  for (const entry of flagsMap.values()) {
    const definition = METRIC_DEFINITIONS[entry.metricKey];
    if (!definition) {
      continue;
    }
    const reasonSet = reasonSets.get(entry.dimension);
    if (!reasonSet) {
      continue;
    }

    for (const value of entry.values) {
      if (typeof value === "boolean" && value === false) {
        reasonSet.add(definition.reason || `${entry.metricKey}=false`);
        continue;
      }
      if (definition.expectsStatusCode && typeof value === "number" && value !== 200) {
        reasonSet.add(`${entry.metricKey}=${value}`);
      }
    }
  }

  for (const [dimension, set] of reasonSets.entries()) {
    if (set.size > 0) {
      reasons[dimension] = Array.from(set.values());
    }
  }

  const flags: MqaMetricFlag[] = Array.from(flagsMap.values()).map((entry) => ({
    metricId: entry.metricId,
    metricKey: entry.metricKey,
    dimension: entry.dimension,
    values: Array.from(entry.values)
  }));

  return { flags, reasons };
}

function findNonMaxDimensions(scores: MqaScores): MqaDimension[] {
  const nonMax: MqaDimension[] = [];
  (Object.keys(DIMENSION_MAX) as MqaDimension[]).forEach((dimension) => {
    const value = scores[dimension];
    if (typeof value === "number" && value < DIMENSION_MAX[dimension]) {
      nonMax.push(dimension);
    }
  });
  return nonMax;
}

/*
 * MQA methodology v2 (https://data.europa.eu/mqa/methodology): every metric is
 * binary and weighted 1 / 0.5 / 0.25; dataset, distribution and data service each
 * score 0-7.5, and the final dataset score averages the groups that are present.
 */
const V2_MAX_SCORE = 7.5;
const V1_MAX_SCORE = 405;
const V2_DIMENSIONS = ["findability", "accessibility", "interoperability", "reusability"] as const;

type MqaBand = "Sufficient" | "Good" | "Excellent";
type MqaEntity = "dataset" | "distribution" | "dataService";

type MqaV2Metric = {
  metric: string;
  property: string;
  importance: string;
  weight: number;
  dimension: string;
  /** 1 fulfilled, 0 not fulfilled, null not evaluated (e.g. no URL to test): scored as 0 */
  result: number | null;
};

type MqaV2Entity = {
  score: number;
  metrics?: MqaV2Metric[];
};

type MqaFailingMetric = {
  metric: string;
  property: string;
  dimension: string;
  importance: string;
  weight: number;
  entity: MqaEntity;
  failed: number;
  total: number;
  /** Exact increase of the final score if every failing entity passed this metric */
  gain: number;
};

type MqaGroupScore = { count: number; average: number };

type MqaLinks = {
  portalId: string;
  portalUrl: string;
  mqaUrl: string;
};

export type MqaV2Result = MqaLinks & {
  methodology: "v2";
  metricsVersion: string;
  score: number;
  maxScore: number;
  band: MqaBand;
  dataset: { score: number; maxScore: number };
  distributions: MqaGroupScore | null;
  dataServices: MqaGroupScore | null;
  failing: MqaFailingMetric[];
};

/** Shares `methodology`, `metricsVersion`, `score`, `maxScore` with v2; v1 has no bands or per-metric weights */
export type MqaV1Result = MqaLinks & {
  methodology: "v1";
  metricsVersion: string;
  note: string;
  score: number | null;
  maxScore: number;
  breakdown: MqaBreakdown;
  details: MqaMetricDetails;
};

export type MqaResult = MqaV2Result | MqaV1Result;

const V1_NOTE = "Not yet re-evaluated with MQA methodology v2: scores come from the previous MQA methodology (405-point scale, five dimensions).";

const PROPERTY_PREFIXES: Array<[string, string]> = [
  ["http://purl.org/dc/terms/", "dct:"],
  ["http://www.w3.org/ns/dcat#", "dcat:"],
  ["http://www.w3.org/ns/adms#", "adms:"],
  ["http://xmlns.com/foaf/0.1/", "foaf:"],
  ["http://data.europa.eu/r5r/", "dcatap:"]
];

function shortProperty(uri: string): string {
  for (const [namespace, prefix] of PROPERTY_PREFIXES) {
    if (uri.startsWith(namespace)) {
      return prefix + uri.slice(namespace.length);
    }
  }
  return uri;
}

export function mqaBand(score: number): MqaBand {
  if (score >= 5) return "Excellent";
  if (score >= 2.5) return "Good";
  return "Sufficient";
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function groupScore(entities: MqaV2Entity[]): MqaGroupScore | null {
  if (entities.length === 0) {
    return null;
  }
  const average = entities.reduce((sum, entity) => sum + entity.score, 0) / entities.length;
  return { count: entities.length, average: round(average) };
}

function parseMqaV2(entry: Record<string, unknown>, links: MqaLinks): MqaV2Result {
  const dataset = entry.dataset as MqaV2Entity | undefined;
  if (!dataset || typeof dataset.score !== "number") {
    throw new Error("Unexpected MQA payload: missing dataset score");
  }

  const groups: Array<[MqaEntity, MqaV2Entity[]]> = [
    ["dataset", [dataset]],
    ["distribution", Array.isArray(entry.distributions) ? entry.distributions as MqaV2Entity[] : []],
    ["dataService", Array.isArray(entry.dataServices) ? entry.dataServices as MqaV2Entity[] : []]
  ];
  const groupsPresent = groups.filter(([, entities]) => entities.length > 0).length;

  // A metadata-only dataset is scored on the dataset alone
  const score = typeof entry.datasetFinal === "number" ? entry.datasetFinal : groupsPresent === 1 ? dataset.score : undefined;
  if (score === undefined) {
    throw new Error("Unexpected MQA payload: missing final dataset score");
  }

  const failing: MqaFailingMetric[] = [];
  for (const [entity, entities] of groups) {
    const byMetric = new Map<string, { metric: MqaV2Metric; failed: number }>();
    for (const item of entities) {
      for (const metric of item.metrics ?? []) {
        if (metric.result === 1) continue;
        const current = byMetric.get(metric.metric);
        if (current) {
          current.failed += 1;
        } else {
          byMetric.set(metric.metric, { metric, failed: 1 });
        }
      }
    }
    for (const { metric, failed } of byMetric.values()) {
      failing.push({
        metric: metric.metric,
        property: shortProperty(metric.property),
        dimension: metric.dimension,
        importance: metric.importance,
        weight: metric.weight,
        entity,
        failed,
        total: entities.length,
        // The group average spans all its entities, and the final score averages the groups
        gain: round(metric.weight * failed / entities.length / groupsPresent, 4)
      });
    }
  }
  failing.sort((a, b) => b.gain - a.gain || a.metric.localeCompare(b.metric));

  return {
    methodology: "v2",
    metricsVersion: typeof entry.metricsVersion === "string" ? entry.metricsVersion : "2",
    score: round(score, 4),
    maxScore: V2_MAX_SCORE,
    band: mqaBand(score),
    dataset: { score: dataset.score, maxScore: V2_MAX_SCORE },
    distributions: groupScore(groups[1][1]),
    dataServices: groupScore(groups[2][1]),
    failing,
    ...links
  };
}

const MQA_TIMEOUT_MS = 30000;

// fetch, not axios: axios's fetch adapter breaks on Workers ("'cache' field ... not implemented")
function fetchMqa(url: string): Promise<Response> {
  return safeFetch(url, {
    headers: { 'User-Agent': 'CKAN-MCP-Server/1.0' },
    signal: AbortSignal.timeout(MQA_TIMEOUT_MS)
  }, { httpsOnly: true });
}

async function fetchMetricsGraph(metricsUrl: string): Promise<unknown> {
  try {
    const response = await fetchMqa(metricsUrl);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  } catch (error) {
    throw new Error(`MQA metrics error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchMqaV1(europeanId: string, links: MqaLinks): Promise<MqaV1Result> {
  const metricsUrl = `${MQA_METRICS_BASE}/${europeanId}/metrics`;
  const notReEvaluated = `Dataset ${europeanId} is on data.europa.eu but not yet re-evaluated with MQA methodology v2, ` +
    `and previous-methodology metrics are not available`;

  let metrics: unknown;
  try {
    metrics = await fetchMetricsGraph(metricsUrl);
  } catch (error) {
    throw new Error(`${notReEvaluated} (${error instanceof Error ? error.message : String(error)}).`);
  }
  const scores = extractMetricsScores(metrics);

  // During the rollout the metrics endpoint may already hold v2 numbers: never print them on the 405 scale
  const looksV1 = scores.contextuality !== undefined || (scores.total ?? 0) > V2_MAX_SCORE;
  if (!looksV1) {
    throw new Error(`${notReEvaluated}. Try again after the next harvest.`);
  }

  const nonMaxDimensions = findNonMaxDimensions(scores);
  return {
    methodology: "v1",
    metricsVersion: "1",
    note: V1_NOTE,
    score: scores.total ?? null,
    maxScore: V1_MAX_SCORE,
    breakdown: {
      scores,
      nonMaxDimensions,
      metricsUrl,
      mqaUrl: links.mqaUrl,
      portalId: europeanId
    },
    details: extractMetricDetails(metrics, nonMaxDimensions),
    ...links
  };
}

export async function getMqaQuality(serverUrl: string, datasetId: string): Promise<MqaResult> {
  // Step 1: Get dataset metadata from CKAN to extract identifier
  interface PackageShowResult {
    identifier?: string;
    name: string;
  }

  const dataset = await makeCkanRequest<PackageShowResult>(
    serverUrl,
    "package_show",
    { id: datasetId }
  );

  // Step 2: Use identifier field, fallback to name
  const baseIdentifier = dataset.identifier || dataset.name;
  const candidates = buildMqaIdCandidates(baseIdentifier);

  if (candidates.length === 0) {
    throw new Error("Dataset identifier is empty; cannot query MQA API");
  }

  // Step 3: Query the MQA cache (try candidates)
  for (const europeanId of candidates) {
    const links: MqaLinks = {
      portalId: europeanId,
      portalUrl: `https://data.europa.eu/data/datasets/${europeanId}/quality?locale=it`,
      mqaUrl: `${MQA_API_BASE}/${europeanId}`
    };

    let response: Response;
    try {
      response = await fetchMqa(links.mqaUrl);
    } catch (error) {
      throw new Error(`MQA API error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (response.status === 404) {
      // "No v2 metrics found": the dataset exists but has not been re-evaluated with v2 yet.
      // Anything else ("DQV of dataset not found") means this candidate id is not on data.europa.eu.
      if (/no v2 metrics/i.test(await response.text())) {
        return fetchMqaV1(europeanId, links);
      }
      continue;
    }
    if (!response.ok) {
      throw new Error(`MQA API error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as { result?: { results?: unknown[] } };
    const entry = payload?.result?.results?.[0];
    if (!entry || typeof entry !== "object") {
      throw new Error("Unexpected MQA payload: no result");
    }
    return parseMqaV2(entry as Record<string, unknown>, links);
  }

  throw new Error(
    `No MQA record on data.europa.eu for this dataset (identifier may not be aligned). ` +
    `Tried: ${candidates.join(", ")}. ` +
    `Check the dataset quality page on data.europa.eu to confirm the identifier (it may include a '~~1' suffix) ` +
    `or verify alignment on dati.gov.it (quality may be marked as 'Non disponibile o identificativo non allineato').`
  );
}

function formatNumber(value: number): string {
  return String(round(value, 2));
}

function describeFailing(item: MqaFailingMetric): string {
  const scope = item.entity === "dataset"
    ? "dataset"
    : `${item.failed} of ${item.total} ${item.entity === "distribution" ? "distributions" : "data services"}`;
  return `\`${item.property}\` (${item.metric}, ${item.importance.toLowerCase()} ${item.weight}) - ${scope}, +${formatNumber(item.gain)}`;
}

function pushV2Scores(lines: string[], result: MqaV2Result): void {
  lines.push(`**Score**: ${formatNumber(result.score)}/${result.maxScore} (${result.band})`);
  lines.push(`Methodology: MQA v2 (metrics ${result.metricsVersion}). Bands: Sufficient < 2.5 ≤ Good < 5 ≤ Excellent.`);
  lines.push("");
  lines.push("## Scores");
  lines.push(`- Dataset: ${formatNumber(result.dataset.score)}/${result.dataset.maxScore}`);
  if (result.distributions) {
    lines.push(`- Distributions (${result.distributions.count}): average ${formatNumber(result.distributions.average)}/${result.maxScore}`);
  }
  if (result.dataServices) {
    lines.push(`- Data services (${result.dataServices.count}): average ${formatNumber(result.dataServices.average)}/${result.maxScore}`);
  }
  lines.push("");
}

function pushV1Scores(lines: string[], result: MqaV1Result): void {
  lines.push(`> ${result.note}`);
  lines.push("");
  const scores = result.breakdown.scores;
  if (typeof scores.total === "number") {
    lines.push(`**Score**: ${scores.total}/${result.maxScore}`);
    lines.push("");
  }
  lines.push("## Dimension Scores");
  for (const dimension of Object.keys(DIMENSION_MAX) as MqaDimension[]) {
    const value = scores[dimension];
    if (typeof value !== "number") continue;
    const max = DIMENSION_MAX[dimension];
    const isMax = value >= max;
    lines.push(`- ${DIMENSION_LABELS[dimension]}: ${value}/${max} ${isMax ? "✅" : "⚠️"}`);
  }
  lines.push("");
}

function pushLinks(lines: string[], result: MqaResult): void {
  lines.push("---");
  lines.push(`Portal: ${result.portalUrl}`);
  lines.push(`MQA source: ${result.mqaUrl}`);
  if (result.methodology === "v1") {
    lines.push(`Metrics endpoint: ${result.breakdown.metricsUrl}`);
  }
}

const TOP_FIXES = 5;

/**
 * Format MQA quality data as markdown (summary)
 */
export function formatQualityMarkdown(result: MqaResult, datasetId: string): string {
  const lines: string[] = [`# Quality Metrics for Dataset: ${datasetId}`, ""];

  if (result.methodology === "v1") {
    pushV1Scores(lines, result);
    if (result.breakdown.nonMaxDimensions.length > 0) {
      lines.push(`Non-max dimension(s): ${result.breakdown.nonMaxDimensions.join(", ")}. Use ckan_get_mqa_quality_details for the reasons.`);
      lines.push("");
    }
  } else {
    pushV2Scores(lines, result);
    if (result.failing.length === 0) {
      lines.push("All evaluated metrics are fulfilled.");
    } else {
      lines.push(`## Top fixes (${Math.min(TOP_FIXES, result.failing.length)} of ${result.failing.length} failing metrics, by gain on the final score)`);
      for (const item of result.failing.slice(0, TOP_FIXES)) {
        lines.push(`- ${describeFailing(item)}`);
      }
      if (result.failing.length > TOP_FIXES) {
        lines.push("- Use ckan_get_mqa_quality_details for the full list.");
      }
    }
    lines.push("");
  }

  pushLinks(lines, result);
  return lines.join("\n");
}

/**
 * Format MQA quality data as markdown (every failing metric)
 */
export function formatQualityDetailsMarkdown(result: MqaResult, datasetId: string): string {
  const lines: string[] = [`# Quality Details for Dataset: ${datasetId}`, ""];

  if (result.methodology === "v1") {
    pushV1Scores(lines, result);
    lines.push("## Non-max Reasons");
    if (result.breakdown.nonMaxDimensions.length === 0) {
      lines.push("- All dimensions are at max score.");
    }
    for (const dimension of result.breakdown.nonMaxDimensions) {
      const reasons = result.details.reasons[dimension] || [];
      lines.push(`- ${DIMENSION_LABELS[dimension]}: ${reasons.length > 0 ? reasons.join("; ") : "no failing flags detected in metrics payload"}`);
    }
    lines.push("");
  } else {
    pushV2Scores(lines, result);
    if (result.failing.length === 0) {
      lines.push("All evaluated metrics are fulfilled.");
      lines.push("");
    }
    for (const dimension of V2_DIMENSIONS) {
      const items = result.failing.filter(item => item.dimension === dimension);
      if (items.length === 0) continue;
      lines.push(`## ${DIMENSION_LABELS[dimension]}`);
      for (const item of items) {
        lines.push(`- ${describeFailing(item)}`);
      }
      lines.push("");
    }
    lines.push("Gain = increase of the final score if every listed entity fulfilled the metric.");
    lines.push("");
  }

  pushLinks(lines, result);
  return lines.join("\n");
}

/**
 * Register MQA quality tools
 */
export function registerQualityTools(server: McpServer): void {
  server.registerTool(
    "ckan_get_mqa_quality",
    {
      title: "Get MQA Quality Score",
      description: "Get MQA (Metadata Quality Assessment) quality score for a dataset on dati.gov.it from data.europa.eu. " +
        "Returns the final score on the 0-7.5 scale of MQA methodology v2 with its band (Sufficient/Good/Excellent), " +
        "dataset, distribution and data service scores, and the failing metrics with the largest gain. " +
        "Datasets not yet re-evaluated fall back to the previous methodology (405 scale), labelled as such. " +
        "Only works with dati.gov.it server. " +
        "Typical workflow: ckan_package_show (get dataset ID) → ckan_get_mqa_quality → ckan_get_mqa_quality_details (full list of failing metrics)",
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of dati.gov.it (e.g., https://www.dati.gov.it/opendata)"),
        dataset_id: z.string().describe("Dataset ID or name"),
        response_format: ResponseFormatSchema.optional()
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ server_url, dataset_id, response_format }) => {
      // Validate server URL
      if (!isValidMqaServer(server_url)) {
        return {
          content: [{
            type: "text" as const,
            text: formatError(
              `Error: MQA quality metrics are only available for dati.gov.it datasets. ` +
              `Provided server: ${server_url}\n\n` +
              `The MQA (Metadata Quality Assurance) system is operated by data.europa.eu ` +
              `and only evaluates datasets from Italian open data portal.`,
              response_format === ResponseFormat.JSON
            )
          }],
          isError: true
        };
      }

      try {
        const qualityData = await getMqaQuality(server_url, dataset_id);

        // The demo footer is Markdown: appending it to JSON would break parsing (Workers only)
        const format = response_format || ResponseFormat.MARKDOWN;
        const output = format === ResponseFormat.JSON
          ? truncateJson(qualityData)
          : truncateText(addDemoFooter(formatQualityMarkdown(qualityData, dataset_id)));

        return {
          content: [{
            type: "text" as const,
            text: output
          }]
        };
      } catch (error) {
        const message = `Error retrieving quality metrics: ${formatCkanError(error, "ckan_get_mqa_quality")}`;
        return {
          content: [{ type: "text" as const, text: formatError(message, response_format === ResponseFormat.JSON) }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "ckan_get_mqa_quality_details",
    {
      title: "Get MQA Quality Details",
      description: "Get detailed MQA (Metadata Quality Assessment) quality reasons for a dataset on dati.gov.it. " +
        "Lists every failing metric grouped by FAIR dimension, with DCAT-AP property, weight, how many distributions fail it " +
        "and its gain on the final score (methodology v2); previous-methodology datasets get non-max reasons. " +
        "Only works with dati.gov.it server. " +
        "Typical workflow: ckan_get_mqa_quality (get overview scores) → ckan_get_mqa_quality_details (inspect failing metrics)",
      inputSchema: z.object({
        server_url: z.string().url().describe("Base URL of dati.gov.it (e.g., https://www.dati.gov.it/opendata)"),
        dataset_id: z.string().describe("Dataset ID or name"),
        response_format: ResponseFormatSchema.optional()
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ server_url, dataset_id, response_format }) => {
      if (!isValidMqaServer(server_url)) {
        return {
          content: [{
            type: "text" as const,
            text: formatError(
              `Error: MQA quality details are only available for dati.gov.it datasets. ` +
              `Provided server: ${server_url}\n\n` +
              `The MQA (Metadata Quality Assurance) system is operated by data.europa.eu ` +
              `and only evaluates datasets from Italian open data portal.`,
              response_format === ResponseFormat.JSON
            )
          }],
          isError: true
        };
      }

      try {
        const details = await getMqaQuality(server_url, dataset_id);
        // The demo footer is Markdown: appending it to JSON would break parsing (Workers only)
        const format = response_format || ResponseFormat.MARKDOWN;
        const output = format === ResponseFormat.JSON
          ? truncateJson(details)
          : truncateText(addDemoFooter(formatQualityDetailsMarkdown(details, dataset_id)));

        return {
          content: [{
            type: "text" as const,
            text: output
          }]
        };
      } catch (error) {
        const message = `Error retrieving quality details: ${formatCkanError(error, "ckan_get_mqa_quality_details")}`;
        return {
          content: [{ type: "text" as const, text: formatError(message, response_format === ResponseFormat.JSON) }],
          isError: true
        };
      }
    }
  );
}
