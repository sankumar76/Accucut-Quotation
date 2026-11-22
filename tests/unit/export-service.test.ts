import { describe, expect, it, vi } from 'vitest';

import { ExportBusyError } from '@/lib/errors';
import { createFixedClock } from '@/lib/time';
import type { ExportModel } from '@/server/export/export-model';
import type { ApprovalRecord, ApprovalRepository } from '@/server/repositories/approval-repository';
import type { CalculationRepository, ExportFigures } from '@/server/repositories/calculation-repository';
import type { EstimateNodeRepository, NodeRecord } from '@/server/repositories/estimate-node-repository';
import type { ExportedImage } from '@/server/repositories/image-repository';
import { createTransactionHandle, type Transaction, type TransactionOptions, type TransactionRunner } from '@/server/repositories/transaction';
import { createExportService, type ExportDependencies } from '@/server/services/export-service';

import { inProcessBuilder } from '../support/in-process-builder';
import { defined } from '../support/defined';
import { pngOfDimensions, smallWebp } from '../support/pictures';
import { seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * The export service (STORY-07.01 AC-2, AC-3, AC-6; STORY-07.02 AC-1, AC-4, AC-5, AC-9): the summary and the file over fakes, with a clock the test holds. The role is refused before anything is read, a thrown
 * message of the build is not passed on, the file is built from the calculation's own rows and the registry version it was made with, and **no figure is read unless the state is current**. Every name
 * and ID is invented.
 */

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca101';
const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', role: 'ADMIN' } as const;
const ENGINEER = { id: '00000000-0000-4000-8000-0000000e0001', role: 'ENGINEER' } as const;
const VERSION = { id: '00000000-0000-4000-8000-0aaa00000001', number: 3, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: '2026-11-01T00:00:00.000Z' };
const OLD_VERSION = { ...VERSION, id: '00000000-0000-4000-8000-0aaa00000002', number: 2 };
const NOON_UTC = new Date('2026-11-14T12:00:00.000Z');

const descriptionId = defined(seedConfig.fields.find((field) => field.key === 'description')).id;
const countId = defined(seedConfig.fields.find((field) => field.systemRole === 'quantity')).id;
const materialId = seedFieldAt('E').id;
const unitPriceId = seedFieldAt('BG').id;

const node = (id: string, parentId: string | null, sortIndex: number, inputs: Record<string, unknown> = {}, imageId: string | null = null): NodeRecord => ({ id, parentId, sortIndex, revision: 1, inputs, imageId });

const STEEL = { materialInDrawing: 'Invented steel', pricePerKg: '82.5' };
const row = (n: number, slNo: string, parentId: string | null, sortIndex: number, imageId: string | null = null, name = `Part ${slNo}`) => ({
  id: `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`,
  nodeId: `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`,
  parentId,
  sortIndex,
  slNo,
  inputs: { [descriptionId]: name, [materialId]: STEEL.materialInDrawing, [countId]: '2' },
  imageId,
  outputs: { [unitPriceId]: `${String(n)}00.5` },
});

const IMAGE_A = '00000000-0000-4000-8000-0000000a1a01';
const IMAGE_B = '00000000-0000-4000-8000-0000000a1a02';
const IMAGE_WEBP = '00000000-0000-4000-8000-0000000a1a03';
const storedImage = (id: string, mime: ExportedImage['mime'] = 'image/png', bytes: Uint8Array = new Uint8Array(pngOfDimensions(40, 20))): ExportedImage => ({ id, mime, bytes });

const FIGURES: ExportFigures = {
  // Read in the stored order, which is not the tree's.
  rows: [row(3, '2', null, 1, IMAGE_B), row(2, '1.1', row(1, '1', null, 0).nodeId, 0), row(1, '1', null, 0, IMAGE_A)],
  materials: [STEEL],
  // BG 100.5 + 200.5 + 300.5 = 601.5; the total Tool Cost 5 and BN = 601.5 / 5 (stored at full precision).
  productValues: { totalPrice: '601.5', pricePerToolCost: '120.3', toolCostTotal: '5' },
  warnings: [],
  madeByName: 'Invented Engineer',
};

/** What `findLatestApproval` answers for an approval that stands (the record is the repository's; the file reads its price and its cancel). */
const APPROVED_AT = new Date('2026-11-12T05:50:00.000Z');
const approvalOf = (over: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
  id: '00000000-0000-4000-8000-0000000ab001',
  calculationId: CALCULATION_ID,
  approvedPrice: '600.00',
  approvedAt: APPROVED_AT,
  approverName: 'Invented Lead',
  engineerName: 'Invented Engineer',
  calculatedTotal: '601.50',
  isOverride: true,
  overrideReason: 'Rounded down for the quote',
  unlock: null,
  cancel: null,
  ...over,
});

/** The estimate is calculated at the revision it is at now, so its figures are current, unless a test says otherwise. */
const basisOf = (over: { inputsRevision?: number; calculationRevision?: number | null } = {}) => {
  const inputsRevision = over.inputsRevision ?? 5;
  const calculationRevision = over.calculationRevision === undefined ? inputsRevision : over.calculationRevision;
  return {
    inputsRevision,
    calculation: calculationRevision === null ? null : { id: CALCULATION_ID, inputsRevision: calculationRevision, configVersionId: OLD_VERSION.id, createdAt: new Date('2026-11-10T00:00:00.000Z') },
  };
};

function world(
  overrides: Partial<ExportDependencies> = {},
  nodes: ReadonlyArray<NodeRecord> = [],
  basis = basisOf(),
  figures: ExportFigures | null = FIGURES,
  mimes: Readonly<Record<string, string>> = {},
  approval: ApprovalRecord | null = null,
) {
  const findHeader = vi.fn(() => Promise.resolve({ code: 'Q-2026-0701', customerName: 'Acme Tools' as string | null }));
  const listNodes = vi.fn<EstimateNodeRepository['listNodes']>(() => Promise.resolve([...nodes]));
  const current = vi.fn(() => Promise.resolve(VERSION));
  const byId = vi.fn(() => Promise.resolve(OLD_VERSION));
  const findFigureBasis = vi.fn<CalculationRepository['findFigureBasis']>(() => Promise.resolve(basis));
  const findExportFigures = vi.fn<CalculationRepository['findExportFigures']>(() => Promise.resolve(figures));
  // Answers only for this estimate: a read for any other ID would find no approval, so a read of the wrong estimate shows.
  const findLatestApproval = vi.fn<ApprovalRepository['findLatestApproval']>((estimateId) => Promise.resolve(estimateId === ESTIMATE_ID ? approval : null));
  const readMany = vi.fn((_estimateId: string, ids: ReadonlyArray<string>) =>
    Promise.resolve([storedImage(IMAGE_A), storedImage(IMAGE_B), storedImage(IMAGE_WEBP, 'image/webp', new Uint8Array(smallWebp()))].filter((image) => ids.includes(image.id))),
  );
  // The stored type of each picture asked for: PNG unless a test names another.
  const findMimes = vi.fn((_estimateId: string, ids: ReadonlyArray<string>) => Promise.resolve(ids.map((id) => ({ id, mime: (mimes[id] ?? 'image/png') as ExportedImage['mime'] }))));
  const builder = inProcessBuilder();
  // The one transaction the reads share (STORY-07.04 AC-4): what it was asked for, the handle it gave, and whether it is open now, so a test can tell a read inside it from a read after it.
  const transaction = { runs: [] as Array<{ readonly options: TransactionOptions | undefined; readonly tx: Transaction }>, open: false };
  const transactions: TransactionRunner = {
    async run(work, options) {
      const tx = createTransactionHandle();
      transaction.runs.push({ options, tx });
      transaction.open = true;
      try {
        return await work(tx);
      } finally {
        transaction.open = false;
      }
    },
  };
  const service = createExportService({
    header: { findHeader },
    nodes: { listNodes },
    calculations: { findFigureBasis, findExportFigures },
    approvals: { findLatestApproval },
    images: { readMany, findMimes },
    configuration: { current, byId },
    transactions,
    builder,
    clock: createFixedClock(NOON_UTC),
    ...overrides,
  });
  return { service, transaction, findHeader, listNodes, current, byId, findFigureBasis, findExportFigures, findLatestApproval, readMany, findMimes, builder };
}

describe('getSummary', () => {
  it('counts the parts and the pictures, names the first and last column, and lists the rows in tree order with their typed count', async () => {
    const { service } = world(
      {},
      [
        node('b', null, 1, { [descriptionId]: 'Lid', [countId]: '24.50' }),
        node('a', null, 0, { [descriptionId]: '  Base frame  ', [countId]: 'not a number' }, 'image-1'),
        node('c', 'a', 0, {}, 'image-2'),
      ],
      basisOf({ calculationRevision: null }),
    );
    expect(await service.getSummary(LEAD, ESTIMATE_ID)).toEqual({
      fileName: 'Customer_Q-2026-0701_14-11-2026.xlsx',
      partCount: 3,
      pictureCount: 2,
      columns: { first: 'A', last: 'BO', count: 67 },
      rows: [
        { slNo: '1', name: 'Base frame', count: null },
        { slNo: '1.1', name: '', count: null },
        { slNo: '2', name: 'Lid', count: '24.50' },
      ],
      state: 'none',
      figures: null,
      warning: null,
    });
  });

  it('counts only the pictures the file can hold: a WebP is on the part but not in the file, so it is not promised (review SQR-01 of AQP-332)', async () => {
    const { service, findMimes } = world(
      {},
      [node('a', null, 0, {}, 'image-png'), node('b', null, 1, {}, 'image-webp'), node('c', null, 2, {}, 'image-jpeg'), node('d', null, 3, {}, 'image-png'), node('e', null, 4)],
      basisOf(),
      FIGURES,
      { 'image-webp': 'image/webp', 'image-jpeg': 'image/jpeg' },
    );
    const summary = await service.getSummary(LEAD, ESTIMATE_ID);
    expect(summary.partCount).toBe(5);
    expect(summary.pictureCount).toBe(3);
    // Each distinct picture is asked for once, of this estate's pictures, and no bytes are read.
    expect(findMimes).toHaveBeenCalledTimes(1);
    expect(findMimes).toHaveBeenCalledWith(ESTIMATE_ID, ['image-png', 'image-webp', 'image-jpeg']);
  });

  it('asks for no picture type when no part has a picture, and counts none', async () => {
    const { service, findMimes } = world({}, [node('a', null, 0)]);
    expect((await service.getSummary(LEAD, ESTIMATE_ID)).pictureCount).toBe(0);
    expect(findMimes).not.toHaveBeenCalled();
  });

  it('is "Customer" in the name while no customer is chosen', async () => {
    const { service } = world({ header: { findHeader: () => Promise.resolve({ code: 'Q-2026-0701', customerName: null }) } });
    expect((await service.getSummary(ADMIN, ESTIMATE_ID)).fileName).toBe('Customer_Q-2026-0701_14-11-2026.xlsx');
  });

  it('is a 404 for an estimate that is not there, before any part is read', async () => {
    const { service, listNodes } = world({ header: { findHeader: () => Promise.resolve(null) } });
    await expect(service.getSummary(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 404 });
    expect(listNodes).not.toHaveBeenCalled();
  });

  it('is a plain fault, not a half-drawn screen, when the registry holds no field', async () => {
    const empty = { ...VERSION, document: { ...seedConfig, fields: [] } };
    const { service } = world({ configuration: { current: () => Promise.resolve(empty), byId: () => Promise.resolve(empty) } });
    await expect(service.getSummary(LEAD, ESTIMATE_ID)).rejects.toThrow('The configuration version has no fields.');
  });

  it('reads no picture bytes, whatever the state: the summary counts pictures from their types alone', async () => {
    const { service, readMany } = world();
    await service.getSummary(LEAD, ESTIMATE_ID);
    expect(readMany).not.toHaveBeenCalled();
  });
});

describe('getSummary: the figures of SCR-10 only while the state is current (STORY-07.03 AC-8)', () => {
  it.each([
    ['never calculated', basisOf({ calculationRevision: null }), 'none'],
    ['out of date', basisOf({ inputsRevision: 6, calculationRevision: 5 }), 'out-of-date'],
  ] as const)('%s: the state is %s... and no figure, no approval and nothing of the calculation is read or answered', async (_label, basis, expected) => {
    const { service, findExportFigures, findLatestApproval, byId, current } = world({}, [node('a', null, 0)], basis);
    const summary = await service.getSummary(LEAD, ESTIMATE_ID);
    expect(summary.state).toBe(expected);
    expect(summary.figures).toBeNull();
    for (const spy of [findExportFigures, findLatestApproval, byId]) expect(spy).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });

  it('current: each row\'s H, own BG and own Tool Cost as the file holds them, in tree order, with BL2, BN2, the total Tool Cost, and where each is in the file', async () => {
    const { service } = world();
    const { figures, state } = await service.getSummary(ADMIN, ESTIMATE_ID);
    expect(state).toBe('current');
    expect(figures?.rows).toEqual([
      { slNo: '1', count: '2', bg: '100.5', toolCost: '0' },
      { slNo: '1.1', count: '2', bg: '200.5', toolCost: '0' },
      { slNo: '2', count: '2', bg: '300.5', toolCost: '0' },
    ]);
    expect(figures?.totals).toEqual({ bl: '601.5', bn: '120.3', bo: null, toolCostTotal: '5' });
    expect(figures?.cells).toEqual({ bl: 'BL2', bn: 'BN2', bo: 'BO2', toolCostTotal: 'BM6' });
    expect(figures?.letters).toEqual({ count: 'H', bg: 'BG', toolCost: 'BM' });
  });

  it('reads the version the calculation was made with, as the file does, and reads the figures once, through the figure state', async () => {
    const { service, byId, findExportFigures } = world();
    await service.getSummary(LEAD, ESTIMATE_ID);
    expect(byId).toHaveBeenCalledWith(OLD_VERSION.id);
    expect(findExportFigures).toHaveBeenCalledTimes(1);
    expect(findExportFigures).toHaveBeenCalledWith(CALCULATION_ID, expect.anything());
  });

  it('adds the BG column up against BL2: 100.5 + 200.5 + 300.5 is 601.5, the same, and says when the lines as shown differ by a few hundredths', async () => {
    const { service } = world();
    expect((await service.getSummary(LEAD, ESTIMATE_ID)).figures?.reconciliation).toEqual({ columnSum: '601.5', linesAsShown: '601.50', total: '601.5', matches: true });
    const lines = { ...FIGURES, rows: [row(1, '1', null, 0), row(2, '2', null, 1)].map((entry, index) => ({ ...entry, outputs: { [unitPriceId]: index === 0 ? '10.005' : '20.005' } })), productValues: { ...FIGURES.productValues, totalPrice: '30.01' } };
    const apart = await world({}, [], basisOf(), lines).service.getSummary(LEAD, ESTIMATE_ID);
    // 10.005 and 20.005 are shown as 10.01 and 20.01: they add to 30.02 as shown, and to 30.01 exactly.
    expect(apart.figures?.reconciliation).toEqual({ columnSum: '30.01', linesAsShown: '30.02', total: '30.01', matches: true });
  });

  it('says the column and BL2 do not match when they differ at two decimals (a fault the page then shows plainly)', async () => {
    const wrong = { ...FIGURES, productValues: { ...FIGURES.productValues, totalPrice: '601.52' } };
    expect((await world({}, [], basisOf(), wrong).service.getSummary(LEAD, ESTIMATE_ID)).figures?.reconciliation.matches).toBe(false);
  });

  it('reads BO through findLatestApproval, once, for this estimate, and gives the price with its difference from the calculated total and the reason', async () => {
    const { service, findLatestApproval } = world({}, [], basisOf(), FIGURES, {}, approvalOf());
    const { figures } = await service.getSummary(LEAD, ESTIMATE_ID);
    expect(findLatestApproval).toHaveBeenCalledTimes(1);
    expect(findLatestApproval).toHaveBeenCalledWith(ESTIMATE_ID, expect.anything());
    expect(figures?.totals.bo).toBe('600');
    expect(figures?.approval).toEqual({
      price: '600.00',
      approvedAt: '2026-11-12T05:50:00.000Z',
      earlier: false,
      calculatedTotal: '601.50',
      difference: { direction: 'lower', amount: '1.50' },
      reason: 'Rounded down for the quote',
    });
  });

  it('is the price approved earlier after an unlock, and says so', async () => {
    const unlock = { unlockedAt: APPROVED_AT, byName: 'Invented Lead', reason: 'Rates moved', engineerName: 'Invented Engineer' };
    const { figures } = await world({}, [], basisOf(), FIGURES, {}, approvalOf({ unlock })).service.getSummary(LEAD, ESTIMATE_ID);
    expect(figures?.totals.bo).toBe('600');
    expect(figures?.approval).toMatchObject({ price: '600.00', earlier: true });
  });

  it('has no difference and no reason for a price set at the calculated total', async () => {
    const { figures } = await world({}, [], basisOf(), FIGURES, {}, approvalOf({ approvedPrice: '601.50', isOverride: false, overrideReason: null })).service.getSummary(LEAD, ESTIMATE_ID);
    expect(figures?.approval).toMatchObject({ price: '601.50', difference: null, reason: null });
  });

  it('has no approval and an empty BO2 for a cancelled approval, whose price leaves the file, and for an estimate never approved', async () => {
    const cancel = { cancelledAt: APPROVED_AT, byName: 'Invented Admin', reason: 'Customer withdrew', engineerName: 'Invented Engineer' };
    const cancelled = (await world({}, [], basisOf(), FIGURES, {}, approvalOf({ cancel })).service.getSummary(LEAD, ESTIMATE_ID)).figures;
    expect(cancelled?.totals.bo).toBeNull();
    expect(cancelled?.approval).toBeNull();
    expect(JSON.stringify(cancelled)).not.toContain('600.00');
    expect((await world().service.getSummary(LEAD, ESTIMATE_ID)).figures?.approval).toBeNull();
  });

  it('is a fault, not an empty page, when a current calculation cannot be read', async () => {
    await expect(world({}, [], basisOf(), null).service.getSummary(LEAD, ESTIMATE_ID)).rejects.toThrow('The calculation linked to the estimate could not be read.');
  });
});

describe('getSummary: the quantity warning, only while the state is current (STORY-07.06 AC-1, AC-4, AC-5)', () => {
  /** The calculation of the fixture, made at this time by this person, with a 0 in QTY per Assy on two rows. */
  const CALCULATED_AT = '2026-11-10T00:00:00.000Z';
  const WARNED: ExportFigures = {
    ...FIGURES,
    warnings: [
      { code: 'QTY_ZERO', nodeId: '00000000-0000-4000-8000-0000000008aa', slNo: '1.1', label: 'Support arm' },
      { code: 'QTY_ZERO', nodeId: '00000000-0000-4000-8000-0000000008bb', slNo: '2', label: '' },
    ],
    madeByName: 'Invented Engineer',
  };

  it('AC-4: current: who went ahead, when (the calculation\'s own time) and each warned row by its Sl. No and its name, and nothing else of the record (no code, no node ID)', async () => {
    const { service } = world({}, [node('a', null, 0)], basisOf(), WARNED);
    const { warning, state } = await service.getSummary(LEAD, ESTIMATE_ID);
    expect(state).toBe('current');
    expect(warning).toEqual({
      madeBy: 'Invented Engineer',
      at: CALCULATED_AT,
      rows: [
        { slNo: '1.1', label: 'Support arm' },
        { slNo: '2', label: '' },
      ],
    });
    expect(JSON.stringify(warning)).not.toMatch(/QTY_ZERO|00000000-0000-4000-8000-0000000008/);
  });

  it('AC-4: a calculation with no warning has none in its summary, and so does the Admin\'s', async () => {
    const { service } = world();
    expect((await service.getSummary(ADMIN, ESTIMATE_ID)).warning).toBeNull();
  });

  it('AC-4: the warning is read with the figures, once: the same single read of the calculation, through the figure state', async () => {
    const { service, findExportFigures } = world({}, [node('a', null, 0)], basisOf(), WARNED);
    await service.getSummary(LEAD, ESTIMATE_ID);
    expect(findExportFigures).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['never calculated', basisOf({ calculationRevision: null }), 'none'],
    ['out of date', basisOf({ inputsRevision: 6, calculationRevision: 5 }), 'out-of-date'],
  ] as const)('AC-3, AC-4: %s: no warning, and the list of a stale calculation is not read at all', async (_label, basis, expected) => {
    const { service, findExportFigures } = world({}, [node('a', null, 0)], basis, WARNED);
    const summary = await service.getSummary(LEAD, ESTIMATE_ID);
    expect(summary.state).toBe(expected);
    expect(summary.warning).toBeNull();
    expect(findExportFigures).not.toHaveBeenCalled();
    expect(JSON.stringify(summary)).not.toContain('Support arm');
    expect(JSON.stringify(summary)).not.toContain('Invented Engineer');
  });

  it('AC-5 (NFR-002): an Engineer is refused before the warning, or anything else, is read', async () => {
    const { service, findExportFigures, findFigureBasis } = world({}, [node('a', null, 0)], basisOf(), WARNED);
    await expect(service.getSummary(ENGINEER, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 403 });
    expect(findExportFigures).not.toHaveBeenCalled();
    expect(findFigureBasis).not.toHaveBeenCalled();
  });

  it('A-24: the file holds no warning: the model sent to the build is the same for a warned calculation and for one with none, and no word of the warning is in it', async () => {
    const plain = world({}, [node('a', null, 0)], basisOf(), FIGURES);
    const warned = world({}, [node('a', null, 0)], basisOf(), WARNED);
    await plain.service.getFile(LEAD, ESTIMATE_ID);
    await warned.service.getFile(LEAD, ESTIMATE_ID);
    expect(warned.builder.built[0]).toEqual(plain.builder.built[0]);
    expect(JSON.stringify(warned.builder.built[0])).not.toMatch(/QTY_ZERO|Support arm|Invented Engineer|warning/i);
  });
});

describe('getFile: the calculation\'s rows, in the version it was made with (AC-1, AC-5)', () => {
  it('answers with the type, the bytes and the name, and builds one row per node of the calculation in depth-first order', async () => {
    const { service, builder } = world();
    const file = await service.getFile(LEAD, ESTIMATE_ID);
    expect(file).toMatchObject({ mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: 'Customer_Q-2026-0701_14-11-2026.xlsx' });
    const model = defined(builder.built[0]);
    expect(model.columns).toHaveLength(67);
    expect(model.rows.map((entry) => entry.cells['A'])).toEqual(['1', '1.1', '2']);
    expect(model.rows.map((entry) => entry.cells['D'])).toEqual(['Part 1', 'Part 1.1', 'Part 2']);
    expect(model.rows.map((entry) => entry.cells['BG'])).toEqual([100.5, 200.5, 300.5]);
  });

  it('reads the registry version the calculation was made with, not the one in force now', async () => {
    const { service, current, byId } = world();
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(byId).toHaveBeenCalledWith(OLD_VERSION.id);
    expect(current).not.toHaveBeenCalled();
  });

  it('uses the IST date of the moment of the download', async () => {
    const { service } = world({ clock: createFixedClock(new Date('2026-11-14T19:00:00.000Z')) });
    expect((await service.getFile(LEAD, ESTIMATE_ID)).fileName).toContain('_15-11-2026.xlsx');
  });

  it('passes a failure of the build on as it is, which the route answers with a fixed 500 and no message, and gives the place back', async () => {
    const builder = inProcessBuilder(() => Promise.reject(new Error('a name typed by a person')));
    const { service } = world({ builder });
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toThrow('a name typed by a person');
    expect(builder.open()).toBe(0);
  });
});

describe('getFile: the pictures (AC-4, AC-5)', () => {
  it('reads the distinct pictures of the calculation\'s rows, from this estimate, and embeds each in the picture column of its rows', async () => {
    const { service, builder, readMany } = world();
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(readMany).toHaveBeenCalledTimes(1);
    expect(readMany).toHaveBeenCalledWith(ESTIMATE_ID, [IMAGE_B, IMAGE_A]);
    const model = defined(builder.built[0]);
    expect(model.pictureColumn).toBe('C');
    expect(model.pictures).toHaveLength(2);
    // The rows in tree order: part 1 has picture A (place 1 in the list, read second), part 1.1 has none, part 2 has picture B (place 0).
    expect(model.rows.map((entry) => entry.picture)).toEqual([1, null, 0]);
  });

  it('takes the picture a row recorded, never a newer one: the ID comes from the calculation\'s row, and the node table is not asked for it', async () => {
    const { service, listNodes, readMany } = world({}, [node('x', null, 0, {}, IMAGE_WEBP)]);
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(listNodes).not.toHaveBeenCalled();
    expect(readMany.mock.calls.flatMap(([, ids]) => ids)).not.toContain(IMAGE_WEBP);
  });

  it('leaves a picture the workbook cannot hold (WebP) out of the file and its cell empty, and the rest of the row is written', async () => {
    const figures = { ...FIGURES, rows: [row(1, '1', null, 0, IMAGE_WEBP)] };
    const { service, builder } = world({}, [], basisOf(), figures);
    await service.getFile(LEAD, ESTIMATE_ID);
    const model = defined(builder.built[0]);
    expect(model.pictures).toBeUndefined();
    expect(model.pictureColumn).toBeUndefined();
    expect(model.rows[0]?.cells['D']).toBe('Part 1');
    expect(model.rows[0]?.picture).toBeNull();
  });

  it('reads no picture and sets no picture column for a calculation whose parts have none', async () => {
    const figures = { ...FIGURES, rows: [row(1, '1', null, 0)] };
    const { service, builder, readMany } = world({}, [], basisOf(), figures);
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(readMany).not.toHaveBeenCalled();
    expect(defined(builder.built[0]).pictures).toBeUndefined();
  });
});

describe('getFile: BL2, BN2 and BO2 in row 2 and the total Tool Cost in the footer (STORY-07.03 AC-1, AC-3, AC-4)', () => {
  it('puts the stored BL and BN in row 2 and the stored total Tool Cost in a footer two below the last row, and no other row holds a product figure', async () => {
    const { service, builder } = world();
    await service.getFile(LEAD, ESTIMATE_ID);
    const model = defined(builder.built[0]);
    expect(model.rows.map((entry) => [entry.cells['BL'] ?? null, entry.cells['BN'] ?? null, entry.cells['BO'] ?? null])).toEqual([
      [601.5, 120.3, null],
      [null, null, null],
      [null, null, null],
    ]);
    // Three parts in rows 2 to 4: the footer is row 6, one empty row (5) between.
    expect(model.footer).toEqual({ row: 6, cells: { BL: 'Total Tool Cost', BM: 5 } });
  });

  it('reads BO through findLatestApproval, once, for this estimate (architecture section 4.10: no query of its own) and writes its price in BO2', async () => {
    const { service, builder, findLatestApproval } = world({}, [], basisOf(), FIGURES, {}, approvalOf());
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(findLatestApproval).toHaveBeenCalledTimes(1);
    expect(findLatestApproval).toHaveBeenCalledWith(ESTIMATE_ID, expect.anything());
    expect(defined(builder.built[0]).rows[0]?.cells['BO']).toBe(600);
  });

  it('keeps the price approved earlier in BO2 after an unlock, and leaves BO2 empty after a cancel and when there is no approval (none is answered once the price was removed)', async () => {
    const unlock = { unlockedAt: APPROVED_AT, byName: 'Invented Lead', reason: 'Rates moved', engineerName: 'Invented Engineer' };
    const cancel = { cancelledAt: APPROVED_AT, byName: 'Invented Admin', reason: 'Customer withdrew', engineerName: 'Invented Engineer' };
    const boOf = async (approval: ApprovalRecord | null): Promise<unknown> => {
      const { service, builder } = world({}, [], basisOf(), FIGURES, {}, approval);
      await service.getFile(LEAD, ESTIMATE_ID);
      return defined(builder.built[0]).rows[0]?.cells['BO'];
    };
    expect(await boOf(approvalOf({ unlock }))).toBe(600);
    expect(await boOf(approvalOf({ cancel }))).toBeNull();
    expect(await boOf(null)).toBeNull();
  });

  it("writes the override's reason in no cell: nothing of the model holds it", async () => {
    const { service, builder } = world({}, [], basisOf(), FIGURES, {}, approvalOf());
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(JSON.stringify(defined(builder.built[0]))).not.toContain('Rounded down for the quote');
  });

  it('asks for no approval when the state refuses the file', async () => {
    for (const basis of [basisOf({ calculationRevision: null }), basisOf({ inputsRevision: 6, calculationRevision: 5 })]) {
      const { service, findLatestApproval } = world({}, [], basis);
      await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409 });
      expect(findLatestApproval).not.toHaveBeenCalled();
    }
  });

  it('refuses a stored figure that is not a plain decimal, with words that hold none of it, and gives the place back', async () => {
    const figures = { ...FIGURES, productValues: { ...FIGURES.productValues, totalPrice: 'Infinity' } };
    const builder = inProcessBuilder();
    await expect(world({ builder }, [], basisOf(), figures).service.getFile(LEAD, ESTIMATE_ID)).rejects.toThrow('A stored figure is not a number.');
    expect(builder.open()).toBe(0);
  });
});

describe('getFile: no figure is read unless the state is current (the ordering condition of AQP-332; architecture section 4.6)', () => {
  it('a never-calculated estimate is 409 NOT_CALCULATED, and nothing of a calculation, a picture or a place is read or taken', async () => {
    const { service, findExportFigures, readMany, byId, builder } = world({}, [], basisOf({ calculationRevision: null }));
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: 'NOT_CALCULATED' });
    for (const spy of [findExportFigures, readMany, byId]) expect(spy).not.toHaveBeenCalled();
    expect(builder.admitted).toEqual([]);
  });

  it('an estimate whose inputs changed after Calculate is 409 EXPORT_OUT_OF_DATE with its own words, and nothing of the stale calculation is read', async () => {
    const { service, findExportFigures, readMany, byId, builder } = world({}, [], basisOf({ inputsRevision: 6, calculationRevision: 5 }));
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE' });
    for (const spy of [findExportFigures, readMany, byId]) expect(spy).not.toHaveBeenCalled();
    expect(builder.admitted).toEqual([]);
  });

  it('says in plain words what is wrong, and the two refusals are told apart', async () => {
    const none = await world({}, [], basisOf({ calculationRevision: null })).service.getFile(LEAD, ESTIMATE_ID).catch((error: unknown) => error);
    const stale = await world({}, [], basisOf({ inputsRevision: 6, calculationRevision: 5 })).service.getFile(LEAD, ESTIMATE_ID).catch((error: unknown) => error);
    expect((none as Error).message).toBe('There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current.');
    expect((stale as Error).message).toBe('The total is cleared because an input changed. There is no file to download until you press Recalculate.');
  });

  it('a calculation that is somehow ahead of its estimate counts as out of date, never as current', async () => {
    const { service, findExportFigures } = world({}, [], basisOf({ inputsRevision: 5, calculationRevision: 6 }));
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ code: 'EXPORT_OUT_OF_DATE' });
    expect(findExportFigures).not.toHaveBeenCalled();
  });

  it('is a 404 when the estimate has no figure basis at all, and a fault (not an empty file) when a current calculation cannot be read', async () => {
    await expect(world({}, [], null as never).service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(world({}, [], basisOf(), null).service.getFile(LEAD, ESTIMATE_ID)).rejects.toThrow('The calculation linked to the estimate could not be read.');
  });
});

describe('STORY-07.04 AC-1, AC-2: the refusals, in the words of SCR-10, for a Lead and an Admin', () => {
  const NOT_CALCULATED = 'There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current.';
  const CLEARED = 'The total is cleared because an input changed. There is no file to download until you press Recalculate.';

  it.each([LEAD, ADMIN])('AC-1: $role, never calculated: 409 NOT_CALCULATED with the screen\'s words, no file, nothing read', async (viewer) => {
    const { service, findExportFigures, findLatestApproval, readMany, byId, builder } = world({}, [], basisOf({ calculationRevision: null }));
    await expect(service.getFile(viewer, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: 'NOT_CALCULATED', message: NOT_CALCULATED });
    for (const spy of [findExportFigures, findLatestApproval, readMany, byId]) expect(spy).not.toHaveBeenCalled();
    expect(builder.admitted).toEqual([]);
    expect(builder.built).toEqual([]);
  });

  it.each([LEAD, ADMIN])('AC-2: $role, an input changed after the last calculation: 409 EXPORT_OUT_OF_DATE with the screen\'s words, no file, nothing read', async (viewer) => {
    const { service, findExportFigures, findLatestApproval, readMany, byId, builder } = world({}, [], basisOf({ inputsRevision: 6, calculationRevision: 5 }));
    await expect(service.getFile(viewer, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE', message: CLEARED });
    for (const spy of [findExportFigures, findLatestApproval, readMany, byId]) expect(spy).not.toHaveBeenCalled();
    expect(builder.admitted).toEqual([]);
    expect(builder.built).toEqual([]);
  });

  it('AC-1, AC-2: the summary says the state and holds no figure and no cell of a calculation when it is not current, so the screen can refuse', async () => {
    for (const [basis, state] of [
      [basisOf({ calculationRevision: null }), 'none'],
      [basisOf({ inputsRevision: 6, calculationRevision: 5 }), 'out-of-date'],
    ] as const) {
      const { service, findExportFigures, findLatestApproval } = world({}, [node('a', null, 0)], basis);
      expect(await service.getSummary(LEAD, ESTIMATE_ID)).toMatchObject({ state, figures: null });
      expect(findExportFigures).not.toHaveBeenCalled();
      expect(findLatestApproval).not.toHaveBeenCalled();
    }
  });

  it('AC-3: once a calculation is current the same estimate gets its file, for a Lead and an Admin', async () => {
    for (const viewer of [LEAD, ADMIN]) {
      const { service } = world({}, [], basisOf({ inputsRevision: 6, calculationRevision: 6 }));
      expect((await service.getFile(viewer, ESTIMATE_ID)).bytes.byteLength).toBeGreaterThan(0);
    }
  });
});

describe('STORY-07.04 AC-4 (race): the state and the figures are read in one repeatable-read transaction, never from an earlier summary', () => {
  it('getFile reads the basis, the rows and BO2 through the transaction it opened, asked to be repeatable-read, and builds only after it ended', async () => {
    // Whether the transaction was open when the place was taken: the build's place is asked for after the snapshot, never inside it.
    const openWhenPlaceTaken: boolean[] = [];
    let isOpen = (): boolean => true;
    const builder = inProcessBuilder(undefined, () => {
      openWhenPlaceTaken.push(isOpen());
      return null;
    });
    const { service, transaction, findFigureBasis, findExportFigures, findLatestApproval, readMany, byId } = world({ builder }, [], basisOf(), FIGURES, {}, approvalOf());
    isOpen = () => transaction.open;
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(transaction.runs).toHaveLength(1);
    const run = defined(transaction.runs[0]);
    expect(run.options).toEqual({ isolation: 'repeatable-read' });
    expect(findFigureBasis).toHaveBeenCalledWith(ESTIMATE_ID, run.tx);
    expect(findExportFigures).toHaveBeenCalledWith(CALCULATION_ID, run.tx);
    expect(findLatestApproval).toHaveBeenCalledWith(ESTIMATE_ID, run.tx);
    // The build is not inside the snapshot: the pictures, the registry version and the place come after it (a build may take far longer than a transaction may).
    expect(openWhenPlaceTaken).toEqual([false]);
    for (const spy of [readMany, byId]) expect(spy).toHaveBeenCalled();
    expect(transaction.open).toBe(false);
  });

  it('getSummary reads the basis, the parts, the rows and BO2 through one repeatable-read transaction too', async () => {
    const { service, transaction, findFigureBasis, listNodes, findExportFigures, findLatestApproval } = world({}, [node('a', null, 0)], basisOf(), FIGURES, {}, approvalOf());
    await service.getSummary(LEAD, ESTIMATE_ID);
    expect(transaction.runs).toHaveLength(1);
    const run = defined(transaction.runs[0]);
    expect(run.options).toEqual({ isolation: 'repeatable-read' });
    for (const spy of [findFigureBasis, listNodes, findLatestApproval]) expect(spy).toHaveBeenCalledWith(ESTIMATE_ID, run.tx);
    expect(findExportFigures).toHaveBeenCalledWith(CALCULATION_ID, run.tx);
  });

  it('a refusal ends the transaction (nothing was written) and is the error the caller gets, unchanged', async () => {
    const { service, transaction } = world({}, [], basisOf({ inputsRevision: 6, calculationRevision: 5 }));
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE' });
    expect(transaction.runs).toHaveLength(1);
    expect(transaction.open).toBe(false);
  });

  it('the state is read again for the download, so a change after the summary is refused: a summary that said current does not let a file out once the inputs changed', async () => {
    const { service, findFigureBasis, builder } = world({}, [node('a', null, 0)], basisOf());
    expect(await service.getSummary(LEAD, ESTIMATE_ID)).toMatchObject({ state: 'current' });
    // Someone changes an input between the page being drawn and the button being pressed.
    findFigureBasis.mockResolvedValue(basisOf({ inputsRevision: 6, calculationRevision: 5 }));
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE' });
    expect(builder.admitted).toEqual([]);
  });

  it('the other way: a summary that said the figures were cleared does not keep the file refused once a Recalculate made them current', async () => {
    const { service, findFigureBasis } = world({}, [node('a', null, 0)], basisOf({ inputsRevision: 6, calculationRevision: 5 }));
    expect(await service.getSummary(LEAD, ESTIMATE_ID)).toMatchObject({ state: 'out-of-date', figures: null });
    findFigureBasis.mockResolvedValue(basisOf({ inputsRevision: 6, calculationRevision: 6 }));
    expect((await service.getFile(LEAD, ESTIMATE_ID)).fileName).toMatch(/\.xlsx$/);
  });
});

describe('getFile: the place of the build (issue 440)', () => {
  it('takes a place counted from the rows before any picture is read, and gives it back after the build', async () => {
    const order: string[] = [];
    const builder = inProcessBuilder();
    const admit = builder.admit.bind(builder);
    builder.admit = (partCount: number) => {
      order.push(`admit ${String(partCount)}`);
      return admit(partCount);
    };
    const readMany = vi.fn((_estimateId: string, ids: ReadonlyArray<string>) => {
      order.push('read pictures');
      return Promise.resolve(ids.map((id) => storedImage(id)));
    });
    const { service } = world({ builder, images: { readMany, findMimes: () => Promise.resolve([]) } });
    await service.getFile(LEAD, ESTIMATE_ID);
    expect(order).toEqual(['admit 3', 'read pictures']);
    expect(builder.open()).toBe(0);
  });

  it('a refused place is the 503 EXPORT_BUSY, with no picture read', async () => {
    const builder = inProcessBuilder(undefined, () => new ExportBusyError());
    const { service, readMany } = world({ builder });
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 503, code: 'EXPORT_BUSY' });
    expect(readMany).not.toHaveBeenCalled();
  });

  it('gives the place back when a picture cannot be read', async () => {
    const builder = inProcessBuilder();
    const { service } = world({ builder, images: { readMany: () => Promise.reject(new Error('the database is busy')), findMimes: () => Promise.resolve([]) } });
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toThrow('the database is busy');
    expect(builder.open()).toBe(0);
  });
});

describe('the role is refused first (NFR-002)', () => {
  it.each(['getSummary', 'getFile'] as const)('%s refuses an Engineer before anything is read or built', async (method) => {
    const { service, findHeader, listNodes, current, byId, findFigureBasis, findExportFigures, findLatestApproval, readMany, builder } = world();
    await expect(service[method](ENGINEER, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    for (const spy of [findHeader, listNodes, current, byId, findFigureBasis, findExportFigures, findLatestApproval, readMany]) expect(spy).not.toHaveBeenCalled();
    expect(builder.admitted).toEqual([]);
  });

  it.each(['getSummary', 'getFile'] as const)('%s refuses a role that does not exist yet, by the same closed list', async (method) => {
    const { service, findHeader } = world();
    await expect(service[method]({ id: ESTIMATE_ID, role: 'AUDITOR' as never }, ESTIMATE_ID)).rejects.toThrow();
    expect(findHeader).not.toHaveBeenCalled();
  });
});

describe('the model sent to the thread holds only what the file shows', () => {
  it('holds no key of the calculation record beyond the cells: no node ID, no parent, no master snapshot', async () => {
    const { service, builder } = world();
    await service.getFile(LEAD, ESTIMATE_ID);
    const model: ExportModel = defined(builder.built[0]);
    expect(Object.keys(model).sort()).toEqual(['columns', 'footer', 'pictureColumn', 'pictures', 'rows', 'sheetName']);
    expect(JSON.stringify(model.rows)).not.toMatch(/00000000-0000-4000-8000-0000000008/);
  });
});
