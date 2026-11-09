import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateServerUrl,
  isBlockedIp,
  isPrivateHostAllowed,
  createSsrfSafeLookup,
  assertHostnameResolvesSafe,
  assertRedirectKeepsPrivateExemption,
  warnIfPrivateHostsOverHttp,
  __setDnsResolverForTests,
  SsrfGuardError
} from '../../src/utils/http';

describe('CKAN_PRIVATE_HOSTS', () => {
  const origPrivate = process.env.CKAN_PRIVATE_HOSTS;
  const origAllowed = process.env.CKAN_ALLOWED_DOMAINS;

  beforeEach(() => {
    delete process.env.CKAN_PRIVATE_HOSTS;
    delete process.env.CKAN_ALLOWED_DOMAINS;
  });
  afterEach(() => {
    if (origPrivate === undefined) delete process.env.CKAN_PRIVATE_HOSTS; else process.env.CKAN_PRIVATE_HOSTS = origPrivate;
    if (origAllowed === undefined) delete process.env.CKAN_ALLOWED_DOMAINS; else process.env.CKAN_ALLOWED_DOMAINS = origAllowed;
    __setDnsResolverForTests(null);
  });

  const resolveTo = (address: string) => (_h: string, _o: any, cb: any) => cb(null, [{ address, family: address.includes(':') ? 6 : 4 }]);
  const lookupOf = (hostname: string, address: string) =>
    new Promise<string>((resolve, reject) =>
      createSsrfSafeLookup({ lookup: resolveTo(address) })(hostname, {}, (err: any, addr: any) => (err ? reject(err) : resolve(addr))));

  it('is off by default: localhost and private literals stay blocked', () => {
    expect(isPrivateHostAllowed('localhost')).toBe(false);
    expect(() => validateServerUrl('http://localhost:5003')).toThrow(SsrfGuardError);
    expect(() => validateServerUrl('http://192.168.1.5')).toThrow(SsrfGuardError);
  });

  it('opens exactly the listed host names', () => {
    process.env.CKAN_PRIVATE_HOSTS = 'localhost, ckan.intra.example , 10.1.2.3';
    expect(() => validateServerUrl('http://localhost:5003')).not.toThrow();
    expect(() => validateServerUrl('https://CKAN.intra.example')).not.toThrow();
    expect(() => validateServerUrl('http://10.1.2.3')).not.toThrow();
    expect(() => validateServerUrl('http://10.1.2.4')).toThrow(SsrfGuardError);
    expect(() => validateServerUrl('http://127.0.0.1')).toThrow(SsrfGuardError);
    expect(() => validateServerUrl('http://other.intra.example')).not.toThrow();
  });

  it('opens a listed IPv6 loopback literal but not other IPv6 literals', () => {
    process.env.CKAN_PRIVATE_HOSTS = '[::1]';
    expect(() => validateServerUrl('http://[::1]:5003')).not.toThrow();
    expect(() => validateServerUrl('http://[fe80::1]')).toThrow(SsrfGuardError);
  });

  it('never opens link-local, cloud metadata, 0.0.0.0, shared or multicast, even when listed', () => {
    process.env.CKAN_PRIVATE_HOSTS = '169.254.169.254,0.0.0.0,100.64.0.1,224.0.0.1,[fe80::1],[64:ff9b::a9fe:a9fe]';
    for (const url of [
      'http://169.254.169.254/', 'http://0.0.0.0/', 'http://100.64.0.1/', 'http://224.0.0.1/',
      'http://[fe80::1]/', 'http://[64:ff9b::a9fe:a9fe]/'
    ]) {
      expect(() => validateServerUrl(url)).toThrow(SsrfGuardError);
    }
  });

  it('isBlockedIp only relaxes loopback, RFC 1918 and unique-local when asked', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '::1', 'fd00::1']) {
      expect(isBlockedIp(ip)).toBe(true);
      expect(isBlockedIp(ip, true)).toBe(false);
    }
    for (const ip of ['169.254.169.254', '0.0.0.0', '100.64.0.1', '198.18.0.1', '224.0.0.1', 'fe80::1', 'ff02::1', '::ffff:7f00:1']) {
      expect(isBlockedIp(ip, true)).toBe(true);
    }
  });

  it('keeps CKAN_ALLOWED_DOMAINS in force for a listed host', () => {
    process.env.CKAN_PRIVATE_HOSTS = 'localhost';
    process.env.CKAN_ALLOWED_DOMAINS = 'www.dati.gov.it';
    expect(() => validateServerUrl('http://localhost:5003')).toThrow('allowed list');
  });

  it('lets a listed host resolve to a private address, and nobody else', async () => {
    process.env.CKAN_PRIVATE_HOSTS = 'ckan.intra.example';
    await expect(lookupOf('ckan.intra.example', '10.0.0.7')).resolves.toBe('10.0.0.7');
    await expect(lookupOf('evil.example', '10.0.0.7')).rejects.toThrow('private/internal');
  });

  it('still refuses a listed host that resolves to the metadata address', async () => {
    process.env.CKAN_PRIVATE_HOSTS = 'ckan.intra.example';
    await expect(lookupOf('ckan.intra.example', '169.254.169.254')).rejects.toThrow('private/internal');
  });

  it('does not relax the fetch path, so sparql_query stays closed to private hosts', async () => {
    process.env.CKAN_PRIVATE_HOSTS = 'ckan.intra.example,localhost,192.168.1.10';
    __setDnsResolverForTests(async () => [{ address: '192.168.1.9', family: 4 }]);
    await expect(assertHostnameResolvesSafe('ckan.intra.example')).rejects.toBeInstanceOf(SsrfGuardError);
    __setDnsResolverForTests(async () => [{ address: '127.0.0.1', family: 4 }]);
    await expect(assertHostnameResolvesSafe('localhost')).rejects.toBeInstanceOf(SsrfGuardError);
    __setDnsResolverForTests(async () => [{ address: '192.168.1.10', family: 4 }]);
    await expect(assertHostnameResolvesSafe('192.168.1.10')).rejects.toBeInstanceOf(SsrfGuardError);
  });

  it('opens a listed IP literal, and keeps a listed metadata address blocked', () => {
    process.env.CKAN_PRIVATE_HOSTS = '192.168.1.10,169.254.169.254';
    expect(() => validateServerUrl('http://192.168.1.10:5000')).not.toThrow();
    expect(() => validateServerUrl('http://169.254.169.254/latest/meta-data/')).toThrow(SsrfGuardError);
  });

  describe('redirects', () => {
    it('refuses a redirect from a host that is not listed to a listed one', () => {
      process.env.CKAN_PRIVATE_HOSTS = 'localhost,ckan.intra.example';
      expect(() => assertRedirectKeepsPrivateExemption('www.dati.gov.it', 'http://localhost:5003/x')).toThrow(SsrfGuardError);
      expect(() => assertRedirectKeepsPrivateExemption('www.dati.gov.it', 'https://CKAN.intra.example/')).toThrow('not allowed');
    });

    it('allows a redirect between listed hosts, and leaves other hops to validateServerUrl', () => {
      process.env.CKAN_PRIVATE_HOSTS = 'localhost,ckan.intra.example';
      expect(() => assertRedirectKeepsPrivateExemption('localhost', 'https://ckan.intra.example/')).not.toThrow();
      expect(() => assertRedirectKeepsPrivateExemption('localhost', 'https://www.dati.gov.it/')).not.toThrow();
      expect(() => assertRedirectKeepsPrivateExemption('www.dati.gov.it', 'https://www.example.org/')).not.toThrow();
      expect(() => validateServerUrl('http://192.168.1.99/')).toThrow(SsrfGuardError);
    });

    it('does nothing when no host is listed', () => {
      expect(() => assertRedirectKeepsPrivateExemption('www.dati.gov.it', 'https://www.example.org/')).not.toThrow();
    });
  });

  describe('startup warning for the HTTP transport', () => {
    it('names the listed hosts when CKAN_PRIVATE_HOSTS is set', () => {
      process.env.CKAN_PRIVATE_HOSTS = 'localhost, ckan.intra.example';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        warnIfPrivateHostsOverHttp();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(String(spy.mock.calls[0][0])).toContain('localhost, ckan.intra.example');
        expect(String(spy.mock.calls[0][0])).toContain('every client');
      } finally {
        spy.mockRestore();
      }
    });

    it('is silent when nothing is listed', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        warnIfPrivateHostsOverHttp();
        process.env.CKAN_PRIVATE_HOSTS = ' , ';
        warnIfPrivateHostsOverHttp();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
