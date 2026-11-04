import { describe, expect, it } from 'vitest';

import type { LimitEntry } from '../../scripts/lib/js-budget';
import {
  ANONYMOUS,
  checkTarget,
  checkTargets,
  failedRows,
  formatBytes,
  headline,
  rowsAsMarkdown,
  rowsAsText,
  type Observation,
  type PageFetcher,
  type Viewer,
} from '../../scripts/lib/js-budget-check';
import type { RouteTarget } from '../../scripts/lib/js-budget-routes';

/** STORY-10.10 AC-1 (viewers, largest total, table) and AC-2 (every way a route can fail). Invented pages and files. */

const FILE_A = 'console.log("a");\n'.repeat(2_000);
const FILE_B = 'console.log("bbbbbb");\n'.repeat(5_000);
const files = new Map<string, string>([
  ['chunks/a.js', FILE_A],
  ['chunks/b.js', FILE_B],
]);
const read = (relative: string): Uint8Array | undefined => {
  const text = files.get(relative);
  return text === undefined ? undefined : Buffer.from(text);
};
const htmlOf = (...names: string[]): string => `<html><head>${names.map((name) => `<script src="/_next/static/chunks/${name}.js"></script>`).join('')}</head></html>`;

const page = (status: number, html = ''): Observation => ({ status, html });
const redirect = (location = '/sign-in?callbackUrl=%2Fqueue'): Observation => ({ status: 307, html: '', location });

/** A fetcher that answers from a table keyed by `<viewer> <path>` and records every request. */
function fetcherOf(answers: Record<string, Observation | Error>): { fetchPage: PageFetcher; calls: string[] } {
  const calls: string[] = [];
  const fetchPage: PageFetcher = async (path, viewer: Viewer) => {
    const key = `${viewer.name} ${path}`;
    calls.push(key);
    const answer = answers[key];
    if (answer === undefined) throw new Error(`no answer planned for ${key}`);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetchPage, calls };
}

const target = (overrides: Partial<RouteTarget> = {}): RouteTarget => ({ route: '/queue', kind: 'page', path: '/queue', roles: ['ADMIN'], ...overrides });

describe('checkTarget: a page that needs no sign-in', () => {
  it('measures it as the anonymous viewer and never signs in', async () => {
    const { fetchPage, calls } = fetcherOf({ 'anonymous /sign-in': page(200, htmlOf('a')) });
    const row = await checkTarget(target({ route: '/sign-in', path: '/sign-in' }), fetchPage, { read });
    expect(calls).toEqual(['anonymous /sign-in']);
    expect(row).toMatchObject({ route: '/sign-in', ok: true, viewer: 'anonymous', files: 1, rawBytes: FILE_A.length, limit: 200_000 });
    expect(row.headroom).toBe(200_000 - (row.gzipBytes ?? 0));
  });
});

describe('checkTarget: a page that needs sign-in', () => {
  it('is requested as every role allowed on it, and the largest total counts', async () => {
    const { fetchPage, calls } = fetcherOf({
      'anonymous /queue': redirect(),
      'LEAD /queue': page(200, htmlOf('a')),
      'ADMIN /queue': page(200, htmlOf('a', 'b')),
    });
    const row = await checkTarget(target({ roles: ['LEAD', 'ADMIN'] }), fetchPage, { read });
    expect(calls).toEqual(['anonymous /queue', 'LEAD /queue', 'ADMIN /queue']);
    expect(row).toMatchObject({ ok: true, viewer: 'ADMIN', files: 2, rawBytes: FILE_A.length + FILE_B.length });
  });

  it('fails when a role is sent away instead of seeing the page, naming the role and the path but not the return address', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': redirect(), 'ADMIN /queue': redirect('/change-password?next=%2Fqueue&secret=1') });
    const row = await checkTarget(target(), fetchPage, { read });
    expect(row.ok).toBe(false);
    expect(row.note).toBe('ADMIN got a redirect (HTTP 307 to /change-password), not HTTP 200');
    expect(row.note).not.toContain('secret');
  });

  it('fails when the route needs sign-in and no role is allowed on it', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': redirect() });
    expect(await checkTarget(target({ roles: [] }), fetchPage, { read })).toMatchObject({ ok: false, note: 'the route needs sign-in and no role is allowed on it' });
  });
});

describe('checkTarget: AC-2, a route that fails is named with its reason', () => {
  it.each([
    ['answers 500', page(500, htmlOf('a')), 'anonymous got HTTP 500, not HTTP 200'],
    ['answers 404 though it is a page of the product', page(404, htmlOf('a')), 'anonymous got HTTP 404, not HTTP 200'],
    ['answers 204 with no content', page(204), 'anonymous got HTTP 204, not HTTP 200'],
  ])('a route that %s', async (_label, answer, note) => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': answer });
    expect(await checkTarget(target(), fetchPage, { read })).toMatchObject({ route: '/queue', ok: false, note });
  });

  it('a route that cannot be reached', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': new Error('fetch failed') });
    expect(await checkTarget(target(), fetchPage, { read })).toMatchObject({ ok: false, note: 'the request did not complete: fetch failed' });
  });

  it('a route whose sign-in is refused', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': redirect(), 'ADMIN /queue': new Error('sign-in was refused: the portal answered HTTP 200 and started no session') });
    expect(await checkTarget(target(), fetchPage, { read })).toMatchObject({ ok: false });
  });

  it('a route with a script that is not in .next/static, naming the viewer and the file', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': page(200, htmlOf('a', 'missing')) });
    const row = await checkTarget(target(), fetchPage, { read });
    expect(row).toMatchObject({ ok: false });
    expect(row.note).toBe('anonymous: the script /_next/static/chunks/missing.js is not in .next/static');
  });

  it('a route with no request path, such as a dynamic route with no record', async () => {
    const { fetchPage, calls } = fetcherOf({});
    const row = await checkTarget(target({ route: '/estimates/[id]', problem: 'a dynamic segment needs a record made from invented data, and none could be made' }), fetchPage, { read });
    expect(calls).toEqual([]);
    expect(row).toMatchObject({ ok: false, route: '/estimates/[id]' });
    expect((await checkTarget({ route: '/x', kind: 'page', roles: [] }, fetchPage, { read })).note).toBe('the route has no request path');
  });
});

describe('checkTarget: over the limit (the planted overrun, a negative control)', () => {
  const lowered: Record<string, LimitEntry> = {
    '/queue': { limitBytes: 100, decision: 'DL-999', lighthouseRun: 'invented-run', lighthouseResult: 'missed' },
  };

  it('fails a route whose total is over its limit and says by how much', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': page(200, htmlOf('a', 'b')) });
    const row = await checkTarget(target(), fetchPage, { read, limits: lowered });
    expect(row.ok).toBe(false);
    expect(row.limit).toBe(100);
    expect(row.headroom).toBeLessThan(0);
    expect(row.note).toBe(`over its limit by ${formatBytes(-(row.headroom ?? 0))} bytes`);
  });

  it('passes the same page against the default limit, so the failure is the lowered limit and nothing else', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': page(200, htmlOf('a', 'b')) });
    expect(await checkTarget(target(), fetchPage, { read })).toMatchObject({ ok: true, limit: 200_000 });
  });

  it('passes a total exactly at the limit and fails one byte over', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /queue': page(200, htmlOf('a')) });
    const total = (await checkTarget(target(), fetchPage, { read })).gzipBytes ?? 0;
    const limitOf = (limitBytes: number): Record<string, LimitEntry> => ({ '/queue': { limitBytes, decision: 'DL-999', lighthouseRun: 'invented-run', lighthouseResult: 'missed' } });
    const at = limitOf(total);
    const under = limitOf(total - 1);
    expect(await checkTarget(target(), fetchPage, { read, limits: at })).toMatchObject({ ok: true, headroom: 0 });
    expect(await checkTarget(target(), fetchPage, { read, limits: under })).toMatchObject({ ok: false, headroom: -1 });
  });
});

describe('checkTarget: the not-found page and a page hidden in production', () => {
  const notFound = (): RouteTarget => ({ route: 'not-found', kind: 'not-found', path: '/nfr-009-unused-path', roles: ['ADMIN'] });

  it('measures the not-found page when the signed-in viewer gets 404', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /nfr-009-unused-path': redirect(), 'ADMIN /nfr-009-unused-path': page(404, htmlOf('a')) });
    expect(await checkTarget(notFound(), fetchPage, { read })).toMatchObject({ route: 'not-found', ok: true, viewer: 'ADMIN', limit: 200_000 });
  });

  it('measures it as the anonymous viewer when no sign-in stands in front of it', async () => {
    const { fetchPage, calls } = fetcherOf({ 'anonymous /nfr-009-unused-path': page(404, htmlOf('a')) });
    expect(await checkTarget(notFound(), fetchPage, { read })).toMatchObject({ ok: true, viewer: 'anonymous' });
    expect(calls).toHaveLength(1);
  });

  it('fails the not-found row on any other status, 200 included', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /nfr-009-unused-path': redirect(), 'ADMIN /nfr-009-unused-path': page(200, htmlOf('a')) });
    expect(await checkTarget(notFound(), fetchPage, { read })).toMatchObject({ ok: false, note: 'ADMIN got HTTP 200, not HTTP 404' });
  });

  it('passes a hidden route that answers 404, without measuring it, and fails one that answers 200', async () => {
    const hidden: RouteTarget = { route: '/design-system', kind: 'hidden', path: '/design-system', roles: ['ADMIN'] };
    const good = fetcherOf({ 'anonymous /design-system': redirect(), 'ADMIN /design-system': page(404, htmlOf('a')) });
    expect(await checkTarget(hidden, good.fetchPage, { read })).toEqual({
      route: '/design-system',
      kind: 'hidden',
      ok: true,
      note: 'answers 404 as required (hidden in production); not measured',
    });
    const bad = fetcherOf({ 'anonymous /design-system': redirect(), 'ADMIN /design-system': page(200, htmlOf('a')) });
    expect(await checkTarget(hidden, bad.fetchPage, { read })).toMatchObject({ ok: false });
  });
});

describe('the table and the headline', () => {
  it('writes one row per route and names a failing row in the headline', async () => {
    const { fetchPage } = fetcherOf({ 'anonymous /sign-in': page(200, htmlOf('a')), 'anonymous /boom': page(500) });
    const rows = await checkTargets(
      [target({ route: '/sign-in', path: '/sign-in' }), target({ route: '/boom', path: '/boom' })],
      fetchPage,
      { read },
    );
    expect(rows.map((row) => row.route)).toEqual(['/sign-in', '/boom']);
    expect(failedRows(rows).map((row) => row.route)).toEqual(['/boom']);
    expect(headline(rows)).toBe('JS budget: 1 of 2 rows failed (default limit 200,000 bytes gzip): /boom.');
    expect(headline(rows.slice(0, 1))).toBe('JS budget: all 1 rows are within their limit (default 200,000 bytes gzip).');

    const markdown = rowsAsMarkdown(rows).split('\n');
    expect(markdown[0]).toBe('| Route | Result | Viewer | Files | Raw bytes | Gzip bytes | Limit | Headroom | Note |');
    expect(markdown).toHaveLength(4);
    expect(markdown[2]).toMatch(/^\| \/sign-in \| pass \| anonymous \| 1 \| 36,000 \| [\d,]+ \([\d.]+ KB\) \| 200,000 \| [\d,]+ \| {2}\|$/);
    expect(markdown[3]).toBe('| /boom | FAIL | n/a | n/a | n/a | n/a | n/a | n/a | anonymous got HTTP 500, not HTTP 200 |');
    expect(rowsAsText(rows)).toContain('FAIL  /boom');
  });

  it('keeps a table row on one line even if a note holds a pipe or a line break', () => {
    const row = rowsAsMarkdown([{ route: '/x', kind: 'page', ok: false, note: 'a | b\nc' }]).split('\n')[2];
    expect(row).toBe('| /x | FAIL | n/a | n/a | n/a | n/a | n/a | n/a | a / b c |');
  });

  it('formats numbers with commas whatever the machine locale', () => {
    expect(formatBytes(197_138)).toBe('197,138');
    expect(formatBytes(999)).toBe('999');
    expect(formatBytes(-2_862)).toBe('-2,862');
    expect(ANONYMOUS).toEqual({ name: 'anonymous', isSignedIn: false });
  });
});
