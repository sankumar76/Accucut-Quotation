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
const SCAN_HELPER = read('../e2e/support/canary-scan.ts');
const PRODUCTION_ROUTES_SPEC = read('../e2e/production-routes.spec.ts');

const SECURITY_DIRECTORY = fileURLToPath(new URL('../security/', import.meta.url));
const SECURITY_FILES = readdirSync(SECURITY_DIRECTORY).filter((name) => name.endsWith('.test.ts'));

/** Every way a test is switched off or narrowed to one run, in Playwright and in Vitest. */
const QUARANTINE_MARKERS =
  /\b(?:test|it|describe)\s*\.\s*(?:skip|fixme|fail|slow|only|todo|skipIf|runIf)\b|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\.skip\s*\(|\.todo\s*\(/;

/**
 * Ways a scan test can leave before it asserts, which no quarantine marker shows (QLT-10; the planted F14 was
 * `if (process.env.CI) return;` at the top of a test): a read of the environment and a `return` with no value. A `return` with a value
 * is a function's answer and is allowed.
 */
function earlyExits(text: string): string[] {
  return [/process\.env/.test(text) ? 'a read of the environment: process.env' : '', /\breturn\s*;/.test(text) ? 'a bare return' : ''].filter(
    (found) => found !== '',
  );
}

/** The titles of the tests in a spec whose body holds no `expect(`: a test that cannot fail. */
function testsWithoutAssertions(text: string): string[] {
  return text
    .split(/^test\(/m)
    .slice(1)
    .filter((body) => !body.includes('expect('))
    .map((body) => /^('[^']*'|"[^"]*"|`[^`]*`)/.exec(body)?.[1] ?? 'a test');
}

/**
 * The body of a named function: from the line that ends the signature with `{` to the closing brace at the indentation of the `function`
 * line. Prettier puts the signature's closing `{` at the end of a line, so this finds it without parsing the types in the signature.
 * `undefined` when the function is not there, which a caller treats as a failure (a renamed helper must not escape the check).
 */
function functionBody(text: string, name: string): string | undefined {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => new RegExp(`function ${name}\\(`).test(line));
  if (start === -1) return undefined;
  const indent = /^\s*/.exec(lines[start] ?? '')?.[0] ?? '';
  const open = lines.findIndex(
    (line, index) => index >= start && line.trimEnd().endsWith('{') && (index === start || line.startsWith(`${indent}) `) || line.startsWith(`${indent}):`)),
  );
  const close = lines.findIndex((line, index) => index > open && line === `${indent}}`);
  return open === -1 || close === -1 ? undefined : lines.slice(open + 1, close).join('\n');
}

/** The functions of the scan helper that make the run meaningful: if one can be left early, the scan can be green having looked at nothing. */
const SCAN_HELPER_FUNCTIONS = ['scanAsEngineer', 'openEngineerPages', 'callEngineerRoutes', 'expectScanSawEnough', 'fetchReferencedFiles'] as const;

const WIDTHS = ['mobile', 'tablet', 'desktop'];

describe('the scan is not quarantined (AC-8)', () => {
  it('has no skip, fixme, fail, slow, only or todo in the scan, the production-route spec or any file of tests/security', () => {
    expect(SECURITY_FILES.length).toBeGreaterThan(5);
    const files: ReadonlyArray<readonly [string, string]> = [
      ['tests/e2e/canary-scan.spec.ts', SCAN_SPEC],
      ['tests/e2e/support/canary-scan.ts', SCAN_HELPER],
      ['tests/e2e/production-routes.spec.ts', PRODUCTION_ROUTES_SPEC],
      ...SECURITY_FILES.map((name): readonly [string, string] => [`tests/security/${name}`, read(`../security/${name}`)]),
    ];
    const marked = files.filter(([, text]) => QUARANTINE_MARKERS.test(text)).map(([name]) => name);
    expect(marked).toEqual([]);
  });

  it('the marker pattern can fail: it matches each way of switching a test off', () => {
    for (const text of [
      "test.skip('x', () => {})",
      'test.fixme(true)',
      'test.fail()',
      'test.slow()',
      "it.only('x', f)",
      'describe.skip(',
      "it.todo('x')",
      'xit(',
      "it.skipIf(true)('x', f)",
    ]) {
      expect(QUARANTINE_MARKERS.test(text), text).toBe(true);
    }
    expect(QUARANTINE_MARKERS.test("test('a normal test', async () => {})")).toBe(false);
  });

  it('the scan spec has no early exit: no bare return, no read of the environment, and every test asserts (QLT-10)', () => {
    expect(earlyExits(SCAN_SPEC)).toEqual([]);
    expect(testsWithoutAssertions(SCAN_SPEC)).toEqual([]);
    // The Engineer scan test must really run the procedure and judge what it saw, not just open a page.
    const engineerScan = SCAN_SPEC.split(/^test\(/m).find((body) => body.startsWith("'AC-3: an Engineer")) ?? '';
    expect(engineerScan).toContain('scanAsEngineer(');
    expect(engineerScan).toContain('expectScanSawEnough(');
  });

  it.each(SCAN_HELPER_FUNCTIONS)('the scan helper function %s has no early exit and no read of the environment (QLT-17)', (name) => {
    const body = functionBody(SCAN_HELPER, name);
    expect(body, `${name} is in tests/e2e/support/canary-scan.ts`).toBeDefined();
    expect(earlyExits(body ?? '')).toEqual([]);
  });

  it('the guard that judges a scan is really there: expectScanSawEnough asserts, and scanAsEngineer opens the pages and calls the routes', () => {
    expect(functionBody(SCAN_HELPER, 'expectScanSawEnough')).toContain('expect(');
    const scan = functionBody(SCAN_HELPER, 'scanAsEngineer') ?? '';
    for (const step of ['openEngineerPages(', 'callEngineerRoutes(', 'fetchReferencedFiles(']) expect(scan, step).toContain(step);
  });

  it('the helper check can fail: it finds a function body and sees an early return in it (the planted N12)', () => {
    const helper = [
      'export function expectScanSawEnough(recorder: ScanRecorder, scan: EngineerScan): void {',
      '  if (process.env.CI) return;',
      '  expect(scan.pages).toBeGreaterThan(0);',
      '}',
      '',
      'export async function scanAsEngineer(',
      '  page: Page,',
      '  owner: { readonly id: string },',
      '): Promise<EngineerScan> {',
      '  return { pages: 1 };',
      '}',
      '',
    ].join('\n');
    expect(earlyExits(functionBody(helper, 'expectScanSawEnough') ?? '')).toEqual(['a read of the environment: process.env', 'a bare return']);
    // A signature that wraps over several lines, with braces in its types, still gives the body and nothing after it.
    expect(functionBody(helper, 'scanAsEngineer')).toBe('  return { pages: 1 };');
    expect(earlyExits(functionBody(helper, 'scanAsEngineer') ?? '')).toEqual([]);
    expect(functionBody(helper, 'renamedAway')).toBeUndefined();
  });

  it('the early-exit check can fail: it names each way of leaving a scan test before it asserts (the planted F14)', () => {
    const planted = "test('AC-3: x', async ({ page }) => {\n  if (process.env.CI) return;\n  await page.goto('/');\n  expect(1).toBe(1);\n});\n";
    expect(earlyExits(planted)).toEqual(['a read of the environment: process.env', 'a bare return']);
    expect(earlyExits("test('x', async () => {\n  if (isCi) {\n    return;\n  }\n});\n")).toEqual(['a bare return']);
    expect(earlyExits('const plant = () => {\n  return `${body}`;\n};\n')).toEqual([]);
    expect(testsWithoutAssertions("test('a', async () => {\n  await go();\n});\ntest('b', async () => {\n  expect(1).toBe(1);\n});\n")).toEqual(["'a'"]);
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

  it('lists the eleven tests of the scan: the Engineer scan, the refusals, the real-data controls (the rates, the materials of STORY-02.03, the customers of STORY-02.02 and the exchange rates of STORY-02.04), the options lists, two planted-leak controls, the absent route', () => {
    expect(tests.map((test) => test.title.split(':')[0]).sort()).toEqual([
      'AC-3',
      'AC-3, AC-4 (control with real data)',
      'AC-4',
      'AC-4 (negative control)',
      'AC-4 (negative control)',
      'AC-4, AC-6 (STORY-02.03)',
      'AC-5',
      'AC-5, AC-7 (STORY-02.02)',
      'AC-6 (control with real data, STORY-02.03)',
      'AC-6 (control with real data, STORY-02.04)',
      'AC-7 (control with real data, STORY-02.02)',
    ]);
  });

  it('runs every one of them in the mobile, tablet and desktop projects (a width is never skipped)', () => {
    for (const test of tests) expect([...test.projects].sort(), test.title).toEqual([...WIDTHS].sort());
  });
});
