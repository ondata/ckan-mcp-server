import { describe, it, expect, vi, beforeEach } from 'vitest';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import axios from 'axios';
import { makeCkanRequest, validateServerUrl } from '../../src/utils/http';
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
