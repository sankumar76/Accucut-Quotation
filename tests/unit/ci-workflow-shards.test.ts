import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * AQP-227 AC-1 and AQP-208 AC-4, the parts of the workflow guard that `ci-workflow.test.ts` (near its 400-line limit) does not
 * carry: nothing in the `e2e` job's strategy may change the number of shards at run time, and neither of the two jobs behind
 * the required check may continue on error. Like that file, this reads the workflow text: the workflow cannot run in a unit test.
 */

// A Windows checkout with Git's default autocrlf writes CRLF; the checks below expect LF (DEF-002).
const LINES = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8')
  .replaceAll('\r\n', '\n')
  .split('\n');

/** The text of one job, from its key (two spaces under `jobs:`) to the next job's key. */
function jobBlock(id: string): string {
  const jobs = LINES.slice(LINES.indexOf('jobs:') + 1);
  const start = jobs.indexOf(`  ${id}:`);
  if (start === -1) throw new Error(`No job "${id}"`);
  const rest = jobs.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[\w-]+:\s*$/.test(line));
  return rest.slice(0, end === -1 ? undefined : end).join('\n');
}

/** The lines under `strategy:` of one job, without comment lines. A strategy written inline fails here, so it fails closed. */
function strategyBlock(id: string): string {
  const lines = jobBlock(id)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'));
  const start = lines.indexOf('    strategy:');
  expect(start, `job ${id}: a block "strategy:" at 4 spaces`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() !== '' && !line.startsWith('      '));
  return rest.slice(0, end === -1 ? undefined : end).join('\n').trimEnd();
}

describe('CI workflow: the shards behind the required check (AQP-227)', () => {
  // QLT-02. `exclude` of shard 4 runs three shards (`strategy.job-total` is 3) and `include` of shard 5 runs five, while the
  // `shard: [1, 2, 3, 4]` line, which `ci-workflow.test.ts` and `e2e-shards.test.ts` read, still says four. `max-parallel`
  // would serialise the shards and lose the time the fourth shard buys.
  it('AC-1: the e2e strategy has no include, exclude or max-parallel', () => {
    expect(strategyBlock('e2e')).not.toMatch(/\b(include|exclude|max-parallel)\b/);
  });

  // The same class: a second matrix dimension would multiply the jobs. Together with the shard list this pins the whole block.
  it('AC-1: the e2e strategy holds only fail-fast: false and the one-line shard list', () => {
    expect(strategyBlock('e2e')).toBe('      fail-fast: false\n      matrix:\n        shard: [1, 2, 3, 4]');
  });

  // QLT-03 (AQP-208 AC-4). A job-level `continue-on-error` stops a failed job from failing the run, so a
  // failing shard would merge past the one required check. The fan-in job and the Stage 12 step are guarded elsewhere.
  it.each(['verify', 'e2e'])('AQP-208 AC-4: the %s job does not continue on error', (id) => {
    expect(jobBlock(id)).not.toMatch(/^ {4}continue-on-error:/m);
  });
});
