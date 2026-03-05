import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatSparqlMarkdown, formatSparqlJson, querySparqlEndpoint, validateSelectQuery, injectLimit } from '../../src/tools/sparql';

describe('sparql_query', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  const mockFetch = (payload: unknown, ok = true, status = 200) => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Bad Request',
      json: async () => payload
    });
  };

  const sampleSparqlResponse = {
    head: { vars: ['publisherName', 'count'] },
    results: {
      bindings: [
        { publisherName: { type: 'literal', value: 'ISTAT' }, count: { type: 'literal', value: '42' } },
        { publisherName: { type: 'literal', value: 'ISPRA' }, count: { type: 'literal', value: '10' } }
      ]
    }
  };

  describe('querySparqlEndpoint', () => {
    it('sends POST with sparql-query content-type and accepts json', async () => {
      mockFetch(sampleSparqlResponse);

      await querySparqlEndpoint('https://data.europa.eu/sparql', 'SELECT ?s WHERE { ?s ?p ?o } LIMIT 1');

      expect(fetch).toHaveBeenCalledWith(
        'https://data.europa.eu/sparql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/sparql-query',
            'Accept': 'application/sparql-results+json'
          }),
          body: 'SELECT ?s WHERE { ?s ?p ?o } LIMIT 1'
        })
      );
    });

    it('returns parsed SPARQL results', async () => {
      mockFetch(sampleSparqlResponse);

      const result = await querySparqlEndpoint('https://data.europa.eu/sparql', 'SELECT * WHERE { }');

      expect(result.head.vars).toEqual(['publisherName', 'count']);
      expect(result.results.bindings).toHaveLength(2);
      expect(result.results.bindings[0].publisherName.value).toBe('ISTAT');
    });

    it('rejects non-HTTPS endpoints', async () => {
      await expect(
        querySparqlEndpoint('http://insecure.example.com/sparql', 'SELECT * WHERE { }')
      ).rejects.toThrow('Only HTTPS endpoints are allowed');
    });

    it('throws on HTTP error response', async () => {
      mockFetch({ error: 'bad query' }, false, 400);

      await expect(
        querySparqlEndpoint('https://data.europa.eu/sparql', 'INVALID QUERY')
      ).rejects.toThrow('SPARQL endpoint error (400)');
    });

    it('throws on network error', async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'));

      await expect(
        querySparqlEndpoint('https://data.europa.eu/sparql', 'SELECT * WHERE { }')
      ).rejects.toThrow('Network failure');
    });
  });

  describe('formatSparqlMarkdown', () => {
    it('renders a markdown table with header and rows', () => {
      const md = formatSparqlMarkdown(sampleSparqlResponse, 'https://example.com/sparql');

      expect(md).toContain('# SPARQL Query Results');
      expect(md).toContain('**Endpoint**: https://example.com/sparql');
      expect(md).toContain('**Rows**: 2');
      expect(md).toContain('| publisherName | count |');
      expect(md).toContain('| ISTAT | 42 |');
      expect(md).toContain('| ISPRA | 10 |');
    });

    it('shows no results message when bindings is empty', () => {
      const empty = { head: { vars: ['s'] }, results: { bindings: [] } };
      const md = formatSparqlMarkdown(empty, 'https://example.com/sparql');

      expect(md).toContain('**Rows**: 0');
      expect(md).toContain('_No results_');
    });

    it('escapes pipe characters in values', () => {
      const data = {
        head: { vars: ['label'] },
        results: { bindings: [{ label: { type: 'literal', value: 'foo|bar' } }] }
      };
      const md = formatSparqlMarkdown(data, 'https://example.com/sparql');

      expect(md).toContain('foo\\|bar');
    });

    it('handles missing binding values with empty string', () => {
      const data = {
        head: { vars: ['a', 'b'] },
        results: { bindings: [{ a: { type: 'literal', value: 'only-a' } }] }
      };
      const md = formatSparqlMarkdown(data, 'https://example.com/sparql');

      expect(md).toContain('| only-a |  |');
    });
  });

  describe('validateSelectQuery', () => {
    it('accepts a plain SELECT query', () => {
      expect(() => validateSelectQuery('SELECT ?s WHERE { ?s ?p ?o }')).not.toThrow();
    });

    it('accepts SELECT with PREFIX declarations before it', () => {
      expect(() => validateSelectQuery('PREFIX ex: <http://example.org/>\nSELECT ?s WHERE { }')).not.toThrow();
    });

    it('accepts SELECT case-insensitively', () => {
      expect(() => validateSelectQuery('select ?s where { }')).not.toThrow();
    });

    it('rejects a CONSTRUCT query', () => {
      expect(() => validateSelectQuery('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }')).toThrow('Only SELECT queries are supported');
    });

    it('rejects an ASK query', () => {
      expect(() => validateSelectQuery('ASK { ?s ?p ?o }')).toThrow('Only SELECT queries are supported');
    });

    it('rejects a query with no keyword', () => {
      expect(() => validateSelectQuery('{ ?s ?p ?o }')).toThrow('Only SELECT queries are supported');
    });

    it('ignores SELECT in a comment', () => {
      expect(() => validateSelectQuery('# SELECT ?s WHERE { }\nCONSTRUCT { } WHERE { }')).toThrow('Only SELECT queries are supported');
    });
  });

  describe('injectLimit', () => {
    it('appends LIMIT when not present', () => {
      const result = injectLimit('SELECT ?s WHERE { ?s ?p ?o }', 50);
      expect(result).toContain('LIMIT 50');
    });

    it('does not inject LIMIT when already present', () => {
      const query = 'SELECT ?s WHERE { ?s ?p ?o } LIMIT 10';
      expect(injectLimit(query, 50)).toBe(query);
    });

    it('detects LIMIT case-insensitively', () => {
      const query = 'SELECT ?s WHERE { ?s ?p ?o } limit 5';
      expect(injectLimit(query, 50)).toBe(query);
    });

    it('trims trailing whitespace before appending LIMIT', () => {
      const result = injectLimit('SELECT ?s WHERE { ?s ?p ?o }   ', 100);
      expect(result).toMatch(/\}\nLIMIT 100$/);
    });
  });

  describe('formatSparqlJson', () => {
    it('returns count, columns, and rows', () => {
      const result = formatSparqlJson(sampleSparqlResponse);

      expect(result.count).toBe(2);
      expect(result.columns).toEqual(['publisherName', 'count']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ publisherName: 'ISTAT', count: '42' });
    });

    it('returns empty rows array when no bindings', () => {
      const empty = { head: { vars: ['s'] }, results: { bindings: [] } };
      const result = formatSparqlJson(empty);

      expect(result.count).toBe(0);
      expect(result.rows).toEqual([]);
    });

    it('fills missing bindings with empty string', () => {
      const data = {
        head: { vars: ['a', 'b'] },
        results: { bindings: [{ a: { type: 'literal', value: 'val-a' } }] }
      };
      const result = formatSparqlJson(data);

      expect(result.rows[0]).toEqual({ a: 'val-a', b: '' });
    });
  });
});
