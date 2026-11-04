import { describe, it, expect } from 'vitest';
import { extractCkanErrorMessage } from '../../src/utils/http.js';

// Real bodies, 2026-11-04: dati.comune.messina.it (409) and donneesquebec.ca (403).
describe('extractCkanErrorMessage', () => {
  it('reads a CKAN error message', () => {
    const body = { success: false, error: { __type: 'Authorization Error', message: 'Accès non autorisé: Not authorized to call function NULLIF' } };
    expect(extractCkanErrorMessage(body)).toBe('Accès non autorisé: Not authorized to call function NULLIF');
  });

  it('reads a validation error, which has no message, on one line', () => {
    const body = { success: false, error: { __type: 'Validation Error', query: ['(psycopg2.errors.UndefinedColumn) column "colonna_inesistente" does not exist\nLINE 1: ...'] } };
    expect(extractCkanErrorMessage(body)).toBe('query: (psycopg2.errors.UndefinedColumn) column "colonna_inesistente" does not exist LINE 1: ...');
  });

  it('caps the message at 300 characters and says how much was cut', () => {
    const body = { success: false, error: { message: 'x'.repeat(1000) } };
    expect(extractCkanErrorMessage(body)).toBe(`${'x'.repeat(300)}… [700 more characters from the portal omitted]`);
  });

  it('returns null for anything that is not a CKAN error body', () => {
    // GHSA-6f9w: an arbitrary upstream body must not be reflected to the caller.
    expect(extractCkanErrorMessage('<!DOCTYPE html><title>Just a moment...</title>')).toBeNull();
    expect(extractCkanErrorMessage({ error: { message: 'no success flag' } })).toBeNull();
    expect(extractCkanErrorMessage({ success: true, result: {} })).toBeNull();
    expect(extractCkanErrorMessage(null)).toBeNull();
  });
});
