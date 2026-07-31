import { describe, it, expect } from 'vitest';
import { truncateJson, formatError, jsonToolResult, cappedStructured } from '../../src/utils/formatting';

/**
 * The contract under test: whatever the input, the output parses as JSON.
 * See issue #39 — the previous last-resort branch cut the serialized string
 * mid-value and returned it as-is.
 */
describe('truncateJson', () => {
  it('returns pretty JSON when it fits', () => {
    const obj = { count: 2, results: [{ id: 'a' }, { id: 'b' }] };
    const out = truncateJson(obj, 1000);
    expect(JSON.parse(out)).toEqual(obj);
    expect(out).toContain('\n  ');
  });

  it('falls back to compact JSON when pretty overflows but compact fits', () => {
    const obj = { count: 1, results: [{ id: 'a'.repeat(60) }] };
    const pretty = JSON.stringify(obj, null, 2).length;
    const compact = JSON.stringify(obj).length;
    const out = truncateJson(obj, compact + 1);
    expect(compact).toBeLessThan(pretty);
    expect(JSON.parse(out)).toEqual(obj);
    expect(out).not.toContain('\n');
  });

  it('shrinks a known array and flags the truncation', () => {
    const obj = { count: 50, results: Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, pad: 'x'.repeat(100) })) };
    const out = truncateJson(obj, 2000);
    const parsed = JSON.parse(out);
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(parsed.results.length).toBeLessThan(50);
    expect(parsed._truncated).toBe(true);
    expect(parsed._original_count).toBe(50);
  });

  it('stays parseable when a single element already exceeds the limit', () => {
    const obj = { count: 1, results: [{ id: 'a', blob: 'x'.repeat(5000) }] };
    const out = truncateJson(obj, 500);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(out.length).toBeLessThanOrEqual(500);
  });

  it('stays parseable when no shrinkable key is present', () => {
    const obj = { id: 'x', notes: 'n'.repeat(5000) };
    const out = truncateJson(obj, 300);
    const parsed = JSON.parse(out);
    expect(parsed._truncated).toBe(true);
    expect(parsed._error).toMatch(/character limit/);
  });

  it('shrinks rows for SPARQL-shaped payloads', () => {
    const obj = { count: 40, columns: ['s', 'p'], rows: Array.from({ length: 40 }, () => ({ s: 'x'.repeat(80), p: 'y'.repeat(80) })) };
    const out = truncateJson(obj, 1500);
    const parsed = JSON.parse(out);
    expect(parsed.rows.length).toBeLessThan(40);
    expect(parsed.columns).toEqual(['s', 'p']);
  });

  it('sacrifices records before fields on datastore payloads', () => {
    const fields = Array.from({ length: 5 }, (_, i) => ({ id: `col${i}`, type: 'text' }));
    const records = Array.from({ length: 40 }, (_, i) => ({ col0: `v${i}`.repeat(40) }));
    const out = truncateJson({ resource_id: 'r', fields, records, total: 40 }, 1200);
    const parsed = JSON.parse(out);
    expect(parsed.records.length).toBeLessThan(40);
    expect(parsed.fields.length).toBe(5);
  });

  it('respects the limit even when the explanatory fallback does not fit', () => {
    const obj = { id: 'x', blob: 'y'.repeat(1000) };
    for (const limit of [200, 40, 20, 2]) {
      const out = truncateJson(obj, limit);
      expect(() => JSON.parse(out), `limit ${limit}`).not.toThrow();
      expect(out.length, `limit ${limit}`).toBeLessThanOrEqual(limit);
    }
  });

  it('never emits the invalid-JSON tail the old fallback produced', () => {
    const obj = { id: 'x', blob: 'y'.repeat(200000) };
    const out = truncateJson(obj, 1000);
    expect(out).not.toContain('[Response truncated at');
    expect(() => JSON.parse(out)).not.toThrow();
  });
});

/**
 * The cap must apply to both channels: structuredContent used to carry the full
 * untruncated object while the text was capped, making the limit meaningless for
 * any client reading it (issue #39).
 */
describe('jsonToolResult', () => {
  it('returns the object unchanged when it fits', () => {
    const obj = { count: 2, results: [{ id: 'a' }, { id: 'b' }] };
    const res = jsonToolResult(obj, 1000);
    expect(res.structuredContent).toEqual(obj);
    expect(JSON.parse(res.content[0].text)).toEqual(obj);
  });

  it('caps structuredContent, not just the text', () => {
    const obj = { count: 50, results: Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, pad: 'x'.repeat(100) })) };
    const res = jsonToolResult(obj, 2000);
    const structured = res.structuredContent as { results: unknown[]; _truncated: boolean; _original_count: number };
    expect(structured.results.length).toBeLessThan(50);
    expect(structured._truncated).toBe(true);
    expect(structured._original_count).toBe(50);
  });

  it('keeps the two channels identical', () => {
    const obj = { count: 30, records: Array.from({ length: 30 }, (_, i) => ({ v: 'y'.repeat(120), i })) };
    const res = jsonToolResult(obj, 1500);
    expect(res.structuredContent).toEqual(JSON.parse(res.content[0].text));
  });

  it('degrades to a data-less object when nothing fits', () => {
    const res = jsonToolResult({ id: 'x', blob: 'z'.repeat(5000) }, 40);
    expect(res.content[0].text.length).toBeLessThanOrEqual(40);
    expect(res.structuredContent).toEqual(JSON.parse(res.content[0].text));
    expect(res.structuredContent).not.toHaveProperty('blob');
  });
});

/**
 * For tools whose text channel is Markdown: the structured payload has no truncated
 * JSON to derive from, so it is capped on its own. Element count is not a size bound
 * when the field lengths come from upstream.
 */
describe('cappedStructured', () => {
  it('leaves a small payload untouched', () => {
    const obj = { site_title: 'Portal', extensions: ['datastore'] };
    expect(cappedStructured(obj, 1000)).toEqual(obj);
  });

  it('caps a payload whose upstream fields are long, not numerous', () => {
    const obj = { site_title: 'x'.repeat(60000), site_description: 'y'.repeat(60000) };
    const out = cappedStructured(obj, 1000) as Record<string, unknown>;
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(1000);
    expect(out._truncated).toBe(true);
  });

  it('shrinks a bounded-count list whose entries are unbounded in size', () => {
    const portals = Array.from({ length: 50 }, (_, i) => ({ url: `https://p${i}`, title: 't'.repeat(2000) }));
    const out = cappedStructured({ portals }, 5000) as { portals?: unknown[] };
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(5000);
    expect(out.portals?.length ?? 0).toBeLessThan(50);
  });
});

describe('formatError', () => {
  it('returns plain text for markdown callers', () => {
    expect(formatError('boom', false)).toBe('boom');
  });

  it('returns parseable JSON for json callers', () => {
    const parsed = JSON.parse(formatError('boom', true));
    expect(parsed).toEqual({ error: 'boom', _error: true });
  });
});
