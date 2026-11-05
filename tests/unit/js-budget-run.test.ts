import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { routesOfBuild, runBudgetCheck, staticReader } from '../../scripts/lib/js-budget-run';

/**
 * STORY-10.10 AC-1: the build output is read from disk (`.next/static` for the files, the app-path list for the routes).
 * A small invented build in a temporary folder; the pages are answered by a fake `fetch`.
 */

let root: string;
const APP_PATHS = '.next/server/app-paths-manifest.json';

function writeFile(relative: string, content: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'js-budget-run-'));
  writeFile('.next/static/chunks/app.js', 'console.log("app");\n'.repeat(500));
  writeFile(APP_PATHS, JSON.stringify({ '/(public)/sign-in/page': 'x', '/_not-found/page': 'y', '/api/auth/[...nextauth]/route': 'z' }));
  writeFile('outside.js', 'secret');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('staticReader', () => {
  it('reads a file under .next/static and answers undefined for a file that is not there', () => {
    const read = staticReader(root);
    expect(read('chunks/app.js')?.byteLength).toBe('console.log("app");\n'.length * 500);
    expect(read('chunks/missing.js')).toBeUndefined();
  });

  it('reads nothing outside .next/static, however the path is written', () => {
    const read = staticReader(root);
    expect(read('../../outside.js')).toBeUndefined();
    expect(read('chunks/../../../outside.js')).toBeUndefined();
  });
});

describe('routesOfBuild', () => {
  it('lists the page routes of the build', () => {
    expect(routesOfBuild(root)).toEqual({ routes: [{ pattern: '/sign-in', roles: ['ADMIN'] }], problems: [] });
  });

  it('throws a clear message when the build is missing, or its list is not what Next.js writes', () => {
    expect(() => routesOfBuild(join(root, 'nowhere'))).toThrow('run the production build first');
    writeFile('broken/.next/server/app-paths-manifest.json', '{not json');
    expect(() => routesOfBuild(join(root, 'broken'))).toThrow('is not a list of app paths');
    writeFile('wrong/.next/server/app-paths-manifest.json', JSON.stringify(['a']));
    expect(() => routesOfBuild(join(root, 'wrong'))).toThrow('is not a list of app paths');
  });
});

describe('runBudgetCheck', () => {
  const html = '<html><head><script src="/_next/static/chunks/app.js"></script></head></html>';
  const fakeFetch = async (input: string | URL | Request): Promise<Response> => {
    const path = new URL(String(input)).pathname;
    return path === '/sign-in' ? new Response(html, { status: 200 }) : new Response(html, { status: 404 });
  };

  it('checks every route of the build and the not-found page, and returns one row each', async () => {
    const rows = await runBudgetCheck({ buildDir: root, baseUrl: 'http://localhost:3999', credentialsFor: () => undefined, fetchImpl: fakeFetch });
    expect(rows.map((row) => [row.route, row.ok])).toEqual([
      ['/sign-in', true],
      ['not-found', true],
    ]);
  });

  it('uses the route source it is given in place of the build', async () => {
    const rows = await runBudgetCheck({
      buildDir: root,
      baseUrl: 'http://localhost:3999/',
      credentialsFor: () => undefined,
      fetchImpl: fakeFetch,
      source: { routes: [], problems: ['/odd: has a shape the check cannot request'] },
      limits: {},
    });
    expect(rows.map((row) => [row.route, row.ok])).toEqual([
      ['/odd', false],
      ['not-found', true],
    ]);
  });
});
