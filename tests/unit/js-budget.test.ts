import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  BYTES_PER_KB,
  DEFAULT_LIMIT_BYTES,
  ROUTE_LIMITS,
  firstLoadScriptUrls,
  gzipBytes,
  limitFor,
  limitTableProblems,
  measureFirstLoad,
  staticPathOf,
  type LimitEntry,
} from '../../scripts/lib/js-budget';

/**
 * STORY-10.10 AC-1 (what counts), AC-3 (the limit table). Invented HTML, files and sizes; no build is run.
 */

const page = (head: string, body = ''): string => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

describe('firstLoadScriptUrls (AC-1)', () => {
  it('counts a script with a src and leaves out a script with nomodule, however the attribute is spelled', () => {
    const html = page(
      '<script src="/_next/static/chunks/a.js" async=""></script>' +
        '<script src="/_next/static/chunks/poly.js" noModule=""></script>' +
        '<script src="/_next/static/chunks/poly2.js" nomodule></script>' +
        "<SCRIPT SRC='/_next/static/chunks/b.js' NOMODULE='nomodule'></SCRIPT>" +
        '<script src="/_next/static/chunks/c.js"></script>',
    );
    expect(firstLoadScriptUrls(html)).toEqual(['/_next/static/chunks/a.js', '/_next/static/chunks/c.js']);
  });

  it('counts a preload and a modulepreload that name a script, and nothing else that is linked', () => {
    const html = page(
      '<link rel="preload" as="script" href="/_next/static/chunks/p.js"/>' +
        '<link rel="modulepreload" as="script" href="/_next/static/chunks/m.js"/>' +
        '<link rel="stylesheet" href="/_next/static/chunks/s.css"/>' +
        '<link rel="preload" as="style" href="/_next/static/chunks/s2.css"/>' +
        '<link rel="preload" as="font" href="/_next/static/media/f.woff2" crossorigin=""/>' +
        '<link rel="prefetch" as="script" href="/_next/static/chunks/later.js"/>' +
        '<link rel="preload" href="/_next/static/chunks/no-as.js"/>' +
        '<link rel="icon" href="/accucut-logo.jpg"/>',
    );
    expect(firstLoadScriptUrls(html)).toEqual(['/_next/static/chunks/p.js', '/_next/static/chunks/m.js']);
  });

  it('counts a URL used twice once, whether it is a preload and a script or two scripts', () => {
    const html = page(
      '<link rel="preload" as="script" href="/_next/static/chunks/a.js"/>' +
        '<script src="/_next/static/chunks/a.js"></script>' +
        '<script src="/_next/static/chunks/a.js"></script>',
    );
    expect(firstLoadScriptUrls(html)).toEqual(['/_next/static/chunks/a.js']);
  });

  it('does not count inline scripts (the RSC payload), and does not read a tag named inside their text', () => {
    const html = page(
      // A literal closing tag cannot appear inside script text (the browser would end the script there), so the text holds opening tags only.
      '<script>self.__next_f.push([1,"<script src=\\"/_next/static/chunks/fake.js\\"><link rel=preload as=script href=/_next/static/chunks/fake2.js>"])</script>',
      '<script src="/_next/static/chunks/real.js"></script>',
    );
    expect(firstLoadScriptUrls(html)).toEqual(['/_next/static/chunks/real.js']);
  });

  it('keeps the query (a different query is a different URL) and decodes &amp; in it', () => {
    const html = page('<script src="/_next/static/chunks/a.js?dpl=one&amp;x=2"></script><script src="/_next/static/chunks/a.js?dpl=two"></script>');
    expect(firstLoadScriptUrls(html)).toEqual(['/_next/static/chunks/a.js?dpl=one&x=2', '/_next/static/chunks/a.js?dpl=two']);
  });

  it('ignores a script with an empty or missing src and a link with no href', () => {
    const html = page('<script src=""></script><script async></script><link rel="preload" as="script"/>');
    expect(firstLoadScriptUrls(html)).toEqual([]);
  });

  it('reads unquoted attribute values', () => {
    expect(firstLoadScriptUrls(page('<script src=/_next/static/chunks/u.js async></script>'))).toEqual(['/_next/static/chunks/u.js']);
  });
});

describe('staticPathOf (AC-1: read from .next/static, not over HTTP)', () => {
  it('maps a static URL to the path inside .next/static and drops the query', () => {
    expect(staticPathOf('/_next/static/chunks/a.js?dpl=abc')).toEqual({ ok: true, relative: 'chunks/a.js' });
  });

  it('decodes the percent-encoded brackets that Turbopack puts in file names', () => {
    expect(staticPathOf('/_next/static/chunks/%5Broot-of-the-server%5D__abc._.js')).toEqual({ ok: true, relative: 'chunks/[root-of-the-server]__abc._.js' });
  });

  it('accepts an absolute URL on the origin the page was served from, and refuses another origin', () => {
    expect(staticPathOf('http://localhost:3999/_next/static/chunks/a.js', 'http://localhost:3999')).toEqual({ ok: true, relative: 'chunks/a.js' });
    expect(staticPathOf('https://cdn.example.test/_next/static/chunks/a.js', 'http://localhost:3999')).toMatchObject({ ok: false });
    expect(staticPathOf('//cdn.example.test/_next/static/chunks/a.js')).toMatchObject({ ok: false });
  });

  it.each([
    ['a path outside /_next/static/', '/scripts/a.js'],
    ['a path that climbs out', '/_next/static/../server/app.js'],
    ['a climb written in encoded form', '/_next/static/%2e%2e/server/app.js'],
    ['an empty segment', '/_next/static/chunks//a.js'],
    ['a backslash', '/_next/static/chunks%5Ca.js'],
    ['malformed encoding', '/_next/static/chunks/%E0%A4%A.js'],
  ])('refuses %s', (_label, url) => {
    expect(staticPathOf(url)).toMatchObject({ ok: false });
  });

  it('refuses text that is not a URL when an origin is given', () => {
    expect(staticPathOf('http://[bad', 'http://localhost:3999')).toMatchObject({ ok: false });
  });
});

describe('gzip level 9 and 1 KB = 1,000 bytes (AC-1)', () => {
  const sample = Buffer.from('const total = items.map((item) => item.price * item.quantity);\n'.repeat(400));

  it('compresses with level 9, the gzip -9 of the AQP-28 review', () => {
    expect(gzipBytes(sample)).toBe(gzipSync(sample, { level: 9 }).length);
    expect(gzipBytes(sample)).toBeLessThanOrEqual(gzipSync(sample, { level: 1 }).length);
  });

  it('takes a kilobyte as 1,000 bytes and the default limit as 200,000 bytes', () => {
    expect(BYTES_PER_KB).toBe(1_000);
    expect(DEFAULT_LIMIT_BYTES).toBe(200 * BYTES_PER_KB);
  });
});

describe('measureFirstLoad (AC-1, AC-2)', () => {
  const files = new Map<string, Buffer>([
    ['chunks/a.js', Buffer.from('console.log("a");\n'.repeat(300))],
    ['chunks/b.js', Buffer.from('console.log("b");\n'.repeat(500))],
    ['chunks/[odd].js', Buffer.from('console.log("odd");\n'.repeat(100))],
  ]);
  const read = (relative: string): Uint8Array | undefined => files.get(relative);

  it('sums the raw and gzip bytes of the distinct files, counting a repeated file once', () => {
    const html = page(
      '<link rel="preload" as="script" href="/_next/static/chunks/a.js"/>',
      '<script src="/_next/static/chunks/a.js"></script><script src="/_next/static/chunks/b.js" async=""></script>' +
        '<script src="/_next/static/chunks/poly.js" nomodule=""></script><script>inline()</script>',
    );
    const a = files.get('chunks/a.js') ?? Buffer.alloc(0);
    const b = files.get('chunks/b.js') ?? Buffer.alloc(0);
    expect(measureFirstLoad(html, read)).toEqual({
      ok: true,
      files: [
        { url: '/_next/static/chunks/a.js', rawBytes: a.length, gzipBytes: gzipSync(a, { level: 9 }).length },
        { url: '/_next/static/chunks/b.js', rawBytes: b.length, gzipBytes: gzipSync(b, { level: 9 }).length },
      ],
      rawBytes: a.length + b.length,
      gzipBytes: gzipSync(a, { level: 9 }).length + gzipSync(b, { level: 9 }).length,
    });
  });

  it('finds a file whose name has encoded brackets', () => {
    const result = measureFirstLoad(page('<script src="/_next/static/chunks/%5Bodd%5D.js"></script>'), read);
    expect(result).toMatchObject({ ok: true, files: [{ url: '/_next/static/chunks/%5Bodd%5D.js' }] });
  });

  it('fails, naming the file, when a script is not in .next/static', () => {
    const result = measureFirstLoad(page('<script src="/_next/static/chunks/gone.js"></script>'), read);
    expect(result).toEqual({ ok: false, problems: ['the script /_next/static/chunks/gone.js is not in .next/static'] });
  });

  it('fails when a script is not a file of this build, and reports every problem', () => {
    const result = measureFirstLoad(page('<script src="https://cdn.example.test/x.js"></script><script src="/_next/static/chunks/gone.js"></script>'), read);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems).toHaveLength(2);
  });

  it('fails when a page names no script, rather than reporting zero bytes', () => {
    expect(measureFirstLoad(page('<title>x</title>'), read)).toMatchObject({ ok: false });
  });
});

describe('the limit table (AC-3)', () => {
  const entry = (overrides: Partial<LimitEntry>): LimitEntry => ({
    limitBytes: 210_000,
    decision: 'DL-123',
    lighthouseRun: 'https://example.test/runs/1',
    lighthouseResult: 'met',
    ...overrides,
  });

  it('has no route exception when the story merges, and the default is 200,000 bytes', () => {
    expect(Object.keys(ROUTE_LIMITS)).toEqual([]);
    expect(limitTableProblems(ROUTE_LIMITS)).toEqual([]);
    expect(limitFor('/queue')).toBe(200_000);
    expect(limitFor('not-found')).toBe(200_000);
  });

  it('uses the table entry for its route and the default for every other', () => {
    const table = { '/heavy': entry({}) };
    expect(limitFor('/heavy', table)).toBe(210_000);
    expect(limitFor('/other', table)).toBe(200_000);
  });

  it('accepts a raised limit that names a decision and a run that met the targets, and a lowered one that names a run that missed them', () => {
    expect(limitTableProblems({ '/a': entry({}), '/b': entry({ limitBytes: 150_000, lighthouseResult: 'missed' }) })).toEqual([]);
  });

  it('fails an entry that differs from the default and names no decision', () => {
    expect(limitTableProblems({ '/a': entry({ decision: '' }) })).toEqual(['/a: no product-manager decision ID (DL-nnn) is named']);
    expect(limitTableProblems({ '/a': entry({ decision: 'because I said so' }) })).toHaveLength(1);
  });

  it('fails an entry that names no Lighthouse run', () => {
    expect(limitTableProblems({ '/a': entry({ lighthouseRun: '  ' }) })).toEqual(['/a: no Lighthouse run is named']);
  });

  it('fails a raised limit backed by a run that missed, and a lowered limit backed by a run that met', () => {
    expect(limitTableProblems({ '/a': entry({ lighthouseResult: 'missed' }) })).toEqual(['/a: a raised limit needs a Lighthouse run that met the targets']);
    expect(limitTableProblems({ '/b': entry({ limitBytes: 150_000 }) })).toEqual(['/b: a lowered limit needs a Lighthouse run that missed the targets']);
  });

  it('fails an entry equal to the default, and a limit that is not a positive whole number', () => {
    expect(limitTableProblems({ '/a': entry({ limitBytes: DEFAULT_LIMIT_BYTES }) })).toHaveLength(1);
    expect(limitTableProblems({ '/a': entry({ limitBytes: 0 }) }).length).toBeGreaterThan(0);
    expect(limitTableProblems({ '/a': entry({ limitBytes: 1.5 }) }).length).toBeGreaterThan(0);
  });
});
