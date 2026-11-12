import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

import { type AuditTransactionReport, checkAuditTransactions, createServicesProgram, serviceFilesUnder } from '../support/audit-transaction-check';
import { type Case, filesOf, fixtureSources, OPEN_LIMITS, PASSING } from '../support/audit-transaction-cases';
import { FAILING } from '../support/audit-transaction-failing-cases';

/**
 * STORY-10.18 (GitHub #104; architecture section 6): every use of `AuditService.record` in `src/server/services` runs in the transaction
 * of the change it records. `AuditService.record` takes the change's `Transaction`; this test reads the services with the TypeScript
 * type checker (the options of `tsconfig.json`) and refuses a `record` that is not awaited in a `.run(` callback of a
 * `TransactionRunner` (or in a helper reached from one in at most 3 calls, each awaited, each in the function whose parameter it passes),
 * or whose callback passes its transaction to no repository call other than `record`. The rule is in `tests/support/audit-transaction-check.ts`,
 * with the list of what it does not see; the cases are in `tests/support/audit-transaction-cases.ts`. The lint half (only `transaction.ts`
 * and `tests/**` may import `createTransactionHandle`) is `tests/unit/lint/transaction-handle-rule.test.ts`.
 *
 * What a pass does not prove (AC-5), in short: a helper called from another file, a repository call in a closure that never runs
 * (GitHub #259), that a write or an order is required, and `record` reached by destructuring or a computed key. The `OPEN_LIMITS` cases
 * below pass on purpose, so the list in the header is checked and a change that closes one of them shows here.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The slow part (building the program, then asking the type checker about the real services) runs once, in the hook (DL-057). */
const PROGRAM_BUILD_TIMEOUT = 120_000;

/** Uses of `AuditService.record` in the services at master 2891457: 15 calls (AQP-123 and AQP-130 added to the 11 that AC-4 counted at 023e17d). */
const RECORD_CALLS_AT_BASE = 15;

const ALL_CASES: readonly Case[] = [...PASSING, ...FAILING, ...OPEN_LIMITS];

describe('every audit.record call runs in the change\'s transaction (STORY-10.18; architecture section 6)', () => {
  let program: ts.Program;
  let serviceFiles: string[];
  let today: AuditTransactionReport;
  let definition: AuditTransactionReport;

  beforeAll(() => {
    program = createServicesProgram({ root: ROOT, virtualFiles: fixtureSources(ALL_CASES) });
    serviceFiles = serviceFilesUnder(ROOT);
    today = checkAuditTransactions(program, ROOT, serviceFiles);
    definition = checkAuditTransactions(
      program,
      ROOT,
      serviceFiles.filter((path) => path.endsWith('/audit-service.ts')),
    );
  }, PROGRAM_BUILD_TIMEOUT);

  const reportFor = (testCase: Case): AuditTransactionReport => checkAuditTransactions(program, ROOT, filesOf(ROOT, testCase));

  it('finds the services it is meant to read', () => {
    expect(serviceFiles.length).toBeGreaterThan(0);
    expect(serviceFiles.some((path) => path.endsWith('/audit-service.ts'))).toBe(true);
  });

  it(`AC-4: today's services pass with no allow-list, and at least ${RECORD_CALLS_AT_BASE} record calls were checked`, () => {
    expect(today.findings.map(({ file, line, message }) => `${file}:${line}: ${message}`)).toEqual([]);
    expect(today.checked).toBeGreaterThanOrEqual(RECORD_CALLS_AT_BASE);
  });

  it('the definition of record in audit-service.ts is not checked as a call', () => {
    expect(definition).toEqual({ checked: 0, findings: [] });
  });

  it('refuses a path the program does not hold, so a typo cannot make the check visit nothing', () => {
    expect(() => checkAuditTransactions(program, ROOT, ['src/server/services/no-such-service.ts'])).toThrow(/not part of the program/);
  });

  describe('AC-2: forms that pass', () => {
    it.each(PASSING)('$name', (testCase) => {
      const report = reportFor(testCase);
      expect(report.findings.map(({ message }) => message)).toEqual([]);
      expect(report.checked).toBe(testCase.records);
    });
  });

  describe('AC-3: forms that fail (the plants), and the edge cases of the chain', () => {
    it.each(FAILING)('$name', (testCase) => {
      const report = reportFor(testCase);
      expect(report.checked).toBe(testCase.records);
      expect(report.findings.map(({ message }) => message)).toEqual(testCase.findings.map((fragment) => expect.stringContaining(fragment)));
    });
  });

  describe('AC-5: forms that pass and the headers list as open', () => {
    it.each(OPEN_LIMITS)('$name', (testCase) => {
      const report = reportFor(testCase);
      expect(report.findings.map(({ message }) => message)).toEqual([]);
      expect(report.checked).toBe(testCase.records);
    });
  });
});
