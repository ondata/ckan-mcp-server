import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { makeCkanRequest } from '../../src/utils/http';
import packageShowFixture from '../fixtures/responses/package-show-success.json';
import resourceShowFixture from '../fixtures/responses/resource-show-success.json';
import organizationShowFixture from '../fixtures/responses/organization-show-success.json';

vi.mock('axios');

describe('MCP Resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dataset resource', () => {
    it('fetches dataset metadata via package_show', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result).toHaveProperty('id', 'pkg-1');
      expect(result).toHaveProperty('name', 'example-dataset');
      expect(result).toHaveProperty('title', 'Example Dataset');
      expect(result).toHaveProperty('resources');
      expect(result.resources).toBeInstanceOf(Array);
    });

    it('includes organization metadata', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result.organization).toHaveProperty('id');
      expect(result.organization).toHaveProperty('name');
      expect(result.organization).toHaveProperty('title');
    });

    it('includes tags', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'package_show',
        { id: 'example-dataset' }
      );

      expect(result.tags).toBeInstanceOf(Array);
      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.tags[0]).toHaveProperty('name');
    });
  });

  describe('resource resource', () => {
    it('fetches resource metadata via resource_show', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: resourceShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'resource_show',
        { id: 'res-1' }
      );

      expect(result).toHaveProperty('id', 'res-1');
      expect(result).toHaveProperty('name', 'example-resource.csv');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('format', 'CSV');
    });

    it('includes datastore status', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: resourceShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'resource_show',
        { id: 'res-1' }
      );

      expect(result).toHaveProperty('datastore_active', true);
    });

    it('includes file metadata', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: resourceShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'resource_show',
        { id: 'res-1' }
      );

      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('mimetype');
      expect(result).toHaveProperty('hash');
    });
  });

  describe('organization resource', () => {
    it('fetches organization metadata via organization_show', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: organizationShowFixture });

      const result = await makeCkanRequest(
        'https://demo.ckan.org',
        'organization_show',
        { id: 'example-org', include_datasets: false }
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('title');
    });

    it('can exclude datasets from response', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: organizationShowFixture });

      await makeCkanRequest('https://demo.ckan.org', 'organization_show', {
        id: 'example-org',
        include_datasets: false,
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { id: 'example-org', include_datasets: false },
        })
      );
    });
  });

  describe('API calls', () => {
    it('constructs correct URL for package_show', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: packageShowFixture });

      await makeCkanRequest('https://demo.ckan.org', 'package_show', {
        id: 'test-id',
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://demo.ckan.org/api/3/action/package_show',
        expect.any(Object)
      );
    });

    it('constructs correct URL for resource_show', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: resourceShowFixture });

      await makeCkanRequest('https://demo.ckan.org', 'resource_show', {
        id: 'res-id',
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://demo.ckan.org/api/3/action/resource_show',
        expect.any(Object)
      );
    });

    it('constructs correct URL for organization_show', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: organizationShowFixture });

      await makeCkanRequest('https://demo.ckan.org', 'organization_show', {
        id: 'org-name',
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://demo.ckan.org/api/3/action/organization_show',
        expect.any(Object)
      );
    });
  });
});
