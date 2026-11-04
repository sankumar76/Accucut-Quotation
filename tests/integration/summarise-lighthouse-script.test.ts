import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * STORY-10.10 AC-7: `scripts/summarise-lighthouse.ts` reads the files that Lighthouse CI's filesystem target really
 * writes (`<host>-<path>-<time>.report.json`, beside a manifest and the HTML). The first nightly run read the wrong file
 * names and printed an empty table, so this runs the real script over folders named the way Lighthouse CI names them.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const report = (requested: string, final: string, lcp: number): string =>
  JSON.stringify({
    requestedUrl: `http://localhost:3000${requested}`,
    finalDisplayedUrl: `http://localhost:3000${final}`,
    audits: { 'largest-contentful-paint': { numericValue: lcp }, 'total-blocking-time': { numericValue: 100 } },
    environment: { benchmarkIndex: 1_400, hostUserAgent: 'Mozilla/5.0 HeadlessChrome/137.0.7151.55 Safari/537.36' },
  });

interface Result {
  readonly code: number | null;
  readonly output: string;
}

const passedThrough = (): Record<string, string> =>
  Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'].flatMap((name) => (process.env[name] === undefined ? [] : [[name, process.env[name]]])));

function summarise(wifi: string, slow: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/summarise-lighthouse.ts', '--wifi', wifi, '--slow4g', slow], {
      cwd: ROOT,
      env: { NODE_ENV: 'test', ...passedThrough() },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

let scratch: string;
let healthy: Result;
let signedOut: Result;
let empty: Result;

function folder(name: string, files: Record<string, string>): string {
  const directory = join(scratch, name);
  mkdirSync(directory, { recursive: true });
  for (const [file, content] of Object.entries(files)) writeFileSync(join(directory, file), content);
  return directory;
}

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'summarise-lighthouse-'));
  const good = (): Record<string, string> => ({
    'localhost-_-2026-11-04_21-39-50.report.json': report('/', '/', 1_000),
    'localhost-_-2026-11-04_21-39-50.report.html': '<html></html>',
    'localhost-_-2026-11-04_21-39-52.report.json': report('/', '/', 2_000),
    'localhost-_-2026-11-04_21-39-54.report.json': report('/', '/', 3_000),
    'manifest.json': '[]',
  });
  healthy = await summarise(folder('wifi-ok', good()), folder('slow-ok', good()));
  signedOut = await summarise(folder('wifi-out', { 'localhost-_-2026-11-04_21-39-50.report.json': report('/', '/sign-in', 900) }), folder('slow-out', good()));
  empty = await summarise(folder('wifi-empty', { 'manifest.json': '[]' }), folder('slow-empty', good()));
});

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('scripts/summarise-lighthouse.ts', () => {
  it('reads the report files Lighthouse CI writes, and prints the median of the runs for each profile', () => {
    expect(healthy.code).toBe(0);
    expect(healthy.output).toContain('| / | 3 | 2000 | 100 |  |');
    expect(healthy.output).toContain('Median benchmarkIndex 1400. No B0 is set');
    expect(healthy.output).toContain('Chromium 137.0.7151.55');
    expect(healthy.output).not.toContain('(no report)');
  });

  it('fails, naming the page, when a run ended on the sign-in page: its figures are not the page asked for', () => {
    expect(signedOut.code).toBe(1);
    expect(signedOut.output).toContain('NOT THIS PAGE: ended on /sign-in');
    expect(signedOut.output).toContain('/ (ended on /sign-in)');
  });

  it('fails, rather than print an empty table, when a folder holds no report', () => {
    expect(empty.code).toBe(1);
    expect(empty.output).toContain('holds no Lighthouse report');
  });
});
