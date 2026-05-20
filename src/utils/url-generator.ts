import portalsConfig from '../portals.json' assert { type: 'json' };
import { getPortalConfig, normalizePortalUrl } from './portal-config.js';

const UUID_RE = /\/resource\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Given a resource download URL and the requesting server URL, returns the
 * source portal origin and embedded resource ID when the resource belongs to
 * a different CKAN portal (harvested dataset pattern). Returns null when the
 * domain matches or the URL does not contain a CKAN resource path.
 */
export function extractSourcePortal(
  resourceUrl: string | null | undefined,
  serverUrl: string
): { portalUrl: string; resourceId: string } | null {
  if (!resourceUrl) return null;
  let rParsed: URL;
  let sParsed: URL;
  try {
    rParsed = new URL(resourceUrl);
    sParsed = new URL(serverUrl);
  } catch {
    return null;
  }
  if (rParsed.hostname === sParsed.hostname) return null;
  const match = rParsed.pathname.match(UUID_RE);
  if (!match) return null;
  return {
    portalUrl: `${rParsed.protocol}//${rParsed.host}`,
    resourceId: match[1]
  };
}

/**
 * Generate the view URL for a dataset
 */
export function getDatasetViewUrl(serverUrl: string, pkg: any): string {
  const cleanServerUrl = normalizePortalUrl(serverUrl);
  const portal = getPortalConfig(serverUrl);

  const template = portal?.dataset_view_url || portalsConfig.defaults.dataset_view_url;
  
  return template
    .replace('{server_url}', cleanServerUrl)
    .replace('{id}', pkg.id)
    .replace('{name}', pkg.name);
}

/**
 * Generate the view URL for an organization
 */
export function getOrganizationViewUrl(serverUrl: string, org: any): string {
  const cleanServerUrl = normalizePortalUrl(serverUrl);
  const portal = getPortalConfig(serverUrl);

  const template = portal?.organization_view_url || portalsConfig.defaults.organization_view_url;
  
  return template
    .replace('{server_url}', cleanServerUrl)
    .replace('{id}', org.id)
    .replace('{name}', org.name);
}
