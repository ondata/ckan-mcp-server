import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { makeCkanRequest } from '../../src/utils/http';
import { scoreDatasetRelevance } from '../../src/tools/package';
import packageSearchFixture from '../fixtures/responses/package-search-success.json';
import packageShowFixture from '../fixtures/responses/package-show-success.json';
import notFoundError from '../fixtures/errors/not-found.json';

vi.mock('axios');

describe('ckan_package_search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic search', () => {
    it('returns search results with basic query', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test' }
      );

      expect(result).toHaveProperty('count', 100);
      expect(result).toHaveProperty('results');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('returns empty results when no matches', async () => {
      const emptyResults = {
        help: 'http://demo.ckan.org/api/3/action/help_show?name=package_search',
        success: true,
        result: {
          count: 0,
          results: [],
          facets: {}
        }
      };

      vi.mocked(axios.get).mockResolvedValue({ data: emptyResults });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'nonexistent-dataset-xyz' }
      );

      expect(result.count).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('uses default query "*:*" when q not provided', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        {}
      );

      const axiosCall = vi.mocked(axios.get).mock.calls[0];
      expect(axiosCall[1].params).not.toHaveProperty('q');
    });
  });

  describe('pagination', () => {
    it('supports pagination with start parameter', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test', start: 10, rows: 10 }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            start: 10,
            rows: 10
          })
        })
      );
    });

    it('supports large results with max rows', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test', rows: 1000 }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            rows: 1000
          })
        })
      );
    });
  });

  describe('sorting', () => {
    it('supports sorting with sort parameter', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test', sort: 'metadata_modified desc' }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            sort: 'metadata_modified desc'
          })
        })
      );
    });

    it('supports sorting by name', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test', sort: 'name asc' }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            sort: 'name asc'
          })
        })
      );
    });
  });

  describe('filtering', () => {
    it('supports filter queries with fq parameter', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        {
          q: 'test',
          fq: 'organization:example-org'
        }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            fq: 'organization:example-org'
          })
        })
      );
    });

    it('supports multiple filter queries', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        {
          q: 'test',
          fq: 'organization:example-org AND res_format:CSV'
        }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            fq: 'organization:example-org AND res_format:CSV'
          })
        })
      );
    });
  });

  describe('faceting', () => {
    it('returns facet data when requested', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        {
          q: 'test',
          facet_field: ['organization']
        }
      );

      expect(result).toHaveProperty('facets');
      expect(result.facets).toBeInstanceOf(Object);
    });
  });

  describe('complex queries', () => {
    it('handles complex query with multiple parameters', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        {
          q: 'test',
          fq: 'organization:example-org',
          sort: 'metadata_modified desc',
          start: 0,
          rows: 20,
          facet_field: ['organization', 'res_format']
        }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'test',
            fq: 'organization:example-org',
            sort: 'metadata_modified desc',
            start: 0,
            rows: 20
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('handles 404 error for invalid query', async () => {
      const error = new Error('Not Found') as any;
      error.isAxiosError = true;
      error.response = {
        status: 404,
        data: notFoundError
      };
      vi.mocked(axios.get).mockRejectedValue(error);

      await expect(
        makeCkanRequest(
          'http://demo.ckan.org',
          'package_search',
          { q: 'invalid' }
        )
      ).rejects.toThrow();
    });

    it('handles server error', async () => {
      const error = new Error('Internal Server Error') as any;
      error.isAxiosError = true;
      error.response = {
        status: 500,
        data: {
          success: false,
          error: { message: 'Internal server error' }
        }
      };
      vi.mocked(axios.get).mockRejectedValue(error);

      await expect(
        makeCkanRequest(
          'http://demo.ckan.org',
          'package_search',
          { q: 'test' }
        )
      ).rejects.toThrow();
    });
  });

  describe('response structure', () => {
    it('returns properly structured response', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test' }
      );

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('facets');
      expect(typeof result.count).toBe('number');
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.facets).toBe('object');
    });

    it('includes package metadata in results', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_search',
        { q: 'test' }
      );

      if (result.results.length > 0) {
        const pkg = result.results[0];
        expect(pkg).toHaveProperty('id');
        expect(pkg).toHaveProperty('name');
        expect(pkg).toHaveProperty('title');
      }
    });
  });
});

describe('ckan_find_relevant_datasets', () => {
  it('scores datasets with default weights', () => {
    const dataset = packageSearchFixture.result.results[0];

    const result = scoreDatasetRelevance('example dataset', dataset);

    expect(result.total).toBeGreaterThan(0);
    expect(result.breakdown.total).toBe(result.total);
    expect(result.terms).toContain('example');
  });

  it('applies custom weights', () => {
    const dataset = packageSearchFixture.result.results[0];

    const defaultScore = scoreDatasetRelevance('example dataset', dataset);
    const weightedScore = scoreDatasetRelevance('example dataset', dataset, {
      title: 10,
      notes: 0,
      tags: 0,
      organization: 0
    });

    expect(weightedScore.total).toBeGreaterThan(defaultScore.total);
  });
});

describe('ckan_package_show', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('returns package details for valid ID', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('id', 'pkg-1');
      expect(result).toHaveProperty('name', 'example-dataset');
      expect(result).toHaveProperty('title');
    });

    it('includes package metadata', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('maintainer');
      expect(result).toHaveProperty('license_title');
      expect(result).toHaveProperty('metadata_created');
      expect(result).toHaveProperty('metadata_modified');
    });
  });

  describe('resources', () => {
    it('includes resources in package details', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('resources');
      expect(result.resources).toBeInstanceOf(Array);
      expect(result.resources.length).toBeGreaterThan(0);
    });

    it('includes resource metadata', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      if (result.resources && result.resources.length > 0) {
        const resource = result.resources[0];
        expect(resource).toHaveProperty('id');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('url');
        expect(resource).toHaveProperty('format');
      }
    });

    it('handles packages with multiple resources', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result.num_resources).toBeGreaterThanOrEqual(2);
      expect(result.resources.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('organization', () => {
    it('includes organization information', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('organization');
      expect(result.organization).toBeInstanceOf(Object);
      expect(result.organization).toHaveProperty('id');
      expect(result.organization).toHaveProperty('name');
      expect(result.organization).toHaveProperty('title');
    });
  });

  describe('tags', () => {
    it('includes tags in package details', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('tags');
      expect(result.tags).toBeInstanceOf(Array);
    });

    it('includes tag metadata', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      if (result.tags && result.tags.length > 0) {
        const tag = result.tags[0];
        expect(tag).toHaveProperty('name');
        expect(tag).toHaveProperty('id');
      }
    });
  });

  describe('tracking', () => {
    it('supports include_tracking parameter', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        {
          id: 'example-dataset',
          include_tracking: true
        }
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            include_tracking: true
          })
        })
      );
    });

    it('includes tracking summary when requested', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        {
          id: 'example-dataset',
          include_tracking: true
        }
      );

      expect(result).toHaveProperty('tracking_summary');
    });
  });

  describe('error handling', () => {
    it('handles 404 error for invalid package ID', async () => {
      const error = new Error('Not Found') as any;
      error.isAxiosError = true;
      error.response = {
        status: 404,
        data: notFoundError
      };
      vi.mocked(axios.get).mockRejectedValue(error);

      await expect(
        makeCkanRequest(
          'http://demo.ckan.org',
          'package_show',
          { id: 'non-existent-package' }
        )
      ).rejects.toThrow();
    });

    it('handles server error when fetching package', async () => {
      const error = new Error('Internal Server Error') as any;
      error.isAxiosError = true;
      error.response = {
        status: 500,
        data: {
          success: false,
          error: { message: 'Internal server error' }
        }
      };
      vi.mocked(axios.get).mockRejectedValue(error);

      await expect(
        makeCkanRequest(
          'http://demo.ckan.org',
          'package_show',
          { id: 'example-dataset' }
        )
      ).rejects.toThrow();
    });
  });

  describe('response structure', () => {
    it('returns properly structured package response', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('notes');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('resources');
    });

    it('includes optional fields when available', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'http://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('organization');
      expect(result).toHaveProperty('license_title');
      expect(result).toHaveProperty('metadata_created');
      expect(result).toHaveProperty('metadata_modified');
    });
  });
});
