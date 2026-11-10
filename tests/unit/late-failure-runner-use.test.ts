import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Tech-debt #130, requirement 2: every audited master's integration test makes its late failure with the shared runner
 * (`tests/support/late-failure-runner.ts`) and never with a runner of its own. A local runner that throws after every `run` rolls back a
 * second transaction opened inside the change as well, so a bypass passes (OBS-1 of the AQP-122 G7 report, DEF-017 class, DL-107).
 *
 * The check reads the test files as text. A file that hands its own `transactions` to `buildMastersService`, or declares a function that
 * returns a `TransactionRunner`, must import `createLateFailingRunner`, and must not write a `run` method of its own.
 */

const MASTERS_TESTS = join(process.cwd(), 'tests', 'integration', 'masters');

/** The problems in one test file's text, as short sentences. Empty when the file is clean. */
function localRunnerProblems(source: string): string[] {
  const problems: string[] = [];
  const injectsRunner = /buildMastersService\(\s*\{[^}]*\btransactions\s*:/.test(source) || /\)\s*:\s*TransactionRunner\b/.test(source);
  if (injectsRunner && !/\bcreateLateFailingRunner\b/.test(source)) problems.push('uses a runner without createLateFailingRunner');
  if (/\brun\s*:\s*\(?\s*work\b|\brun\s*\(\s*work\b|\brun\s*<\s*T\s*>\s*\(/.test(source)) problems.push('declares a run method of its own');
  return problems;
}

describe('the masters integration tests use the shared late-failure runner (#130)', () => {
  const files = readdirSync(MASTERS_TESTS).filter((name) => name.endsWith('.test.ts'));

  it('finds the masters integration tests it is meant to guard', () => {
    expect(files).toEqual(expect.arrayContaining(['materials.test.ts', 'process-items.test.ts']));
  });

  it.each(files)('%s has no runner of its own', (name) => {
    expect(localRunnerProblems(readFileSync(join(MASTERS_TESTS, name), 'utf8'))).toEqual([]);
  });

  describe('the check itself (a plant per form of the fault)', () => {
    const local = `function failingAfterTheLastStep(): TransactionRunner {
      const real = createTransactionRunner(db.prisma);
      return { run: (work) => real.run(async (tx) => { await work(tx); throw new Error('late'); }) };
    }
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });`;

    it('refuses a local runner that throws after every run', () => {
      expect(localRunnerProblems(local)).toEqual(['uses a runner without createLateFailingRunner', 'declares a run method of its own']);
    });

    it('refuses a generic run method even when the shared runner is also imported', () => {
      expect(localRunnerProblems(`import { createLateFailingRunner } from 'x';\n${local}`)).toEqual(['declares a run method of its own']);
    });

    it('refuses a service given a runner the file did not take from the shared helper', () => {
      expect(localRunnerProblems('const s = db.buildMastersService({ transactions: someRunner });')).toEqual(['uses a runner without createLateFailingRunner']);
    });

    it('accepts the shared runner', () => {
      const shared = `import { createLateFailingRunner } from 'x';
      function failingAfterTheLastStep(): TransactionRunner { return createLateFailingRunner(real, new Error('late')); }
      const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });`;
      expect(localRunnerProblems(shared)).toEqual([]);
    });
  });
});
