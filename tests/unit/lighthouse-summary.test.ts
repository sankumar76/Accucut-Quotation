import { describe, expect, it } from 'vitest';

import {
  COMPARABLE_FRACTION,
  comparability,
  medianOf,
  parseBaseline,
  parseRun,
  profileMarkdown,
  REPORT_FILE,
  redirectedPages,
  summariseProfile,
  type RunFigures,
} from '../../scripts/lib/lighthouse-summary';

/** STORY-10.10 AC-7: the summary, and the rule that a run more than 25 % from B0 is "not comparable". Invented figures. */

const report = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    finalDisplayedUrl: 'http://localhost:4123/queue?a=1',
    audits: { 'largest-contentful-paint': { numericValue: 1800.4 }, 'total-blocking-time': { numericValue: 120 } },
    environment: { benchmarkIndex: 1500, hostUserAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/137.0.7151.55 Safari/537.36' },
    ...overrides,
  });

const run = (overrides: Partial<RunFigures> = {}): RunFigures => ({ url: '/', finalPath: '/', lcpMs: 1_000, tbtMs: 100, benchmarkIndex: 1_000, chromium: '137.0.1.2', ...overrides });

describe('parseRun', () => {
  it('reads the LCP, the TBT, the benchmark index and the Chromium version, and shows the page without its port', () => {
    expect(parseRun(report())).toEqual({ url: '/queue?a=1', finalPath: '/queue', lcpMs: 1800.4, tbtMs: 120, benchmarkIndex: 1500, chromium: '137.0.7151.55' });
  });

  it('falls back to the final URL, then the requested URL, and tolerates a missing user agent or audit value', () => {
    expect(parseRun(report({ finalDisplayedUrl: undefined, finalUrl: 'http://localhost:1/a' }))?.url).toBe('/a');
    expect(parseRun(report({ finalDisplayedUrl: undefined, requestedUrl: 'http://localhost:1/b' }))?.url).toBe('/b');
    expect(parseRun(report({ finalDisplayedUrl: undefined }))?.url).toBe('(unknown page)');
    expect(parseRun(report({ finalDisplayedUrl: 'not a url' }))?.url).toBe('not a url');
    const sparse = parseRun(report({ environment: { benchmarkIndex: 900 }, audits: { 'largest-contentful-paint': {}, 'total-blocking-time': {} } }));
    expect(sparse).toMatchObject({ lcpMs: undefined, tbtMs: undefined, benchmarkIndex: 900, chromium: undefined });
  });

  it('returns undefined for text that is not a Lighthouse report', () => {
    expect(parseRun('{not json')).toBeUndefined();
    expect(parseRun(JSON.stringify({ audits: {} }))).toBeUndefined();
  });
});

describe('summariseProfile', () => {
  it('takes the median per page over its runs, in the order the pages first appear', () => {
    const summary = summariseProfile([
      run({ url: '/', lcpMs: 3_000, tbtMs: 300, benchmarkIndex: 1_000 }),
      run({ url: '/queue', finalPath: '/queue', lcpMs: 1_000 }),
      run({ url: '/', lcpMs: 1_000, tbtMs: 100, benchmarkIndex: 2_000 }),
      run({ url: '/', lcpMs: 2_000, tbtMs: 200, benchmarkIndex: 3_000 }),
    ]);
    expect(summary.pages).toEqual([
      { url: '/', runs: 3, medianLcpMs: 2_000, medianTbtMs: 200, redirectedTo: undefined },
      { url: '/queue', runs: 1, medianLcpMs: 1_000, medianTbtMs: 100, redirectedTo: undefined },
    ]);
    expect(summary.medianBenchmarkIndex).toBe(1_500);
    expect(summary.chromium).toBe('137.0.1.2');
  });

  it('has nothing to report for no runs', () => {
    expect(summariseProfile([])).toEqual({ pages: [], medianBenchmarkIndex: undefined, chromium: undefined });
    expect(medianOf([])).toBeUndefined();
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('comparability (AC-7: more than 25 % away from B0 is not comparable)', () => {
  it('is the baseline run when B0 is not set', () => {
    expect(comparability(1_000, undefined)).toEqual({ kind: 'baseline' });
  });

  it('is comparable at exactly 25 % above or below, and not comparable just over', () => {
    expect(COMPARABLE_FRACTION).toBe(0.25);
    expect(comparability(1_250, 1_000)).toEqual({ kind: 'comparable', deviation: 0.25 });
    expect(comparability(750, 1_000)).toEqual({ kind: 'comparable', deviation: 0.25 });
    expect(comparability(1_251, 1_000)).toMatchObject({ kind: 'not-comparable' });
    expect(comparability(749, 1_000)).toMatchObject({ kind: 'not-comparable' });
  });

  it('is comparable at the baseline itself', () => {
    expect(comparability(1_000, 1_000)).toEqual({ kind: 'comparable', deviation: 0 });
  });
});

describe('parseBaseline', () => {
  it('reads a positive number, and nothing else', () => {
    expect(parseBaseline('1200')).toBe(1_200);
    expect(parseBaseline(' 1200.5 ')).toBe(1_200.5);
    for (const bad of [undefined, '', '  ', 'abc', '0', '-5', 'Infinity']) expect(parseBaseline(bad)).toBeUndefined();
  });
});

describe('profileMarkdown', () => {
  const summary = summariseProfile([run({ url: '/', lcpMs: 1_234.6, tbtMs: 56.2, benchmarkIndex: 1_500 })]);

  it('writes the table, the benchmark index and the Chromium version', () => {
    const text = profileMarkdown('Wi-Fi profile', summary, undefined);
    expect(text).toContain('#### Wi-Fi profile');
    expect(text).toContain('| / | 1 | 1235 | 56 |  |');
    expect(text).toContain('Median benchmarkIndex 1500. No B0 is set, so this is a baseline run: record 1500 as B0. Chromium 137.0.1.2.');
  });

  it('says comparable, with the deviation, within 25 % of B0', () => {
    expect(profileMarkdown('Wi-Fi profile', summary, 1_400)).toContain('7.1 % from B0 1400: comparable.');
  });

  it('marks the run NOT COMPARABLE, and says to re-run, when it is more than 25 % from B0', () => {
    const text = profileMarkdown('Wi-Fi profile', summary, 1_000);
    expect(text).toContain('50.0 % from B0 1000: NOT COMPARABLE (more than 25 % away). Re-run; if it happens again, take a new baseline.');
  });

  it('shows an empty profile and a missing index plainly', () => {
    const text = profileMarkdown('Slow 4G profile', summariseProfile([]), 1_000);
    expect(text).toContain('| (no report) | 0 | n/a | n/a | |');
    expect(text).toContain('No benchmark index was reported. Chromium unknown.');
  });
});

describe('a page that ended on another page', () => {
  it('reads the asked-for page and the page the browser ended on from the report', () => {
    const redirected = parseRun(report({ requestedUrl: 'http://localhost:4123/', finalDisplayedUrl: 'http://localhost:4123/sign-in?callbackUrl=%2F' }));
    expect(redirected).toMatchObject({ url: '/', finalPath: '/sign-in' });
  });

  it('is named in the summary and in the list of pages whose figures are not their own', () => {
    const summary = summariseProfile([run({ url: '/' }), run({ url: '/', finalPath: '/sign-in' }), run({ url: '/queue', finalPath: '/queue' })]);
    expect(redirectedPages(summary)).toEqual(['/ (ended on /sign-in)']);
    expect(profileMarkdown('Wi-Fi profile', summary, undefined)).toContain('| / | 2 | 1000 | 100 | NOT THIS PAGE: ended on /sign-in |');
    expect(redirectedPages(summariseProfile([run()]))).toEqual([]);
  });

  it('compares the path and not the query, so a page that adds a query is still the page asked for', () => {
    expect(redirectedPages(summariseProfile([run({ url: '/queue?tab=1', finalPath: '/queue' })]))).toEqual([]);
  });
});

describe('REPORT_FILE (the files Lighthouse CI keeps)', () => {
  it('matches the JSON report of a run and nothing else in the folder', () => {
    expect(REPORT_FILE.test('localhost-_-2026-11-04_21-39-53.report.json')).toBe(true);
    for (const other of ['localhost-_-2026-11-04_21-39-53.report.html', 'manifest.json', 'lhr-1793.json']) expect(REPORT_FILE.test(other), other).toBe(false);
  });
});
