import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import axios from 'axios';
import { makeCkanRequest, validateServerUrl } from '../../src/utils/http';
import { __resetCacheForTests } from '../../src/utils/cache';
import successResponse from '../fixtures/responses/status-success.json';

vi.mock('axios');

describe('validateServerUrl', () => {
  it('allows valid http URL', () => {
    expect(() => validateServerUrl('http://demo.ckan.org')).not.toThrow();
  });

  it('allows valid https URL', () => {
    expect(() => validateServerUrl('https://dati.gov.it')).not.toThrow();
  });

  it('blocks non-http/s protocol (file://)', () => {
    expect(() => validateServerUrl('file:///etc/passwd')).toThrow('Disallowed protocol');
  });

  it('blocks non-http/s protocol (ftp://)', () => {
    expect(() => validateServerUrl('ftp://example.com')).toThrow('Disallowed protocol');
  });

  it('blocks localhost', () => {
    expect(() => validateServerUrl('http://localhost/api')).toThrow('not allowed');
  });

  it('blocks loopback 127.0.0.1', () => {
    expect(() => validateServerUrl('http://127.0.0.1')).toThrow('private/internal');
  });

  it('blocks loopback 127.x.x.x range', () => {
    expect(() => validateServerUrl('http://127.0.0.2')).toThrow('private/internal');
  });

  it('blocks AWS metadata 169.254.169.254', () => {
    expect(() => validateServerUrl('http://169.254.169.254/latest/meta-data/')).toThrow('private/internal');
  });

  it('blocks private class A (10.x.x.x)', () => {
    expect(() => validateServerUrl('http://10.0.0.1')).toThrow('private/internal');
  });

  it('blocks private class B (172.16.x.x)', () => {
    expect(() => validateServerUrl('http://172.16.0.1')).toThrow('private/internal');
  });

  it('blocks private class C (192.168.x.x)', () => {
    expect(() => validateServerUrl('http://192.168.1.1')).toThrow('private/internal');
  });

  it('blocks IPv6 loopback ::1', () => {
    expect(() => validateServerUrl('http://[::1]')).toThrow('private/internal');
  });

  it('blocks IPv6 unique local fc00::', () => {
    expect(() => validateServerUrl('http://[fc00::1]')).toThrow('private/internal');
  });

  it('blocks IPv6 link-local fe80::', () => {
    expect(() => validateServerUrl('http://[fe80::1]')).toThrow('private/internal');
  });

  it('throws on invalid URL', () => {
    expect(() => validateServerUrl('not-a-url')).toThrow('Invalid URL');
  });
});

describe('makeCkanRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('makes successful request and returns result', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    const result = await makeCkanRequest(
      'http://demo.ckan.org',
      'ckan_status_show'
    );

    expect(axios.get).toHaveBeenCalledWith(
      'http://demo.ckan.org/api/3/action/ckan_status_show',
      expect.objectContaining({
        params: {},
        timeout: 30000,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Sec-CH-UA': '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
          'Sec-CH-UA-Mobile': '?0',
          'Sec-CH-UA-Platform': '"Linux"',
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
    );

    expect(result).toEqual(successResponse.result);
  });

  it('makes request with parameters', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest(
      'http://demo.ckan.org',
      'package_search',
      { q: 'test', rows: 10 }
    );

    expect(axios.get).toHaveBeenCalledWith(
      'http://demo.ckan.org/api/3/action/package_search',
      expect.objectContaining({
        params: { q: 'test', rows: 10 }
      })
    );
  });

  it('normalizes URL with trailing slash', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest(
      'http://demo.ckan.org/',
      'ckan_status_show'
    );

    expect(axios.get).toHaveBeenCalledWith(
      'http://demo.ckan.org/api/3/action/ckan_status_show',
      expect.any(Object)
    );
  });

  it('resolves portal hostname to api url', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest(
      'https://dati.anticorruzione.it',
      'ckan_status_show'
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://dati.anticorruzione.it/opendata/api/3/action/ckan_status_show',
      expect.any(Object)
    );
  });

  it('includes User-Agent header', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest('http://demo.ckan.org', 'ckan_status_show');

    const axiosCall = vi.mocked(axios.get).mock.calls[0];
    expect(axiosCall[1].headers['User-Agent']).toBe(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  });

  it('throws error when success=false in response', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        success: false,
        error: { message: 'Invalid request' }
      }
    });

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'ckan_status_show')
    ).rejects.toThrow('CKAN API returned success=false');
  });

  it('decodes gzip-compressed buffer payload', async () => {
    const payload = gzipSync(Buffer.from(JSON.stringify(successResponse), 'utf-8'));

    vi.mocked(axios.get).mockResolvedValue({
      data: payload,
      headers: {}
    });

    const result = await makeCkanRequest(
      'http://demo.ckan.org',
      'ckan_status_show'
    );

    expect(result).toEqual(successResponse.result);
  });

  it('decodes brotli-compressed buffer payload', async () => {
    const payload = brotliCompressSync(
      Buffer.from(JSON.stringify(successResponse), 'utf-8')
    );

    vi.mocked(axios.get).mockResolvedValue({
      data: payload,
      headers: { 'content-encoding': 'br' }
    });

    const result = await makeCkanRequest(
      'http://demo.ckan.org',
      'ckan_status_show'
    );

    expect(result).toEqual(successResponse.result);
  });

  it('decodes deflate-compressed buffer payload', async () => {
    const payload = deflateSync(
      Buffer.from(JSON.stringify(successResponse), 'utf-8')
    );

    vi.mocked(axios.get).mockResolvedValue({
      data: payload,
      headers: { 'content-encoding': 'deflate' }
    });

    const result = await makeCkanRequest(
      'http://demo.ckan.org',
      'ckan_status_show'
    );

    expect(result).toEqual(successResponse.result);
  });

  it('throws CKAN API error with status and message from response', async () => {
    const axiosError = {
      response: {
        status: 400,
        data: { error: { message: 'Bad request' } }
      }
    };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockRejectedValue(axiosError);

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'ckan_status_show')
    ).rejects.toThrow('CKAN API error (400): Bad request');
  });

  it('throws timeout error when request exceeds timeout', async () => {
    const axiosError = { code: 'ECONNABORTED' };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockRejectedValue(axiosError);

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'ckan_status_show')
    ).rejects.toThrow('Request timeout connecting to http://demo.ckan.org');
  });

  it('throws not found error when server cannot be resolved', async () => {
    const axiosError = { code: 'ENOTFOUND' };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockRejectedValue(axiosError);

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'ckan_status_show')
    ).rejects.toThrow('Server not found: http://demo.ckan.org');
  });

  it('throws network error for other axios errors', async () => {
    const axiosError = { message: 'Socket hang up' };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockRejectedValue(axiosError);

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'ckan_status_show')
    ).rejects.toThrow('Network error: Socket hang up');
  });

  it('rethrows non-axios errors', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    vi.mocked(axios.get).mockRejectedValue(new Error('Unexpected failure'));

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'ckan_status_show')
    ).rejects.toThrow('Unexpected failure');
  });

  it('uses correct timeout setting', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest('http://demo.ckan.org', 'ckan_status_show');

    const axiosCall = vi.mocked(axios.get).mock.calls[0];
    expect(axiosCall[1].timeout).toBe(30000);
  });
});

describe('makeCkanRequest cache integration', () => {
  const originalEnv = process.env.CKAN_CACHE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCacheForTests();
    process.env.CKAN_CACHE_ENABLED = 'true';
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.CKAN_CACHE_ENABLED;
    else process.env.CKAN_CACHE_ENABLED = originalEnv;
    __resetCacheForTests();
  });

  it('serves identical calls from cache after first miss', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest('http://demo.ckan.org', 'status_show');
    await makeCkanRequest('http://demo.ckan.org', 'status_show');

    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1);
  });

  it('treats different params as separate entries', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest('http://demo.ckan.org', 'package_search', { q: 'a' });
    await makeCkanRequest('http://demo.ckan.org', 'package_search', { q: 'b' });

    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2);
  });

  it('does not cache success=false responses', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { success: false, error: { message: 'bad' } }
    });

    await expect(
      makeCkanRequest('http://demo.ckan.org', 'status_show')
    ).rejects.toThrow();
    await expect(
      makeCkanRequest('http://demo.ckan.org', 'status_show')
    ).rejects.toThrow();

    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2);
  });

  it('does not cache when opts.cache=false', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest('http://demo.ckan.org', 'status_show', {}, { cache: false });
    await makeCkanRequest('http://demo.ckan.org', 'status_show', {}, { cache: false });

    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2);
  });

  it('bypasses cache read when opts.cache=false even if entry exists', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    await makeCkanRequest('http://demo.ckan.org', 'status_show');
    await makeCkanRequest('http://demo.ckan.org', 'status_show', {}, { cache: false });

    expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2);
  });
});

describe('validateServerUrl — CKAN_ALLOWED_DOMAINS', () => {
  const origEnv = process.env.CKAN_ALLOWED_DOMAINS;

  afterEach(() => {
    if (origEnv === undefined) delete process.env.CKAN_ALLOWED_DOMAINS;
    else process.env.CKAN_ALLOWED_DOMAINS = origEnv;
  });

  it('allows any domain when env var is unset', () => {
    delete process.env.CKAN_ALLOWED_DOMAINS;
    expect(() => validateServerUrl('https://data.gov.uk')).not.toThrow();
  });

  it('allows domain present in the list', () => {
    process.env.CKAN_ALLOWED_DOMAINS = 'dati.gov.it,demo.ckan.org';
    expect(() => validateServerUrl('https://dati.gov.it')).not.toThrow();
  });

  it('blocks domain not in the list', () => {
    process.env.CKAN_ALLOWED_DOMAINS = 'dati.gov.it';
    expect(() => validateServerUrl('https://data.gov.uk')).toThrow('not in the allowed list');
  });

  it('ignores empty entries (trailing/leading commas)', () => {
    process.env.CKAN_ALLOWED_DOMAINS = ',dati.gov.it,';
    expect(() => validateServerUrl('https://dati.gov.it')).not.toThrow();
  });
});

describe('audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCacheForTests();
  });

  it('writes JSON log to stderr after successful HTTP request', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await makeCkanRequest('http://demo.ckan.org', 'package_search', { q: 'test', rows: 5 });

    expect(writeSpy).toHaveBeenCalledOnce();
    const line = String(writeSpy.mock.calls[0][0]).trim();
    const log = JSON.parse(line);
    expect(log).toMatchObject({
      server: 'http://demo.ckan.org',
      action: 'package_search',
      q: 'test',
      rows: 5,
      cache_hit: false
    });
    expect(typeof log.ts).toBe('string');
    writeSpy.mockRestore();
  });

  it('logs cache_hit=true when served from cache', async () => {
    process.env.CKAN_CACHE_ENABLED = 'true';
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });

    // First call — cache miss
    await makeCkanRequest('http://demo.ckan.org', 'status_show');

    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Second call — cache hit
    await makeCkanRequest('http://demo.ckan.org', 'status_show');

    expect(writeSpy).toHaveBeenCalledOnce();
    const log = JSON.parse(String(writeSpy.mock.calls[0][0]).trim());
    expect(log.cache_hit).toBe(true);
    writeSpy.mockRestore();
    delete process.env.CKAN_CACHE_ENABLED;
  });

  it('truncates sql field to 200 chars in log', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: successResponse });
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const longSql = 'SELECT * FROM "abc" WHERE ' + 'x=1 AND '.repeat(30);
    await makeCkanRequest('http://demo.ckan.org', 'datastore_search_sql', { sql: longSql });

    const log = JSON.parse(String(writeSpy.mock.calls[0][0]).trim());
    expect((log.sql as string).length).toBeLessThanOrEqual(200);
    writeSpy.mockRestore();
  });
});
