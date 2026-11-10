import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { ownWidthFilesOf, projectBlock, readConfig } from '../support/own-width-files';
import { forEachSpec, listPlaywrightSuites } from '../support/playwright-list';

/**
 * AQP-244 AC-2 (STORY-10.20; test strategy section 10.5 item 9): the own-width files are listed in the `desktop` project only.
 *
 * A spec that sets its own widths runs once, in `desktop`, and skips in `mobile` and `tablet`. Before this change those two
 * projects still LISTED its tests, so `--shard` (which divides listed tests) gave shards 1 and 2 about 114 entries that cost
 * nothing, and shard 3, which holds the `desktop` block, got the work (AQP-244 AC-1, comment 11338). `OWN_WIDTH_FILES` in
 * `playwright.config.ts` ends that: `mobile` and `tablet` add the files to their `testIgnore`. Each test still runs once.
 *
 * Three guards, each red on its own plant (see the pull request):
 *   (a) a source scan: every spec file that skips every non-desktop project is in the list, and every entry is such a file;
 *   (b) a project check on the config text, and Playwright's own listing: `mobile` and `tablet` list none of these files,
 *       `desktop` lists all of them;
 *   (c) the union test and the count-balance assertions of `e2e-shards.test.ts` are unchanged and still pass.
 * A file joins the list only after a ruling in test strategy 10.5, as for the `@one-width` allow-list (section 10 review rule).
 */

const E2E_DIRECTORY = fileURLToPath(new URL('../e2e/', import.meta.url));
const CONFIG = readConfig();
const OWN_WIDTH_FILES = ownWidthFilesOf(CONFIG);

/**
 * A `test.skip(...)` whose condition is true in every project but `desktop`. Two spellings exist in the suite:
 * `testInfo.project.name !== 'desktop'` (the own-width files) and `!isDesktopProject(testInfo.project.name)`.
 */
const SKIPS_EVERY_NON_DESKTOP_PROJECT = /test\.skip\(\s*(?:[\w.]*project\.name\s*!==\s*'desktop'|!isDesktopProject\()/;

/**
 * Files that use the pattern for ONE describe block while their other tests run at all three widths, so a file-level
 * `testIgnore` would drop tests that must run in `mobile` and `tablet`. They are not own-width files. Adding a file here is
 * a ruling in test strategy 10.5, like an entry in the list.
 */
const PARTLY_DESKTOP_ONLY: ReadonlyArray<string> = ['shell.spec.ts'];

const specFiles = (): string[] =>
  readdirSync(E2E_DIRECTORY, { recursive: true, encoding: 'utf8' })
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.spec.ts'))
    .sort();

const read = (file: string): string => readFileSync(`${E2E_DIRECTORY}${file}`, 'utf8').replaceAll('\r\n', '\n');

describe('OWN_WIDTH_FILES in playwright.config.ts (AQP-244 AC-2)', () => {
  it('names spec files of tests/e2e, once each, by file name', () => {
    expect(OWN_WIDTH_FILES.length).toBeGreaterThan(0);
    expect(new Set(OWN_WIDTH_FILES).size).toBe(OWN_WIDTH_FILES.length);
    for (const file of OWN_WIDTH_FILES) {
      expect(file, 'a file name, not a path or a pattern').toMatch(/^[\w.-]+\.spec\.ts$/);
      expect(existsSync(`${E2E_DIRECTORY}${file}`), `${file} exists in tests/e2e`).toBe(true);
    }
  });

  // (a) The scan. A planted third file with the same `test.skip` line fails the first expectation; an entry whose file no
  // longer skips by project fails the second.
  it('holds every spec that skips every non-desktop project, and only those', () => {
    const skipping = specFiles().filter((file) => SKIPS_EVERY_NON_DESKTOP_PROJECT.test(read(file)) && !PARTLY_DESKTOP_ONLY.includes(file));
    expect(skipping, 'add the file to OWN_WIDTH_FILES after a ruling in test strategy 10.5').toEqual([...OWN_WIDTH_FILES].sort());
  });

  it('keeps the partly desktop-only files out of the list, and they still use the pattern', () => {
    for (const file of PARTLY_DESKTOP_ONLY) {
      expect(OWN_WIDTH_FILES, file).not.toContain(file);
      expect(SKIPS_EVERY_NON_DESKTOP_PROJECT.test(read(file)), `${file} still uses the pattern`).toBe(true);
    }
  });

  it('is added to the testIgnore of mobile and tablet, and of no other project', () => {
    for (const name of ['mobile', 'tablet']) {
      const block = projectBlock(CONFIG, name);
      expect(block, name).toMatch(/testIgnore: \['\*\*\/auth\.setup\.ts', \.\.\.OWN_WIDTH_FILES\.map\(\(file\) => `\*\*\/\$\{file\}`\)\],/);
    }
    // desktop runs the files, and the set-up project is not touched.
    expect(projectBlock(CONFIG, 'desktop')).not.toContain('OWN_WIDTH_FILES');
    expect(projectBlock(CONFIG, 'setup')).not.toContain('OWN_WIDTH_FILES');
  });
});

describe('the listing, as Playwright makes it (AQP-244 AC-2, guard (b))', () => {
  const projectsByFile = new Map<string, string[]>();
  // The listing is slow, so it runs once, in a hook, under the shared hook limit (vitest.config.ts, DL-057).
  beforeAll(async () => {
    forEachSpec(await listPlaywrightSuites(), (spec) => {
      const projects = projectsByFile.get(spec.file) ?? [];
      projects.push(...spec.tests.map((test) => test.projectName));
      projectsByFile.set(spec.file, projects);
    });
  });

  it('lists the tests of each own-width file in desktop only, and each file has tests', () => {
    for (const file of OWN_WIDTH_FILES) {
      const projects = projectsByFile.get(file) ?? [];
      expect(projects.length, `${file} is listed`).toBeGreaterThan(0);
      expect(new Set(projects), `${file} runs in desktop only`).toEqual(new Set(['desktop']));
    }
  });

  it('still lists every other spec file in all three width projects (or one, for @one-width tests)', () => {
    for (const [file, projects] of projectsByFile) {
      if (file === 'auth.setup.ts' || OWN_WIDTH_FILES.includes(file)) continue;
      expect(new Set(projects), file).toContain('desktop');
      // A file with a mix of tagged and untagged tests lists mobile and tablet for the untagged ones.
      if (projects.some((project) => project !== 'desktop')) expect(new Set(projects), file).toEqual(new Set(['mobile', 'tablet', 'desktop']));
    }
  });
});
