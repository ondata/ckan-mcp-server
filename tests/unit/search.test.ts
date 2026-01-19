import { describe, it, expect } from 'vitest';
import { resolveSearchQuery, escapeSolrQuery } from '../../src/utils/search';

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
