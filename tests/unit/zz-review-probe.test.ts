import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { checkAuditTransactions, createServicesProgram, serviceFilesUnder } from '../support/audit-transaction-check';

// Reviewer probe (QLT, AQP-237, round 2), control PR only, never merged. It fails on purpose so the CI log prints the whole
// report (how many uses of AuditService.record were visited, and every finding) on the planted services.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

it('probe: print the report of the check on the planted services', () => {
  const program = createServicesProgram({ root: ROOT });
  const report = checkAuditTransactions(program, ROOT, serviceFilesUnder(ROOT));
  expect({ checked: report.checked, findings: report.findings.map(({ file, line, message }) => `${file}:${line}: ${message}`) }).toEqual({
    checked: -1,
    findings: ['printed on purpose'],
  });
}, 120_000);
