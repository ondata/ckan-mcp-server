/**
 * CKAN Quality (MQA) tools for dati.gov.it
 */

import { z } from "zod";
import axios from "axios";
import { ResponseFormat, ResponseFormatSchema } from "../types.js";
import { makeCkanRequest } from "../utils/http.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MQA_API_BASE = "https://data.europa.eu/api/mqa/cache/datasets";
const ALLOWED_SERVER_PATTERNS = [
  /^https?:\/\/(www\.)?dati\.gov\.it/i
];

/**
 * Validate server URL is dati.gov.it
 */
export function isValidMqaServer(serverUrl: string): boolean {
  return ALLOWED_SERVER_PATTERNS.some(pattern => pattern.test(serverUrl));
}

/**
 * Get MQA quality metrics from data.europa.eu
 */
export async function getMqaQuality(serverUrl: string, datasetId: string): Promise<any> {
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
  // Replace colons with hyphens for data.europa.eu API compatibility
  const europeanId = (dataset.identifier || dataset.name).replace(/:/g, '-');

  // Step 3: Query MQA API
  const mqaUrl = `${MQA_API_BASE}/${europeanId}`;

  try {
    const response = await axios.get(mqaUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'CKAN-MCP-Server/1.0'
      }
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`Quality metrics not found for dataset '${europeanId}' on data.europa.eu`);
      }
      throw new Error(`MQA API error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Format MQA quality data as markdown
 */
export function formatQualityMarkdown(data: any, datasetId: string): string {
  const lines: string[] = [];

  lines.push(`# Quality Metrics for Dataset: ${datasetId}`);
  lines.push("");

  if (data.info?.score !== undefined) {
    lines.push(`**Overall Score**: ${data.info.score}/405`);
    lines.push("");
  }

  // Accessibility
  if (data.accessibility) {
    lines.push("## Accessibility");
    if (data.accessibility.accessUrl !== undefined) {
      lines.push(`- Access URL: ${data.accessibility.accessUrl.available ? '✓' : '✗'} Available`);
    }
    if (data.accessibility.downloadUrl !== undefined) {
      lines.push(`- Download URL: ${data.accessibility.downloadUrl.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  // Reusability
  if (data.reusability) {
    lines.push("## Reusability");
    if (data.reusability.licence !== undefined) {
      lines.push(`- License: ${data.reusability.licence.available ? '✓' : '✗'} Available`);
    }
    if (data.reusability.contactPoint !== undefined) {
      lines.push(`- Contact Point: ${data.reusability.contactPoint.available ? '✓' : '✗'} Available`);
    }
    if (data.reusability.publisher !== undefined) {
      lines.push(`- Publisher: ${data.reusability.publisher.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  // Interoperability
  if (data.interoperability) {
    lines.push("## Interoperability");
    if (data.interoperability.format !== undefined) {
      lines.push(`- Format: ${data.interoperability.format.available ? '✓' : '✗'} Available`);
    }
    if (data.interoperability.mediaType !== undefined) {
      lines.push(`- Media Type: ${data.interoperability.mediaType.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  // Findability
  if (data.findability) {
    lines.push("## Findability");
    if (data.findability.keyword !== undefined) {
      lines.push(`- Keywords: ${data.findability.keyword.available ? '✓' : '✗'} Available`);
    }
    if (data.findability.category !== undefined) {
      lines.push(`- Category: ${data.findability.category.available ? '✓' : '✗'} Available`);
    }
    if (data.findability.spatial !== undefined) {
      lines.push(`- Spatial: ${data.findability.spatial.available ? '✓' : '✗'} Available`);
    }
    if (data.findability.temporal !== undefined) {
      lines.push(`- Temporal: ${data.findability.temporal.available ? '✓' : '✗'} Available`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`Source: ${MQA_API_BASE}/${data.id || datasetId}`);

  return lines.join("\n");
}

/**
 * Register MQA quality tools
 */
export function registerQualityTools(server: McpServer): void {
  server.tool(
    "ckan_get_mqa_quality",
    "Get MQA (Metadata Quality Assurance) quality metrics for a dataset on dati.gov.it. " +
    "Returns quality score and detailed metrics (accessibility, reusability, interoperability, findability) " +
    "from data.europa.eu. Only works with dati.gov.it server.",
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
            text: output
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
}
