import { describe, expect, it, vi } from 'vitest';

import { createFixedClock } from '@/lib/time';
import type { ExportModel } from '@/server/export/export-model';
import type { NodeRecord } from '@/server/repositories/estimate-node-repository';
import { createExportService, type ExportDependencies } from '@/server/services/export-service';

import { defined } from '../support/defined';
import { seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * The export service (STORY-07.01 AC-2, AC-3, AC-6): the summary and the file over fakes, with a clock the test holds. The role is refused before anything is read, a thrown message of the build is not
 * passed on, and the file is built from the registry's columns only. Every name and ID is invented.
 */

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', role: 'ADMIN' } as const;
const ENGINEER = { id: '00000000-0000-4000-8000-0000000e0001', role: 'ENGINEER' } as const;
const VERSION = { id: '00000000-0000-4000-8000-0aaa00000001', number: 3, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: '2026-11-01T00:00:00.000Z' };
const NOON_UTC = new Date('2026-11-14T12:00:00.000Z');

const descriptionId = defined(seedConfig.fields.find((field) => field.key === 'description')).id;
const countId = defined(seedConfig.fields.find((field) => field.systemRole === 'quantity')).id;

const node = (id: string, parentId: string | null, sortIndex: number, inputs: Record<string, unknown> = {}, imageId: string | null = null): NodeRecord => ({ id, parentId, sortIndex, revision: 1, inputs, imageId });

function world(overrides: Partial<ExportDependencies> = {}, nodes: ReadonlyArray<NodeRecord> = []) {
  const findHeader = vi.fn(() => Promise.resolve({ code: 'Q-2026-0701', customerName: 'Acme Tools' as string | null }));
  const listNodes = vi.fn(() => Promise.resolve([...nodes]));
  const current = vi.fn(() => Promise.resolve(VERSION));
  const build = vi.fn((model: ExportModel) => Promise.resolve(new Uint8Array([80, 75, model.columns.length])));
  const service = createExportService({ header: { findHeader }, nodes: { listNodes }, configuration: { current }, build, clock: createFixedClock(NOON_UTC), ...overrides });
  return { service, findHeader, listNodes, current, build };
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
    const { service } = world({ configuration: { current: () => Promise.resolve(empty) } });
    await expect(service.getSummary(LEAD, ESTIMATE_ID)).rejects.toThrow('The configuration version has no fields.');
  });
});

describe('getFile', () => {
  it('builds the header row of the registry\'s 67 columns with no row below, and answers with the type, the bytes and the name', async () => {
    const { service, build } = world();
    const file = await service.getFile(LEAD, ESTIMATE_ID);
    expect(file).toEqual({
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: new Uint8Array([80, 75, 67]),
      fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx',
    });
    const model = defined(build.mock.calls[0]?.[0]);
    expect(model.rows).toEqual([]);
    expect(model.columns.map((column) => column.letter).slice(0, 3)).toEqual(['A', 'B', 'C']);
    expect(defined(model.columns[0]).header).toBe(defined(seedFieldAt('A')).label);
  });

  it('uses the IST date of the moment of the download', async () => {
    const clock = createFixedClock(new Date('2026-11-14T19:00:00.000Z'));
    const { service } = world({ clock });
    expect((await service.getFile(LEAD, ESTIMATE_ID)).fileName).toContain('_2026-11-15.xlsx');
  });

  it('passes a failure of the build on as it is, which the route answers with a fixed 500 and no message', async () => {
    const { service } = world({ build: () => Promise.reject(new Error('a name typed by a person')) });
    await expect(service.getFile(LEAD, ESTIMATE_ID)).rejects.toThrow('a name typed by a person');
  });
});

describe('the role is refused first (NFR-002)', () => {
  it.each(['getSummary', 'getFile'] as const)('%s refuses an Engineer before anything is read or built', async (method) => {
    const { service, findHeader, listNodes, current, build } = world();
    await expect(service[method](ENGINEER, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    for (const spy of [findHeader, listNodes, current, build]) expect(spy).not.toHaveBeenCalled();
  });

  it.each(['getSummary', 'getFile'] as const)('%s refuses a role that does not exist yet, by the same closed list', async (method) => {
    const { service, findHeader } = world();
    await expect(service[method]({ id: ESTIMATE_ID, role: 'AUDITOR' as never }, ESTIMATE_ID)).rejects.toThrow();
    expect(findHeader).not.toHaveBeenCalled();
  });
});
