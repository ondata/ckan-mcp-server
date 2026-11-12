import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { formatSparqlMarkdown, formatSparqlJson, querySparqlEndpoint, validateSelectQuery, injectLimit } from '../../src/tools/sparql';
import { __setDnsResolverForTests } from '../../src/utils/http';
import { summarizeToolError } from '../../src/utils/error-telemetry';

describe('sparql_query', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
    // Default: resolve every hostname to a public IP so tests stay offline.
    __setDnsResolverForTests(async () => [{ address: '93.184.216.34', family: 4 }]);
  });

  afterAll(() => {
    __setDnsResolverForTests(null);
  });

  const mockFetch = (payload: unknown, ok = true, status = 200) => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Bad Request',
      headers: { get: () => null },
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
            'Content-Type': 'application/sparql-query; charset=utf-8',
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

    it('rejects private IP endpoints (SSRF prevention)', async () => {
      await expect(
        querySparqlEndpoint('https://169.254.169.254/sparql', 'SELECT * WHERE { }')
      ).rejects.toThrow('private/internal');
    });

    it('rejects hostnames that RESOLVE to an internal IP (DNS-name bypass)', async () => {
      __setDnsResolverForTests(async () => [{ address: '127.0.0.1', family: 4 }]);
      await expect(
        querySparqlEndpoint('https://internal.lvh.me/sparql', 'SELECT * WHERE { }')
      ).rejects.toThrow('private/internal');
    });

    it('does NOT follow a redirect to an internal host (redirect SSRF)', async () => {
      // Public endpoint resolves fine, but 302-redirects to cloud metadata.
      __setDnsResolverForTests(async (hostname: string) =>
        hostname === '169.254.169.254'
          ? [{ address: '169.254.169.254', family: 4 }]
          : [{ address: '93.184.216.34', family: 4 }]
      );
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: { get: (h: string) => (h.toLowerCase() === 'location' ? 'https://169.254.169.254/latest/meta-data/' : null) },
        json: async () => ({})
      });

      await expect(
        querySparqlEndpoint('https://attacker.example/sparql', 'SELECT * WHERE { }')
      ).rejects.toThrow('private/internal');
    });

    it('rejects a redirect to a non-HTTPS URL', async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 301,
        statusText: 'Moved',
        headers: { get: (h: string) => (h.toLowerCase() === 'location' ? 'http://data.europa.eu/sparql' : null) },
        json: async () => ({})
      });

      await expect(
        querySparqlEndpoint('https://data.europa.eu/sparql', 'SELECT * WHERE { }')
      ).rejects.toThrow('non-HTTPS');
    });

    it('throws on HTTP error response', async () => {
      mockFetch({ error: 'bad query' }, false, 400);

      await expect(
        querySparqlEndpoint('https://data.europa.eu/sparql', 'INVALID QUERY')
      ).rejects.toThrow('SPARQL endpoint error (400)');
    });

    it('includes the endpoint\'s own reason for a 400', async () => {
      const body = 'SPARQL-QUERY: queryStr=SELECT ?a WHERE {VALUES ?a {(<x>)}}\n'
        + 'java.util.concurrent.ExecutionException: org.openrdf.query.MalformedQueryException: Encountered " "(" "( "" at line 1, column 65.\n'
        + 'Was expecting one of:\n    "}" ...';
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(body, { status: 400, statusText: 'Bad Request' }));

      const err = await querySparqlEndpoint('https://query.wikidata.org/sparql', 'SELECT ?a WHERE {VALUES ?a {(<x>)}}').catch(e => e);
      expect(err.message).toBe('SPARQL endpoint error (400): Bad Request: Encountered " "(" "( "" at line 1, column 65.');
    });

    it('reads the reason from the head of a large error body', async () => {
      // Wikidata's parse errors run to ~9 KB of stack trace after the message.
      const body = 'SPARQL-QUERY: queryStr=SELECT\njava.util.concurrent.ExecutionException: MalformedQueryException: Encountered "(" at line 1, column 65.\n'
        + '    at x.y.z\n'.repeat(2000);
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(body, { status: 400, statusText: 'Bad Request' }));

      const err = await querySparqlEndpoint('https://query.wikidata.org/sparql', 'SELECT * WHERE { }').catch(e => e);
      expect(err.message).toBe('SPARQL endpoint error (400): Bad Request: Encountered "(" at line 1, column 65.');
    });

    it('takes the first line of a Virtuoso error body', async () => {
      const body = "Virtuoso 37000 Error SP030: SPARQL compiler, line 2: syntax error at '(' before '<x>'\n\nSPARQL query:\nSELECT ...";
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(body, { status: 400, statusText: 'Bad Request' }));

      const err = await querySparqlEndpoint('https://lod.dati.gov.it/sparql', 'SELECT ?a WHERE {}').catch(e => e);
      expect(err.message).toBe("SPARQL endpoint error (400): Bad Request: Virtuoso 37000 Error SP030: SPARQL compiler, line 2: syntax error at '(' before '<x>'");
    });

    it('leaves out an HTML error page', async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response('<html><body>502 Bad Gateway</body></html>', { status: 502, statusText: 'Bad Gateway', headers: { 'content-type': 'text/html' } })
      );

      const err = await querySparqlEndpoint('https://query.wikidata.org/sparql', 'SELECT * WHERE { }').catch(e => e);
      expect(err.message).toBe('SPARQL endpoint error (502): Bad Gateway');
    });

    it('caps a long reason', async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('x'.repeat(5000), { status: 400, statusText: 'Bad Request' }));

      const err = await querySparqlEndpoint('https://query.wikidata.org/sparql', 'SELECT * WHERE { }').catch(e => e);
      expect(err.message.length).toBeLessThan(400);
    });

    it('reports a timeout as such', async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

      const err = await querySparqlEndpoint('https://query.wikidata.org/sparql', 'SELECT * WHERE { }').catch(e => e);
      expect(err.message).toContain('did not answer within 15 seconds');
      expect(summarizeToolError(`SPARQL query failed:\n${err.message}`).error_kind).toBe('timeout');
    });

    it('classifies an endpoint HTTP error as upstream_http', () => {
      expect(summarizeToolError('SPARQL query failed:\nSPARQL endpoint error (400): Bad Request').error_kind).toBe('upstream_http');
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

    // Telemetry 2026-11-11: ten Wikidata SELECTs rejected because the `#` closing the
    // rdfs: namespace IRI was read as a comment, taking the SELECT on the same line with it.
    it('accepts SELECT after a namespace IRI ending in # on the same line', () => {
      expect(() => validateSelectQuery(
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#> SELECT ?s WHERE { ?s ?p ?o }'
      )).not.toThrow();
    });

    it('does not read a # inside a string literal as a comment', () => {
      expect(() => validateSelectQuery('PREFIX x: <http://x/> SELECT ?s WHERE { ?s ?p "a#b" }')).not.toThrow();
    });

    it('still ignores SELECT in a comment that follows an IRI', () => {
      expect(() => validateSelectQuery('PREFIX x: <http://x/#> # SELECT\nCONSTRUCT { } WHERE { }')).toThrow('Only SELECT queries are supported');
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
