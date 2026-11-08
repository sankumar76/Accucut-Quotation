import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { forEachSpec, listPlaywrightSuites } from '../support/playwright-list';

/**
 * STORY-01.03 T8 (AC-8; test strategy section 10, flaky-test policy): the cost-confidentiality scan runs in CI stage 12 on every pull
 * request, and it and the role-matrix and canary tests are never quarantined. A scan that can be skipped is a scan that someone
 * will skip, so this fails the build when:
 *   - the scan's spec is missing from the list that Playwright itself gives, or is not in all three width projects;
 *   - a test of the scan, of `tests/security` or of the production-route spec is skipped, marked `fixme`, `fail`, `slow`, `only` or
 *     `todo`, or the spec is ignored by the Playwright configuration;
 *   - the workflow's stage 12 command narrows the run (a path, `--grep`, `--project`), or stage 11 stops running `tests/security`.
 * The E2E suite cannot run in a unit test, so this reads the text of the files and asks Playwright to list the tests, as
 * `one-width-tag.test.ts` and `e2e-shards.test.ts` do.
 */

const read = (url: string): string => readFileSync(fileURLToPath(new URL(url, import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const WORKFLOW = read('../../.github/workflows/ci.yml');
const CONFIG = read('../../playwright.config.ts');
const SCAN_SPEC = read('../e2e/canary-scan.spec.ts');
const PRODUCTION_ROUTES_SPEC = read('../e2e/production-routes.spec.ts');

const SECURITY_DIRECTORY = fileURLToPath(new URL('../security/', import.meta.url));
const SECURITY_FILES = readdirSync(SECURITY_DIRECTORY).filter((name) => name.endsWith('.test.ts'));

/** Every way a test is switched off or narrowed to one run, in Playwright and in Vitest. */
const QUARANTINE_MARKERS = /\b(?:test|it|describe)\s*\.\s*(?:skip|fixme|fail|slow|only|todo|skipIf|runIf)\b|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\.skip\s*\(|\.todo\s*\(/;

const WIDTHS = ['mobile', 'tablet', 'desktop'];

describe('the scan is not quarantined (AC-8)', () => {
  it('has no skip, fixme, fail, slow, only or todo in the scan, the production-route spec or any file of tests/security', () => {
    expect(SECURITY_FILES.length).toBeGreaterThan(5);
    const files: ReadonlyArray<readonly [string, string]> = [
      ['tests/e2e/canary-scan.spec.ts', SCAN_SPEC],
      ['tests/e2e/production-routes.spec.ts', PRODUCTION_ROUTES_SPEC],
      ...SECURITY_FILES.map((name): readonly [string, string] => [`tests/security/${name}`, read(`../security/${name}`)]),
    ];
    const marked = files.filter(([, text]) => QUARANTINE_MARKERS.test(text)).map(([name]) => name);
    expect(marked).toEqual([]);
  });

  it('the marker pattern can fail: it matches each way of switching a test off', () => {
    for (const text of ["test.skip('x', () => {})", "test.fixme(true)", "test.fail()", 'test.slow()', "it.only('x', f)", 'describe.skip(', "it.todo('x')", 'xit(', "it.skipIf(true)('x', f)"]) {
      expect(QUARANTINE_MARKERS.test(text), text).toBe(true);
    }
    expect(QUARANTINE_MARKERS.test("test('a normal test', async () => {})")).toBe(false);
  });

  it('the Playwright configuration does not ignore the scan and does not turn retries up', () => {
    expect(CONFIG).not.toMatch(/testIgnore:\s*['"[]?[^,\n]*canary/);
    expect(CONFIG).toMatch(/retries:\s*1,/);
    expect(CONFIG).toContain("testMatch: '**/*.{spec,setup}.ts'");
  });

  it('stage 12 runs the whole suite: no path, no --grep and no --project on the command', () => {
    const command = /npx playwright test (.*)$/m.exec(WORKFLOW)?.[1] ?? '';
    expect(command).toBe('--shard="${SHARD_INDEX}/${SHARD_TOTAL}"');
  });

  it('stage 11 runs tests/security, which holds the role matrix, the import rule, the strict schemas and the scanner tests', () => {
    expect(WORKFLOW).toMatch(/npx vitest run tests\/unit tests\/integration tests\/security tests\/acceptance --coverage/);
  });
});

describe('the scan is in the Playwright list at three widths (AC-8)', () => {
  let tests: Array<{ readonly title: string; readonly projects: string[] }> = [];

  beforeAll(async () => {
    // Playwright lists a spec once for each project it runs in, so the projects of one title are gathered here.
    const found = new Map<string, string[]>();
    forEachSpec(await listPlaywrightSuites(), (spec) => {
      if (spec.file === 'canary-scan.spec.ts') found.set(spec.title, [...(found.get(spec.title) ?? []), ...spec.tests.map((test) => test.projectName)]);
    });
    tests = [...found].map(([title, projects]) => ({ title, projects }));
  });

  it('lists the five tests of the scan', () => {
    expect(tests.map((test) => test.title.split(':')[0]).sort()).toEqual(['AC-3', 'AC-3, AC-4 (control with real data)', 'AC-4', 'AC-4 (negative control)', 'AC-5']);
  });

  it('runs every one of them in the mobile, tablet and desktop projects (a width is never skipped)', () => {
    for (const test of tests) expect([...test.projects].sort(), test.title).toEqual([...WIDTHS].sort());
  });
});
