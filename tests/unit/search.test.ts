import { describe, it, expect } from 'vitest';
import { resolveSearchQuery, escapeSolrQuery, convertDateMathForUnsupportedFields, stripAccents, hasAccents, isPlainMultiTermQuery, buildOrQuery, hasExplicitBooleanOperator, mayNeedTextWrapping } from '../../src/utils/search';

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

  it('wraps a boolean query when the probe asked for the text parser', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'hotel OR alberghi',
      'text'
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

  it('skips text wrapping for fielded queries even when override is text', () => {
    const result = resolveSearchQuery(
      'http://demo.ckan.org',
      'title:hotel OR title:alberghi',
      'text'
    );

    expect(result.effectiveQuery).toBe('title:hotel OR title:alberghi');
    expect(result.forcedTextField).toBe(false);
  });

  it('forces text field when override is text and query is plain', () => {
    const result = resolveSearchQuery(
      'http://demo.ckan.org',
      'hotel OR alberghi',
      'text'
    );

    expect(result.effectiveQuery).toBe('text:(hotel OR alberghi)');
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

  it('escapes Solr special characters for text field wrapping (preserves quotes)', () => {
    const escaped = escapeSolrQuery('foo") (bar):baz\\qux');
    expect(escaped).toBe('foo"\\) \\(bar\\)\\:baz\\\\qux');

    // The wrapping only applies to boolean queries now, so the escaping path is
    // exercised through one.
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'foo") (bar):baz\\qux OR altro',
      'text'
    );

    expect(result.forcedTextField).toBe(true);
    expect(result.effectiveQuery).toContain('text:(');
    expect(result.effectiveQuery).toContain('OR altro');
    expect(result.effectiveQuery).toContain('\\(bar');
  });

  it('preserves quoted phrases inside text:() wrapping', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'SIC OR PAI OR "aree protette" OR "rischio idrogeologico"',
      'text'
    );

    expect(result.effectiveQuery).toBe('text:(SIC OR PAI OR "aree protette" OR "rischio idrogeologico")');
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

describe('stripAccents', () => {
  it('removes accents from Italian characters', () => {
    expect(stripAccents('natalità')).toBe('natalita');
    expect(stripAccents('qualità')).toBe('qualita');
    expect(stripAccents('età')).toBe('eta');
    expect(stripAccents('università')).toBe('universita');
  });

  it('removes accents from French characters', () => {
    expect(stripAccents('réfugiés')).toBe('refugies');
    expect(stripAccents('forêt')).toBe('foret');
  });

  it('leaves plain ASCII unchanged', () => {
    expect(stripAccents('nascite popolazione')).toBe('nascite popolazione');
  });

  it('handles mixed accented and plain text', () => {
    expect(stripAccents('natalità nascite')).toBe('natalita nascite');
  });
});

describe('hasAccents', () => {
  it('detects accented characters', () => {
    expect(hasAccents('natalità')).toBe(true);
    expect(hasAccents('réfugiés')).toBe(true);
  });

  it('returns false for plain ASCII', () => {
    expect(hasAccents('nascite popolazione')).toBe(false);
    expect(hasAccents('*:*')).toBe(false);
  });
});

describe('isPlainMultiTermQuery', () => {
  it('detects plain multi-term query', () => {
    expect(isPlainMultiTermQuery('natalita nascite popolazione')).toBe(true);
    expect(isPlainMultiTermQuery('crime homicide city')).toBe(true);
  });

  it('returns false for single term', () => {
    expect(isPlainMultiTermQuery('natalita')).toBe(false);
  });

  it('returns false for wildcard-all', () => {
    expect(isPlainMultiTermQuery('*:*')).toBe(false);
  });

  it('returns false for queries with explicit boolean operators', () => {
    expect(isPlainMultiTermQuery('natalita OR nascite')).toBe(false);
    expect(isPlainMultiTermQuery('natalita AND nascite')).toBe(false);
    expect(isPlainMultiTermQuery('+natalita -nascite')).toBe(false);
  });

  it('returns false for fielded queries', () => {
    expect(isPlainMultiTermQuery('title:natalita notes:nascite')).toBe(false);
  });
});

describe('buildOrQuery', () => {
  it('joins terms with OR', () => {
    expect(buildOrQuery('natalita nascite popolazione')).toBe('natalita OR nascite OR popolazione');
  });

  it('handles extra whitespace', () => {
    expect(buildOrQuery('  crime   homicide  ')).toBe('crime OR homicide');
  });
});

describe('hasExplicitBooleanOperator', () => {
  // The shapes below were measured against live portals on 2026-09-05. Counts are
  // dati.gov.it, plain vs text:(...): the wrapper must reach only the boolean ones.
  it.each([
    ['ambiente', false],                              // 8047 / 8047
    ['qualità aria', false],                          // 366 / 366
    ['qualità aria Milano', false],                   // 650 / 51
    ['defibrillatori Comune di Lecce', false],        // 678 / 1
    ['musei roma arte opere catalogo', false],        // 9 / 0
    ['"qualità dell\'aria"', false],                  // 318 / 318
    ['aria OR Milano', true],                         // 59 / 3421
    ['aria AND Milano', true],                        // 59 / 59
    ['bandiera blu OR bandiere blu OR spiagge', true] // 0 / 7
  ])('%s -> %s', (query, expected) => {
    expect(hasExplicitBooleanOperator(query as string)).toBe(expected);
  });

  it('wraps intra-word punctuation, which dismax misreads as an operator', () => {
    // plain `e-government` returns 58919 of ~65000 datasets — the portal reads the
    // hyphen as NOT — against 278 for the escaped literal. `COVID-19`: 9963 vs 69.
    expect(hasExplicitBooleanOperator('e-government')).toBe(true);
    expect(hasExplicitBooleanOperator('COVID-19')).toBe(true);
  });

  it('leaves a real unary operator alone: wrapping inverts it', () => {
    // dati.gov.it: `ambiente` 8047, `ambiente -rifiuti` 7649 unwrapped and 398
    // wrapped — and 8047 - 7649 = 398, exactly the set the caller excluded.
    // dismax honours +/-/! natively, so these queries must reach it untouched.
    expect(hasExplicitBooleanOperator('ambiente -rifiuti')).toBe(false);
    expect(hasExplicitBooleanOperator('+ambiente +rifiuti')).toBe(false);
    expect(hasExplicitBooleanOperator('ambiente !rifiuti')).toBe(false);
    expect(mayNeedTextWrapping('ambiente -rifiuti')).toBe(false);
  });

  it('prefers a typed exclusion over the OR fix when both are present', () => {
    // Neither form serves both: wrapping restores OR but destroys the exclusion.
    // The exclusion was typed explicitly and the portal can honour it, so it wins.
    expect(hasExplicitBooleanOperator('aria OR acqua -rifiuti')).toBe(false);
  });
});

describe('mayNeedTextWrapping', () => {
  it('is false for the match-all query, so it never triggers a probe', () => {
    expect(mayNeedTextWrapping('*:*')).toBe(false);
  });

  it('is false for a fielded query: the colon already leaves dismax', () => {
    expect(mayNeedTextWrapping('title:(aria OR acqua)')).toBe(false);
    expect(mayNeedTextWrapping('metadata_created:[NOW-7DAYS TO NOW]')).toBe(false);
  });

  it('is false for plain keyword queries, the common LLM-generated shape', () => {
    expect(mayNeedTextWrapping('bonifica siti contaminati Piemonte')).toBe(false);
    expect(mayNeedTextWrapping('ANAC bandi gara appalti OCDS anticorruzione')).toBe(false);
  });

  it('is true only when a boolean operator can actually be honoured', () => {
    expect(mayNeedTextWrapping('aria OR acqua')).toBe(true);
  });
});

describe('resolveSearchQuery — boolean-only wrapping', () => {
  it('leaves a plain multi-term query to the portal parser', () => {
    // The regression this guards: 678 results collapsed to 1. Two layers keep it
    // away: mayNeedTextWrapping stops the probe from ever asking for the wrapper on
    // this shape, and with no override nothing wraps.
    expect(mayNeedTextWrapping('defibrillatori Comune di Lecce')).toBe(false);

    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'defibrillatori Comune di Lecce',
      undefined
    );
    expect(result.forcedTextField).toBe(false);
    expect(result.effectiveQuery).toBe('defibrillatori Comune di Lecce');
  });

  it('honours an explicit query_parser: "text" from the caller, whatever the shape', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'defibrillatori Comune di Lecce',
      'text'
    );
    expect(result.forcedTextField).toBe(true);
  });

  it('still wraps when the query carries OR', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'bandiera blu OR spiagge',
      'text'
    );
    expect(result.forcedTextField).toBe(true);
    expect(result.effectiveQuery).toBe('text:(bandiera blu OR spiagge)');
  });

  it('never wraps when the caller asked for the default parser', () => {
    const result = resolveSearchQuery(
      'https://www.dati.gov.it/opendata',
      'aria OR acqua',
      'default'
    );
    expect(result.forcedTextField).toBe(false);
  });
});
