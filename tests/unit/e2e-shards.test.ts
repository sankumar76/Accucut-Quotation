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
 * The listings are slow, so they are made once in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), and
 * the tests read them. A listing that fails reports Playwright's stderr (tests/support/playwright-list.ts, QLT-86).
 */

const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const MATRIX = /^ {8}shard: \[([\d, ]+)\]$/m.exec(WORKFLOW)?.[1] ?? '';
const SHARD_COUNT = MATRIX.split(',').filter((entry) => entry.trim() !== '').length;

const WIDTHS = ['mobile', 'tablet', 'desktop'];

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

describe('AQP-208 AC-3: the shards together run every E2E test once', () => {
  let whole: string[] = [];
  let shards: string[][] = [];

  beforeAll(async () => {
    const [all, ...each] = await Promise.all([
      listPlaywrightSuites(),
      ...Array.from({ length: SHARD_COUNT }, (_, index) => listPlaywrightSuites({ index: index + 1, total: SHARD_COUNT })),
    ]);
    whole = entriesOf(all ?? []);
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
});
