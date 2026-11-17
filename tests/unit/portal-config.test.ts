import { describe, it, expect } from "vitest";
import { getPortalMigration, getPortalApiUrlForHostname, getPortalActionBase } from "../../src/utils/portal-config";

describe('getPortalMigration', () => {
  it('returns the notice for a portal marked migrated', () => {
    const m = getPortalMigration('https://catalog.data.gov');
    expect(m?.notice).toContain('stopped being a CKAN portal');
    expect(m?.docs_url).toMatch(/^https:\/\//);
  });

  it('matches the http alias and a trailing slash', () => {
    expect(getPortalMigration('http://catalog.data.gov')).not.toBeNull();
    expect(getPortalMigration('https://catalog.data.gov/')).not.toBeNull();
  });

  it('matches by hostname, as the request router does', () => {
    // A host that left CKAN has left it for every spelling, port and path.
    expect(getPortalMigration('https://CATALOG.DATA.GOV')).not.toBeNull();
    expect(getPortalMigration('https://catalog.data.gov:443')).not.toBeNull();
    expect(getPortalMigration('https://catalog.data.gov/dataset')).not.toBeNull();
  });

  it('is null for a working portal and for an unknown host', () => {
    expect(getPortalMigration('https://open.canada.ca/data')).toBeNull();
    expect(getPortalMigration('https://example.org')).toBeNull();
  });
});

describe('getPortalMigration for data.europa.eu', () => {
  // Clients pass data.europa.eu to CKAN tools (15+ failures in the 2026-11-13/17 telemetry):
  // its old CKAN API is gone, every spelling answers 404 or success=false.
  it.each([
    'https://data.europa.eu',
    'https://data.europa.eu/data',
    'https://data.europa.eu/euodp/en/data/'
  ])('points %s at sparql_query', (url) => {
    const m = getPortalMigration(url);
    expect(m?.notice).toContain('not a CKAN portal');
    expect(m?.notice).toContain('sparql_query');
    expect(m?.notice).toContain('endpoint_url https://data.europa.eu/sparql');
    expect(m?.docs_url).toBe('https://data.europa.eu/en/about/sparql');
  });
});

describe('getPortalApiUrlForHostname', () => {
  // Requests are routed by hostname, so a wrong api_url breaks every spelling of the
  // portal: data.gov.au answers only under /data/api/3 (404 on /api/3, 2026-11-15).
  it('routes data.gov.au and data.nsw.gov.au to their /data API base', () => {
    expect(getPortalApiUrlForHostname('data.gov.au')).toBe('https://data.gov.au/data');
    expect(getPortalApiUrlForHostname('www.data.gov.au')).toBe('https://data.gov.au/data');
    expect(getPortalApiUrlForHostname('data.nsw.gov.au')).toBe('https://data.nsw.gov.au/data');
  });
});

describe('getPortalActionBase', () => {
  it('builds links on the routed API base, not on the caller spelling', () => {
    expect(getPortalActionBase('https://data.gov.au')).toBe('https://data.gov.au/data/api/3/action');
    expect(getPortalActionBase('https://data.gov.au/data/')).toBe('https://data.gov.au/data/api/3/action');
  });

  it('keeps an unknown portal as given', () => {
    expect(getPortalActionBase('https://ckan.example.org/')).toBe('https://ckan.example.org/api/3/action');
  });
});
