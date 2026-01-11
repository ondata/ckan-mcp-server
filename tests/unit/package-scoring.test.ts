import { describe, it, expect } from 'vitest';
import {
  extractQueryTerms,
  escapeRegExp,
  textMatchesTerms,
  scoreTextField,
  scoreDatasetRelevance
} from '../../src/tools/package';

describe('extractQueryTerms', () => {
  it('extracts terms from simple query', () => {
    const result = extractQueryTerms('health data');
    expect(result).toEqual(['health', 'data']);
  });

  it('removes stopwords', () => {
    const result = extractQueryTerms('the health and the data');
    expect(result).toEqual(['health', 'data']);
  });

  it('removes single-character terms', () => {
    const result = extractQueryTerms('a b health x data y');
    expect(result).toEqual(['health', 'data']);
  });

  it('handles case insensitivity', () => {
    const result = extractQueryTerms('Health DATA');
    expect(result).toEqual(['health', 'data']);
  });

  it('removes duplicate terms', () => {
    const result = extractQueryTerms('health health data health');
    expect(result).toEqual(['health', 'data']);
  });

  it('handles empty query', () => {
    const result = extractQueryTerms('');
    expect(result).toEqual([]);
  });

  it('handles query with only stopwords', () => {
    const result = extractQueryTerms('the and or but');
    expect(result).toEqual([]);
  });

  it('handles special characters', () => {
    const result = extractQueryTerms('health-care, data.csv');
    expect(result).toEqual(['health', 'care', 'data', 'csv']);
  });

  it('handles unicode characters', () => {
    const result = extractQueryTerms('sanità mobilità');
    expect(result).toEqual(['sanità', 'mobilità']);
  });

  it('handles numbers', () => {
    const result = extractQueryTerms('covid19 year2024');
    expect(result).toEqual(['covid19', 'year2024']);
  });
});

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegExp('.')).toBe('\\.');
    expect(escapeRegExp('*')).toBe('\\*');
    expect(escapeRegExp('+')).toBe('\\+');
    expect(escapeRegExp('?')).toBe('\\?');
    expect(escapeRegExp('^')).toBe('\\^');
    expect(escapeRegExp('$')).toBe('\\$');
  });

  it('escapes brackets and braces', () => {
    expect(escapeRegExp('{')).toBe('\\{');
    expect(escapeRegExp('}')).toBe('\\}');
    expect(escapeRegExp('(')).toBe('\\(');
    expect(escapeRegExp(')')).toBe('\\)');
    expect(escapeRegExp('[')).toBe('\\[');
    expect(escapeRegExp(']')).toBe('\\]');
  });

  it('escapes pipe and backslash', () => {
    expect(escapeRegExp('|')).toBe('\\|');
    expect(escapeRegExp('\\')).toBe('\\\\');
  });

  it('handles strings with multiple special characters', () => {
    expect(escapeRegExp('a.b*c+d?')).toBe('a\\.b\\*c\\+d\\?');
  });

  it('does not modify regular text', () => {
    expect(escapeRegExp('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeRegExp('')).toBe('');
  });
});

describe('textMatchesTerms', () => {
  it('matches single term in text', () => {
    const result = textMatchesTerms('health data portal', ['health']);
    expect(result).toBe(true);
  });

  it('matches multiple terms (any match)', () => {
    const result = textMatchesTerms('environmental data', ['health', 'data']);
    expect(result).toBe(true);
  });

  it('does not match when no terms match', () => {
    const result = textMatchesTerms('environmental data', ['health', 'covid']);
    expect(result).toBe(false);
  });

  it('handles undefined text', () => {
    const result = textMatchesTerms(undefined, ['health']);
    expect(result).toBe(false);
  });

  it('handles empty terms array', () => {
    const result = textMatchesTerms('health data', []);
    expect(result).toBe(false);
  });

  it('is case insensitive', () => {
    const result = textMatchesTerms('HEALTH DATA', ['health']);
    expect(result).toBe(true);
  });

  it('matches word boundaries', () => {
    const result = textMatchesTerms('healthcare data', ['health']);
    expect(result).toBe(false);
  });

  it('normalizes underscores to spaces', () => {
    const result = textMatchesTerms('health_data', ['data']);
    expect(result).toBe(true);
  });

  it('handles partial word matches correctly', () => {
    const result = textMatchesTerms('environmental', ['environment']);
    expect(result).toBe(false);
  });

  it('handles unicode text', () => {
    const result = textMatchesTerms('dati sanitari', ['sanitari']);
    expect(result).toBe(true);
  });
});

describe('scoreTextField', () => {
  it('returns weight when text matches terms', () => {
    const result = scoreTextField('health data portal', ['health'], 5);
    expect(result).toBe(5);
  });

  it('returns 0 when text does not match terms', () => {
    const result = scoreTextField('environmental data', ['health'], 5);
    expect(result).toBe(0);
  });

  it('handles undefined text', () => {
    const result = scoreTextField(undefined, ['health'], 5);
    expect(result).toBe(0);
  });

  it('handles empty terms', () => {
    const result = scoreTextField('health data', [], 5);
    expect(result).toBe(0);
  });

  it('uses correct weight', () => {
    const result = scoreTextField('covid data', ['covid'], 10);
    expect(result).toBe(10);
  });

  it('handles zero weight', () => {
    const result = scoreTextField('health data', ['health'], 0);
    expect(result).toBe(0);
  });
});

describe('scoreDatasetRelevance', () => {
  describe('basic scoring', () => {
    it('scores dataset with matching title', () => {
      const dataset = {
        title: 'Health Data Portal',
        notes: 'Environmental information',
        tags: [],
        organization: null
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBeGreaterThan(0);
      expect(result.breakdown.title).toBeGreaterThan(0);
      expect(result.breakdown.notes).toBe(0);
    });

    it('scores dataset with matching notes', () => {
      const dataset = {
        title: 'Data Portal',
        notes: 'Health information system',
        tags: [],
        organization: null
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBeGreaterThan(0);
      expect(result.breakdown.title).toBe(0);
      expect(result.breakdown.notes).toBeGreaterThan(0);
    });

    it('scores dataset with matching tags', () => {
      const dataset = {
        title: 'Data Portal',
        notes: 'Information system',
        tags: [{ name: 'health' }, { name: 'data' }],
        organization: null
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBeGreaterThan(0);
      expect(result.breakdown.tags).toBeGreaterThan(0);
    });

    it('scores dataset with matching organization', () => {
      const dataset = {
        title: 'Data Portal',
        notes: 'Information system',
        tags: [],
        organization: { title: 'Ministry of Health' }
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBeGreaterThan(0);
      expect(result.breakdown.organization).toBeGreaterThan(0);
    });

    it('returns zero score when no matches', () => {
      const dataset = {
        title: 'Environmental Data',
        notes: 'Climate information',
        tags: [{ name: 'climate' }],
        organization: { title: 'EPA' }
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBe(0);
    });
  });

  describe('combined scoring', () => {
    it('sums scores from multiple fields', () => {
      const dataset = {
        title: 'Health Data',
        notes: 'Health information',
        tags: [{ name: 'health' }],
        organization: { title: 'Health Ministry' }
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBe(
        result.breakdown.title +
        result.breakdown.notes +
        result.breakdown.tags +
        result.breakdown.organization
      );
    });

    it('uses default weights correctly', () => {
      const dataset = {
        title: 'Health Data',
        notes: '',
        tags: [],
        organization: null
      };
      const result = scoreDatasetRelevance('health', dataset);

      // Default weight for title is 4
      expect(result.breakdown.title).toBe(4);
    });

    it('uses custom weights correctly', () => {
      const dataset = {
        title: 'Health Data',
        notes: '',
        tags: [],
        organization: null
      };
      const weights = { title: 10, notes: 5, tags: 3, organization: 1 };
      const result = scoreDatasetRelevance('health', dataset, weights);

      expect(result.breakdown.title).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('handles dataset with missing fields', () => {
      const dataset = {};
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBe(0);
    });

    it('handles empty query', () => {
      const dataset = {
        title: 'Health Data',
        notes: 'Information'
      };
      const result = scoreDatasetRelevance('', dataset);

      expect(result.total).toBe(0);
      expect(result.terms).toEqual([]);
    });

    it('handles query with only stopwords', () => {
      const dataset = {
        title: 'Health Data',
        notes: 'Information'
      };
      const result = scoreDatasetRelevance('the and or', dataset);

      expect(result.total).toBe(0);
      expect(result.terms).toEqual([]);
    });

    it('uses name as fallback when title is missing', () => {
      const dataset = {
        name: 'health-data-portal',
        notes: 'Information'
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.total).toBeGreaterThan(0);
    });

    it('handles tags as strings', () => {
      const dataset = {
        title: 'Data Portal',
        tags: ['health', 'data']
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.breakdown.tags).toBeGreaterThan(0);
    });

    it('handles organization.name when title is missing', () => {
      const dataset = {
        title: 'Data',
        organization: { name: 'health-ministry' }
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.breakdown.organization).toBeGreaterThan(0);
    });

    it('handles owner_org as fallback', () => {
      const dataset = {
        title: 'Data',
        owner_org: 'health-ministry'
      };
      const result = scoreDatasetRelevance('health', dataset);

      expect(result.breakdown.organization).toBeGreaterThan(0);
    });
  });

  describe('returns structure', () => {
    it('returns total, breakdown, and terms', () => {
      const dataset = {
        title: 'Health Data'
      };
      const result = scoreDatasetRelevance('health data', dataset);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('terms');
      expect(result.breakdown).toHaveProperty('title');
      expect(result.breakdown).toHaveProperty('notes');
      expect(result.breakdown).toHaveProperty('tags');
      expect(result.breakdown).toHaveProperty('organization');
    });

    it('includes extracted terms in result', () => {
      const dataset = { title: 'Data' };
      const result = scoreDatasetRelevance('health data portal', dataset);

      expect(result.terms).toContain('health');
      expect(result.terms).toContain('data');
      expect(result.terms).toContain('portal');
    });
  });
});
