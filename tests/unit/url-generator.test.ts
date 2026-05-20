import { describe, it, expect } from 'vitest';
import { getDatasetViewUrl, getOrganizationViewUrl, extractSourcePortal } from '../../src/utils/url-generator';

describe('url-generator', () => {
  const dataset = {
    id: 'test-dataset-id',
    name: 'test-dataset-name'
  };
  const organization = {
    id: 'test-org-id',
    name: 'test-org-name'
  };

  describe('getDatasetViewUrl', () => {
    it('uses custom template for exact URL match', () => {
      const url = getDatasetViewUrl('https://www.dati.gov.it/opendata', dataset);
      expect(url).toBe('https://www.dati.gov.it/view-dataset/dataset?id=test-dataset-id');
    });

    it('uses custom template for aliased URL (non-www)', () => {
      // Input URL is the alias
      const url = getDatasetViewUrl('https://dati.gov.it/opendata', dataset);
      // Expected output uses the template from configuration which has the canonical www URL
      expect(url).toBe('https://www.dati.gov.it/view-dataset/dataset?id=test-dataset-id');
    });

    it('uses custom template for aliased URL (http)', () => {
      const url = getDatasetViewUrl('http://dati.gov.it/opendata', dataset);
      expect(url).toBe('https://www.dati.gov.it/view-dataset/dataset?id=test-dataset-id');
    });

    it('uses default template for unknown server', () => {
      const url = getDatasetViewUrl('https://example.com', dataset);
      // Default template uses {server_url} which is replaced by input url
      expect(url).toBe('https://example.com/dataset/test-dataset-name');
    });
  });

  describe('getOrganizationViewUrl', () => {
    it('uses custom template for exact URL match with trailing slash', () => {
      const url = getOrganizationViewUrl('https://www.dati.gov.it/opendata/', organization);
      expect(url).toBe('https://www.dati.gov.it/view-dataset?organization=test-org-name');
    });

    it('uses custom template for aliased URL', () => {
      const url = getOrganizationViewUrl('http://dati.gov.it/opendata', organization);
      expect(url).toBe('https://www.dati.gov.it/view-dataset?organization=test-org-name');
    });

    it('uses default template for unknown server', () => {
      const url = getOrganizationViewUrl('https://example.com/', organization);
      expect(url).toBe('https://example.com/organization/test-org-name');
    });
  });
});

describe('extractSourcePortal', () => {
  const SERVER = 'https://dati.gov.it/opendata';
  const UUID = '550e8400-e29b-41d4-a716-446655440000';

  it('returns portalUrl and resourceId for different-domain CKAN URL', () => {
    const url = `https://dati.comune.milano.it/dataset/abc/resource/${UUID}/download/file.csv`;
    const result = extractSourcePortal(url, SERVER);
    expect(result).not.toBeNull();
    expect(result?.portalUrl).toBe('https://dati.comune.milano.it');
    expect(result?.resourceId).toBe(UUID);
  });

  it('handles source portal with path prefix', () => {
    const url = `https://dati.comune.messina.it/opendata/dataset/abc/resource/${UUID}/download/data.csv`;
    const result = extractSourcePortal(url, SERVER);
    expect(result?.portalUrl).toBe('https://dati.comune.messina.it');
    expect(result?.resourceId).toBe(UUID);
  });

  it('returns null when resource URL is on the same domain', () => {
    const url = `https://dati.gov.it/opendata/dataset/abc/resource/${UUID}/download/file.csv`;
    expect(extractSourcePortal(url, SERVER)).toBeNull();
  });

  it('returns null when URL has no /resource/{uuid}/ pattern', () => {
    expect(extractSourcePortal('https://otherdomain.it/files/data.csv', SERVER)).toBeNull();
  });

  it('returns null for null/undefined resourceUrl', () => {
    expect(extractSourcePortal(null, SERVER)).toBeNull();
    expect(extractSourcePortal(undefined, SERVER)).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(extractSourcePortal('not-a-url', SERVER)).toBeNull();
  });

  it('is case-insensitive for UUID hex digits', () => {
    const uuid = '550E8400-E29B-41D4-A716-446655440000';
    const url = `https://otherdomain.it/dataset/abc/resource/${uuid}/download/file.csv`;
    const result = extractSourcePortal(url, SERVER);
    expect(result).not.toBeNull();
    expect(result?.resourceId).toBe(uuid);
  });
});
