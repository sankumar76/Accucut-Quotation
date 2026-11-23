import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-06.09 (FR-065, NFR-026; ADR-007; architecture sections 4.8, 4.9 and 5.1), written as scans of the source tree so a later change that goes around the rule fails here and not in review:
 *   - **An approved estimate is read from its own record alone.** The services that read an estimate's figures for a screen (`estimate-review-*` and the cost details) import no master repository, no master
 *     service and no code that reads the masters (`calculation-masters` is the one reader of the masters, for Calculate), and name no master table. What they show comes from `calculation_rows`,
 *     `calculations.master_snapshot` and the configuration version the calculation was made with. The three repositories they read through name no master table either.
 *   - **The one sanctioned path to the masters is `ratesChangedSince`** (`rate-changes.ts`, STORY-06.11): the review service imports that one function and nothing else from `rate-changes`, and it refuses an APPROVED estimate before any read.
 *   - **The permanent regression test stays.** `tests/acceptance/aqp-approved-immutable.test.ts` exists and holds no skip, todo or only (AC-6).
 * Every scan has a control that plants a fault in a copy of the text and sees it found.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SERVICES = join(ROOT, 'src', 'server', 'services');
const REPOSITORIES = join(ROOT, 'src', 'server', 'repositories');

const textOf = (path: string): string => readFileSync(path, 'utf8');
/** Comments are not code: a file may say what it must not import. */
const codeOf = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** The files of the read side: every `estimate-review-*` file and the cost details service. */
const readSide = (): string[] => [
  ...readdirSync(SERVICES)
    .filter((name) => name.startsWith('estimate-review-') && name.endsWith('.ts'))
    .map((name) => join(SERVICES, name)),
  join(SERVICES, 'cost-details-service.ts'),
];

/** An import of a master repository, a master service, or the code that reads the masters for a calculation. */
const MASTER_IMPORT = /from '[^']*\/(master-repository|customer-repository|material-repository|treatment-repository|exchange-rate-repository|master-constraints|masters-service|customer-service|treatment-service|exchange-rate-service|calculation-masters|rate-changes)'/;
/** The one import of `rate-changes` the read side may hold, in `estimate-review-service.ts` only (STORY-06.11). Any other import of that file, `countRateChanges` for one, stays an offender. */
const SANCTIONED = /import \{ ratesChangedSince, type CalculationMasters \} from '\.\/rate-changes';/;
const REVIEW_SERVICE = join(SERVICES, 'estimate-review-service.ts');
/** A master table read in SQL (`FROM customers`, `JOIN materials`) or through its Prisma accessor (`db.material.findMany`). The word alone is not a read: the snapshot's own `materials` list is stored text. */
const MASTER_TABLE = /\b(FROM|JOIN|INTO|UPDATE)\s+"?(customers|customer_rates|materials|treatments|exchange_rates|process_items)\b|\.(customer|customerRate|material|treatment|exchangeRate|processItem)\.(find|create|update|delete|upsert|count|aggregate)/i;

describe('the read side of an approved estimate reads no master', () => {
  it('there are files to scan: the review service and the cost details service', () => {
    const names = readSide().map((path) => path.slice(SERVICES.length + 1).replaceAll('\\', '/'));
    expect(names).toContain('estimate-review-service.ts');
    expect(names).toContain('cost-details-service.ts');
    for (const path of readSide()) expect(existsSync(path)).toBe(true);
  });

  it('no file of the read side imports a master repository, a master service or the reader of the masters', () => {
    const offenders = readSide().filter((path) => {
      const code = codeOf(textOf(path));
      return MASTER_IMPORT.test(path === REVIEW_SERVICE ? code.replace(SANCTIONED, '') : code);
    });
    expect(offenders).toEqual([]);
  });

  it('the review service holds the one sanctioned import of rate-changes, and ratesChangedSince refuses a locked (APPROVED or QUOTED) estimate before it reads a snapshot or a master', () => {
    expect(codeOf(textOf(REVIEW_SERVICE))).toMatch(SANCTIONED);
    const code = codeOf(textOf(join(SERVICES, 'rate-changes.ts')));
    const body = code.slice(code.indexOf('function ratesChangedSince('));
    // CR-01 item 7B: "locked" is asked of `isLocked`, the one helper, so a quoted estimate is refused like an approved one.
    const approved = body.indexOf('isLocked(access.status)');
    expect(approved).toBeGreaterThan(-1);
    expect(approved).toBeLessThan(body.indexOf('findMasterSnapshot('));
    expect(approved).toBeLessThan(body.indexOf('countRateChanges('));
  });

  it('no file of the read side names a master table or a Prisma accessor of one', () => {
    const offenders = readSide().filter((path) => MASTER_TABLE.test(codeOf(textOf(path))));
    expect(offenders).toEqual([]);
  });

  it('the repositories the read side reads through (the calculation, the approvals and the parts) name no master table', () => {
    const files = ['calculation-repository.ts', 'approval-repository.ts', 'estimate-node-repository.ts'].map((name) => join(REPOSITORIES, name));
    expect(files.filter((path) => MASTER_TABLE.test(codeOf(textOf(path))))).toEqual([]);
  });

  it('control: a planted import and a planted table name are found by the same scans', () => {
    expect(MASTER_IMPORT.test("import type { MasterRepository } from '../repositories/master-repository';")).toBe(true);
    expect(MASTER_IMPORT.test("import { readMasters } from './calculation-masters';")).toBe(true);
    // rate-changes: the sanctioned statement is removed, any other import of it is not.
    const sanctioned = "import { ratesChangedSince, type CalculationMasters } from './rate-changes';";
    const direct = "import { countRateChanges } from './rate-changes';";
    expect(MASTER_IMPORT.test(sanctioned)).toBe(true);
    expect(MASTER_IMPORT.test(sanctioned.replace(SANCTIONED, ''))).toBe(false);
    expect(MASTER_IMPORT.test(direct)).toBe(true);
    expect(MASTER_IMPORT.test(direct.replace(SANCTIONED, ''))).toBe(true);
    expect(MASTER_IMPORT.test(`${sanctioned}\n${direct}`.replace(SANCTIONED, ''))).toBe(true);
    expect(MASTER_IMPORT.test("import type { CalculationRepository } from '../repositories/calculation-repository';")).toBe(false);
    expect(MASTER_TABLE.test('SELECT c.name FROM customers c JOIN estimates e ON e.customer_id = c.id')).toBe(true);
    expect(MASTER_TABLE.test('await db.material.findMany()')).toBe(true);
    expect(MASTER_TABLE.test('SELECT * FROM calculation_rows')).toBe(false);
    expect(MASTER_TABLE.test('materials: z.array(z.strictObject({ id: z.string() }))')).toBe(false);
    // A comment that names one is not an import.
    expect(MASTER_IMPORT.test(codeOf("// never import from '../repositories/master-repository'"))).toBe(false);
  });
});

describe('AC-6: the regression test of the approved estimate stays in the permanent suite', () => {
  const FILES = ['tests/acceptance/aqp-approved-immutable.test.ts', 'tests/integration/approval/immutability.test.ts'];
  const SKIPPED = /\b(it|test|describe)\.(skip|todo|only|fails)\b|\b(xit|xdescribe|xtest)\b|\.skipIf\b|\.runIf\b/;

  it.each(FILES)('%s exists and holds no skip, todo, only or conditional run', (file) => {
    const path = join(ROOT, file);
    expect(existsSync(path)).toBe(true);
    expect(codeOf(textOf(path))).not.toMatch(SKIPPED);
  });

  it('control: each way of leaving a test out is found by the scan', () => {
    for (const planted of ["it.skip('x', () => {})", "describe.todo('x')", "it.only('x', () => {})", "xit('x', () => {})", "it.skipIf(true)('x', () => {})"]) expect(planted).toMatch(SKIPPED);
  });
});
