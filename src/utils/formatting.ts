/**
 * Formatting utilities for output
 */

import { CHARACTER_LIMIT } from "../types.js";

/**
 * Truncate text if it exceeds character limit
 */
export function truncateText(text: string, limit: number = CHARACTER_LIMIT): string {
  if (text.length <= limit) {
    return text;
  }
  return text.substring(0, limit) + `\n\n... [Response truncated at ${limit} characters]`;
}

/**
 * Truncate a JSON-serializable object to fit within character limit.
 * Unlike truncateText, this always produces valid JSON by shrinking
 * known arrays (results, records, resources, packages, organizations, groups, tags)
 * before falling back to compact serialization.
 */
export function truncateJson(obj: unknown, limit: number = CHARACTER_LIMIT): string {
  // Try pretty first
  let json = JSON.stringify(obj, null, 2);
  if (json.length <= limit) return json;

  // Try compact (no indentation)
  json = JSON.stringify(obj);
  if (json.length <= limit) return json;

  // Shrink known arrays progressively
  const data = structuredClone(obj) as Record<string, unknown>;
  const arrayKeys = ['results', 'records', 'resources', 'packages', 'organizations', 'groups', 'tags'];
  for (const key of arrayKeys) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      const originalCount = data[key].length;
      while (data[key].length > 1) {
        data[key].pop();
        data['_truncated'] = true;
        data['_original_count'] = originalCount;
        json = JSON.stringify(data);
        if (json.length <= limit) return json;
      }
    }
  }

  // Last resort: compact with truncateText (may produce invalid JSON, but respects limit)
  return truncateText(JSON.stringify(data), limit);
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  try {
    if (!dateStr) {
      return 'Invalid Date';
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toISOString().slice(0, 10);
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Detect if running on Cloudflare Workers
 */
export function isWorkers(): boolean {
  // Check for Workers-specific globals
  try {
    return typeof WorkerGlobalScope !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Add demo instance footer to markdown responses when running on Workers
 */
export function addDemoFooter(text: string): string {
  if (!isWorkers()) {
    return text;
  }

  const footer = '\n\n---\nℹ️ Demo instance (100k requests/day shared quota). For unlimited access: https://github.com/ondata/ckan-mcp-server#installation';
  return text + footer;
}
