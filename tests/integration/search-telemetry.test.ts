import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerPackageTools } from '../../src/tools/package';
import {
  recordSearchResults,
  takeSearchResults,
  SEARCH_TELEMETRY_MAX_RESULTS
} from '../../src/utils/search-telemetry';
import packageSearchFixture from '../fixtures/responses/package-search-success.json';

vi.mock('axios');

const SERVER_URL = 'https://www.dati.gov.it/opendata';

async function connect() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerPackageTools(server);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe('search telemetry side channel', () => {
  it('caps results and clears after take', () => {
    const key = {};
    const datasets = Array.from({ length: 30 }, (_, i) => ({ id: `id-${i}`, name: `name-${i}` }));
    recordSearchResults(key, 30, 10, datasets);

    const taken = takeSearchResults(key);
    expect(taken?.result_count).toBe(30);
    expect(taken?.result_start).toBe(10);
    expect(taken?.result_ids).toHaveLength(SEARCH_TELEMETRY_MAX_RESULTS);
    expect(taken?.result_names[0]).toBe('name-0');
    expect(takeSearchResults(key)).toBeNull();
  });

  it('keeps instances separate', () => {
    const a = {};
    const b = {};
    recordSearchResults(a, 1, 0, [{ id: 'a', name: 'a' }]);
    expect(takeSearchResults(b)).toBeNull();
    expect(takeSearchResults(a)?.result_ids).toEqual(['a']);
  });
});

describe('search tools record returned datasets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ckan_package_search records ids, names, count and start', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });
    const { server, client } = await connect();

    await client.callTool({
      name: 'ckan_package_search',
      arguments: { server_url: SERVER_URL, q: 'example', page: 2, page_size: 2 }
    });

    expect(takeSearchResults(server)).toEqual({
      result_count: 100,
      result_start: 2,
      result_ids: ['pkg-1', 'pkg-2'],
      result_names: ['example-dataset', 'another-dataset']
    });
  });

  it('ckan_package_search records zero results', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { success: true, result: { count: 0, results: [], facets: {} } }
    });
    const { server, client } = await connect();

    await client.callTool({
      name: 'ckan_package_search',
      arguments: { server_url: SERVER_URL, q: 'zzqxnonesiste' }
    });

    expect(takeSearchResults(server)).toMatchObject({ result_count: 0, result_ids: [], result_names: [] });
  });

  it('ckan_find_relevant_datasets records the ranked datasets', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: packageSearchFixture });
    const { server, client } = await connect();

    await client.callTool({
      name: 'ckan_find_relevant_datasets',
      arguments: { server_url: SERVER_URL, query: 'example dataset', limit: 5 }
    });

    const taken = takeSearchResults(server);
    expect(taken?.result_count).toBe(100);
    expect(taken?.result_start).toBe(0);
    expect([...(taken?.result_ids ?? [])].sort()).toEqual(['pkg-1', 'pkg-2']);
    expect(taken?.result_names).toHaveLength(2);
  });
});
