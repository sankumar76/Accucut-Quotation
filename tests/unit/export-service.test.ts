import { describe, expect, it, vi } from 'vitest';

import { ExportBusyError } from '@/lib/errors';
import { createFixedClock } from '@/lib/time';
import type { ExportModel } from '@/server/export/export-model';
import type { ExportFigures } from '@/server/repositories/calculation-repository';
import type { NodeRecord } from '@/server/repositories/estimate-node-repository';
import type { ExportedImage } from '@/server/repositories/image-repository';
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
};

/** The estimate is calculated at the revision it is at now, so its figures are current, unless a test says otherwise. */
const basisOf = (over: { inputsRevision?: number; calculationRevision?: number | null } = {}) => {
  const inputsRevision = over.inputsRevision ?? 5;
  const calculationRevision = over.calculationRevision === undefined ? inputsRevision : over.calculationRevision;
  return {
    inputsRevision,
    calculation: calculationRevision === null ? null : { id: CALCULATION_ID, inputsRevision: calculationRevision, configVersionId: OLD_VERSION.id, createdAt: new Date('2026-11-10T00:00:00.000Z') },
  };
};

function world(overrides: Partial<ExportDependencies> = {}, nodes: ReadonlyArray<NodeRecord> = [], basis = basisOf(), figures: ExportFigures | null = FIGURES) {
  const findHeader = vi.fn(() => Promise.resolve({ code: 'Q-2026-0701', customerName: 'Acme Tools' as string | null }));
  const listNodes = vi.fn(() => Promise.resolve([...nodes]));
  const current = vi.fn(() => Promise.resolve(VERSION));
  const byId = vi.fn(() => Promise.resolve(OLD_VERSION));
  const findFigureBasis = vi.fn(() => Promise.resolve(basis));
  const findExportFigures = vi.fn(() => Promise.resolve(figures));
  const readMany = vi.fn((_estimateId: string, ids: ReadonlyArray<string>) =>
    Promise.resolve([storedImage(IMAGE_A), storedImage(IMAGE_B), storedImage(IMAGE_WEBP, 'image/webp', new Uint8Array(smallWebp()))].filter((image) => ids.includes(image.id))),
  );
  const builder = inProcessBuilder();
  const service = createExportService({
    header: { findHeader },
    nodes: { listNodes },
    calculations: { findFigureBasis, findExportFigures },
    images: { readMany },
    configuration: { current, byId },
    builder,
    clock: createFixedClock(NOON_UTC),
    ...overrides,
  });
  return { service, findHeader, listNodes, current, byId, findFigureBasis, findExportFigures, readMany, builder };
}

describe('getSummary', () => {
  it('counts the parts and the pictures, names the first and last column, and lists the rows in tree order with their typed count', async () => {
    const { service } = world({}, [
      node('b', null, 1, { [descriptionId]: 'Lid', [countId]: '24.50' }),
      node('a', null, 0, { [descriptionId]: '  Base frame  ', [countId]: 'not a number' }, 'image-1'),
      node('c', 'a', 0, {}, 'image-2'),
    ]);
    expect(await service.getSummary(LEAD, ESTIMATE_ID)).toEqual({
      fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx',
      partCount: 3,
      pictureCount: 2,
      columns: { first: 'A', last: 'BO', count: 67 },
      rows: [
        { slNo: '1', name: 'Base frame', count: null },
        { slNo: '1.1', name: '', count: null },
        { slNo: '2', name: 'Lid', count: '24.50' },
      ],
    });
  });

  it('is "Customer" in the name while no customer is chosen', async () => {
    const { service } = world({ header: { findHeader: () => Promise.resolve({ code: 'Q-2026-0701', customerName: null }) } });
    expect((await service.getSummary(ADMIN, ESTIMATE_ID)).fileName).toBe('Quotation_Customer_Q-2026-0701_2026-11-14.xlsx');
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

  it('reads no calculated figure and no picture: the summary is the parts as they are now', async () => {
    const { service, findFigureBasis, findExportFigures, readMany } = world();
    await service.getSummary(LEAD, ESTIMATE_ID);
    for (const spy of [findFigureBasis, findExportFigures, readMany]) expect(spy).not.toHaveBeenCalled();
  });
});

describe('getFile: the calculation\'s rows, in the version it was made with (AC-1, AC-5)', () => {
  it('answers with the type, the bytes and the name, and builds one row per node of the calculation in depth-first order', async () => {
    const { service, builder } = world();
    const file = await service.getFile(LEAD, ESTIMATE_ID);
    expect(file).toMatchObject({ mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx' });
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
    expect((await service.getFile(LEAD, ESTIMATE_ID)).fileName).toContain('_2026-11-15.xlsx');
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
    expect((none as Error).message).toBe('The estimate has not been calculated yet, so there is no file to download.');
    expect((stale as Error).message).toBe('The estimate changed after it was last calculated, so there is no file to download until it is calculated again.');
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
    const { service } = world({ builder, images: { readMany } });
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
    const { service } = world({ builder, images: { readMany: () => Promise.reject(new Error('the database is busy')) } });
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toThrow('the database is busy');
    expect(builder.open()).toBe(0);
  });
});

describe('the role is refused first (NFR-002)', () => {
  it.each(['getSummary', 'getFile'] as const)('%s refuses an Engineer before anything is read or built', async (method) => {
    const { service, findHeader, listNodes, current, byId, findFigureBasis, findExportFigures, readMany, builder } = world();
    await expect(service[method](ENGINEER, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    for (const spy of [findHeader, listNodes, current, byId, findFigureBasis, findExportFigures, readMany]) expect(spy).not.toHaveBeenCalled();
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
    expect(Object.keys(model).sort()).toEqual(['columns', 'pictureColumn', 'pictures', 'rows', 'sheetName']);
    expect(JSON.stringify(model.rows)).not.toMatch(/00000000-0000-4000-8000-0000000008/);
  });
});
