import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { buildWorkbook } from '@/server/export/build-workbook';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createExportRepository } from '@/server/repositories/export-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';
import { createExportService, type ExportService } from '@/server/services/export-service';

import { currentCalculationOf, requestFor } from '../../support/approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { inProcessBuilder } from '../../support/in-process-builder';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';
import { loadWorkbook, readXlsxParts } from '../../support/xlsx-parts';
import { QUANTITY_CASES, type CaseRow } from '../../unit/quantity/quantity-cases';

/**
 * STORY-07.03 (FR-069, FR-103, FR-107/108; NFR-026, NFR-027; D-05, D-16, D-29; SPEC sections 10 and 14, items 2, 12 and 16; architecture sections 4.6 and 4.10) against real PostgreSQL in a throwaway database, as
 * the **runtime role**: an Engineer's Calculate stores a record, the export service reads it back through the figure state and the latest approval through `findLatestApproval`, the file is built in process and read
 * back with ExcelJS. BL2, BN2 and BO2 are once in row 2 and nowhere else (AC-1); the exported BG column adds up to BL2, for the hand-worked cases CE-1, CE-2, CE-3 and CE-12 D (AC-2); the footer is the total Tool
 * Cost (AC-3); BO2 follows the approval through approve, unlock, cancel and removal, and the latest row wins (AC-4); a reason is in no cell and no part (AC-5); the cells are numbers at full precision (AC-6); and the
 * summary says what the file holds (AC-8). **The cases use the constructed quantity cases of `tests/unit/quantity/quantity-cases.ts` through the real chain**: a customer whose 15 rates are all 0 and every
 * typed number 0 but the count (H), the per-piece cost (Machining Cost AP) and the Tool Cost (BM), so BG = AP x H, as in the calculation test. Every name and number is invented.
 */

let db: CalculationDatabase;
let exporter: ExportService;
let review: EstimateReviewService;
let zeroCustomerId: string;

const lead = () => ({ id: db.personId, role: 'LEAD' as const });
const admin = () => ({ id: db.personId, role: 'ADMIN' as const });
const engineer = () => ({ id: db.engineerId, role: 'ENGINEER' as const });

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  const images = createImageRepository(db.prisma);
  exporter = createExportService({
    header: createExportRepository(db.prisma),
    nodes: db.nodes,
    calculations: db.calculations,
    approvals: db.approvals,
    images,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
    transactions: db.transactions,
    builder: inProcessBuilder(buildWorkbook),
    clock: { now: () => new Date('2026-11-14T12:00:00.000Z') },
  });
  review = createEstimateReviewService({
    calculations: db.calculations,
    approvals: db.approvals,
    nodes: db.nodes,
    estimates: db.estimates,
    masters: db.masterRepository,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
  });
  // A customer whose 15 rates are all 0 (the calculation test's own recipe), so the cost of a row is the one typed in AP.
  const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented zero-rate customer') RETURNING id::text");
  zeroCustomerId = defined(customer.rows[0]).id;
  for (const item of SEED_PROCESS_ITEMS) await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, 0)', [zeroCustomerId, item.id]);
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** The inputs of a row as the calculation test types them: every number 0 but the count (H), the per-piece cost (AP) and the Tool Cost (BM). */
function bareInputs(row: CaseRow, name: string): Record<string, unknown> {
  const zeros = Object.fromEntries(seedConfig.fields.filter((field) => field.kind === 'input' && field.dataType === 'number').map((field) => [field.id, '0']));
  return { ...completePartInputs(), ...zeros, [idOf('E')]: db.materialOneId, [idOf('D')]: name, [idOf('H')]: row.h, [idOf('AP')]: row.cost, [idOf('BM')]: row.toolCost ?? '0' };
}

/** An estimate of the Engineer's holding the rows of a constructed case, placed by their Sl. No ("1.1.2" is the second child of "1.1"), calculated. */
async function calculatedCase(rows: ReadonlyArray<CaseRow>): Promise<string> {
  const estimateId = await db.addEstimate({ engineer: true, customerId: zeroCustomerId });
  const ids = new Map<string, string>();
  for (const row of rows) {
    const path = row.sl.split('.');
    const parent = path.length === 1 ? null : defined(ids.get(path.slice(0, -1).join('.')), `the parent of ${row.sl}`);
    ids.set(row.sl, await db.addPart(estimateId, { parentId: parent, sortIndex: Number(defined(path[path.length - 1])) - 1, inputs: bareInputs(row, `Part ${row.sl}`) }));
  }
  await db.service.calculate(engineer(), estimateId);
  return estimateId;
}

const caseOf = (id: string) => defined(QUANTITY_CASES.find((candidate) => candidate.id === id), id);

async function sheetOf(estimateId: string): Promise<{ sheet: ExcelJS.Worksheet; bytes: Uint8Array }> {
  const { bytes } = await exporter.getFile(lead(), estimateId);
  return { sheet: defined((await loadWorkbook(bytes)).getWorksheet('Quotation')), bytes };
}

const POSITION = { bg: seedFieldAt('BG').position, bl: seedFieldAt('BL').position, bm: seedFieldAt('BM').position, bn: seedFieldAt('BN').position, bo: seedFieldAt('BO').position };
const column = (sheet: ExcelJS.Worksheet, position: number, from: number, to: number): unknown[] => Array.from({ length: to - from + 1 }, (_, index) => sheet.getCell(from + index, position).value);

describe('AC-1 (D-16): BL2, BN2 and BO2 once, in row 2, and no per-item totals', () => {
  it('CE-7 (30 and 5): BL2 = 30 and BN2 = 6 in row 2; BO2 is empty (never approved); BL, BN and BO are empty on every other part row', async () => {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    const { sheet } = await sheetOf(estimateId);
    expect([sheet.getCell(2, POSITION.bl).value, sheet.getCell(2, POSITION.bn).value, sheet.getCell(2, POSITION.bo).value]).toEqual([30, 6, null]);
    for (const position of [POSITION.bl, POSITION.bn, POSITION.bo]) expect(column(sheet, position, 3, 4), `column ${String(position)}`).toEqual([null, null]);
    // The cells are the ones the registry's roles name, so they follow their columns.
    expect(seedConfig.fields.find((field) => field.systemRole === 'total')?.position).toBe(POSITION.bl);
    expect(seedConfig.fields.find((field) => field.systemRole === 'approved-price')?.position).toBe(POSITION.bo);
  });

  it('holds nothing below the parts but the footer: no per-item total, no cell between the last part and the footer, nothing after it', async () => {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    const { sheet } = await sheetOf(estimateId);
    // Header (1), three parts (2 to 4), one empty row (5), the footer (6): five rows hold values.
    expect(sheet.actualRowCount).toBe(5);
    expect(sheet.lastRow?.number).toBe(6);
    expect(sheet.getRow(5).hasValues).toBe(false);
    expect(sheet.getRow(6).hasValues).toBe(true);
  });
});

describe('AC-2 (SPEC section 14.2; CE-1, CE-2, CE-3, CE-12 D): the exported BG column adds up to BL2', () => {
  it.each([
    ['CE-1', '30', ['0', '6', '24']],
    ['CE-2 A', '840', ['600', '240']],
    ['CE-3', '5', ['0', '2', '0', '3']],
    ['CE-12 D', '1000', ['1000']],
  ] as const)('%s: BG %j and BL2 = %s, and BL2 is the total SCR-06 shows', async (id, bl, bg) => {
    const estimateId = await calculatedCase(caseOf(id).rows);
    const { sheet } = await sheetOf(estimateId);
    const exported = column(sheet, POSITION.bg, 2, 1 + bg.length) as number[];
    expect(exported.map(String)).toEqual([...bg]);
    expect(exported.reduce((sum, value) => sum + value, 0)).toBe(Number(bl));
    expect(sheet.getCell(2, POSITION.bl).value).toBe(Number(bl));
    expect(defined((await review.getCosts(lead(), estimateId)).totals).totalPrice).toBe(bl);
  });

  it('a tree with two top-level items (CE-3) is two items, 1 and 2, each with its own part, and BL2 is 5 (2 + 3)', async () => {
    const estimateId = await calculatedCase(caseOf('CE-3').rows);
    const { sheet } = await sheetOf(estimateId);
    expect(column(sheet, 1, 2, 5)).toEqual(['1', '1.1', '2', '2.1']);
    expect(sheet.getCell(2, POSITION.bl).value).toBe(5);
  });
});

describe('AC-2 at full precision: BL2, BN2 and the total are the stored figures, equal to SCR-06 to the paisa', () => {
  it('with the real rates, BL2 is the stored total and BN2 the stored BL / Tool Cost, as the review shows them at two decimals', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    const base = { ...completePartInputs(), [idOf('E')]: db.materialOneId };
    const first = await db.addPart(estimateId, { parentId: null, sortIndex: 0, inputs: { ...base, [idOf('D')]: 'Alpha', [idOf('H')]: '2', [idOf('BM')]: '1234.5' } });
    await db.addPart(estimateId, { parentId: first, sortIndex: 0, inputs: { ...base, [idOf('D')]: 'Beta', [idOf('H')]: '7', [idOf('J')]: '321.45', [idOf('BM')]: '99.99' } });
    await db.addPart(estimateId, { parentId: null, sortIndex: 1, inputs: { ...base, [idOf('D')]: 'Gamma', [idOf('H')]: '11', [idOf('L')]: '4.4' } });
    await db.service.calculate(engineer(), estimateId);
    const costs = await review.getCosts(lead(), estimateId);
    const totals = defined(costs.totals);
    const { sheet } = await sheetOf(estimateId);

    const blCell = sheet.getCell(2, POSITION.bl).value;
    const bnCell = sheet.getCell(2, POSITION.bn).value;
    expect(blCell).toBe(Number(defined(totals.totalPrice)));
    expect(bnCell).toBe(Number(defined(totals.pricePerToolCost)));
    expect(new Decimal(String(blCell)).toFixed(2)).toBe(new Decimal(defined(totals.totalPrice)).toFixed(2));
    // The exported BG column adds up to BL2 at two decimals (the stored figure is the sum of unrounded values).
    const bgSum = (column(sheet, POSITION.bg, 2, 4) as number[]).reduce((sum, value) => sum.plus(value), new Decimal(0));
    expect(bgSum.toFixed(2)).toBe(new Decimal(defined(totals.totalPrice)).toFixed(2));
    // The footer is the stored total Tool Cost, with no quantity applied: 1234.5 + 99.99 and the Tool Cost every complete part carries (Gamma's own).
    expect(sheet.getCell(6, POSITION.bm).value).toBe(Number(defined(totals.toolCostTotal)));
    expect(sheet.getCell(6, POSITION.bm).value).toBe(new Decimal('1234.5').plus('99.99').plus(String(base[idOf('BM')])).toNumber());
  });
});

describe('AC-3 (D-05, CE-7): the footer at lastNodeRow + 2', () => {
  it('Tool Cost 2 and 3 give a total of 5 in the Tool Cost column of the footer, "Total Tool Cost" in the cell to its left, and every part keeps its own Tool Cost cell', async () => {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    const { sheet } = await sheetOf(estimateId);
    expect(sheet.getCell(6, POSITION.bm).value).toBe(5);
    expect(sheet.getCell(6, POSITION.bm - 1).value).toBe('Total Tool Cost');
    expect(sheet.getCell(6, POSITION.bm - 1).type).toBe(ExcelJS.ValueType.String);
    // No part's own Tool Cost cell is replaced, and none sums the others: row 2 holds the first part's own entry (0), then 2 and 3.
    expect(column(sheet, POSITION.bm, 2, 4)).toEqual([0, 2, 3]);
    // BN2 = BL2 / the total Tool Cost = 30 / 5.
    expect(sheet.getCell(2, POSITION.bn).value).toBe(6);
  });

  it('10 parts in rows 2 to 11 give the footer in row 13', async () => {
    const rows: CaseRow[] = Array.from({ length: 10 }, (_, index) => ({ sl: String(index + 1), h: '1', cost: '3', bg: '3', toolCost: index === 0 ? '5' : '0' }));
    const estimateId = await calculatedCase(rows);
    const { sheet } = await sheetOf(estimateId);
    expect(column(sheet, 1, 2, 11)).toEqual(rows.map((row) => row.sl));
    expect(sheet.getCell(13, POSITION.bm).value).toBe(5);
    expect(sheet.getCell(13, POSITION.bm - 1).value).toBe('Total Tool Cost');
    expect(sheet.getRow(12).hasValues).toBe(false);
    expect(sheet.getCell(2, POSITION.bl).value).toBe(30);
  });

  it('with no Tool Cost the footer shows 0 and BN2 is an empty cell (a division by zero), and BL2 is still the total', async () => {
    const estimateId = await calculatedCase(caseOf('CE-1').rows);
    const { sheet } = await sheetOf(estimateId);
    expect(sheet.getCell(6, POSITION.bm).value).toBe(0);
    expect(sheet.getCell(2, POSITION.bn).value).toBeNull();
    expect(sheet.getCell(2, POSITION.bl).value).toBe(30);
  });
});

describe('AC-4 (D-29; architecture section 4.10; 06.12, 06.13): BO2 follows the latest approval', () => {
  /** A calculated estimate approved at `price` by the real approval service. */
  async function approved(price: string, reason?: string): Promise<{ estimateId: string; calculationId: string }> {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    const calculationId = await currentCalculationOf(db, estimateId);
    await db.approvalService.approve(lead(), estimateId, { ...requestFor(db, calculationId, price), ...(reason === undefined ? {} : { reason }) });
    return { estimateId, calculationId };
  }
  const bo2 = async (estimateId: string) => (await sheetOf(estimateId)).sheet.getCell(2, POSITION.bo).value;

  it('an approved estimate: BO2 holds the approved price as a number, and the other totals are as before', async () => {
    const { estimateId } = await approved('29.99');
    const { sheet } = await sheetOf(estimateId);
    expect(sheet.getCell(2, POSITION.bo).value).toBe(29.99);
    expect(sheet.getCell(2, POSITION.bl).value).toBe(30);
  });

  it('after an unlock BO2 holds the price approved earlier', async () => {
    const { estimateId } = await approved('29.99');
    await db.owner.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Invented unlock' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    expect(await bo2(estimateId)).toBe(29.99);
  });

  it('after the Admin cancels the approval BO2 is empty, and so it is after the price is removed', async () => {
    const { estimateId } = await approved('29.99');
    await db.owner.query("UPDATE approvals SET cancelled_by = $2::uuid, cancelled_at = now(), cancel_reason = 'Invented cancel' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    expect(await bo2(estimateId)).toBeNull();
    await db.owner.query('UPDATE approvals SET removed_by = $2::uuid, removed_at = now() WHERE estimate_id = $1::uuid', [estimateId, db.personId]);
    expect(await bo2(estimateId)).toBeNull();
  });

  it('is empty for an estimate never approved, and the other totals are in the file all the same', async () => {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    expect(await bo2(estimateId)).toBeNull();
  });

  it('BO is the LATEST row: when the latest approval\'s price was removed, an earlier row\'s price does not come back in its place (the ruling on PR #495, `findLatestApproval`)', async () => {
    const { estimateId, calculationId } = await approved('29.99');
    // The first approval was unlocked; a later one is the latest (inserted as the owner, with a later time), and its price is then cancelled and removed.
    await db.owner.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Invented unlock' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    await db.owner.query(
      `INSERT INTO approvals (estimate_id, calculation_id, approved_price, calculated_bl, approved_by, approved_at, is_override, cancelled_by, cancelled_at, cancel_reason, removed_by, removed_at)
       VALUES ($1::uuid, $2::uuid, 777.77, 30, $3::uuid, now() + interval '1 hour', true, $3::uuid, now(), 'Invented cancel', $3::uuid, now())`,
      [estimateId, calculationId, db.personId],
    );
    expect(await bo2(estimateId)).toBeNull();
    const parts = readXlsxParts((await sheetOf(estimateId)).bytes);
    for (const [name, text] of parts) {
      expect(text, name).not.toContain('29.99');
      expect(text, name).not.toContain('777.77');
    }
  });
});

describe('AC-5 (FR-103): an override\'s reason is written into no cell and no sheet', () => {
  it('the reason given with a different price is in none of the parts of the file, and the file has one sheet', async () => {
    const reason = 'Rounded down to a whole figure for the customer quote';
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    await db.approvalService.approve(lead(), estimateId, { ...requestFor(db, await currentCalculationOf(db, estimateId), '29.99'), reason });
    const { sheet, bytes } = await sheetOf(estimateId);
    const stored = await db.owner.query<{ override_reason: string | null }>('SELECT override_reason FROM approvals WHERE estimate_id = $1::uuid', [estimateId]);
    expect(stored.rows).toEqual([{ override_reason: reason }]);
    expect(sheet.getCell(2, POSITION.bo).value).toBe(29.99);
    const workbook = await loadWorkbook(bytes);
    expect(workbook.worksheets).toHaveLength(1);
    for (const [name, text] of readXlsxParts(bytes)) {
      expect(text, name).not.toContain('Rounded down');
      expect(text, name).not.toContain(reason);
    }
    // Not even a comment or a note on a cell.
    sheet.eachRow((row) => row.eachCell((cell) => expect(cell.note, cell.address).toBeUndefined()));
  });
});

describe('AC-6: BL2 and BN2 are numbers at full precision in a two-decimal format; a division by zero leaves them empty', () => {
  it('the cell holds the stored text\'s number, whatever the digits, and the column is formatted with two decimals', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    await db.addPart(estimateId, { parentId: null, sortIndex: 0, inputs: { ...completePartInputs(), [idOf('E')]: db.materialOneId, [idOf('D')]: 'Precise', [idOf('H')]: '3', [idOf('BM')]: '7' } });
    await db.service.calculate(engineer(), estimateId);
    const stored = defined((await db.owner.query<{ product_values: { totalPrice: string; pricePerToolCost: string } }>('SELECT c.product_values FROM calculations c JOIN estimates e ON e.current_calculation_id = c.id WHERE e.id = $1::uuid', [estimateId])).rows[0]).product_values;
    const { sheet } = await sheetOf(estimateId);
    for (const [position, text] of [[POSITION.bl, stored.totalPrice], [POSITION.bn, stored.pricePerToolCost]] as const) {
      const cell = sheet.getCell(2, position);
      expect(cell.type).toBe(ExcelJS.ValueType.Number);
      expect(cell.value).toBe(Number(text));
      expect(cell.numFmt).toMatch(/0\.00$/);
    }
    expect(sheet.getCell(4, POSITION.bm).value).toBe(7);
  });

  it('BN2 is empty (not Infinity, not NaN, not words) with no Tool Cost, and the format is still the two-decimal one', async () => {
    const estimateId = await calculatedCase(caseOf('CE-1').rows);
    const { sheet, bytes } = await sheetOf(estimateId);
    const cell = sheet.getCell(2, POSITION.bn);
    expect(cell.value).toBeNull();
    expect(cell.numFmt).toMatch(/0\.00$/);
    expect(readXlsxParts(bytes).get('xl/worksheets/sheet1.xml') ?? '').not.toMatch(/Infinity|NaN|#DIV/);
  });
});

describe('AC-8: the summary says what the file holds, only while current, for the Lead and the Admin', () => {
  it('rows, totals, cell addresses and reconciliation are the file\'s own, for a Lead and an Admin alike, and the BG column adds up to BL2', async () => {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    const { sheet } = await sheetOf(estimateId);
    for (const viewer of [lead(), admin()]) {
      const { state, figures } = await exporter.getSummary(viewer, estimateId);
      expect(state).toBe('current');
      expect(figures?.rows.map((row) => [row.slNo, row.count, row.bg, row.toolCost])).toEqual([
        ['1', '2', '0', '0'],
        ['1.1', '6', '6', '2'],
        ['1.1.1', '24', '24', '3'],
      ]);
      expect(figures?.totals).toEqual({ bl: '30', bn: '6', bo: null, toolCostTotal: '5' });
      expect(figures?.cells).toEqual({ bl: 'BL2', bn: 'BN2', bo: 'BO2', toolCostTotal: 'BM6' });
      expect(figures?.reconciliation).toEqual({ columnSum: '30', linesAsShown: '30.00', total: '30', matches: true });
      // What the summary says of each row is what the cell holds.
      figures?.rows.forEach((row, index) => expect(sheet.getCell(index + 2, POSITION.bg).value).toBe(Number(row.bg)));
    }
  });

  it('an approved estimate: the price, its difference from the calculated total and the reason; after a cancel there is none', async () => {
    const estimateId = await calculatedCase(caseOf('CE-7').rows);
    await db.approvalService.approve(lead(), estimateId, { ...requestFor(db, await currentCalculationOf(db, estimateId), '29.99'), reason: 'Invented reason' });
    const { figures } = await exporter.getSummary(lead(), estimateId);
    expect(figures?.totals.bo).toBe('29.99');
    expect(figures?.approval).toMatchObject({ price: '29.99', earlier: false, calculatedTotal: '30.00', difference: { direction: 'lower', amount: '0.01' }, reason: 'Invented reason' });
    await db.owner.query("UPDATE approvals SET cancelled_by = $2::uuid, cancelled_at = now(), cancel_reason = 'Invented cancel' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    const cancelled = (await exporter.getSummary(lead(), estimateId)).figures;
    expect(cancelled?.approval).toBeNull();
    expect(cancelled?.totals.bo).toBeNull();
  });

  it('an out-of-date estimate has no figure in the summary and nothing of the calculation is read', async () => {
    const estimateId = await calculatedCase(caseOf('CE-1').rows);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const summary = await exporter.getSummary(lead(), estimateId);
    expect(summary.state).toBe('out-of-date');
    expect(summary.figures).toBeNull();
  });

  it('an Engineer, who owns the estimate, is refused the summary and the file', async () => {
    const estimateId = await calculatedCase(caseOf('CE-1').rows);
    await expect(exporter.getSummary(engineer(), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    await expect(exporter.getFile(engineer(), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
  });
});
