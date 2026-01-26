import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getMqaQuality, isValidMqaServer, formatQualityMarkdown } from '../../src/tools/quality';
import packageShowWithIdentifier from '../fixtures/responses/package-show-with-identifier.json';
import packageShowWithoutIdentifier from '../fixtures/responses/package-show-without-identifier.json';
import mqaQualitySuccess from '../fixtures/responses/mqa-quality-success.json';
import mqaMetricsSuccess from '../fixtures/responses/mqa-metrics-success.json';

vi.mock('axios');

// Mock axios.isAxiosError
vi.mocked(axios.isAxiosError).mockImplementation((error: any) => {
  return error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError === true;
});

describe('ckan_get_mqa_quality integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  const mockFetchJson = (payload: unknown) => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => payload,
      text: async () => JSON.stringify(payload)
    });
  };

  describe('isValidMqaServer', () => {
    it('accepts dati.gov.it URLs with www', () => {
      expect(isValidMqaServer('https://www.dati.gov.it/opendata')).toBe(true);
      expect(isValidMqaServer('http://www.dati.gov.it/opendata')).toBe(true);
    });

    it('accepts dati.gov.it URLs without www', () => {
      expect(isValidMqaServer('https://dati.gov.it/opendata')).toBe(true);
      expect(isValidMqaServer('http://dati.gov.it/opendata')).toBe(true);
    });

    it('rejects non-dati.gov.it URLs', () => {
      expect(isValidMqaServer('https://catalog.data.gov')).toBe(false);
      expect(isValidMqaServer('https://demo.ckan.org')).toBe(false);
      expect(isValidMqaServer('https://data.gov.uk')).toBe(false);
    });
  });

  describe('getMqaQuality', () => {
    it('retrieves quality metrics for dataset with identifier', async () => {
      // Mock CKAN package_show response
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: packageShowWithIdentifier
      });

      // Mock MQA API response
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mqaQualitySuccess
      });
      mockFetchJson(mqaMetricsSuccess);

      const result = await getMqaQuality(
        'https://www.dati.gov.it/opendata',
        '332be8b7-89b9-4dfe-a252-7fccd3efda76'
      );

      expect(result).toHaveProperty('mqa.result.results.0.info.score', 395);
      expect(result).toHaveProperty('mqa.result.results.0.accessibility');
      expect(result).toHaveProperty('mqa.result.results.0.reusability');
      expect(result).toHaveProperty('mqa.result.results.0.interoperability');
      expect(result).toHaveProperty('mqa.result.results.0.findability');
      expect(result).toHaveProperty('breakdown.scores.accessibility', 90);
      expect(result).toHaveProperty('breakdown.nonMaxDimensions');

      // Verify MQA API was called with identifier
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://data.europa.eu/api/mqa/cache/datasets/332be8b7-89b9-4dfe-a252-7fccd3efda76',
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        'https://data.europa.eu/api/hub/repo/datasets/332be8b7-89b9-4dfe-a252-7fccd3efda76/metrics',
        expect.any(Object)
      );
    });

    it('uses name as fallback when identifier is missing', async () => {
      // Mock CKAN package_show response (no identifier)
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: packageShowWithoutIdentifier
      });

      // Mock MQA API response
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mqaQualitySuccess
      });
      mockFetchJson(mqaMetricsSuccess);

      await getMqaQuality(
        'https://dati.gov.it/opendata',
        'pkg-2'
      );

      // Verify MQA API was called with dataset name
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://data.europa.eu/api/mqa/cache/datasets/example-dataset-no-identifier',
        expect.any(Object)
      );
    });

    it('normalizes identifier for MQA lookups', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          success: true,
          result: {
            id: 'dummy',
            name: 'dummy-name',
            identifier: 'cmna:A064'
          }
        }
      });

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mqaQualitySuccess
      });
      mockFetchJson(mqaMetricsSuccess);

      await getMqaQuality(
        'https://www.dati.gov.it/opendata',
        'dummy-id'
      );

      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://data.europa.eu/api/mqa/cache/datasets/cmna-a064',
        expect.any(Object)
      );
    });

    it('tries disambiguation suffix when base identifier is missing', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          success: true,
          result: {
            id: 'dummy',
            name: 'dummy-name',
            identifier: 'c_a734:elenco-posteggi-autorizzati-per-il-commercio-su-aree-pubbliche-2022-2023'
          }
        }
      });

      vi.mocked(axios.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 404 },
        message: 'Request failed with status code 404'
      });

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mqaQualitySuccess
      });
      mockFetchJson(mqaMetricsSuccess);

      await getMqaQuality(
        'https://www.dati.gov.it/opendata',
        'dummy-id'
      );

      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://data.europa.eu/api/mqa/cache/datasets/c_a734-elenco-posteggi-autorizzati-per-il-commercio-su-aree-pubbliche-2022-2023',
        expect.any(Object)
      );

      expect(axios.get).toHaveBeenNthCalledWith(
        3,
        'https://data.europa.eu/api/mqa/cache/datasets/c_a734-elenco-posteggi-autorizzati-per-il-commercio-su-aree-pubbliche-2022-2023~~1',
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        'https://data.europa.eu/api/hub/repo/datasets/c_a734-elenco-posteggi-autorizzati-per-il-commercio-su-aree-pubbliche-2022-2023~~1/metrics',
        expect.any(Object)
      );
    });

    it('throws error when dataset not found', async () => {
      // Mock CKAN package_show error
      vi.mocked(axios.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404,
          data: {
            error: { message: 'Not found' }
          }
        }
      });

      await expect(
        getMqaQuality('https://www.dati.gov.it/opendata', 'non-existent')
      ).rejects.toThrow('CKAN API error');
    });

    it('throws error when MQA API returns 404', async () => {
      // Mock CKAN package_show success
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: packageShowWithIdentifier
      });

      // Mock MQA API 404 error
      vi.mocked(axios.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404
        },
        message: 'Request failed with status code 404'
      });
      vi.mocked(axios.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404
        },
        message: 'Request failed with status code 404'
      });
      vi.mocked(axios.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404
        },
        message: 'Request failed with status code 404'
      });

      await expect(
        getMqaQuality('https://www.dati.gov.it/opendata', '332be8b7-89b9-4dfe-a252-7fccd3efda76')
      ).rejects.toThrow('Quality metrics not found or identifier not aligned');
    });

    it('throws error when MQA API is unavailable', async () => {
      // Mock CKAN package_show success
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: packageShowWithIdentifier
      });

      // Mock MQA API network error
      vi.mocked(axios.get).mockRejectedValueOnce({
        isAxiosError: true,
        code: 'ENOTFOUND',
        message: 'Network error'
      });

      await expect(
        getMqaQuality('https://www.dati.gov.it/opendata', '332be8b7-89b9-4dfe-a252-7fccd3efda76')
      ).rejects.toThrow('MQA API error');
    });
  });

  describe('formatQualityMarkdown', () => {
    it('formats complete quality data as markdown', () => {
      const result = formatQualityMarkdown({
        mqa: mqaQualitySuccess,
        breakdown: {
          scores: {
            accessibility: 90,
            findability: 100,
            interoperability: 110,
            reusability: 75,
            contextuality: 20
          },
          nonMaxDimensions: ['accessibility'],
          metricsUrl: 'https://data.europa.eu/api/hub/repo/datasets/r_liguri-ds-664/metrics',
          mqaUrl: 'https://data.europa.eu/api/mqa/cache/datasets/r_liguri-ds-664',
          portalId: 'r_liguri-ds-664'
        }
      }, 'test-dataset');

      expect(result).toContain('# Quality Metrics');
      expect(result).toContain('test-dataset');
      expect(result).toContain('**Overall Score**: 395/405');
      expect(result).toContain('## Dimension Scores');
      expect(result).toContain('Accessibility: 90/100 ⚠️ (max 100)');
      expect(result).toContain('Findability: 100/100 ✅');
      expect(result).toContain('Non-max dimension(s): accessibility');
      expect(result).toContain('## Accessibility');
      expect(result).toContain('## Reusability');
      expect(result).toContain('## Interoperability');
      expect(result).toContain('## Findability');
      expect(result).toContain('## Contextuality');
      expect(result).toContain('✓ Available');
    });

    it('handles partial quality data', () => {
      const partialData = {
        info: { score: 200 },
        accessibility: {
          accessUrl: { available: true }
        }
      };

      const result = formatQualityMarkdown(partialData, 'partial-dataset');

      expect(result).toContain('**Overall Score**: 200/405');
      expect(result).toContain('## Accessibility');
      expect(result).not.toContain('## Reusability');
    });

    it('shows unavailable indicators correctly', () => {
      const dataWithUnavailable = {
        info: { score: 100 },
        accessibility: {
          accessUrl: { available: false },
          downloadUrl: { available: true }
        }
      };

      const result = formatQualityMarkdown(dataWithUnavailable, 'test');

      expect(result).toContain('✗ Available');
      expect(result).toContain('✓ Available');
    });
  });
});
