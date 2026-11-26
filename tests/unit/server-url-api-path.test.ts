// A `server_url` copied with the API path (`.../api/3/action`) must not get the path
// appended a second time: 5 of 6 such calls on the Worker answered 404 (Nov 2026).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { makeCkanRequest } from '../../src/utils/http';
import { __resetCacheForTests } from '../../src/utils/cache';
import { stripApiPath, getPortalActionBase } from '../../src/utils/portal-config';
import { getDatasetViewUrl } from '../../src/utils/url-generator';

vi.mock('axios');

describe('stripApiPath', () => {
  it.each([
    ['https://ckan.example.org/data/api/3/action', 'https://ckan.example.org/data'],
    ['https://ckan.example.org/data/api/3/action/', 'https://ckan.example.org/data'],
    ['https://ckan.example.org/api/3', 'https://ckan.example.org'],
    ['https://ckan.example.org/katalog/api/', 'https://ckan.example.org/katalog'],
    ['https://ckan.example.org/API/3/Action', 'https://ckan.example.org'],
  ])('%s -> %s', (input, expected) => {
    expect(stripApiPath(input)).toBe(expected);
  });

  it('leaves a portal URL alone', () => {
    expect(stripApiPath('https://ckan.example.org/data/')).toBe('https://ckan.example.org/data/');
    expect(stripApiPath('https://ckan.example.org/apiportal')).toBe('https://ckan.example.org/apiportal');
  });
});

describe('server_url with the API path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCacheForTests();
  });

  it('calls the action once, not under a doubled API path', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { success: true, result: { count: 0, results: [] } } });

    await makeCkanRequest('https://ckan.example.org/data/api/3/action', 'package_search', { q: 'x' });

    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('https://ckan.example.org/data/api/3/action/package_search');
  });

  it('builds links from the portal root', () => {
    expect(getPortalActionBase('https://ckan.example.org/data/api/3/action')).toBe('https://ckan.example.org/data/api/3/action');
    expect(getDatasetViewUrl('https://ckan.example.org/data/api/3', { id: '1', name: 'd' })).toBe('https://ckan.example.org/data/dataset/d');
  });
});
