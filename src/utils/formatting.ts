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
