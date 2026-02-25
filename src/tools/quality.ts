/**
 * CKAN Quality (MQA) tools for dati.gov.it
 */

import { z } from "zod";
import axios from "axios";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import { addDemoFooter } from "../utils/formatting.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MQA_API_BASE = "https://data.europa.eu/api/mqa/cache/datasets";
const MQA_METRICS_BASE = "https://data.europa.eu/api/hub/repo/datasets";
const ALLOWED_SERVER_PATTERNS = [
  /^https?:\/\/(www\.)?dati\.gov\.it/i
];

/**
 * Validate server URL is dati.gov.it
 */
export function isValidMqaServer(serverUrl: string): boolean {
  return ALLOWED_SERVER_PATTERNS.some(pattern => pattern.test(serverUrl));
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

/**
 * Get MQA quality metrics from data.europa.eu
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

type MqaQualityResult = {
  mqa: unknown;
  breakdown: MqaBreakdown;
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

type MqaQualityDetailsResult = {
  breakdown: MqaBreakdown;
  details: MqaMetricDetails;
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

type MqaFetchResult = {
  mqa: unknown;
  metrics: unknown;
  breakdown: MqaBreakdown;
};

async function fetchMqaQuality(serverUrl: string, datasetId: string): Promise<MqaFetchResult> {
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

  // Step 3: Query MQA API (try candidates)
  for (const europeanId of candidates) {
    const mqaUrl = `${MQA_API_BASE}/${europeanId}`;
    const metricsUrl = `${MQA_METRICS_BASE}/${europeanId}/metrics`;

    try {
      const response = await axios.get(mqaUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'CKAN-MCP-Server/1.0'
        }
      });

      let metricsPayload: unknown;
      try {
        const metricsResponse = await fetch(metricsUrl, {
          headers: {
            'User-Agent': 'CKAN-MCP-Server/1.0'
          }
        });
        if (!metricsResponse.ok) {
          throw new Error(`MQA metrics error: ${metricsResponse.status} ${metricsResponse.statusText}`);
        }
        try {
          metricsPayload = await metricsResponse.json();
        } catch {
          metricsPayload = await metricsResponse.text();
        }
      } catch (metricsError) {
        if (metricsError instanceof Error) {
          throw new Error(`MQA metrics error: ${metricsError.message}`);
        }
        throw metricsError;
      }

      const scores = extractMetricsScores(metricsPayload);
      const resultEntry = (response.data as any)?.result?.results?.[0];
      const portalId = resultEntry?.info?.["dataset-id"] || europeanId;
      const breakdown: MqaBreakdown = {
        scores,
        nonMaxDimensions: findNonMaxDimensions(scores),
        metricsUrl,
        mqaUrl,
        portalId
      };

      return {
        mqa: response.data,
        metrics: metricsPayload,
        breakdown
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          continue;
        }
        throw new Error(`MQA API error: ${error.message}`);
      }
      throw error;
    }
  }

  throw new Error(
    `Quality metrics not found or identifier not aligned on data.europa.eu. ` +
    `Tried: ${candidates.join(", ")}. ` +
    `Check the dataset quality page on data.europa.eu to confirm the identifier (it may include a '~~1' suffix) ` +
    `or verify alignment on dati.gov.it (quality may be marked as 'Non disponibile o identificativo non allineato').`
  );
}

export async function getMqaQuality(serverUrl: string, datasetId: string): Promise<MqaQualityResult> {
  const result = await fetchMqaQuality(serverUrl, datasetId);
  return {
    mqa: result.mqa,
    breakdown: result.breakdown
  };
}

export async function getMqaQualityDetails(serverUrl: string, datasetId: string): Promise<MqaQualityDetailsResult> {
  const result = await fetchMqaQuality(serverUrl, datasetId);
  const details = extractMetricDetails(result.metrics, result.breakdown.nonMaxDimensions);
  return {
    breakdown: result.breakdown,
    details
  };
}

/**
 * Format MQA quality data as markdown
 */
type Availability = {
  available: boolean;
};

type NormalizedQualityData = {
  id?: string;
  info?: {
    score?: number;
  };
  accessibility?: {
    accessUrl?: Availability;
    downloadUrl?: Availability;
  };
  reusability?: {
    licence?: Availability;
    contactPoint?: Availability;
    publisher?: Availability;
  };
  interoperability?: {
    format?: Availability;
    mediaType?: Availability;
  };
  findability?: {
    keyword?: Availability;
    category?: Availability;
    spatial?: Availability;
    temporal?: Availability;
  };
  contextuality?: {
    byteSize?: Availability;
    rights?: Availability;
  };
  breakdown?: MqaBreakdown;
};

function findSectionMetric(section: unknown, key: string): unknown {
  if (!Array.isArray(section)) {
    return undefined;
  }

  for (const item of section) {
    if (item && typeof item === "object" && key in item) {
      return (item as Record<string, unknown>)[key];
    }
  }

  return undefined;
}

function metricArrayIsAvailable(metric: unknown): boolean | undefined {
  if (!Array.isArray(metric)) {
    return undefined;
  }

  const byName = new Map<string, number>();
  for (const entry of metric) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const name = (entry as Record<string, unknown>).name;
    const percentage = (entry as Record<string, unknown>).percentage;
    if (typeof name === "string" && typeof percentage === "number") {
      byName.set(name.toLowerCase(), percentage);
    }
  }

  if (byName.has("yes")) {
    return (byName.get("yes") || 0) > 0;
  }

  if (byName.size > 0) {
    for (const [name, percentage] of byName.entries()) {
      if (name.startsWith("2") && percentage > 0) {
        return true;
      }
    }
    return false;
  }

  return undefined;
}

function metricBoolean(section: unknown, key: string): boolean | undefined {
  const metric = findSectionMetric(section, key);
  if (typeof metric === "boolean") {
    return metric;
  }
  return undefined;
}

function metricAvailability(section: unknown, availabilityKey: string, statusKey?: string): Availability | undefined {
  const availabilityMetric = findSectionMetric(section, availabilityKey);
  const availability = metricArrayIsAvailable(availabilityMetric);
  if (availability !== undefined) {
    return { available: availability };
  }

  if (statusKey) {
    const statusMetric = findSectionMetric(section, statusKey);
    const statusAvailable = metricArrayIsAvailable(statusMetric);
    if (statusAvailable !== undefined) {
      return { available: statusAvailable };
    }
  }

  return undefined;
}

function normalizeQualityData(data: any): NormalizedQualityData {
  const mqaData = data?.mqa ?? data;
  const breakdown: MqaBreakdown | undefined = data?.breakdown;
  const resultEntry = mqaData?.result?.results?.[0];
  if (!resultEntry || typeof resultEntry !== "object") {
    return { ...data, breakdown };
  }

  return {
    id: resultEntry.info?.["dataset-id"],
    info: { score: resultEntry.info?.score },
    accessibility: {
      accessUrl: metricAvailability(resultEntry.accessibility, "accessUrlAvailability", "accessUrlStatusCode"),
      downloadUrl: metricAvailability(resultEntry.accessibility, "downloadUrlAvailability", "downloadUrlStatusCode")
    },
    reusability: {
      licence: metricAvailability(resultEntry.reusability, "licenceAvailability"),
      contactPoint: metricBoolean(resultEntry.reusability, "contactPointAvailability") !== undefined
        ? { available: metricBoolean(resultEntry.reusability, "contactPointAvailability") as boolean }
        : undefined,
      publisher: metricBoolean(resultEntry.reusability, "publisherAvailability") !== undefined
        ? { available: metricBoolean(resultEntry.reusability, "publisherAvailability") as boolean }
        : undefined
    },
    interoperability: {
      format: metricAvailability(resultEntry.interoperability, "formatAvailability"),
      mediaType: metricAvailability(resultEntry.interoperability, "mediaTypeAvailability")
    },
    findability: {
      keyword: metricBoolean(resultEntry.findability, "keywordAvailability") !== undefined
        ? { available: metricBoolean(resultEntry.findability, "keywordAvailability") as boolean }
        : undefined,
      category: metricBoolean(resultEntry.findability, "categoryAvailability") !== undefined
        ? { available: metricBoolean(resultEntry.findability, "categoryAvailability") as boolean }
        : undefined,
      spatial: metricBoolean(resultEntry.findability, "spatialAvailability") !== undefined
        ? { available: metricBoolean(resultEntry.findability, "spatialAvailability") as boolean }
        : undefined,
      temporal: metricBoolean(resultEntry.findability, "temporalAvailability") !== undefined
        ? { available: metricBoolean(resultEntry.findability, "temporalAvailability") as boolean }
        : undefined
    },
    contextuality: {
      byteSize: metricAvailability(resultEntry.contextuality, "byteSizeAvailability"),
      rights: metricAvailability(resultEntry.contextuality, "rightsAvailability")
    },
    breakdown
  };
}

export function formatQualityMarkdown(data: any, datasetId: string): string {
  const normalized = normalizeQualityData(data);
  const lines: string[] = [];

  lines.push(`# Quality Metrics for Dataset: ${datasetId}`);
  lines.push("");

  if (normalized.info?.score !== undefined) {
    lines.push(`**Overall Score**: ${normalized.info.score}/405`);
    lines.push("");
  }

  if (normalized.breakdown?.scores) {
    lines.push("## Dimension Scores");
    const scores = normalized.breakdown.scores;
    const order: Array<[MqaDimension, string, number]> = [
      ["accessibility", "Accessibility", DIMENSION_MAX.accessibility],
      ["findability", "Findability", DIMENSION_MAX.findability],
      ["interoperability", "Interoperability", DIMENSION_MAX.interoperability],
      ["reusability", "Reusability", DIMENSION_MAX.reusability],
      ["contextuality", "Contextuality", DIMENSION_MAX.contextuality]
    ];
    for (const [key, label, max] of order) {
      const value = scores[key];
      if (typeof value === "number") {
        const isMax = value >= max;
        const status = isMax ? "✅" : "⚠️";
        lines.push(`- ${label}: ${value}/${max} ${status}${isMax ? "" : ` (max ${max})`}`);
      }
    }
    if (normalized.breakdown.nonMaxDimensions.length > 0) {
      lines.push(`- Non-max dimension(s): ${normalized.breakdown.nonMaxDimensions.join(", ")}`);
    } else if (Object.keys(scores).length > 0) {
      lines.push("- Non-max dimension(s): none");
    }
    lines.push("");
  }

  // Accessibility
  if (normalized.accessibility) {
    lines.push("## Accessibility");
    if (normalized.accessibility.accessUrl !== undefined) {
      lines.push(`- Access URL: ${normalized.accessibility.accessUrl.available ? '✓' : '✗'} Available`);
    }
    if (normalized.accessibility.downloadUrl !== undefined) {
      lines.push(`- Download URL: ${normalized.accessibility.downloadUrl.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  // Reusability
  if (normalized.reusability) {
    lines.push("## Reusability");
    if (normalized.reusability.licence !== undefined) {
      lines.push(`- License: ${normalized.reusability.licence.available ? '✓' : '✗'} Available`);
    }
    if (normalized.reusability.contactPoint !== undefined) {
      lines.push(`- Contact Point: ${normalized.reusability.contactPoint.available ? '✓' : '✗'} Available`);
    }
    if (normalized.reusability.publisher !== undefined) {
      lines.push(`- Publisher: ${normalized.reusability.publisher.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  // Interoperability
  if (normalized.interoperability) {
    lines.push("## Interoperability");
    if (normalized.interoperability.format !== undefined) {
      lines.push(`- Format: ${normalized.interoperability.format.available ? '✓' : '✗'} Available`);
    }
    if (normalized.interoperability.mediaType !== undefined) {
      lines.push(`- Media Type: ${normalized.interoperability.mediaType.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  // Findability
  if (normalized.findability) {
    lines.push("## Findability");
    if (normalized.findability.keyword !== undefined) {
      lines.push(`- Keywords: ${normalized.findability.keyword.available ? '✓' : '✗'} Available`);
    }
    if (normalized.findability.category !== undefined) {
      lines.push(`- Category: ${normalized.findability.category.available ? '✓' : '✗'} Available`);
    }
    if (normalized.findability.spatial !== undefined) {
      lines.push(`- Spatial: ${normalized.findability.spatial.available ? '✓' : '✗'} Available`);
    }
    if (normalized.findability.temporal !== undefined) {
      lines.push(`- Temporal: ${normalized.findability.temporal.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  if (normalized.contextuality) {
    lines.push("## Contextuality");
    if (normalized.contextuality.byteSize !== undefined) {
      lines.push(`- Byte Size: ${normalized.contextuality.byteSize.available ? '✓' : '✗'} Available`);
    }
    if (normalized.contextuality.rights !== undefined) {
      lines.push(`- Rights: ${normalized.contextuality.rights.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  lines.push("---");
  const portalId = normalized.breakdown?.portalId || normalized.id || datasetId;
  lines.push(`Portal: https://data.europa.eu/data/datasets/${portalId}/quality?locale=it`);
  lines.push(`MQA source: ${MQA_API_BASE}/${portalId}`);
  const metricsEndpoint = normalized.breakdown?.metricsUrl || `${MQA_METRICS_BASE}/${portalId}/metrics`;
  lines.push(`Metrics endpoint: ${metricsEndpoint}`);
  lines.push(`Tip: Use the metrics endpoint to explain score deductions (e.g., failing measurements such as knownLicence = false).`);

  return lines.join("\n");
}

export function formatQualityDetailsMarkdown(data: MqaQualityDetailsResult, datasetId: string): string {
  const lines: string[] = [];
  const breakdown = data.breakdown;

  lines.push(`# Quality Details for Dataset: ${datasetId}`);
  lines.push("");

  if (typeof breakdown.scores.total === "number") {
    lines.push(`**Overall Score**: ${breakdown.scores.total}/405`);
    lines.push("");
  }

  if (breakdown.scores) {
    lines.push("## Dimension Scores");
    const order: Array<[MqaDimension, number]> = [
      ["accessibility", DIMENSION_MAX.accessibility],
      ["findability", DIMENSION_MAX.findability],
      ["interoperability", DIMENSION_MAX.interoperability],
      ["reusability", DIMENSION_MAX.reusability],
      ["contextuality", DIMENSION_MAX.contextuality]
    ];
    for (const [key, max] of order) {
      const value = breakdown.scores[key];
      if (typeof value === "number") {
        const status = value >= max ? "✅" : "⚠️";
        lines.push(`- ${DIMENSION_LABELS[key]}: ${value}/${max} ${status}${value >= max ? "" : ` (max ${max})`}`);
      }
    }
    lines.push("");
  }

  lines.push("## Non-max Reasons");
  if (breakdown.nonMaxDimensions.length === 0) {
    lines.push("- All dimensions are at max score.");
  } else {
    for (const dimension of breakdown.nonMaxDimensions) {
      const reasons = data.details.reasons[dimension] || [];
      if (reasons.length === 0) {
        lines.push(`- ${DIMENSION_LABELS[dimension]}: no failing flags detected in metrics payload`);
      } else {
        lines.push(`- ${DIMENSION_LABELS[dimension]}: ${reasons.join("; ")}`);
      }
    }
  }
  lines.push("");

  lines.push("---");
  const portalId = breakdown.portalId || datasetId;
  lines.push(`Portal: https://data.europa.eu/data/datasets/${portalId}/quality?locale=it`);
  lines.push(`MQA source: ${MQA_API_BASE}/${portalId}`);
  lines.push(`Metrics endpoint: ${breakdown.metricsUrl || `${MQA_METRICS_BASE}/${portalId}/metrics`}`);

  return lines.join("\n");
}

/**
 * Register MQA quality tools
 */
export function registerQualityTools(server: McpServer): void {
  server.tool(
    "ckan_get_mqa_quality",
    "Get MQA (Metadata Quality Assurance) quality metrics for a dataset on dati.gov.it. " +
    "Returns quality score and detailed metrics (accessibility, reusability, interoperability, findability, contextuality) " +
    "from data.europa.eu. Only works with dati.gov.it server. " +
    "Typical workflow: ckan_package_show (get dataset ID) → ckan_get_mqa_quality → ckan_get_mqa_quality_details (for non-max dimensions)",
    {
      server_url: z.string().url().describe("Base URL of dati.gov.it (e.g., https://www.dati.gov.it/opendata)"),
      dataset_id: z.string().describe("Dataset ID or name"),
      response_format: ResponseFormatSchema.optional()
    },
    async ({ server_url, dataset_id, response_format }) => {
      // Validate server URL
      if (!isValidMqaServer(server_url)) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: MQA quality metrics are only available for dati.gov.it datasets. ` +
                  `Provided server: ${server_url}\n\n` +
                  `The MQA (Metadata Quality Assurance) system is operated by data.europa.eu ` +
                  `and only evaluates datasets from Italian open data portal.`
          }]
        };
      }

      try {
        const qualityData = await getMqaQuality(server_url, dataset_id);

        const format = response_format || ResponseFormat.MARKDOWN;
        const output = format === ResponseFormat.JSON
          ? JSON.stringify(qualityData, null, 2)
          : formatQualityMarkdown(qualityData, dataset_id);

        return {
          content: [{
            type: "text" as const,
            text: addDemoFooter(output)
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving quality metrics: ${errorMessage}`
          }]
        };
      }
    }
  );

  server.tool(
    "ckan_get_mqa_quality_details",
    "Get detailed MQA (Metadata Quality Assurance) quality reasons for a dataset on dati.gov.it. " +
    "Returns dimension scores, non-max reasons, and raw MQA flags from data.europa.eu. " +
    "Only works with dati.gov.it server. " +
    "Typical workflow: ckan_get_mqa_quality (get overview scores) → ckan_get_mqa_quality_details (inspect failing metrics)",
    {
      server_url: z.string().url().describe("Base URL of dati.gov.it (e.g., https://www.dati.gov.it/opendata)"),
      dataset_id: z.string().describe("Dataset ID or name"),
      response_format: ResponseFormatSchema.optional()
    },
    async ({ server_url, dataset_id, response_format }) => {
      if (!isValidMqaServer(server_url)) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: MQA quality details are only available for dati.gov.it datasets. ` +
                  `Provided server: ${server_url}\n\n` +
                  `The MQA (Metadata Quality Assurance) system is operated by data.europa.eu ` +
                  `and only evaluates datasets from Italian open data portal.`
          }]
        };
      }

      try {
        const details = await getMqaQualityDetails(server_url, dataset_id);
        const format = response_format || ResponseFormat.MARKDOWN;
        const output = format === ResponseFormat.JSON
          ? JSON.stringify(details, null, 2)
          : formatQualityDetailsMarkdown(details, dataset_id);

        return {
          content: [{
            type: "text" as const,
            text: addDemoFooter(output)
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving quality details: ${errorMessage}`
          }]
        };
      }
    }
  );
}
