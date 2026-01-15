import { describe, it, expect } from 'vitest';
import { parseCkanUri, isValidCkanServer } from '../../src/resources/uri';

describe('parseCkanUri', () => {
  describe('valid URIs', () => {
    it('parses standard dataset URI', () => {
      const uri = new URL('ckan://dati.gov.it/dataset/vaccini-covid');
      const result = parseCkanUri(uri);

      expect(result.server).toBe('https://www.dati.gov.it/opendata');
      expect(result.type).toBe('dataset');
      expect(result.id).toBe('vaccini-covid');
    });

    it('parses resource URI', () => {
      const uri = new URL('ckan://demo.ckan.org/resource/abc-123-def');
      const result = parseCkanUri(uri);

      expect(result.server).toBe('https://demo.ckan.org');
      expect(result.type).toBe('resource');
      expect(result.id).toBe('abc-123-def');
    });

    it('parses organization URI', () => {
      const uri = new URL('ckan://data.gov/organization/sample-org');
      const result = parseCkanUri(uri);

      expect(result.server).toBe('https://data.gov');
      expect(result.type).toBe('organization');
      expect(result.id).toBe('sample-org');
    });

    it('preserves www prefix in server', () => {
      const uri = new URL('ckan://www.dati.gov.it/dataset/test-id');
      const result = parseCkanUri(uri);

      expect(result.server).toBe('https://www.dati.gov.it/opendata');
      expect(result.type).toBe('dataset');
      expect(result.id).toBe('test-id');
    });

    it('handles IDs with hyphens', () => {
      const uri = new URL('ckan://demo.ckan.org/dataset/my-complex-dataset-name');
      const result = parseCkanUri(uri);

      expect(result.id).toBe('my-complex-dataset-name');
    });

    it('handles UUID-style IDs', () => {
      const uri = new URL('ckan://demo.ckan.org/resource/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      const result = parseCkanUri(uri);

      expect(result.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });

  describe('invalid URIs', () => {
    it('throws on missing path segments', () => {
      const uri = new URL('ckan://demo.ckan.org/dataset');
      expect(() => parseCkanUri(uri)).toThrow('expected /{type}/{id}');
    });

    it('throws on root path only', () => {
      const uri = new URL('ckan://demo.ckan.org/');
      expect(() => parseCkanUri(uri)).toThrow('expected /{type}/{id}');
    });

    it('throws on empty hostname', () => {
      // This will actually throw during URL construction, but let's test parsing
      const uri = new URL('ckan:///dataset/test');
      expect(() => parseCkanUri(uri)).toThrow('missing server hostname');
    });
  });
});

describe('isValidCkanServer', () => {
  it('returns true for valid hostnames', () => {
    expect(isValidCkanServer('demo.ckan.org')).toBe(true);
    expect(isValidCkanServer('dati.gov.it')).toBe(true);
    expect(isValidCkanServer('data.gov')).toBe(true);
    expect(isValidCkanServer('www.dati.gov.it')).toBe(true);
  });

  it('returns false for invalid hostnames', () => {
    expect(isValidCkanServer('localhost')).toBe(false);
    expect(isValidCkanServer('invalid hostname')).toBe(false);
    expect(isValidCkanServer('no-dot')).toBe(false);
  });
});
