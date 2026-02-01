import portalsConfig from '../portals.json' assert { type: 'json' };

type PortalSearchConfig = {
  force_text_field?: boolean;
};

type PortalConfig = {
  api_url: string;
  api_url_aliases?: string[];
  api_path?: string;
  search?: PortalSearchConfig;
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

export function getPortalApiPath(serverUrl: string): string {
  const portal = getPortalConfig(serverUrl);
  return portal?.api_path || '/api/3/action';
}
