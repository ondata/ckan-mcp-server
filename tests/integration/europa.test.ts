import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { pickLang, renderEuropaSearchMarkdown } from '../../src/tools/europa';
import { makeEuropaSearchRequest } from '../../src/utils/europa-http';
import type { EuropaDataset } from '../../src/types';
import europaSuccess from '../fixtures/responses/europa-search-success.json';

vi.mock('axios');

describe('europa_dataset_search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pickLang', () => {
    it('picks the requested language', () => {
      const field = { en: 'English', it: 'Italiano', de: 'Deutsch' };
      expect(pickLang(field, 'it')).toBe('Italiano');
    });

    it('falls back to English when requested language is missing', () => {
      const field = { en: 'English', de: 'Deutsch' };
      expect(pickLang(field, 'fr')).toBe('English');
    });

    it('falls back to first available when English is missing', () => {
      const field = { de: 'Deutsch', fr: 'Français' };
      expect(pickLang(field, 'it')).toBe('Deutsch');
    });

    it('returns empty string for undefined input', () => {
      expect(pickLang(undefined, 'en')).toBe('');
    });

    it('returns empty string for empty object', () => {
      expect(pickLang({}, 'en')).toBe('');
    });
  });

  describe('makeEuropaSearchRequest', () => {
    it('returns count and results from API', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: europaSuccess });

      const result = await makeEuropaSearchRequest({ q: 'environment' });

      expect(result.count).toBe(1234);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('abc-123');
    });

    it('handles empty results', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { count: 0, results: [] } }
      });

      const result = await makeEuropaSearchRequest({ q: 'nonexistent' });

      expect(result.count).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('sends filters=dataset parameter', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { count: 0, results: [] } }
      });

      await makeEuropaSearchRequest({ q: 'test' });

      const callUrl = vi.mocked(axios.get).mock.calls[0][0];
      expect(callUrl).toContain('filters=dataset');
    });

    it('sends facets param for country filter', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { count: 0, results: [] } }
      });

      await makeEuropaSearchRequest({
        q: 'test',
        facets: { country: ['it', 'de'] }
      });

      const callUrl = vi.mocked(axios.get).mock.calls[0][0];
      expect(callUrl).toContain('facets=');
      expect(callUrl).toContain('country');
    });
  });

  describe('renderEuropaSearchMarkdown', () => {
    const datasets = europaSuccess.result.results as unknown as EuropaDataset[];

    it('returns markdown with header info', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('# European Data Portal');
      expect(md).toContain('**Query**: environment');
      expect(md).toContain('**Results**: 1234');
    });

    it('shows country filter in header', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        country: ['IT', 'DE'],
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('**Country**: IT, DE');
    });

    it('handles empty results', () => {
      const md = renderEuropaSearchMarkdown([], 0, {
        q: 'nonexistent',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('No datasets found');
    });

    it('extracts formats from distributions', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('CSV, JSON, XML');
    });

    it('renders keywords', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('environment');
      expect(md).toContain('air quality');
    });

    it('shows HVD badge', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      // First dataset is HVD
      expect(md).toContain('| HVD | Yes |');
    });

    it('shows pagination hint when more results', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('page: 2');
    });

    it('does not show pagination hint on last page', () => {
      const md = renderEuropaSearchMarkdown(datasets, 2, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).not.toContain('page: 2');
    });

    it('shows dataset link', () => {
      const md = renderEuropaSearchMarkdown(datasets, 1234, {
        q: 'environment',
        lang: 'en',
        page: 1,
        page_size: 10
      });

      expect(md).toContain('https://data.europa.eu/data/datasets/abc-123');
    });
  });
});
