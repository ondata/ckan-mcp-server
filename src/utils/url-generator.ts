import portalsConfig from '../portals.json' assert { type: 'json' };
import { getPortalConfig, normalizePortalUrl } from './portal-config.js';

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
