import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * AQP-199 AC-3 (STORY-10.14; test strategy section 10.5): a test that reads no layout may be tagged `@one-width`, which
 * runs it in the desktop project only. The tag hides a test from the mobile and tablet projects, so it is allowed in
 * exactly four spec files, ruled one by one in section 10.5. Tagging a test anywhere else needs a ruling there first,
 * and this test fails until the ruling and this list are both changed. The E2E suite cannot run in a unit test, so this
 * reads the text of the specs and of the Playwright configuration.
 */

const TAG = '@one-width';
const E2E_DIRECTORY = fileURLToPath(new URL('../e2e/', import.meta.url));

/** The four files section 10.5 rules on. Paths are relative to `tests/e2e`, with forward slashes. */
const RULED_FILES = ['aqp-38-qa.spec.ts', 'axe-helper.spec.ts', 'production-routes.spec.ts', 'sign-in.spec.ts'] as const;

// A Windows checkout with Git's default autocrlf writes CRLF; the checks below expect LF (DEF-002).
const read = (path: string): string => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

const E2E_FILES = readdirSync(E2E_DIRECTORY, { recursive: true, encoding: 'utf8' })
  .map((path) => path.replaceAll('\\', '/'))
  .filter((path) => path.endsWith('.ts'))
  .sort();

const linesOf = (file: string): string[] => read(`${E2E_DIRECTORY}${file}`).split('\n');
const linesWith = (file: string, text: string): string[] => linesOf(file).filter((line) => line.includes(text));

describe('@one-width allow-list (AQP-199 AC-3)', () => {
  it('finds the E2E files it is meant to guard', () => {
    // A path or a read that quietly found nothing would make the guard below pass for the wrong reason.
    expect(E2E_FILES.length).toBeGreaterThan(RULED_FILES.length);
    for (const file of RULED_FILES) expect(E2E_FILES).toContain(file);
  });

  it('appears in no file of tests/e2e except the four ruled in test strategy section 10.5', () => {
    const tagged = E2E_FILES.filter((file) => read(`${E2E_DIRECTORY}${file}`).includes(TAG));
    expect(tagged.filter((file) => !(RULED_FILES as ReadonlyArray<string>).includes(file))).toEqual([]);
  });

  it('is used as a Playwright tag (tag: "@one-width") in each of the four ruled files', () => {
    for (const file of RULED_FILES) {
      expect(linesWith(file, `tag: '${TAG}'`).length, file).toBeGreaterThan(0);
    }
  });

  it('is spelled the same everywhere, so grepInvert matches every use of it', () => {
    // A near miss ("@one_width", "@onewidth", "@one-widths") would leave a test at three widths, or hide it from none.
    for (const file of E2E_FILES) {
      const spellings = read(`${E2E_DIRECTORY}${file}`).match(/@one[-_ ]?width\w*/gi) ?? [];
      for (const spelling of spellings) expect(spelling, file).toBe(TAG);
    }
  });

  it('is not on the tests the ruling keeps at three widths', () => {
    const kept: ReadonlyArray<readonly [string, string]> = [
      ['sign-in.spec.ts', "test.describe('SCR-01 at this width (AC-8)'"],
      ['sign-in.spec.ts', "test('the account menu shows who is signed in, with the e-mail and the role'"],
      ['aqp-38-qa.spec.ts', "test.describe('[AQP-38 AC-8] keyboard and screen reader on SCR-01'"],
      ['aqp-38-qa.spec.ts', "test.describe('[AQP-38 AC-3, AC-8] the locked and \"could not be checked\" states'"],
    ];
    for (const [file, opening] of kept) {
      const found = linesWith(file, opening);
      expect(found, `${file}: ${opening}`).toHaveLength(1);
      expect(found[0], `${file}: ${opening}`).not.toContain(TAG);
    }
  });
});

describe('Playwright projects and the tag (AQP-199 AC-3)', () => {
  const config = read(fileURLToPath(new URL('../../playwright.config.ts', import.meta.url)));
  /** The object of one project, from its `name:` line to the next project or the end of the list. */
  const project = (name: string): string => {
    const start = config.indexOf(`name: '${name}'`);
    expect(start, `project ${name}`).toBeGreaterThan(-1);
    const rest = config.slice(start + 1);
    const next = rest.search(/\n {4}\{|\n {2}\],/);
    return config.slice(start, next === -1 ? undefined : start + 1 + next);
  };

  it('hides the tagged tests from mobile and tablet, and runs everything in desktop', () => {
    expect(config).toMatch(/const ONE_WIDTH = \/@one-width\/;/);
    expect(project('mobile')).toContain('grepInvert: ONE_WIDTH');
    expect(project('tablet')).toContain('grepInvert: ONE_WIDTH');
    expect(project('desktop')).not.toContain('grep');
  });

  it('keeps one retry and forbidOnly in CI, and runs four workers in CI and two elsewhere', () => {
    expect(config).toContain('retries: 1,');
    expect(config).toContain('forbidOnly: IN_CI,');
    expect(config).toContain('const CI_WORKERS = 4;');
    expect(config).toContain('const LOCAL_WORKERS = 2;');
    expect(config).toContain('workers: IN_CI ? CI_WORKERS : LOCAL_WORKERS,');
  });

  it('widens no timeout: the expectation timeout is still 15 s and no test timeout is set here', () => {
    expect(config).toContain('expect: { timeout: 15_000 }');
    expect(config).not.toMatch(/^\s{2}timeout:/m);
  });
});

describe('set-up warm-up (AQP-199 AC-1)', () => {
  const setup = read(fileURLToPath(new URL('../e2e/auth.setup.ts', import.meta.url)));

  it('opens /, /queue and /design-system on the development server before the width projects start', () => {
    expect(setup).toContain("const WARMED_ROUTES = ['/', '/queue', '/design-system'] as const;");
    expect(setup).toContain('for (const route of WARMED_ROUTES)');
    expect(setup).toContain('await page.goto(`${DEVELOPMENT_URL}${route}`);');
    // The warm-up runs before the signed-in state is saved, so the width projects start only after it.
    expect(setup.indexOf('for (const route of WARMED_ROUTES)')).toBeLessThan(setup.indexOf('context.storageState'));
  });
});
