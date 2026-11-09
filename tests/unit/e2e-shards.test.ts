import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { forEachSpec, listPlaywrightSuites, type ListedSuite } from '../support/playwright-list';

/**
 * AQP-208 AC-3 (NFR-016: every E2E test keeps running). The CI shards split the suite with `--shard=<i>/<N>`. This lists the
 * tests the way CI would (`playwright test --list`, no browser and no server needed), once whole and once per shard, and
 * checks that the shards together hold exactly the whole suite: no test missing and none in two shards. The `setup`
 * project runs once in each shard, against that shard's own database, so it is counted per shard, outside that comparison.
 * N is read from the workflow's matrix, so changing the shard count is covered without editing this test.
 *
 * AQP-227 AC-2 adds three checks of the balance between shards: `fullyParallel` is on (the cause), the shards differ by at most
 * one width test (the effect), and each is within 10 % of the mean (a backstop for a gross imbalance).
 *
 * The listings are slow, so they are made once in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), and
 * the tests read them. A listing that fails reports Playwright's stderr (tests/support/playwright-list.ts, QLT-86).
 */

const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const CONFIG = readFileSync(fileURLToPath(new URL('../../playwright.config.ts', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const MATRIX = /^ {8}shard: \[([\d, ]+)\]$/m.exec(WORKFLOW)?.[1] ?? '';
const SHARD_COUNT = MATRIX.split(',').filter((entry) => entry.trim() !== '').length;

const WIDTHS = ['mobile', 'tablet', 'desktop'];

/** How far a shard's width-test count may be from the mean over the shards: 10 % (AQP-227 AC-2). */
const BALANCE_TOLERANCE = 0.1;

/**
 * One entry per test and project: `project | file:line | describe titles > title`. The describe titles are part of the key
 * because a spec file may declare the same test once per route in a loop (`shell-lazy-load.spec.ts`), at one line. A
 * repeated entry is a test listed twice.
 */
function entriesOf(suites: ReadonlyArray<ListedSuite>): string[] {
  const entries: string[] = [];
  forEachSpec(suites, (spec, blocks) => {
    for (const test of spec.tests) entries.push(`${test.projectName} | ${spec.file}:${spec.line} | ${[...blocks, spec.title].join(' > ')}`);
  });
  return entries.sort();
}

const projectOf = (entry: string): string => entry.split(' | ')[0] ?? '';
const widthTests = (entries: ReadonlyArray<string>): string[] => entries.filter((entry) => WIDTHS.includes(projectOf(entry)));
const setupTests = (entries: ReadonlyArray<string>): string[] => entries.filter((entry) => projectOf(entry) === 'setup');

describe('AQP-208 AC-3: the shards together run every E2E test once, in near-equal counts (AQP-227 AC-2)', () => {
  let whole: string[] = [];
  let shards: string[][] = [];

  beforeAll(async () => {
    // The whole suite is listed first and alone, then the shards together (QLT-04, AQP-227). Playwright keeps compiled specs
    // in a cache (`PWTEST_CACHE_DIR`). On a cold cache, listings that run at the same time race on it, and some report the
    // compiled line of a test instead of its source line (`design-system.spec.ts:112` for the test at line 100). The
    // `file:line` keys then differ between the whole list and a shard, and the union test fails with nothing missing. Once
    // the first listing has filled the cache, the shards only read it. Cold cache, listed together: 4 of 4 probe runs failed;
    // listed in this order: 6 of 6 passed.
    const all = await listPlaywrightSuites();
    const each = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, index) => listPlaywrightSuites({ index: index + 1, total: SHARD_COUNT })));
    whole = entriesOf(all);
    shards = each.map(entriesOf);
  });

  it('has the shard count of the workflow matrix', () => {
    expect(SHARD_COUNT).toBeGreaterThanOrEqual(2);
    expect(shards).toHaveLength(SHARD_COUNT);
  });

  it("the union of the shards' mobile, tablet and desktop lists is the whole list, with none missing and none in two shards", () => {
    const expected = widthTests(whole);
    // The suite is not empty, and every width has tests (a listing that failed quietly would otherwise pass).
    for (const width of WIDTHS) expect(expected.some((entry) => projectOf(entry) === width), width).toBe(true);

    const union = shards.flatMap((shard) => widthTests(shard)).sort();
    // Equal as sorted lists, so a test in two shards shows as a repeat and a test in none shows as missing.
    expect(union).toEqual(expected);
    // Every test of the whole list is listed once (so a repeat in the union can only be a test in two shards).
    expect(new Set(expected).size).toBe(expected.length);
    expect(new Set(union).size).toBe(union.length);
    for (const shard of shards) expect(widthTests(shard).length).toBeGreaterThan(0);
  });

  it('the set-up project runs once in each shard, with the same tests as in the whole list', () => {
    const setup = setupTests(whole);
    expect(setup.length).toBeGreaterThan(0);
    for (const shard of shards) expect(setupTests(shard)).toEqual(setup);
  });

  // AQP-227 AC-2 (test strategy 10.5, "Three shards"): three checks, each catching something the others do not. They count
  // tests, not time; the time spread between shards is reported in the pull request and is not a pass line.
  //
  // 1. The cause. With `fullyParallel`, `--shard` divides the tests themselves, in groups of near-equal count. Without it
  //    Playwright divides by file. On today's suite that split is 163 / 156 / 148 width tests, only 4.9 % from the mean, so
  //    check 3 alone passes a switch to per-file splitting (QLT-01). Check 2 fails it too; this one names the cause. It also
  //    refuses a project-level `fullyParallel: false`.
  it('fullyParallel stays on, so --shard divides the tests and not the files', () => {
    expect(CONFIG).toMatch(/^ {2}fullyParallel: true,$/m);
    expect(CONFIG).not.toMatch(/fullyParallel:\s*false/);
  });

  // 2. The effect. Playwright deals the listed tests into groups that differ by at most one test (156 / 156 / 155 today).
  //    A looser bound would still pass a per-file split of this suite, so the bound is one. A `test.describe.serial` group
  //    is one unit for the split and would break this bound: that is a deliberate signal to ask the solution-architect.
  it('the shards differ by at most one mobile, tablet and desktop test', () => {
    const counts = shards.map((shard) => widthTests(shard).length);
    expect(Math.max(...counts) - Math.min(...counts), `tests per shard: ${counts.join(' / ')}`).toBeLessThanOrEqual(1);
  });

  // 3. A backstop, as AC-2 asks: each shard within 10 % of the mean. It catches a gross imbalance (one very large serial
  //    group, say), which check 2 also catches; it does NOT detect `fullyParallel: false` on today's suite (4.9 %).
  it('each shard holds a number of mobile, tablet and desktop tests within 10 % of the mean over the shards', () => {
    const counts = shards.map((shard) => widthTests(shard).length);
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    expect(mean).toBeGreaterThan(0);
    counts.forEach((count, index) => {
      const deviation = Math.abs(count - mean) / mean;
      const detail = `shard ${index + 1} of ${counts.length} has ${count} tests, the mean is ${mean.toFixed(1)}`;
      expect(deviation, detail).toBeLessThanOrEqual(BALANCE_TOLERANCE);
    });
  });
});
