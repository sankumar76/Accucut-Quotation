import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * AQP-199 AC-3 (STORY-10.14; test strategy section 10.5): a test that reads no layout may be tagged `@one-width`, which
 * runs it in the desktop project only. The tag hides a test from the mobile and tablet projects, so it is allowed in
 * exactly seven spec files, ruled one by one in section 10.5 (four from AQP-199, two from AQP-65, one from its G7), and on exactly the 35 tests
 * pinned below. Tagging a test anywhere else, or tagging another test in one of the seven files (for example inside a block that the ruling keeps at
 * three widths), fails here until the ruling and this list are both changed. The E2E suite cannot run in a unit test, so
 * this reads the text of the specs and of the Playwright configuration, and asks Playwright itself to list the tests.
 */

const TAG = '@one-width';
const E2E_DIRECTORY = fileURLToPath(new URL('../e2e/', import.meta.url));
const PLAYWRIGHT_CLI = fileURLToPath(new URL('../../node_modules/@playwright/test/cli.js', import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WIDTH_PROJECTS = ['mobile', 'tablet', 'desktop'] as const;

/** The seven files section 10.5 rules on. Paths are relative to `tests/e2e`, with forward slashes. */
const RULED_FILES: ReadonlyArray<string> = [
  'aqp-38-qa.spec.ts',
  'axe-helper.spec.ts',
  'production-routes.spec.ts',
  'sign-in.spec.ts',
  'users-production.spec.ts',
  'users.spec.ts',
  'aqp-65-qa.spec.ts',
];

/**
 * The 35 tests ruled to run at one width, as `file > blocks > title`: 22 from AQP-199, 12 from AQP-65 and 1 from its G7 (all of
 * users-production.spec.ts, and seven in users.spec.ts). Everything else keeps three widths, in particular
 * "SCR-01 at this width (AC-8)" and the account-menu test in sign-in.spec.ts, the AC-8 keyboard and screen-reader
 * block and the locked and "could not be checked" states in aqp-38-qa.spec.ts, and in users.spec.ts the list (scroll and
 * axe), the 44 px test, the keyboard test of the add dialog, the field-message test, and the reset and deactivate dialogs
 * (test strategy section 10.5).
 */
const ONE_WIDTH_TESTS: ReadonlyArray<string> = [
  'aqp-38-qa.spec.ts > [AQP-38 AC-4, AC-6] sessions and return addresses in the browser > [AQP-38 AC-4] a copied cookie on a second device is dead after sign-out on the first: it is sent to sign in, the page renders, and it can sign in again',
  'aqp-38-qa.spec.ts > [AQP-38 AC-4, AC-6] sessions and return addresses in the browser > [AQP-38 AC-6] a signed-in visitor sent to /sign-in with a hostile return address is taken home, not away',
  'aqp-38-qa.spec.ts > [AQP-38 AC-4, AC-6] sessions and return addresses in the browser > [AQP-38 AC-6] signing in from a link with a hostile return address lands at home on this site',
  'axe-helper.spec.ts > DEF-009 (control): a scan that does not wait does see the start colour, so the test above can fail',
  'axe-helper.spec.ts > DEF-009: the shared axe helper scans after the transition, so the settled colours are judged, not the blend',
  'axe-helper.spec.ts > DEF-009: the wait does not wait for an animation that never ends, such as a spinner',
  'axe-helper.spec.ts > DEF-009: the wait returns at once when nothing is animating',
  'axe-helper.spec.ts > DEF-009: the wait returns only after a running transition has reached its end value',
  'production-routes.spec.ts > AC-7: /design-system is not found in the production build, for a signed-in Lead',
  'production-routes.spec.ts > AC-7: a signed-out visitor is sent to the sign-in page, which says nothing about the route',
  'sign-in.spec.ts > AC-1: the person lands on their role\'s home > a Lead lands on "Task queue" with the empty-state text of SCR-03',
  'sign-in.spec.ts > AC-1: the person lands on their role\'s home > an Engineer lands on "My tasks" with the empty-state text of SCR-03',
  'sign-in.spec.ts > AC-2: one message for every failure > a wrong password shows the same message, keeps both fields as typed, and moves focus to the notice',
  'sign-in.spec.ts > AC-2: one message for every failure > an unknown e-mail shows the same message, keeps both fields as typed, and moves focus to the notice',
  'sign-in.spec.ts > AC-3: five failures block the account > the sixth attempt shows the locked message, also for a correct password and also for an unknown e-mail',
  'sign-in.spec.ts > AC-4: sign-out > a visitor who asks for a protected page is sent to sign in, and comes back to it afterwards',
  'sign-in.spec.ts > AC-4: sign-out > clears the session, sends the next request to the sign-in page, and the back button shows nothing protected',
  'sign-in.spec.ts > AC-5: the session cookie in the production build > has the __Secure- prefix, HttpOnly, Secure and SameSite=Lax',
  'sign-in.spec.ts > AC-6: only a same-origin relative path is honoured as the place to go > a protocol-relative address (//evil.example) is ignored: the person goes to their home',
  'sign-in.spec.ts > AC-6: only a same-origin relative path is honoured as the place to go > a slash and a backslash (/\\evil.example) is ignored: the person goes to their home',
  'sign-in.spec.ts > AC-6: only a same-origin relative path is honoured as the place to go > an absolute address (https://evil.example) is ignored: the person goes to their home',
  'sign-in.spec.ts > the form checks before it sends > asks for an e-mail address and a password in the words of SCR-01',
  // AQP-65 (STORY-01.04): the production-build 403 file in full, and the Users tests that read no layout.
  'users-production.spec.ts > a Lead on the production build > TD-06: /users answers HTTP 403 with the "no access" page and no page data',
  'users-production.spec.ts > a Lead on the production build > the API refuses with the same fixed 403 for a real ID and an invented one, and sends no data',
  'users-production.spec.ts > a Engineer on the production build > TD-06: /users answers HTTP 403 with the "no access" page and no page data',
  'users-production.spec.ts > a Engineer on the production build > the API refuses with the same fixed 403 for a real ID and an invented one, and sends no data',
  'users-production.spec.ts > a signed-out visitor is sent to the sign-in page and sees nothing of /users',
  'users.spec.ts > the list > AC-4: the own row cannot be deactivated: the control is disabled and its name says why',
  'users.spec.ts > the list > STD-01: the own row cannot be reset either: the control is disabled and its name says why',
  'users.spec.ts > add a user (AC-1, AC-3, AC-7) > adds a person, shows them in the list, and never shows the password',
  'users.spec.ts > add a user (AC-1, AC-3, AC-7) > refuses an e-mail that is already used, whatever its letter case',
  'users.spec.ts > add a user (AC-1, AC-3, AC-7) > AC-3: a second Admin is refused, the current Admin is named, and nobody is added',
  'users.spec.ts > edit (AC-1) > changes the name and the role of a person',
  'users.spec.ts > edit (AC-1) > AC-4: the Admin cannot change their own role: the role list is disabled and says why',
  // AQP-65 G7: QA's no-change Edit check reads no layout (architect, Jira 11046; test strategy v0.20 section 10.5).
  'aqp-65-qa.spec.ts > [AQP-65 AC-1] edit with no change closes the dialog and sends no request',
];

// A Windows checkout with Git's default autocrlf writes CRLF; the checks below expect LF (DEF-002).
const read = (path: string): string => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

const E2E_FILES = readdirSync(E2E_DIRECTORY, { recursive: true, encoding: 'utf8' })
  .map((path) => path.replaceAll('\\', '/'))
  .filter((path) => path.endsWith('.ts'))
  .sort();

describe('@one-width allow-list (AQP-199 AC-3)', () => {
  it('finds the E2E files it is meant to guard', () => {
    // A path or a read that quietly found nothing would make the guard below pass for the wrong reason.
    expect(E2E_FILES.length).toBeGreaterThan(RULED_FILES.length);
    for (const file of RULED_FILES) expect(E2E_FILES).toContain(file);
  });

  it('appears in no file of tests/e2e except the seven ruled in test strategy section 10.5', () => {
    const tagged = E2E_FILES.filter((file) => read(`${E2E_DIRECTORY}${file}`).includes(TAG));
    expect(tagged.filter((file) => !RULED_FILES.includes(file))).toEqual([]);
  });

  it('is spelled the same everywhere, so grepInvert matches every use of it', () => {
    // A near miss ("@one_width", "@onewidth", "@one-widths") would leave a test at three widths, or hide it from none.
    for (const file of E2E_FILES) {
      const spellings = read(`${E2E_DIRECTORY}${file}`).match(/@one[-_ ]?width\w*/gi) ?? [];
      for (const spelling of spellings) expect(spelling, file).toBe(TAG);
    }
  });
});

/** What `playwright test --list --reporter=json` prints, reduced to what this test reads. */
interface ListedSuite {
  readonly title: string;
  readonly specs?: ReadonlyArray<ListedSpec> | undefined;
  readonly suites?: ReadonlyArray<ListedSuite> | undefined;
}
interface ListedSpec {
  readonly title: string;
  readonly file: string;
  readonly tags?: ReadonlyArray<string> | undefined;
  readonly tests: ReadonlyArray<{ readonly projectName: string }>;
}
const specSchema = z.object({
  title: z.string(),
  file: z.string(),
  tags: z.array(z.string()).optional(),
  tests: z.array(z.object({ projectName: z.string() })),
});
const suiteSchema: z.ZodType<ListedSuite> = z.lazy(() =>
  z.object({ title: z.string(), specs: z.array(specSchema).optional(), suites: z.array(suiteSchema).optional() }),
);

/** One test of the real suite as Playwright lists it, with the projects it runs in. */
interface ListedTest {
  readonly key: string;
  readonly tagged: boolean;
  readonly projects: ReadonlyArray<string>;
}

function listTests(): ListedTest[] {
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 90_000,
  });
  if (result.status !== 0) throw new Error(`playwright test --list exited with ${String(result.status)}: ${result.stderr.slice(0, 500)}`);
  const parsed = z.object({ suites: z.array(suiteSchema) }).parse(JSON.parse(result.stdout));
  const found = new Map<string, { tagged: boolean; projects: string[] }>();
  const visit = (suite: ListedSuite, blocks: ReadonlyArray<string>): void => {
    for (const spec of suite.specs ?? []) {
      const key = [spec.file, ...blocks, spec.title].join(' > ');
      const entry = found.get(key) ?? { tagged: false, projects: [] };
      entry.tagged = entry.tagged || (spec.tags ?? []).includes(TAG.slice(1));
      entry.projects.push(...spec.tests.map((test) => test.projectName));
      found.set(key, entry);
    }
    for (const child of suite.suites ?? []) visit(child, [...blocks, child.title]);
  };
  // The first level of suites is the file, which the key already starts with.
  for (const file of parsed.suites) visit(file, []);
  return [...found.entries()].map(([key, entry]) => ({ key, tagged: entry.tagged, projects: entry.projects.sort() }));
}

describe('the tests that carry @one-width, as Playwright lists them (AQP-199 AC-3)', () => {
  let listed: ListedTest[] = [];
  beforeAll(() => {
    listed = listTests();
  }, 90_000);

  it('are exactly the 35 tests ruled in test strategy section 10.5, by title', () => {
    const tagged = listed.filter((test) => test.tagged).map((test) => test.key).sort();
    expect(tagged).toEqual([...ONE_WIDTH_TESTS].sort());
    expect(ONE_WIDTH_TESTS).toHaveLength(35);
  });

  it('run in the desktop project only, and every other test runs in all three width projects', () => {
    expect(listed.length).toBeGreaterThan(ONE_WIDTH_TESTS.length);
    for (const test of listed) {
      if (test.key.startsWith('auth.setup.ts > ')) {
        expect(test.projects, test.key).toEqual(['setup']);
      } else if (test.tagged) {
        expect(test.projects, test.key).toEqual(['desktop']);
      } else {
        expect(test.projects, test.key).toEqual([...WIDTH_PROJECTS].sort());
      }
    }
  });

  it('keep the layout tests of the ruled files at three widths', () => {
    const keptAtThree = listed.filter(
      (test) =>
        test.key.startsWith('sign-in.spec.ts > SCR-01 at this width (AC-8) > ') ||
        test.key === 'sign-in.spec.ts > AC-1: the person lands on their role\'s home > the account menu shows who is signed in, with the e-mail and the role' ||
        test.key.startsWith('aqp-38-qa.spec.ts > [AQP-38 AC-8] keyboard and screen reader on SCR-01 > ') ||
        test.key.startsWith('aqp-38-qa.spec.ts > [AQP-38 AC-3, AC-8] the locked and "could not be checked" states > '),
    );
    // 6 SCR-01 tests, the account-menu test, 4 keyboard and screen-reader tests, 3 locked / 503 / network tests.
    expect(keptAtThree).toHaveLength(14);
    for (const test of keptAtThree) {
      expect(test.tagged, test.key).toBe(false);
      expect(test.projects, test.key).toEqual([...WIDTH_PROJECTS].sort());
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
