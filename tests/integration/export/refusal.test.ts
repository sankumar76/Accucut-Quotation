import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { EstimateViewer } from '@/server/services/estimate-service';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { buildWorkbook } from '@/server/export/build-workbook';
import { createDownloadRepository } from '@/server/repositories/download-repository';
import { createExportRepository } from '@/server/repositories/export-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createExportService, type ExportService } from '@/server/services/export-service';
import { exportFileSchema } from '@/server/views/schemas/export';

import { adminOf, auditOf, calculatedEstimate, currentCalculationOf, engineerOf, leadOf, refusalOf, requestFor, storedOf } from '../../support/approval-helpers';
import { type ApprovedWorld, openApprovedWorld } from '../../support/approved-world';
import { defined } from '../../support/defined';
import { inProcessBuilder } from '../../support/in-process-builder';
import { loadWorkbook } from '../../support/xlsx-parts';

/**
 * STORY-07.04 (FR-070, FR-100, FR-101; D-28, D-30, D-37; NFR-002; architecture section 4.6 "No file exists until a calculation is current") against real PostgreSQL in a throwaway database, as the **runtime
 * role**: the file is refused while no calculation is current (409 `NOT_CALCULATED` for an estimate never calculated, at any status, 409 `EXPORT_OUT_OF_DATE` once an input changed) and given once it is, to a Lead and
 * an Admin, never to an Engineer, over the matrix of the story's testing notes: **none / current / out-of-date x DRAFT / SUBMITTED / APPROVED x Engineer / Lead / Admin** (signed-out is the route's 401, in
 * `tests/unit/export-route.test.ts` and `tests/e2e/export-refusal.spec.ts`). AC-4 is tested against the real database: the state and the figures are read in **one repeatable-read snapshot**, so a change another
 * connection commits between two reads is not seen by the second, and a state read for an earlier summary is never used. Every name and number is invented.
 */

const NOT_CALCULATED = 'There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current.';
const CLEARED = 'The total is cleared because an input changed. There is no file to download until you press Recalculate.';

let world: ApprovedWorld;
let db: ApprovedWorld['db'];
let exporter: ExportService;

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'] as const;
type Status = (typeof STATUSES)[number];

beforeAll(async () => {
  world = await openApprovedWorld();
  db = world.db;
  exporter = world.exporter;
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** An estimate that was never calculated, in this status. */
const neverCalculated = (status: Status): Promise<string> => db.addEstimate({ status, engineer: true });

/** An estimate with a current calculation, in this status: SUBMITTED as Calculate leaves it, APPROVED by the Lead, DRAFT by the unlock that keeps the figures (STORY-06.08). */
async function current(status: Status): Promise<string> {
  const { estimateId } = await calculatedEstimate(db, 1);
  if (status === 'SUBMITTED') return estimateId;
  await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, await currentCalculationOf(db, estimateId)));
  if (status === 'APPROVED') return estimateId;
  await world.unlock.unlock(leadOf(db), estimateId, { reason: 'Invented reason to unlock.', audit: auditOf(db) });
  return estimateId;
}

/** An input changed after the calculation: the estimate's input revision goes up, as every real input change does (STORY-06.04), whatever the status. */
async function changed(estimateId: string): Promise<string> {
  await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
  return estimateId;
}

/** The Engineer, the Lead and the Admin of this database (built when a test runs, once the database exists). */
const people = (): { readonly engineer: EstimateViewer; readonly lead: EstimateViewer; readonly admin: EstimateViewer } => ({ engineer: engineerOf(db), lead: leadOf(db), admin: adminOf(db) });

describe('AC-1: never calculated, at any status: 409 NOT_CALCULATED, no file, no partial content', () => {
  it.each(STATUSES)('%s: the Lead and the Admin get the 409 with the words of SCR-10, the Engineer the 403, and nothing is written', async (status) => {
    const estimateId = await neverCalculated(status);
    const before = await storedOf(db, estimateId);
    const { engineer, lead, admin } = people();
    for (const viewer of [lead, admin]) {
      const refusal = await refusalOf(exporter.getFile(viewer, estimateId));
      expect(refusal, viewer.role).toMatchObject({ httpStatus: 409, code: 'NOT_CALCULATED', message: NOT_CALCULATED });
      expect(Object.keys(refusal as object), viewer.role).not.toContain('bytes');
    }
    await expect(exporter.getFile(engineer, estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });
});

describe('AC-2: an input changed after the last calculation: 409 EXPORT_OUT_OF_DATE, no file', () => {
  it.each(STATUSES)('%s: the Lead and the Admin get the 409 with the words of SCR-10, the Engineer the 403, and nothing is written', async (status) => {
    const estimateId = await changed(await current(status));
    const before = await storedOf(db, estimateId);
    const { engineer, lead, admin } = people();
    for (const viewer of [lead, admin]) {
      const refusal = await refusalOf(exporter.getFile(viewer, estimateId));
      expect(refusal, viewer.role).toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE', message: CLEARED });
      expect(Object.keys(refusal as object), viewer.role).not.toContain('bytes');
    }
    await expect(exporter.getFile(engineer, estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

});

describe('AC-3: after Recalculate (state current) the file downloads for a Lead and an Admin, and an Engineer is still 403', () => {
  it.each(STATUSES)('%s with a current calculation: the Lead and the Admin get a workbook, the Engineer the 403', async (status) => {
    const estimateId = await current(status);
    const { engineer, lead, admin } = people();
    for (const viewer of [lead, admin]) {
      const file = exportFileSchema.parse(await exporter.getFile(viewer, estimateId));
      expect(defined((await loadWorkbook(file.bytes)).getWorksheet('Quotation')).actualRowCount, viewer.role).toBeGreaterThan(1);
    }
    await expect(exporter.getFile(engineer, estimateId)).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('an estimate refused as out of date gets its file once the Lead recalculates it, and a second refusal does not come back', async () => {
    const estimateId = await changed(await current('SUBMITTED'));
    await expect(exporter.getFile(leadOf(db), estimateId)).rejects.toMatchObject({ code: 'EXPORT_OUT_OF_DATE' });
    await db.service.recalculate(leadOf(db), estimateId);
    exportFileSchema.parse(await exporter.getFile(leadOf(db), estimateId));
    exportFileSchema.parse(await exporter.getFile(adminOf(db), estimateId));
  });
});

describe('AC-6 (D-37): only the download is refused', () => {
  it('while the figures are not current the summary, the screens\' reads and Calculate or Recalculate all work as usual', async () => {
    const estimateId = await changed(await current('SUBMITTED'));
    const { lead } = people();
    expect(await exporter.getSummary(lead, estimateId)).toMatchObject({ state: 'out-of-date', figures: null, partCount: 1 });
    await expect(exporter.getFile(lead, estimateId)).rejects.toMatchObject({ httpStatus: 409 });
    expect(await world.review.getCosts(lead, estimateId)).toMatchObject({ state: 'out-of-date' });
    await db.service.recalculate(leadOf(db), estimateId);
    expect(await exporter.getSummary(lead, estimateId)).toMatchObject({ state: 'current' });
  });
});

/** The export service over the same database with a hook after the state is read and a probe among the reads of the snapshot. */
function exporterWithHooks(hooks: { afterBasis?: () => Promise<void>; seenByLaterRead?: (inputsRevision: number | undefined) => void }): ExportService {
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  return createExportService({
    header: createExportRepository(db.prisma),
    downloads: createDownloadRepository(db.prisma),
    nodes: db.nodes,
    calculations: {
      findFigureBasis: async (estimateId, tx) => {
        const basis = await db.calculations.findFigureBasis(estimateId, tx);
        await hooks.afterBasis?.();
        return basis;
      },
      findExportFigures: db.calculations.findExportFigures,
    },
    approvals: {
      // A read made later in the same transaction, which is where a change committed after the state was read would show if the reads did not share one snapshot.
      findLatestApproval: async (estimateId, tx) => {
        hooks.seenByLaterRead?.((await db.calculations.findFigureBasis(estimateId, tx))?.inputsRevision);
        return db.approvals.findLatestApproval(estimateId, tx);
      },
    },
    images: createImageRepository(db.prisma),
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
    transactions: db.transactions,
    builder: inProcessBuilder(buildWorkbook),
    clock: { now: () => new Date('2026-11-14T12:00:00.000Z') },
  });
}

const revisionOf = async (estimateId: string): Promise<number> =>
  defined((await db.owner.query<{ revision: number }>('SELECT inputs_revision AS revision FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).revision;

describe('AC-4 (race): the state is read in the same repeatable-read transaction that reads the figures', () => {
  it('a change another connection commits after the state was read is not seen by the later reads of the file: one snapshot', async () => {
    const estimateId = await current('SUBMITTED');
    const start = await revisionOf(estimateId);
    const seen: Array<number | undefined> = [];
    const racing = exporterWithHooks({
      afterBasis: async () => {
        await changed(estimateId);
      },
      seenByLaterRead: (revision) => seen.push(revision),
    });
    // The state read was `current`, so the file is made, from the snapshot of that moment.
    exportFileSchema.parse(await racing.getFile(leadOf(db), estimateId));
    expect(await revisionOf(estimateId)).toBe(start + 1);
    // The later read in the same transaction saw the revision of the state it read, not the one committed since.
    expect(seen).toEqual([start]);
  });

  it('the summary reads its state, its parts and its figures from one snapshot too', async () => {
    const estimateId = await current('SUBMITTED');
    const start = await revisionOf(estimateId);
    const seen: Array<number | undefined> = [];
    const racing = exporterWithHooks({
      afterBasis: async () => {
        await changed(estimateId);
      },
      seenByLaterRead: (revision) => seen.push(revision),
    });
    expect(await racing.getSummary(leadOf(db), estimateId)).toMatchObject({ state: 'current' });
    expect(seen).toEqual([start]);
  });

  it('a read without the snapshot would have seen the change: the runner\'s default is read committed, so the guard above is the snapshot and not luck', async () => {
    const estimateId = await current('SUBMITTED');
    const start = await revisionOf(estimateId);
    const read = async (isolation: 'repeatable-read' | undefined): Promise<Array<number | undefined>> => {
      const seen: Array<number | undefined> = [];
      await db.transactions.run(async (tx) => {
        seen.push((await db.calculations.findFigureBasis(estimateId, tx))?.inputsRevision);
        await changed(estimateId);
        seen.push((await db.calculations.findFigureBasis(estimateId, tx))?.inputsRevision);
      }, isolation === undefined ? undefined : { isolation });
      return seen;
    };
    expect(await read('repeatable-read')).toEqual([start, start]);
    expect(await read(undefined)).toEqual([start + 1, start + 2]);
  });

  it('a state read for an earlier summary is never used: the summary said current, an input changed, the download is refused', async () => {
    const estimateId = await current('SUBMITTED');
    const { lead } = people();
    expect(await exporter.getSummary(lead, estimateId)).toMatchObject({ state: 'current' });
    await changed(estimateId);
    await expect(exporter.getFile(lead, estimateId)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE' });
  });

  it('the other way: the summary said cleared, a Recalculate made the figures current, the download is given', async () => {
    const estimateId = await changed(await current('SUBMITTED'));
    const { lead } = people();
    expect(await exporter.getSummary(lead, estimateId)).toMatchObject({ state: 'out-of-date', figures: null });
    await db.service.recalculate(leadOf(db), estimateId);
    exportFileSchema.parse(await exporter.getFile(lead, estimateId));
  });
});
