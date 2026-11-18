import { createHash, randomBytes } from 'node:crypto';

import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { NOT_APPLICABLE_MATERIAL_ID } from '@/lib/masters/system-entries';
import { buildWorkbook } from '@/server/export/build-workbook';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createExportRepository } from '@/server/repositories/export-repository';
import { createImageRepository, READ_MANY_LIMIT } from '@/server/repositories/image-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';
import { createExportService, type ExportService } from '@/server/services/export-service';

import { addTree500Estimate } from '../../support/calculate-tree';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { inProcessBuilder, type InProcessBuilder } from '../../support/in-process-builder';
import { pngOfDimensions } from '../../support/pictures';
import { seedConfig } from '../../support/seed-config';
import { loadWorkbook, readXlsxParts } from '../../support/xlsx-parts';

/**
 * STORY-07.02 (FR-067, FR-068; NFR-002, NFR-005, NFR-010, NFR-027; ADR-012, ADR-013; architecture section 4.6) against real PostgreSQL in a throwaway database, as the **runtime role**: an Engineer's
 * Calculate stores a record, the export service reads it back **through the figure state** for a Lead and an Admin, and the file is built in process and read back with ExcelJS. The rows are in
 * depth-first order with the Sl. No as text (AC-1); every column is there, hidden lines as 0 (AC-2); a figure that could not be worked out is an empty cell (AC-3); the picture is embedded in
 * column C and is the one the calculation recorded (AC-4, AC-5); "Not applicable" (AC-6); text that starts like a formula is text (AC-7); 50 parts with 50 pictures of 199 KB (AC-8); every BG equals
 * SCR-06's figure (AC-9). Every name and number is invented.
 */

/** The ceiling of the timing test under the combined coverage run of CI, which slows the build several times over; the 10 s line of AC-8 is `tests/perf/export-memory.test.ts`'s. */
const LOOSE_BOUND_SECONDS = 90;

let db: CalculationDatabase;
let exporter: ExportService;
let review: EstimateReviewService;
let builder: InProcessBuilder;
const readManyCalls: number[] = [];
const exportFigureReads = vi.fn();

const lead = () => ({ id: db.personId, role: 'LEAD' as const });
const admin = () => ({ id: db.personId, role: 'ADMIN' as const });
const engineer = () => ({ id: db.engineerId, role: 'ENGINEER' as const });

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  const images = createImageRepository(db.prisma);
  builder = inProcessBuilder(buildWorkbook);
  exporter = createExportService({
    header: createExportRepository(db.prisma),
    nodes: db.nodes,
    calculations: {
      findFigureBasis: (estimateId) => db.calculations.findFigureBasis(estimateId),
      findExportFigures: (calculationId) => {
        exportFigureReads();
        return db.calculations.findExportFigures(calculationId);
      },
    },
    images: {
      readMany: (estimateId, ids) => {
        readManyCalls.push(ids.length);
        return images.readMany(estimateId, ids);
      },
    },
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
    builder,
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
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** A complete part's inputs with its own name (D), the first material (E), and anything a test changes. */
const inputsOf = (name: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({ ...completePartInputs(), [idOf('E')]: db.materialOneId, [idOf('D')]: name, ...over });

/** Adds a part by its place in the tree (the Sl. No is derived from the place) and returns its ID. */
const addPart = (estimateId: string, name: string, parentId: string | null, sortIndex: number, over: Record<string, unknown> = {}): Promise<string> =>
  db.addPart(estimateId, { parentId, sortIndex, inputs: inputsOf(name, over) });

/** An estimate of the Engineer's with these parts (name, parent name, place), calculated. Returns its ID and the IDs of the parts by name. */
async function calculated(parts: ReadonlyArray<{ readonly name: string; readonly parent?: string; readonly at: number; readonly over?: Record<string, unknown> }>): Promise<{ estimateId: string; ids: Map<string, string> }> {
  const estimateId = await db.addEstimate({ engineer: true });
  const ids = new Map<string, string>();
  for (const part of parts) ids.set(part.name, await addPart(estimateId, part.name, part.parent === undefined ? null : defined(ids.get(part.parent)), part.at, part.over));
  await db.service.calculate(engineer(), estimateId);
  return { estimateId, ids };
}

async function sheetOf(estimateId: string, viewer: { id: string; role: 'LEAD' | 'ADMIN' } = lead()): Promise<{ sheet: ExcelJS.Worksheet; bytes: Uint8Array; workbook: ExcelJS.Workbook }> {
  const { bytes } = await exporter.getFile(viewer, estimateId);
  const workbook = await loadWorkbook(bytes);
  return { sheet: defined(workbook.getWorksheet('Quotation')), bytes, workbook };
}

/** What the calculation stored for an estimate's rows, as the owner reads it (the truth the file is held to), by Sl. No. */
async function storedRows(estimateId: string): Promise<Map<string, { inputs: Record<string, string | null>; outputs: Record<string, string | null> }>> {
  const { rows } = await db.owner.query<{ sl_no: string; inputs: Record<string, string | null>; outputs: Record<string, string | null> }>(
    `SELECT r.sl_no, r.inputs, r.outputs FROM calculation_rows r JOIN estimates e ON e.current_calculation_id = r.calculation_id WHERE e.id = $1::uuid`,
    [estimateId],
  );
  return new Map(rows.map((row) => [row.sl_no, { inputs: row.inputs, outputs: row.outputs }]));
}

const OUTPUT_FIELDS = seedConfig.fields.filter((field) => field.kind === 'output' && field.rowScope === 'row');

describe('AC-1: one row per node, depth-first, Sl. No as text, values from the calculation record', () => {
  it('lists 1, 1.1, 1.1.1, 1.1.2, 1.2, 2 from row 2, and every row\'s own values are the stored ones', async () => {
    const { estimateId } = await calculated([
      { name: 'Two', at: 1 },
      { name: 'One', at: 0 },
      { name: 'One-two', parent: 'One', at: 1 },
      { name: 'One-one', parent: 'One', at: 0 },
      { name: 'One-one-two', parent: 'One-one', at: 1 },
      { name: 'One-one-one', parent: 'One-one', at: 0 },
    ]);
    const { sheet } = await sheetOf(estimateId);
    expect(sheet.actualRowCount).toBe(7);
    const slNos = [2, 3, 4, 5, 6, 7].map((row) => sheet.getCell(`A${String(row)}`).value);
    expect(slNos).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.2', '2']);
    expect([2, 3, 4, 5, 6, 7].map((row) => sheet.getCell(`D${String(row)}`).value)).toEqual(['One', 'One-one', 'One-one-one', 'One-one-two', 'One-two', 'Two']);

    const stored = await storedRows(estimateId);
    expect([...stored.keys()].sort()).toEqual([...slNos].map(String).sort());
    // Every row-scope output of every row is the stored figure at full precision, or an empty cell where it is stored as null.
    for (const [index, slNo] of slNos.entries()) {
      const record = defined(stored.get(String(slNo)));
      for (const field of OUTPUT_FIELDS) {
        const expected = record.outputs[field.id];
        const cell = sheet.getCell(index + 2, field.position).value;
        expect(cell, `${String(slNo)} ${field.key}`).toBe(expected === null || expected === undefined ? null : Number(expected));
      }
      expect(sheet.getCell(`H${String(index + 2)}`).value).toBe(Number(defined(record.inputs[idOf('H')])));
    }
  });

  it('keeps "1.10" as text with its zero, and "1.1" is not turned into a number', async () => {
    const parts = [{ name: 'Top', at: 0 }, ...Array.from({ length: 10 }, (_, index) => ({ name: `Child ${String(index + 1)}`, parent: 'Top', at: index }))];
    const { estimateId } = await calculated(parts);
    const { sheet, bytes } = await sheetOf(estimateId);
    const column = Array.from({ length: 11 }, (_, index) => sheet.getCell(`A${String(index + 2)}`).value);
    expect(column).toEqual(['1', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10']);
    // In the XML the Sl. No cells are shared strings, never numbers.
    const xml = defined(readXlsxParts(bytes).get('xl/worksheets/sheet1.xml'));
    const cells = [...xml.matchAll(/<c r="A(\d+)"([^>]*)>/g)].filter((match) => Number(match[1]) >= 2);
    expect(cells).toHaveLength(11);
    for (const match of cells) expect(match[2]).toMatch(/t="s"/);
  });

  it('builds the 500 parts of the largest tree (500 rows, in depth-first order), the same way', async () => {
    const estimateId = await addTree500Estimate(db);
    await db.service.calculate(engineer(), estimateId);
    const { sheet } = await sheetOf(estimateId);
    expect(sheet.actualRowCount).toBe(501);
    const stored = await storedRows(estimateId);
    expect(new Set(Array.from({ length: 500 }, (_, index) => String(sheet.getCell(`A${String(index + 2)}`).value))).size).toBe(500);
    expect([...stored.keys()].every((slNo) => typeof slNo === 'string')).toBe(true);
  }, 120_000);
});

describe('AC-2: unselected treatments and "None" fasteners are present as 0', () => {
  it('writes 0 for Fasteners Qty and Cost (hidden on screen) and for the cost of each treatment that was not selected', async () => {
    const flagsOff = Object.fromEntries(['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'].map((letter) => [idOf(letter), '0']));
    const { estimateId } = await calculated([{ name: 'Plain', at: 0, over: flagsOff }]);
    const { sheet } = await sheetOf(estimateId);
    for (const key of ['fasteners-qty', 'fasteners-cost', 'hot-dip-galvanizing-cost', 'primer-cost', 'shot-blasting-cost', 'polishing-cost', 'powder-coating-cost', 'foam-cost', 'soft-anodize-cost']) {
      const field = defined(seedConfig.fields.find((candidate) => candidate.key === key));
      expect(sheet.getCell(2, field.position).value, key).toBe(0);
    }
    expect(sheet.getCell(2, defined(seedConfig.fields.find((field) => field.key === 'fasteners')).position).value).toBe('None');
  });
});

describe('AC-3: a figure that could not be worked out is an empty cell', () => {
  it('leaves BJ empty when the dollar rate is 0, and writes no Infinity, NaN or error text anywhere in the sheet', async () => {
    await db.owner.query("UPDATE exchange_rates SET inr_value = 0 WHERE currency = 'USD'");
    let estimateId: string;
    try {
      ({ estimateId } = await calculated([{ name: 'Divide', at: 0 }]));
    } finally {
      await db.owner.query("UPDATE exchange_rates SET inr_value = 80 WHERE currency = 'USD'");
    }
    const { sheet, bytes } = await sheetOf(estimateId);
    const bj = defined(seedConfig.fields.find((field) => field.key === 'unit-price-usd')).position;
    const bk = defined(seedConfig.fields.find((field) => field.key === 'unit-price-eur')).position;
    expect(sheet.getCell(2, bj).value).toBeNull();
    expect(typeof sheet.getCell(2, bk).value).toBe('number');
    const xml = defined(readXlsxParts(bytes).get('xl/worksheets/sheet1.xml'));
    expect(xml).not.toMatch(/Infinity|NaN|#DIV\/0!|#NUM!|#VALUE!/);
  });
});

describe('AC-4, AC-5: the picture is embedded in column C, and is the one the calculation recorded', () => {
  const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

  async function storePicture(estimateId: string, bytes: Uint8Array): Promise<string> {
    const { rows } = await db.owner.query<{ id: string }>(
      `INSERT INTO part_images (estimate_id, sha256, mime, bytes, size_bytes, file_name) VALUES ($1::uuid, $2, 'image/png', $3, $4, 'invented.png') RETURNING id::text`,
      [estimateId, sha(bytes), Buffer.from(bytes), bytes.byteLength],
    );
    return defined(rows[0]).id;
  }
  const attach = (nodeId: string, imageId: string | null): Promise<unknown> => db.owner.query('UPDATE estimate_nodes SET image_id = $2::uuid WHERE id = $1::uuid', [nodeId, imageId]);

  it('embeds each part\'s picture in its own row of column C, scaled to its cell, and leaves the cell of a part without one empty', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    const first = await addPart(estimateId, 'With', null, 0);
    await addPart(estimateId, 'Without', null, 1);
    const picture = new Uint8Array(pngOfDimensions(640, 480));
    await attach(first, await storePicture(estimateId, picture));
    await db.service.calculate(engineer(), estimateId);

    const { sheet, workbook } = await sheetOf(estimateId, admin());
    const images = sheet.getImages();
    expect(images).toHaveLength(1);
    expect(Math.floor(defined(images[0]).range.tl.col)).toBe(2);
    expect(Math.floor(defined(images[0]).range.tl.row)).toBe(1);
    expect(sheet.getCell('C2').value).toBeNull();
    expect(sheet.getCell('C3').value).toBeNull();
    expect(Buffer.from(defined(workbook.getImage(Number(defined(images[0]).imageId)).buffer) as unknown as Uint8Array).equals(Buffer.from(picture))).toBe(true);
  });

  it('shows the picture recorded in the calculation, not a newer one: a picture put on the part after Calculate is not in the file (AC-5, ADR-013)', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    const part = await addPart(estimateId, 'Replaced', null, 0);
    const recorded = new Uint8Array(pngOfDimensions(120, 80, 2_000));
    const newer = new Uint8Array(pngOfDimensions(60, 90, 3_000));
    await attach(part, await storePicture(estimateId, recorded));
    await db.service.calculate(engineer(), estimateId);
    // A picture replaced on the part after the calculation, written as the owner does so the estimate stays current: the record, not the part, is what the file is built from.
    await attach(part, await storePicture(estimateId, newer));

    const { sheet, workbook } = await sheetOf(estimateId);
    const [image] = sheet.getImages();
    const embedded = Buffer.from(defined(workbook.getImage(Number(defined(image).imageId)).buffer) as unknown as Uint8Array);
    expect(embedded.equals(Buffer.from(recorded))).toBe(true);
    expect(embedded.equals(Buffer.from(newer))).toBe(false);
  });

  it('reads the pictures of an estimate with 120 of them in batches of 50, 50 and 20, and embeds all 120', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    for (let index = 0; index < 120; index += 1) {
      const part = await addPart(estimateId, `Part ${String(index + 1)}`, null, index);
      await attach(part, await storePicture(estimateId, new Uint8Array(pngOfDimensions(10 + index, 10))));
    }
    await db.service.calculate(engineer(), estimateId);
    readManyCalls.length = 0;
    const { sheet } = await sheetOf(estimateId);
    expect(readManyCalls).toEqual([50, 50, 20]);
    expect(sheet.getImages()).toHaveLength(120);
  }, 120_000);

  it('AC-8 (NFR-010): 50 parts with 50 pictures of 199 KB, through the whole path, build inside the 10 s line (the time is printed)', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    for (let index = 0; index < 50; index += 1) {
      const part = await addPart(estimateId, `Part ${String(index + 1)}`, null, index);
      const bytes = new Uint8Array(pngOfDimensions(800 + index, 600, 199 * 1024));
      bytes.set(randomBytes(bytes.length - 100), 60);
      await attach(part, await storePicture(estimateId, bytes));
    }
    await db.service.calculate(engineer(), estimateId);
    const started = performance.now();
    const { bytes, sheet } = await sheetOf(estimateId);
    const seconds = (performance.now() - started) / 1000;
    process.stdout.write(`\nSTORY-07.02 AC-8 through the service: 50 parts, 50 pictures of 199 KB: ${seconds.toFixed(2)} s, file ${(bytes.byteLength / 1_048_576).toFixed(1)} MB (the read-back included).\n`);
    expect(sheet.getImages()).toHaveLength(50);
    expect(seconds).toBeLessThan(LOOSE_BOUND_SECONDS);
  }, 120_000);

  it('reads a picture only of this estimate: another estimate\'s ID, an unknown one and a text that is no ID are left out, and more than 50 is refused', async () => {
    const repository = createImageRepository(db.prisma);
    const mine = await db.addEstimate({ engineer: true });
    const other = await db.addEstimate({ engineer: true });
    const ownId = await storePicture(mine, new Uint8Array(pngOfDimensions(8, 8)));
    const foreignId = await storePicture(other, new Uint8Array(pngOfDimensions(9, 9)));
    const found = await repository.readMany(mine, [ownId, foreignId, '00000000-0000-4000-8000-00000000dead', 'not-an-id']);
    expect(found.map((image) => image.id)).toEqual([ownId]);
    expect(found[0]?.mime).toBe('image/png');
    expect(await repository.readMany(mine, [])).toEqual([]);
    expect(await repository.readMany('not-an-id', [ownId])).toEqual([]);
    expect(() => repository.readMany(mine, Array.from({ length: READ_MANY_LIMIT + 1 }, () => ownId))).toThrow(RangeError);
  });
});

describe('AC-6: "Not applicable" material and treatment', () => {
  it('shows the words in E and G and leaves F and I blank, while a real material shows its own price in I', async () => {
    const { estimateId } = await calculated([
      { name: 'Plate', at: 0 },
      { name: 'Hidden', at: 1, over: { [idOf('E')]: NOT_APPLICABLE_MATERIAL_ID } },
    ]);
    const { sheet } = await sheetOf(estimateId);
    expect(sheet.getCell('E2').value).toBe('Invented plate');
    expect(sheet.getCell('F2').value).toBe('Invented steel');
    expect(sheet.getCell('I2').value).toBe(60);
    expect(sheet.getCell('E3').value).toBe('Not applicable');
    expect(sheet.getCell('F3').value).toBeNull();
    expect(sheet.getCell('I3').value).toBeNull();
    // The treatment typed as words stays the words.
    expect(typeof sheet.getCell('G2').value).toBe('string');
  });
});

describe('AC-7 (NFR-027): text that starts like a formula is text', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@A1', '\t=1+1', '\r=1+1', '\n=1+1'])('a part named %j is a string cell, not a formula', async (payload) => {
    const { estimateId } = await calculated([{ name: payload, at: 0, over: { [idOf('AJ')]: payload } }]);
    const { sheet, bytes } = await sheetOf(estimateId);
    expect(sheet.getCell('D2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('D2').formula).toBeUndefined();
    expect(sheet.getCell('AJ2').formula).toBeUndefined();
    const xml = defined(readXlsxParts(bytes).get('xl/worksheets/sheet1.xml'));
    expect(xml).not.toMatch(/<f[ >/]/);
  });
});

describe('AC-9 (SPEC section 14.12): every BG in the file is the figure of SCR-06 for that row', () => {
  it('equals the unit price the review shows for each row, to every digit and as shown at two decimals', async () => {
    const { estimateId } = await calculated([
      { name: 'Alpha', at: 0, over: { [idOf('H')]: '2' } },
      { name: 'Beta', parent: 'Alpha', at: 0, over: { [idOf('H')]: '5', [idOf('J')]: '321.45' } },
      { name: 'Gamma', at: 1, over: { [idOf('H')]: '11', [idOf('L')]: '4.4' } },
    ]);
    const costs = await review.getCosts(lead(), estimateId);
    const { sheet } = await sheetOf(estimateId);
    const bg = defined(seedConfig.fields.find((field) => field.systemRole === 'unit-price')).position;
    for (const [index, entry] of costs.nodes.entries()) {
      const shown = defined(entry.figures?.unitPrice);
      const cell = sheet.getCell(index + 2, bg).value;
      expect(sheet.getCell(index + 2, 1).value).toBe(entry.slNo);
      expect(cell).toBe(Number(shown));
      expect(new Decimal(String(cell)).toFixed(2)).toBe(new Decimal(shown).toFixed(2));
    }
    expect(costs.nodes.length).toBe(3);
  });
});

describe('the state of the figures: no file unless the calculation is current, and nothing is read otherwise', () => {
  it('a never-calculated estimate is 409 NOT_CALCULATED and reads neither a calculation nor a picture', async () => {
    const estimateId = await db.addCompleteEstimate();
    exportFigureReads.mockClear();
    readManyCalls.length = 0;
    await expect(exporter.getFile(lead(), estimateId)).rejects.toMatchObject({ httpStatus: 409, code: 'NOT_CALCULATED' });
    expect(exportFigureReads).not.toHaveBeenCalled();
    expect(readManyCalls).toEqual([]);
  });

  it('an estimate whose inputs changed after Calculate is 409 EXPORT_OUT_OF_DATE and the stale figures are not read', async () => {
    const { estimateId } = await calculated([{ name: 'Stale', at: 0 }]);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    exportFigureReads.mockClear();
    await expect(exporter.getFile(lead(), estimateId)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE' });
    expect(exportFigureReads).not.toHaveBeenCalled();
  });

  it('refuses the Engineer who owns the estimate before anything is read, even now that the file carries figures', async () => {
    const { estimateId } = await calculated([{ name: 'Mine', at: 0 }]);
    exportFigureReads.mockClear();
    await expect(exporter.getFile(engineer(), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    expect(exportFigureReads).not.toHaveBeenCalled();
  });

  it('takes a place for the build, counted from the rows, and gives it back', async () => {
    const { estimateId } = await calculated([{ name: 'Placed', at: 0 }]);
    builder.admitted.length = 0;
    await exporter.getFile(lead(), estimateId);
    expect(builder.admitted).toEqual([1]);
    expect(builder.open()).toBe(0);
  });
});
