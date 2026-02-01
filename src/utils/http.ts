/**
 * HTTP utilities for CKAN API requests
 */

import axios, { AxiosError } from "axios";
import { getPortalApiUrlForHostname } from "./portal-config.js";

type ZlibModule = {
  brotliDecompressSync: (input: Buffer) => Buffer;
  gunzipSync: (input: Buffer) => Buffer;
  inflateSync: (input: Buffer) => Buffer;
};

const loadZlib = (() => {
  let cached: Promise<ZlibModule | null> | null = null;
  return async (): Promise<ZlibModule | null> => {
    if (!cached) {
      cached = (async () => {
        try {
          const mod = (await import("node:" + "zlib")) as ZlibModule;
          return mod;
        } catch {
          return null;
        }
      })();
    }
    return cached;
  };
})();

function getHeaderValue(
  headers: Record<string, unknown> | undefined,
  name: string
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value.join(",") : String(value);
    }
  }
  return undefined;
}

function asBuffer(data: unknown): Buffer | undefined {
  if (!data) {
    return undefined;
  }
  if (typeof Buffer === "undefined") {
    return undefined;
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return undefined;
}

async function decodePossiblyCompressed(
  data: unknown,
  headers?: Record<string, unknown>
): Promise<unknown> {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "object" && !asBuffer(data)) {
    return data;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  const buffer = asBuffer(data);
  if (!buffer) {
    return data;
  }

  const encoding = getHeaderValue(headers, "content-encoding");
  let decodedBuffer = buffer;
  const zlib = await loadZlib();

  try {
    if (zlib) {
      if (encoding?.includes("gzip")) {
        decodedBuffer = zlib.gunzipSync(buffer);
      } else if (encoding?.includes("br")) {
        decodedBuffer = zlib.brotliDecompressSync(buffer);
      } else if (encoding?.includes("deflate")) {
        decodedBuffer = zlib.inflateSync(buffer);
      } else if (
        buffer.length >= 2 &&
        buffer[0] === 0x1f &&
        buffer[1] === 0x8b
      ) {
        decodedBuffer = zlib.gunzipSync(buffer);
      }
    }
  } catch {
    decodedBuffer = buffer;
  }

  const text = decodedBuffer.toString("utf-8").trim();
  if (!text) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Make HTTP request to CKAN API
 */
export async function makeCkanRequest<T>(
  serverUrl: string,
  action: string,
  params: Record<string, any> = {}
): Promise<T> {
  let resolvedServerUrl = serverUrl;
  try {
    const hostname = new URL(serverUrl).hostname;
    const portalApiUrl = getPortalApiUrlForHostname(hostname);
    if (portalApiUrl) {
      resolvedServerUrl = portalApiUrl;
    }
  } catch {
    // Keep provided URL if parsing fails
  }

  // Normalize server URL
  const baseUrl = resolvedServerUrl.replace(/\/$/, '');
  const url = `${baseUrl}/api/3/action/${action}`;

  try {
    const response = await axios.get(url, {
      params,
      timeout: 30000,
      responseType: "arraybuffer",
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        Referer: `${baseUrl}/`,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Upgrade-Insecure-Requests': '1',
        'Sec-CH-UA': '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Linux"',
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const decodedData = await decodePossiblyCompressed(
      response.data,
      response.headers
    );
    if (decodedData && (decodedData as { success?: boolean }).success === true) {
      return (decodedData as { result: T }).result;
    } else {
      throw new Error(
        `CKAN API returned success=false: ${JSON.stringify(decodedData)}`
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        const errorMsg = data?.error?.message || data?.error || 'Unknown error';
        throw new Error(`CKAN API error (${status}): ${errorMsg}`);
      } else if (axiosError.code === 'ECONNABORTED') {
        throw new Error(`Request timeout connecting to ${serverUrl}`);
      } else if (axiosError.code === 'ENOTFOUND') {
        throw new Error(`Server not found: ${serverUrl}`);
      } else {
        throw new Error(`Network error: ${axiosError.message}`);
      }
    }
    throw error;
  }
}
