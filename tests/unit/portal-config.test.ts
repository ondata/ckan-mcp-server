import { describe, it, expect } from 'vitest';
import { getPortalMigration } from '../../src/utils/portal-config';

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
