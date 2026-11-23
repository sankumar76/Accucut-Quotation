import type ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CalculateAckRequiredError } from '@/lib/estimate/calculate-ack-required-error';
import { buildWorkbook } from '@/server/export/build-workbook';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createDownloadRepository } from '@/server/repositories/download-repository';
import { createExportRepository } from '@/server/repositories/export-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import type { CalculateOptions } from '@/server/services/calculation-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createExportService, type ExportService } from '@/server/services/export-service';

import { engineerOf, leadOf, refusalOf } from '../../support/approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { inProcessBuilder } from '../../support/in-process-builder';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';
import { loadWorkbook, readXlsxParts } from '../../support/xlsx-parts';
import { QUANTITY_CASES, type CaseRow } from '../../unit/quantity/quantity-cases';

/**
 * STORY-07.06 (FR-104; NFR-002; A-24; architecture sections 4.3 "What the Lead sees" and "The file", 6 "Export summary"; test strategy section 5.2 CE-9 "Lead data") against real PostgreSQL in a throwaway database, as
 * the runtime role: an Engineer goes ahead past a 0 in QTY per Assy through the real Calculate (CE-9 variants A and C), and the export summary names who went ahead, when, and the rows (AC-1, AC-4), only while the
 * calculation is current (AC-3), for the Lead and the Admin and never for an Engineer (AC-5). **The warning is in no cell and no sheet of the file (AC-2, A-24)**: the workbook of a tree with H 0 is compared, part by
 * part and cell by cell, with the workbook of the same tree at H 1, and no XML part of it holds a word of the warning. The rows keep H 0 and BG 0. Every name and number is invented.
 */

let db: CalculationDatabase;
let exporter: ExportService;
let zeroCustomerId: string;

const lead = () => ({ id: db.personId, role: 'LEAD' as const });
const admin = () => ({ id: db.personId, role: 'ADMIN' as const });
const engineer = () => ({ id: db.engineerId, role: 'ENGINEER' as const });

/** The names the test database stores for the two people (`insertPersonAsOwner` adds "Invented"): the summary names a person by their name now. */
const ENGINEER_NAME = 'Invented Calculation Engineer';
const LEAD_NAME = 'Invented Calculation Lead';

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  exporter = createExportService({
    header: createExportRepository(db.prisma),
    downloads: createDownloadRepository(db.prisma),
    nodes: db.nodes,
    calculations: db.calculations,
    approvals: db.approvals,
    images: createImageRepository(db.prisma),
    transactions: db.transactions,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
    builder: inProcessBuilder(buildWorkbook),
    clock: { now: () => new Date('2026-11-14T12:00:00.000Z') },
  });
  // A customer whose 15 rates are all 0 (the calculation test's own recipe), so the cost of a row is the one typed in AP.
  const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name, short_name) VALUES ('Invented zero-rate customer', left(md5('Invented zero-rate customer'), 10)) RETURNING id::text");
  zeroCustomerId = defined(customer.rows[0]).id;
  for (const item of SEED_PROCESS_ITEMS) await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, 0)', [zeroCustomerId, item.id]);
}, 120_000);

afterAll(async () => {
  await db.close();
});

const caseOf = (id: string): ReadonlyArray<CaseRow> => defined(QUANTITY_CASES.find((candidate) => candidate.id === id), id).rows;

/** The inputs of a row as the calculation test types them: every number 0 but the count (H), the per-piece cost (AP) and the Tool Cost (BM). */
function bareInputs(row: CaseRow): Record<string, unknown> {
  const zeros = Object.fromEntries(seedConfig.fields.filter((field) => field.kind === 'input' && field.dataType === 'number').map((field) => [field.id, '0']));
  return { ...completePartInputs(), ...zeros, [idOf('E')]: db.materialOneId, [idOf('D')]: `Part ${row.sl}`, [idOf('H')]: row.h, [idOf('AP')]: row.cost, [idOf('BM')]: row.toolCost ?? '0' };
}

/** An estimate of the Engineer's holding the rows of a constructed case, placed by their Sl. No ("1.1.2" is the second child of "1.1"), not yet calculated. */
async function estimateOf(rows: ReadonlyArray<CaseRow>): Promise<string> {
  const estimateId = await db.addEstimate({ engineer: true, customerId: zeroCustomerId });
  const ids = new Map<string, string>();
  for (const row of rows) {
    const path = row.sl.split('.');
    const parent = path.length === 1 ? null : defined(ids.get(path.slice(0, -1).join('.')), `the parent of ${row.sl}`);
    ids.set(row.sl, await db.addPart(estimateId, { parentId: parent, sortIndex: Number(defined(path[path.length - 1])) - 1, inputs: bareInputs(row) }));
  }
  return estimateId;
}

const audit = (actorId: string, actorLabel: string) => ({ actorId, actorLabel, requestId: `req-${actorLabel.toLowerCase().replaceAll(' ', '-')}` });

/** Presses Calculate as the Engineer: asked about the 0 (the 409 names the revision), then goes ahead with it, as "Calculate anyway" does. */
async function engineerWentAhead(rows: ReadonlyArray<CaseRow>): Promise<string> {
  const estimateId = await estimateOf(rows);
  const asked = await refusalOf(db.service.calculate(engineerOf(db), estimateId));
  if (!(asked instanceof CalculateAckRequiredError)) throw new Error('Expected the 409 CALCULATE_ACK_REQUIRED.', { cause: asked });
  const options: CalculateOptions = { acknowledge: { inputsRevision: asked.inputsRevision }, audit: audit(db.engineerId, 'Calculation Engineer') };
  await db.service.calculate(engineerOf(db), estimateId, options);
  return estimateId;
}

/** The same tree calculated with nothing to warn about. */
async function calculated(rows: ReadonlyArray<CaseRow>): Promise<string> {
  const estimateId = await estimateOf(rows);
  await db.service.calculate(engineerOf(db), estimateId);
  return estimateId;
}

/** Case A as it is, and the same tree with H 1 on the part (1.1) instead of 0. */
const CE9_A = caseOf('CE-9 A');
const CE9_A_AT_H1: ReadonlyArray<CaseRow> = CE9_A.map((row) => (row.sl === '1.1' ? { ...row, h: '1' } : row));

async function createdAtOf(estimateId: string): Promise<string> {
  const { rows } = await db.owner.query<{ created_at: Date }>('SELECT c.created_at FROM calculations c JOIN estimates e ON e.current_calculation_id = c.id WHERE e.id = $1::uuid', [estimateId]);
  return defined(rows[0]).created_at.toISOString();
}

async function fileOf(estimateId: string): Promise<{ sheet: ExcelJS.Worksheet; workbook: ExcelJS.Workbook; bytes: Uint8Array }> {
  const { bytes } = await exporter.getFile(lead(), estimateId);
  const workbook = await loadWorkbook(bytes);
  return { sheet: defined(workbook.getWorksheet('Quotation')), workbook, bytes };
}

/** The address of every cell that holds a value, in reading order. */
function filledAddresses(sheet: ExcelJS.Worksheet): string[] {
  const addresses: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => addresses.push(cell.address)));
  return addresses;
}

const POSITION = { h: seedFieldAt('H').position, bg: seedFieldAt('BG').position };

describe('AC-1, AC-4 (FR-104; CE-9 "Lead data"): the summary names who went ahead, when, and the rows, while the calculation is current', () => {
  it('CE-9 A: the Engineer who went ahead, the time of the calculation and row 1.1 with its name, for a Lead and for an Admin', async () => {
    const estimateId = await engineerWentAhead(CE9_A);
    const at = await createdAtOf(estimateId);
    for (const viewer of [lead(), admin()]) {
      const summary = await exporter.getSummary(viewer, estimateId);
      expect(summary.state).toBe('current');
      expect(summary.warning).toEqual({ madeBy: ENGINEER_NAME, at, rows: [{ slNo: '1.1', label: 'Part 1.1' }] });
    }
  });

  it('CE-9 C: every 0 warns, wherever the row sits: 1.1 and 1.1.1, in tree order, and the rows of the summary hold those two with their H 0', async () => {
    const estimateId = await engineerWentAhead(caseOf('CE-9 C'));
    const { warning, figures } = await exporter.getSummary(lead(), estimateId);
    expect(warning?.rows).toEqual([
      { slNo: '1.1', label: 'Part 1.1' },
      { slNo: '1.1.1', label: 'Part 1.1.1' },
    ]);
    expect(figures?.rows.filter((row) => row.count === '0').map((row) => row.slNo)).toEqual(['1.1', '1.1.1']);
  });

  it('the row shows H 0 and BG 0 as it would by hand: the figures of the summary are the file\'s own', async () => {
    const estimateId = await engineerWentAhead(CE9_A);
    const { figures } = await exporter.getSummary(lead(), estimateId);
    expect(figures?.rows.find((row) => row.slNo === '1.1')).toEqual({ slNo: '1.1', count: '0', bg: '0', toolCost: '0' });
  });

  it('each press stands alone (A-26): after a Lead\'s Recalculate the notice names the Lead and the Lead\'s own time', async () => {
    const estimateId = await engineerWentAhead(CE9_A);
    const asked = await refusalOf(db.service.recalculate(leadOf(db), estimateId));
    if (!(asked instanceof CalculateAckRequiredError)) throw new Error('Expected the 409 CALCULATE_ACK_REQUIRED.', { cause: asked });
    await db.service.recalculate(leadOf(db), estimateId, { acknowledge: { inputsRevision: asked.inputsRevision }, audit: audit(db.personId, 'Calculation Lead') });
    const summary = await exporter.getSummary(lead(), estimateId);
    expect(summary.warning).toEqual({ madeBy: LEAD_NAME, at: await createdAtOf(estimateId), rows: [{ slNo: '1.1', label: 'Part 1.1' }] });
  });

  it('is strict: the warning holds the name, the time and the rows by Sl. No and name, and no code, no node ID and no figure', async () => {
    const estimateId = await engineerWentAhead(CE9_A);
    const { warning } = await exporter.getSummary(lead(), estimateId);
    expect(Object.keys(defined(warning)).sort()).toEqual(['at', 'madeBy', 'rows']);
    expect(defined(warning).rows.map((row) => Object.keys(row).sort())).toEqual([['label', 'slNo']]);
    expect(JSON.stringify(warning)).not.toMatch(/QTY_ZERO|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|₹/);
  });

  it('a calculation with nothing to warn about has no warning in its summary', async () => {
    const estimateId = await calculated(CE9_A_AT_H1);
    const summary = await exporter.getSummary(lead(), estimateId);
    expect(summary.state).toBe('current');
    expect(summary.warning).toBeNull();
  });
});

describe('AC-3, AC-4: the warning only while the state is current', () => {
  it('out-of-date (an input changed after the Engineer went ahead): the state says so and there is no warning, no name and no row in the answer', async () => {
    const estimateId = await engineerWentAhead(CE9_A);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const summary = await exporter.getSummary(lead(), estimateId);
    expect(summary.state).toBe('out-of-date');
    expect(summary.warning).toBeNull();
    expect(summary.figures).toBeNull();
    expect(JSON.stringify(summary)).not.toContain(ENGINEER_NAME);
  });

  it('none (never calculated): the state says so and there is no warning', async () => {
    const estimateId = await estimateOf(CE9_A);
    const summary = await exporter.getSummary(lead(), estimateId);
    expect(summary.state).toBe('none');
    expect(summary.warning).toBeNull();
  });
});

describe('AC-2 (A-24): the warning is in no cell and no sheet of the file', () => {
  it('CE-9 A: the workbook has the same one sheet, the same parts and exactly the same cells as the same tree at H 1; only the values of the row with H 0 differ', async () => {
    const warnedId = await engineerWentAhead(CE9_A);
    const plainId = await calculated(CE9_A_AT_H1);
    const warned = await fileOf(warnedId);
    const plain = await fileOf(plainId);

    // No extra sheet, no extra part of the zip (no comments, no notes, no second sheet), no extra cell.
    expect(warned.workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Quotation']);
    expect([...readXlsxParts(warned.bytes).keys()].sort()).toEqual([...readXlsxParts(plain.bytes).keys()].sort());
    expect(filledAddresses(warned.sheet)).toEqual(filledAddresses(plain.sheet));
    expect(warned.sheet.rowCount).toBe(plain.sheet.rowCount);
    expect(warned.sheet.columnCount).toBe(plain.sheet.columnCount);
    warned.sheet.eachRow((row) => row.eachCell((cell) => expect(cell.note, cell.address).toBeUndefined()));

    // The row shows H 0 and BG 0, as it would by hand; the same cell holds 1 and a price at H 1.
    expect(warned.sheet.getCell(3, POSITION.h).value).toBe(0);
    expect(warned.sheet.getCell(3, POSITION.bg).value).toBe(0);
    expect(plain.sheet.getCell(3, POSITION.h).value).toBe(1);
  });

  it('no part of the file holds a word of the warning: not the title, the tag, the code, who went ahead or "no warning" (the file is clean)', async () => {
    const warned = await fileOf(await engineerWentAhead(CE9_A));
    const text = [...readXlsxParts(warned.bytes).values()].join('\n');
    for (const word of ['Quantity warning', 'Quantity 0', 'QTY_ZERO', 'went ahead', 'warning', ENGINEER_NAME, 'Invented Calculation']) expect(text, word).not.toMatch(new RegExp(word, 'i'));
  });
});

describe('AC-5 (NFR-002): an Engineer gets nothing of the warning', () => {
  it('is refused the summary and the file of the estimate they own, with a 403 that names no one and no row', async () => {
    const estimateId = await engineerWentAhead(CE9_A);
    for (const call of [exporter.getSummary(engineer(), estimateId), exporter.getFile(engineer(), estimateId)]) {
      const failure = await refusalOf(call);
      expect(failure).toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
      expect(JSON.stringify({ message: (failure as Error).message })).not.toMatch(/went ahead|Part 1\.1|Invented/);
    }
  });
});
