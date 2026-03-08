import portalsConfig from '../portals.json' assert { type: 'json' };

type PortalSearchConfig = {
  force_text_field?: boolean;
};

export type HvdConfig = {
  category_field: string;
};

export type SparqlConfig = {
  endpoint_url: string;
  method?: "GET" | "POST";
};

type PortalConfig = {
  api_url: string;
  api_url_aliases?: string[];
  api_path?: string;
  search?: PortalSearchConfig;
  hvd?: HvdConfig;
  sparql?: SparqlConfig;
  normalize?: string;
};

type PortalDefaults = {
  search?: PortalSearchConfig;
};

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function getPortalConfig(serverUrl: string): PortalConfig | null {
  const cleanServerUrl = normalizeUrl(serverUrl);

  const portal = (portalsConfig.portals as PortalConfig[]).find((p) => {
    const mainUrl = normalizeUrl(p.api_url);
    const aliases = (p.api_url_aliases || []).map(normalizeUrl);
    return mainUrl === cleanServerUrl || aliases.includes(cleanServerUrl);
  });

  return portal || null;
}

export function getPortalSearchConfig(serverUrl: string): PortalSearchConfig {
  const portal = getPortalConfig(serverUrl);
  const defaults = (portalsConfig.defaults as PortalDefaults)?.search || {};

  return {
    force_text_field: portal?.search?.force_text_field ?? defaults.force_text_field ?? false
  };
}

/** Returns true if the portal has an explicit force_text_field setting in portals.json */
export function isPortalSearchExplicitlyConfigured(serverUrl: string): boolean {
  const portal = getPortalConfig(serverUrl);
  return portal?.search?.force_text_field !== undefined;
}

export function normalizePortalUrl(serverUrl: string): string {
  return normalizeUrl(serverUrl);
}

export function getPortalApiUrlForHostname(hostname: string): string | null {
  const portal = (portalsConfig.portals as PortalConfig[]).find((p) => {
    const urls = [p.api_url, ...(p.api_url_aliases || [])];
    return urls.some((url) => extractHostname(url) === hostname);
  });

  return portal ? normalizeUrl(portal.api_url) : null;
}

export function getPortalHvdConfig(serverUrl: string): HvdConfig | null {
  const portal = getPortalConfig(serverUrl);
  return portal?.hvd ?? null;
}

/** Lookup by SPARQL endpoint URL (used by sparql.ts to determine method) */
export function getSparqlConfig(endpointUrl: string): SparqlConfig | null {
  const cleanUrl = normalizeUrl(endpointUrl);
  const portal = (portalsConfig.portals as PortalConfig[]).find(
    (p) => p.sparql && normalizeUrl(p.sparql.endpoint_url) === cleanUrl
  );
  return portal?.sparql ?? null;
}

/** Lookup by CKAN server URL (used by status.ts to show SPARQL endpoint) */
export function getPortalSparqlConfig(serverUrl: string): SparqlConfig | null {
  const portal = getPortalConfig(serverUrl);
  return portal?.sparql ?? null;
}

export function getPortalApiPath(serverUrl: string): string {
  const portal = getPortalConfig(serverUrl);
  return portal?.api_path || '/api/3/action';
}

export function requiresMultilingualNormalization(serverUrl: string): boolean {
  const portal = getPortalConfig(serverUrl);
  return portal?.normalize === 'multilingual';
}
