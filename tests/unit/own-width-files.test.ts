import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { ownWidthFilesOf, projectBlock, readConfig } from '../support/playwright-config';
import { forEachSpec, listPlaywrightSuites } from '../support/playwright-list';

/**
 * AQP-244 AC-2 (STORY-10.20; test strategy section 10.5 item 9): the own-width files are listed in the `desktop` project only.
 *
 * A spec that sets its own widths runs once, in `desktop`, and skips in `mobile` and `tablet`. Before this change those two
 * projects still LISTED its tests, so `--shard` (which divides listed tests) gave shards 1 and 2 about 108 entries that cost
 * nothing, and shard 3, which holds the `desktop` block, got the work (AQP-244 AC-1, comment 11338). `OWN_WIDTH_FILES` in
 * `playwright.config.ts` ends that: `mobile` and `tablet` add the files to their `testIgnore`. Each test still runs once.
 *
 * This file holds the guards of the list: (a) the names are pinned here and match the specs' own skip lines, (b) each file skips
 * at FILE level, so a test added to it later cannot lose a width without a visible change, (c) the config ignores the files in
 * `mobile` and `tablet` and in no other project, and (d) Playwright's own listing agrees. The union test and the count-balance
 * assertions of `e2e-shards.test.ts` are unchanged and still pass. Each guard was shown red on a plant: a third file with the
 * skip line, an entry dropped from the list, `tablet` without the ignore, and the skip moved from file level into a describe.
 */

const E2E_DIRECTORY = fileURLToPath(new URL('../e2e/', import.meta.url));
const CONFIG = readConfig();
const OWN_WIDTH_FILES = ownWidthFilesOf(CONFIG);

/**
 * The two files ruled in test strategy 10.5 item 9 (rulings 11342, 11367). The list in the config is read from its text, so
 * without this pin a new entry plus a skip line would turn every guard green with no test edit. Adding a file is an edit of
 * BOTH this constant and `OWN_WIDTH_FILES`, after a ruling there, as for the `@one-width` allow-list (section 10 review rule).
 */
const RULED_OWN_WIDTH_FILES: ReadonlyArray<string> = ['aqp-234-qa.spec.ts', 'masters-table-actions.spec.ts'];

/**
 * A `test.skip(...)` whose condition is true in every project but `desktop`. Two spellings exist in the suite:
 * `testInfo.project.name !== 'desktop'` (the own-width files, either quote) and `!isDesktopProject(testInfo.project.name)`.
 */
const SKIPS_EVERY_NON_DESKTOP_PROJECT = /test\.skip\(\s*(?:[\w.]*project\.name\s*!==?\s*['"]desktop['"]|!isDesktopProject\()/;

/**
 * The file-level form: a `test.beforeEach` at column 0 whose body skips outside `desktop`, so every test of the file, present and
 * future, skips there (QLT-01). Inside a describe block the hook is indented and does not match.
 */
const FILE_LEVEL_DESKTOP_ONLY = /^test\.beforeEach\(\(\{\}, testInfo\) => \{\n {2}test\.skip\(testInfo\.project\.name !== ['"]desktop['"],/m;

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
  it('is exactly the two files ruled in test strategy 10.5 item 9, and no other', () => {
    expect([...OWN_WIDTH_FILES], 'add a file to OWN_WIDTH_FILES and to RULED_OWN_WIDTH_FILES only after a ruling in test strategy 10.5').toEqual([...RULED_OWN_WIDTH_FILES]);
  });

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

  // (b) QLT-01. The listing keeps these files in `desktop` only, so the skip must cover the whole file. A hook inside a describe
  // leaves a test added outside it running in `desktop` only by accident, where it used to run at three widths.
  it('skips outside desktop at file level in each own-width file, so a test added to it cannot lose a width by accident', () => {
    for (const file of OWN_WIDTH_FILES) {
      expect(FILE_LEVEL_DESKTOP_ONLY.test(read(file)), `${file}: a column-0 test.beforeEach with test.skip(testInfo.project.name !== 'desktop', ...)`).toBe(true);
    }
  });

  it('keeps the partly desktop-only files out of the list, and they still use the pattern', () => {
    for (const file of PARTLY_DESKTOP_ONLY) {
      expect(OWN_WIDTH_FILES, file).not.toContain(file);
      expect(SKIPS_EVERY_NON_DESKTOP_PROJECT.test(read(file)), `${file} still uses the pattern`).toBe(true);
    }
  });

  // (c)
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

// (d)
describe('the listing, as Playwright makes it (AQP-244 AC-2)', () => {
  interface ListedEntry {
    readonly file: string;
    readonly title: string;
    readonly tagged: boolean;
    readonly projects: ReadonlyArray<string>;
  }
  const entries: ListedEntry[] = [];
  // The listing is slow, so it runs once, in a hook, under the shared hook limit (vitest.config.ts, DL-057).
  beforeAll(async () => {
    forEachSpec(await listPlaywrightSuites(), (spec, blocks) => {
      entries.push({ file: spec.file, title: [...blocks, spec.title].join(' > '), tagged: (spec.tags ?? []).includes('one-width'), projects: spec.tests.map((test) => test.projectName) });
    });
  });

  it('lists the tests of each own-width file in desktop only, and each file has tests', () => {
    for (const file of OWN_WIDTH_FILES) {
      const projects = entries.filter((entry) => entry.file === file).flatMap((entry) => entry.projects);
      expect(projects.length, `${file} is listed`).toBeGreaterThan(0);
      expect(new Set(projects), `${file} runs in desktop only`).toEqual(new Set(['desktop']));
    }
  });

  // QLT-02. A test outside the list runs at all three widths, or in desktop only when it carries @one-width (section 10.5).
  it('lists every test outside the own-width files in all three width projects, or in desktop only with @one-width', () => {
    // A loop can declare one title several times in a file (shell-lazy-load.spec.ts), so the projects are gathered per title.
    const byTitle = new Map<string, { tagged: boolean; projects: string[] }>();
    for (const entry of entries) {
      if (entry.file === 'auth.setup.ts' || OWN_WIDTH_FILES.includes(entry.file)) continue;
      const key = `${entry.file} > ${entry.title}`;
      const found = byTitle.get(key) ?? { tagged: false, projects: [] };
      found.tagged = found.tagged || entry.tagged;
      found.projects.push(...entry.projects);
      byTitle.set(key, found);
    }
    expect(byTitle.size).toBeGreaterThan(0);
    for (const [key, found] of byTitle) {
      const expected = found.tagged ? ['desktop'] : ['desktop', 'mobile', 'tablet'];
      expect(new Set(found.projects), key).toEqual(new Set(expected));
    }
  });
});
