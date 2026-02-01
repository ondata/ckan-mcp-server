/**
 * HTTP utilities for CKAN API requests
 */

import axios, { AxiosError } from "axios";
import { getPortalApiUrlForHostname, getPortalApiPath } from "./portal-config.js";

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

function asArrayBuffer(data: unknown): ArrayBuffer | undefined {
  if (!data) {
    return undefined;
  }
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return undefined;
}

async function decodeArrayBufferText(
  buffer: ArrayBuffer,
  encoding?: string
): Promise<string> {
  if (encoding && typeof DecompressionStream !== "undefined") {
    try {
      const stream = new DecompressionStream(
        encoding.includes("br")
          ? "br"
          : encoding.includes("deflate")
          ? "deflate"
          : "gzip"
      );
      const decompressed = await new Response(
        new Blob([buffer]).stream().pipeThrough(stream)
      ).arrayBuffer();
      return new TextDecoder("utf-8").decode(decompressed).trim();
    } catch {
      // Fall back to plain text decoding.
    }
  }
  return new TextDecoder("utf-8").decode(buffer).trim();
}

async function decodePossiblyCompressed(
  data: unknown,
  headers?: Record<string, unknown>
): Promise<unknown> {
  if (data === null || data === undefined) {
    return data;
  }

  const arrayBuffer = asArrayBuffer(data);
  if (arrayBuffer && typeof Buffer === "undefined") {
    const encoding = getHeaderValue(headers, "content-encoding");
    const text = await decodeArrayBufferText(arrayBuffer, encoding);
    if (!text) {
      return text;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
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
    if (typeof data === "object") {
      return data;
    }
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
  const isNode =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;

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
  const apiPath = getPortalApiPath(resolvedServerUrl);
  const url = `${baseUrl}${apiPath}/${action}`;

  try {
    let decodedData: unknown;

    if (isNode) {
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

      decodedData = await decodePossiblyCompressed(
        response.data,
        response.headers
      );
    } else {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
          continue;
        }
        searchParams.set(key, String(value));
      }
      const fetchUrl = searchParams.toString()
        ? `${url}?${searchParams.toString()}`
        : url;
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          Referer: `${baseUrl}/`,
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
          "Upgrade-Insecure-Requests": "1",
          "Sec-CH-UA": '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
          "Sec-CH-UA-Mobile": "?0",
          "Sec-CH-UA-Platform": '"Linux"',
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`CKAN API error (${response.status}): ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const headers: Record<string, string> = {};
      response.headers.forEach((headerValue, headerKey) => {
        headers[headerKey] = headerValue;
      });
      decodedData = await decodePossiblyCompressed(buffer, headers);
    }

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
