import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { formatAnalyzeDatasetsMarkdown, formatCatalogStatsMarkdown } from '../../src/tools/analyze';
import searchFixture from '../fixtures/responses/analyze-datasets-search.json';
import schemaFixture from '../fixtures/responses/analyze-datasets-schema.json';
import catalogStatsFixture from '../fixtures/responses/catalog-stats.json';

vi.mock('axios');

describe('ckan_analyze_datasets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatAnalyzeDatasetsMarkdown', () => {
    const serverUrl = 'https://dati.comune.messina.it';
    const query = 'ordinanze';

    it('includes server and query info in header', () => {
      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 42, []);
      expect(result).toContain('**Server**: https://dati.comune.messina.it');
      expect(result).toContain('**Query**: ordinanze');
      expect(result).toContain('**Total datasets found**: 42');
    });

    it('renders DataStore resource with field schema', () => {
      const datasets = [{
        dataset: {
          id: 'pkg-1',
          name: 'ordinanze-viabili',
          title: 'Ordinanze Viabili',
          organization: { name: 'comune-messina', title: 'Comune di Messina' },
          resources: []
        },
        datastoreResources: [{
          resource: { id: 'res-ds-1', name: 'Ordinanze viabili', format: 'CSV' },
          schema: {
            total: 2222,
            fields: [
              { id: '_id', type: 'int' },
              { id: 'numero', type: 'numeric', info: { label: 'Numero ordinanza', notes: 'Numero progressivo' } },
              { id: 'tipo', type: 'text' }
            ]
          }
        }],
        nonDatastoreResources: []
      }];

      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 1, datasets);
      expect(result).toContain('Ordinanze Viabili');
      expect(result).toContain('**Total Records**: 2222');
      expect(result).toContain('`numero` (numeric) — Numero ordinanza: Numero progressivo');
      expect(result).toContain('`tipo` (text)');
      expect(result).not.toContain('`_id`');
    });

    it('renders label without notes when notes is empty', () => {
      const datasets = [{
        dataset: { id: 'pkg-1', name: 'test', title: 'Test', resources: [] },
        datastoreResources: [{
          resource: { id: 'res-1', name: 'Resource' },
          schema: {
            total: 10,
            fields: [{ id: 'tipo', type: 'text', info: { label: 'Tipo', notes: '', type_override: '' } }]
          }
        }],
        nonDatastoreResources: []
      }];

      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 1, datasets);
      expect(result).toContain('`tipo` (text) — Tipo');
      expect(result).not.toMatch(/`tipo` \(text\) — Tipo:/);
    });

    it('renders field without info when info is absent', () => {
      const datasets = [{
        dataset: { id: 'pkg-1', name: 'test', title: 'Test', resources: [] },
        datastoreResources: [{
          resource: { id: 'res-1' },
          schema: {
            total: 5,
            fields: [{ id: 'sintesi', type: 'text' }]
          }
        }],
        nonDatastoreResources: []
      }];

      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 1, datasets);
      expect(result).toContain('`sintesi` (text)');
    });

    it('renders non-DataStore resources in separate section', () => {
      const datasets = [{
        dataset: { id: 'pkg-1', name: 'test', title: 'Test', resources: [] },
        datastoreResources: [],
        nonDatastoreResources: [{ name: 'Documentazione', format: 'PDF' }]
      }];

      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 1, datasets);
      expect(result).toContain('### Other Resources (not queryable)');
      expect(result).toContain('Documentazione (PDF)');
    });

    it('renders error message for failed DataStore introspection', () => {
      const datasets = [{
        dataset: { id: 'pkg-1', name: 'test', title: 'Test', resources: [] },
        datastoreResources: [{
          resource: { id: 'res-1', name: 'Broken Resource' },
          schema: null,
          error: 'CKAN API error (404): Not found'
        }],
        nonDatastoreResources: []
      }];

      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 1, datasets);
      expect(result).toContain('**Error**: CKAN API error (404): Not found');
    });

    it('shows no resources message when dataset has none', () => {
      const datasets = [{
        dataset: { id: 'pkg-1', name: 'test', title: 'Empty Dataset', resources: [] },
        datastoreResources: [],
        nonDatastoreResources: []
      }];

      const result = formatAnalyzeDatasetsMarkdown(serverUrl, query, 1, datasets);
      expect(result).toContain('_No resources available._');
    });
  });

  describe('HTTP integration', () => {
    it('calls package_search then datastore_search for DataStore resources', async () => {
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: searchFixture })
        .mockResolvedValueOnce({ data: schemaFixture });

      const { makeCkanRequest } = await import('../../src/utils/http');

      const search = await makeCkanRequest('https://dati.comune.messina.it', 'package_search', { q: 'ordinanze', rows: 2 });
      expect(search).toHaveProperty('count', 42);
      expect(search.results).toHaveLength(2);
      expect(search.results[0].resources[0].datastore_active).toBe(true);

      const schema = await makeCkanRequest('https://dati.comune.messina.it', 'datastore_search', { resource_id: 'res-ds-1', limit: 0 });
      expect(schema).toHaveProperty('total', 2222);
      expect(schema.fields).toHaveLength(5);
    });

    it('field info.label and info.notes are present in schema fixture', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: schemaFixture });

      const { makeCkanRequest } = await import('../../src/utils/http');
      const schema = await makeCkanRequest('https://dati.comune.messina.it', 'datastore_search', { resource_id: 'res-ds-1', limit: 0 });

      const numeroField = schema.fields.find((f: { id: string }) => f.id === 'numero');
      expect(numeroField).toBeDefined();
      expect(numeroField.info?.label).toBe('Numero ordinanza');
      expect(numeroField.info?.notes).toBe("Numero progressivo dell'ordinanza viabile");

      const sintesiField = schema.fields.find((f: { id: string }) => f.id === 'sintesi');
      expect(sintesiField?.info).toBeUndefined();
    });
  });
});

describe('ckan_catalog_stats', () => {
  const serverUrl = 'https://dati.comune.messina.it';
  const { facets } = catalogStatsFixture.result;

  describe('formatCatalogStatsMarkdown', () => {
    it('includes server and total count', () => {
      const result = formatCatalogStatsMarkdown(serverUrl, 104, facets);
      expect(result).toContain('**Server**: https://dati.comune.messina.it');
      expect(result).toContain('**Total datasets**: 104');
    });

    it('renders Categories section sorted by count', () => {
      const result = formatCatalogStatsMarkdown(serverUrl, 104, facets);
      expect(result).toContain('## Categories');
      expect(result).toContain('**governo**: 46');
      const govIdx = result.indexOf('**governo**');
      const socIdx = result.indexOf('**societa**');
      expect(govIdx).toBeLessThan(socIdx);
    });

    it('renders Formats section', () => {
      const result = formatCatalogStatsMarkdown(serverUrl, 104, facets);
      expect(result).toContain('## Formats');
      expect(result).toContain('**CSV**: 89');
    });

    it('renders Organizations section', () => {
      const result = formatCatalogStatsMarkdown(serverUrl, 104, facets);
      expect(result).toContain('## Organizations');
      expect(result).toContain('**comune-di-messina**: 91');
    });

    it('omits section when facet field is missing', () => {
      const partialFacets = { res_format: facets.res_format };
      const result = formatCatalogStatsMarkdown(serverUrl, 104, partialFacets);
      expect(result).not.toContain('## Categories');
      expect(result).not.toContain('## Organizations');
      expect(result).toContain('## Formats');
    });

    it('omits section when facet field is empty', () => {
      const emptyFacets = { ...facets, groups: {} };
      const result = formatCatalogStatsMarkdown(serverUrl, 104, emptyFacets);
      expect(result).not.toContain('## Categories');
    });
  });
});
