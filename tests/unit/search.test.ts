import { describe, it, expect } from 'vitest';
import { resolveSearchQuery, escapeSolrQuery, convertDateMathForUnsupportedFields } from '../../src/utils/search';

describe('resolveSearchQuery', () => {
  it('keeps query unchanged for non-configured portals', () => {
    const result = resolveSearchQuery(
      'http://demo.ckan.org',
      'hotel OR alberghi',
      undefined
    );

    expect(result.effectiveQuery).toBe('hotel OR alberghi');
    expect(result.forcedTextField).toBe(false);
  });

  it('forces text field for configured portals on non-fielded queries', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'hotel OR alberghi',
      undefined
    );

    expect(result.effectiveQuery).toBe('text:(hotel OR alberghi)');
    expect(result.forcedTextField).toBe(true);
  });

  it('does not force text field for default match-all query', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      '*:*',
      undefined
    );

    expect(result.effectiveQuery).toBe('*:*');
    expect(result.forcedTextField).toBe(false);
  });

  it('does not force text field for fielded queries', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'title:hotel OR title:alberghi',
      undefined
    );

    expect(result.effectiveQuery).toBe('title:hotel OR title:alberghi');
    expect(result.forcedTextField).toBe(false);
  });

  it('forces text field when override is text', () => {
    const result = resolveSearchQuery(
      'http://demo.ckan.org',
      'title:hotel OR title:alberghi',
      'text'
    );

    expect(result.effectiveQuery).toBe('text:(title\\:hotel OR title\\:alberghi)');
    expect(result.forcedTextField).toBe(true);
  });

  it('disables forcing when override is default', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'hotel OR alberghi',
      'default'
    );

    expect(result.effectiveQuery).toBe('hotel OR alberghi');
    expect(result.forcedTextField).toBe(false);
  });

  it('escapes Solr special characters for text field wrapping', () => {
    const escaped = escapeSolrQuery('foo") (bar):baz\\qux');
    expect(escaped).toBe('foo\\\"\\) \\(bar\\)\\:baz\\\\qux');

    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'foo") (bar):baz\\qux',
      undefined
    );

    expect(result.effectiveQuery).toBe('text:(foo\\\"\\) \\(bar\\)\\:baz\\\\qux)');
    expect(result.forcedTextField).toBe(true);
  });
});

describe('convertDateMathForUnsupportedFields', () => {
  it('converts NOW-XDAYS syntax for modified field', () => {
    const result = convertDateMathForUnsupportedFields('modified:[NOW-30DAYS TO NOW]');

    expect(result).toMatch(/^modified:\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z TO 20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/);
    const dates = result.match(/\[(.+?) TO (.+?)\]/);
    expect(dates).toBeTruthy();
    if (dates) {
      const start = new Date(dates[1]);
      const end = new Date(dates[2]);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    }
  });

  it('converts NOW-XDAYS syntax for issued field', () => {
    const result = convertDateMathForUnsupportedFields('issued:[NOW-7DAYS TO NOW]');

    expect(result).toMatch(/^issued:\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z TO 20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/);
  });

  it('converts NOW-XMONTHS syntax', () => {
    const result = convertDateMathForUnsupportedFields('modified:[NOW-6MONTHS TO NOW]');

    expect(result).toMatch(/^modified:\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z TO 20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/);
  });

  it('converts NOW-XYEARS syntax', () => {
    const result = convertDateMathForUnsupportedFields('modified:[NOW-1YEAR TO NOW]');

    expect(result).toMatch(/^modified:\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z TO 20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]$/);
  });

  it('handles plural forms (DAYS, MONTHS, YEARS)', () => {
    const result1 = convertDateMathForUnsupportedFields('modified:[NOW-1DAYS TO NOW]');
    const result2 = convertDateMathForUnsupportedFields('modified:[NOW-1DAY TO NOW]');

    expect(result1).toMatch(/modified:\[.+ TO .+\]/);
    expect(result2).toMatch(/modified:\[.+ TO .+\]/);
  });

  it('leaves metadata_modified unchanged', () => {
    const input = 'metadata_modified:[NOW-30DAYS TO NOW]';
    const result = convertDateMathForUnsupportedFields(input);

    expect(result).toBe(input);
  });

  it('leaves metadata_created unchanged', () => {
    const input = 'metadata_created:[NOW-1YEAR TO NOW]';
    const result = convertDateMathForUnsupportedFields(input);

    expect(result).toBe(input);
  });

  it('handles complex queries with multiple fields', () => {
    const input = 'modified:[NOW-30DAYS TO NOW] AND metadata_modified:[NOW-7DAYS TO NOW]';
    const result = convertDateMathForUnsupportedFields(input);

    expect(result).toMatch(/^modified:\[20\d{2}.+ TO .+\] AND metadata_modified:\[NOW-7DAYS TO NOW\]$/);
  });

  it('leaves queries without NOW syntax unchanged', () => {
    const input = 'modified:[2025-01-01T00:00:00Z TO *]';
    const result = convertDateMathForUnsupportedFields(input);

    expect(result).toBe(input);
  });

  it('is case insensitive for field names', () => {
    const result1 = convertDateMathForUnsupportedFields('Modified:[NOW-30DAYS TO NOW]');
    const result2 = convertDateMathForUnsupportedFields('ISSUED:[NOW-30DAYS TO NOW]');

    expect(result1).toMatch(/Modified:\[20\d{2}.+ TO .+\]/);
    expect(result2).toMatch(/ISSUED:\[20\d{2}.+ TO .+\]/);
  });
});
