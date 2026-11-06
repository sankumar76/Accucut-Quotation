import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

/**
 * AQP-208 AC-3 (NFR-016: every E2E test keeps running). The CI shards split the suite with `--shard=<i>/<N>`. This lists the
 * tests the way CI would (`playwright test --list`, no browser and no server needed), once whole and once per shard, and
 * checks that the shards together hold exactly the whole suite: no test missing and none in two shards. The `setup`
 * project runs once in each shard, against that shard's own database, so it is counted per shard, outside that comparison.
 * N is read from the workflow's matrix, so changing the shard count is covered without editing this test.
 */

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve('@playwright/test/cli');

interface Spec {
  readonly title: string;
  readonly file: string;
  readonly line: number;
  readonly tests: ReadonlyArray<{ readonly projectName: string }>;
}
interface Suite {
  readonly title: string;
  readonly specs?: ReadonlyArray<Spec>;
  readonly suites?: ReadonlyArray<Suite>;
}

/**
 * One entry per test and project: `project | file:line | describe titles > title`. The describe titles are part of the key
 * because a spec file may declare the same test once per route in a loop (`shell-lazy-load.spec.ts`), at one line. A
 * repeated entry is a test listed twice.
 */
async function list(shard?: { index: number; total: number }): Promise<string[]> {
  const args = [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json', ...(shard === undefined ? [] : [`--shard=${shard.index}/${shard.total}`])];
  const { stdout } = await run(process.execPath, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: 'true' } });
  const entries: string[] = [];
  const walk = (suite: Suite, path: ReadonlyArray<string>): void => {
    const here = [...path, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) entries.push(`${test.projectName} | ${spec.file}:${spec.line} | ${[...here, spec.title].join(' > ')}`);
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of (JSON.parse(stdout) as { suites: Suite[] }).suites) walk(suite, []);
  return entries.sort();
}

const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const MATRIX = /^ {8}shard: \[([\d, ]+)\]$/m.exec(WORKFLOW)?.[1] ?? '';
const SHARD_COUNT = MATRIX.split(',').filter((entry) => entry.trim() !== '').length;

const projectOf = (entry: string): string => entry.split(' | ')[0] ?? '';
const WIDTHS = ['mobile', 'tablet', 'desktop'];
const widthTests = (entries: ReadonlyArray<string>): string[] => entries.filter((entry) => WIDTHS.includes(projectOf(entry)));
const setupTests = (entries: ReadonlyArray<string>): string[] => entries.filter((entry) => projectOf(entry) === 'setup');

/** The whole list, then each shard's, listed together (the listings are slow, so every test shares them). */
let listings: Promise<{ whole: string[]; shards: string[][] }> | undefined;
function allListings(): Promise<{ whole: string[]; shards: string[][] }> {
  listings ??= Promise.all([list(), ...Array.from({ length: SHARD_COUNT }, (_, index) => list({ index: index + 1, total: SHARD_COUNT }))]).then(
    ([whole, ...shards]) => ({ whole: whole ?? [], shards }),
  );
  return listings;
}

describe('AQP-208 AC-3: the shards together run every E2E test once', () => {
  it('has the shard count of the workflow matrix', () => {
    expect(SHARD_COUNT).toBeGreaterThanOrEqual(2);
  });

  it(
    "the union of the shards' mobile, tablet and desktop lists is the whole list, with none missing and none in two shards",
    async () => {
      const { whole, shards } = await allListings();
      const expected = widthTests(whole);
      // The suite is not empty, and every width has tests (a listing that failed quietly would otherwise pass).
      for (const width of WIDTHS) expect(expected.some((entry) => projectOf(entry) === width), width).toBe(true);

      const union = shards.flatMap((shard) => widthTests(shard)).sort();
      // Equal as sorted lists, so a test in two shards shows as a repeat and a test in none shows as missing.
      expect(union).toEqual(expected);
      // Every test of the whole list is listed once (so a repeat in the union can only be a test in two shards).
      expect(new Set(expected).size).toBe(expected.length);
      expect(new Set(union).size).toBe(union.length);
      expect(shards).toHaveLength(SHARD_COUNT);
      for (const shard of shards) expect(widthTests(shard).length).toBeGreaterThan(0);
    },
    120_000,
  );

  it(
    'the set-up project runs once in each shard, with the same tests as in the whole list',
    async () => {
      const { whole, shards } = await allListings();
      const setup = setupTests(whole);
      expect(setup.length).toBeGreaterThan(0);
      for (const shard of shards) expect(setupTests(shard)).toEqual(setup);
    },
    120_000,
  );
});
