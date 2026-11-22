import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDownloadRepository } from '@/server/repositories/download-repository';
import { createDownloadMarkerService, type DownloadMarkerService } from '@/server/services/download-marker-service';

import { adminOf, calculatedEstimate, currentCalculationOf, engineerOf, leadOf, requestFor } from '../../support/approval-helpers';
import { type ApprovedWorld, openApprovedWorld } from '../../support/approved-world';
import { defined } from '../../support/defined';

/**
 * STORY-CR01.7E AC-1 to AC-5, AC-8 (CR-01 item 7c; FR-111; NFR-007; architecture section 4.12 d) against real PostgreSQL in a throwaway database, as the **runtime role**: `estimate_downloads` is append-only (the runtime role
 * holds SELECT and INSERT and a trigger refuses UPDATE, DELETE and TRUNCATE for every role, the owner included), a download that is handed over writes one row with the calculation and the approval that went into the file,
 * a download that is refused writes none, and the marker reads "Not downloaded", "Downloaded N×" and "Changed since download" over the real rows. The `idx_*` indexes serve the two reads of the Closed tab's LATERAL query.
 * Every name and number is invented.
 */

let world: ApprovedWorld;
let db: ApprovedWorld['db'];
let markers: DownloadMarkerService;

beforeAll(async () => {
  world = await openApprovedWorld();
  db = world.db;
  markers = createDownloadMarkerService({ downloads: createDownloadRepository(db.prisma) });
}, 120_000);

afterAll(async () => {
  await db.close();
});

interface DownloadRow {
  readonly estimate_id: string;
  readonly calculation_id: string;
  readonly approval_id: string | null;
  readonly downloaded_by: string;
  readonly downloaded_at: Date;
}

const rowsOf = async (estimateId: string): Promise<ReadonlyArray<DownloadRow>> =>
  (await db.owner.query<DownloadRow>('SELECT estimate_id, calculation_id, approval_id, downloaded_by, downloaded_at FROM estimate_downloads WHERE estimate_id = $1::uuid ORDER BY downloaded_at, id', [estimateId])).rows;

const approvalIdsOf = async (estimateId: string): Promise<string[]> =>
  (await db.owner.query<{ id: string }>('SELECT id FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at, id', [estimateId])).rows.map((row) => row.id);

const leadName = async (): Promise<string> => defined((await db.owner.query<{ name: string }>('SELECT name FROM users WHERE id = $1::uuid', [db.personId])).rows[0]).name;

/** A calculated estimate (Submitted, figures current), and its calculation. */
async function calculated(): Promise<{ readonly estimateId: string; readonly calculationId: string }> {
  const { estimateId } = await calculatedEstimate(db, 1);
  return { estimateId, calculationId: await currentCalculationOf(db, estimateId) };
}

describe('AC-1: the table is append-only', () => {
  it('the runtime role holds SELECT and INSERT at table level and neither UPDATE, DELETE nor TRUNCATE', async () => {
    const { rows } = await db.owner.query<{ privilege: string; granted: boolean }>(
      `SELECT privilege, has_table_privilege('accucut_app', 'estimate_downloads', privilege) AS granted FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS privilege`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.granted]))).toEqual({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false, TRUNCATE: false });
  });

  it('has no column that says "updated" and no UPDATE grant on any column', async () => {
    const { rows } = await db.owner.query<{ column: string; granted: boolean }>(
      `SELECT a.attname::text AS "column", has_column_privilege('accucut_app', 'estimate_downloads', a.attname::text, 'UPDATE') AS granted
       FROM pg_attribute a WHERE a.attrelid = 'estimate_downloads'::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    );
    expect(rows.map((row) => row.column).sort()).toEqual(['approval_id', 'calculation_id', 'downloaded_at', 'downloaded_by', 'estimate_id', 'id']);
    expect(rows.filter((row) => row.granted)).toEqual([]);
  });

  describe('a row, once written, cannot be changed or removed by anyone', () => {
    const statements: ReadonlyArray<readonly [string, string]> = [
      ['UPDATE of the person', 'UPDATE estimate_downloads SET downloaded_by = downloaded_by'],
      ['UPDATE of the time', "UPDATE estimate_downloads SET downloaded_at = now() + interval '1 day'"],
      ['UPDATE of the approval', 'UPDATE estimate_downloads SET approval_id = NULL'],
      ['DELETE', 'DELETE FROM estimate_downloads'],
      ['TRUNCATE', 'TRUNCATE estimate_downloads'],
    ];

    it.each(statements)('%s as the runtime role is refused by the missing grant (42501) and the log is as it was', async (_title, sql) => {
      const { estimateId } = await calculated();
      await world.exporter.getFile(leadOf(db), estimateId);
      const before = await rowsOf(estimateId);
      await expect(db.runtime.query(sql)).rejects.toMatchObject({ code: '42501' });
      expect(await rowsOf(estimateId)).toEqual(before);
    });

    it.each(statements)('%s as the owner is refused by a trigger and the log is as it was', async (_title, sql) => {
      const { estimateId } = await calculated();
      await world.exporter.getFile(leadOf(db), estimateId);
      const before = await rowsOf(estimateId);
      await expect(db.owner.query(sql)).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('Table "estimate_downloads" is immutable') });
      expect(await rowsOf(estimateId)).toEqual(before);
    });
  });
});

describe('AC-2: a download that is handed over is recorded with what went into the file', () => {
  it('writes one row with the estimate, its current calculation, no approval before one exists, the Lead and the database\'s time', async () => {
    const { estimateId, calculationId } = await calculated();
    const file = await world.exporter.getFile(leadOf(db), estimateId);
    expect(file.bytes.length).toBeGreaterThan(0);
    const rows = await rowsOf(estimateId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ estimate_id: estimateId, calculation_id: calculationId, approval_id: null, downloaded_by: db.personId });
    expect(Math.abs(defined(rows[0]).downloaded_at.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('writes the approval that was in the file when the estimate is approved, and one row for each download', async () => {
    const { estimateId, calculationId } = await calculated();
    await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId));
    await world.exporter.getFile(leadOf(db), estimateId);
    await world.exporter.getFile(adminOf(db), estimateId);
    const [approvalId] = await approvalIdsOf(estimateId);
    const rows = await rowsOf(estimateId);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.approval_id)).toEqual([approvalId, approvalId]);
  });

  it('writes nothing for the summary: only a file that was handed over is a download', async () => {
    const { estimateId } = await calculated();
    await world.exporter.getSummary(leadOf(db), estimateId);
    expect(await rowsOf(estimateId)).toEqual([]);
  });
});

describe('AC-3: a download that is refused writes no row', () => {
  it('an estimate never calculated (409), an Engineer (403) and an estimate that is not there (404)', async () => {
    const never = await db.addEstimate({ status: 'DRAFT', engineer: true });
    await expect(world.exporter.getFile(leadOf(db), never)).rejects.toMatchObject({ httpStatus: 409 });
    const { estimateId } = await calculated();
    await expect(world.exporter.getFile(engineerOf(db), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    await expect(world.exporter.getFile(leadOf(db), '00000000-0000-4000-8000-00000000dead')).rejects.toMatchObject({ httpStatus: 404 });
    expect(await rowsOf(never)).toEqual([]);
    expect(await rowsOf(estimateId)).toEqual([]);
    expect((await db.owner.query('SELECT 1 FROM estimate_downloads WHERE estimate_id = $1::uuid', ['00000000-0000-4000-8000-00000000dead'])).rowCount).toBe(0);
  });

  it('an estimate whose input changed after Calculate (409 out of date)', async () => {
    const { estimateId } = await calculated();
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    await expect(world.exporter.getFile(leadOf(db), estimateId)).rejects.toMatchObject({ httpStatus: 409, code: 'EXPORT_OUT_OF_DATE' });
    expect(await rowsOf(estimateId)).toEqual([]);
  });
});

describe('AC-4, AC-8: the marker over the real rows', () => {
  it('says none for an estimate nobody downloaded, and for an estimate that is not there a 404', async () => {
    const { estimateId } = await calculated();
    expect(await markers.getMarker(leadOf(db), estimateId)).toEqual({ kind: 'none' });
    await expect(markers.getMarker(leadOf(db), '00000000-0000-4000-8000-00000000dead')).rejects.toMatchObject({ httpStatus: 404 });
    await expect(markers.getMarker(leadOf(db), 'not-a-uuid')).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('says "Downloaded N times" with the last person and time while the approval in the last file stands', async () => {
    const { estimateId, calculationId } = await calculated();
    await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId));
    for (let download = 0; download < 3; download += 1) await world.exporter.getFile(leadOf(db), estimateId);
    const marker = await markers.getMarker(leadOf(db), estimateId);
    expect(marker).toMatchObject({ kind: 'downloaded', count: 3, last: { byName: await leadName() } });
    const [row] = (await rowsOf(estimateId)).slice(-1);
    expect(marker.kind === 'downloaded' && marker.last.at).toBe(defined(row).downloaded_at.toISOString());
  });

  it('AC-8: a Lead downloads, unlocks and approves again: "Changed since download", and the next download makes it "Downloaded" again', async () => {
    const { estimateId, calculationId } = await calculated();
    await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId, '1000.00'));
    await world.exporter.getFile(leadOf(db), estimateId);
    expect((await markers.getMarker(leadOf(db), estimateId)).kind).toBe('downloaded');

    await world.unlock.unlock(leadOf(db), estimateId, { reason: 'Invented reason to unlock.', audit: { actorId: db.personId, actorLabel: 'Calculation Lead', requestId: 'request-unlock-0001' } });
    await db.service.recalculate(leadOf(db), estimateId);
    await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, await currentCalculationOf(db, estimateId), '2000.00'));
    expect(await markers.getMarker(leadOf(db), estimateId)).toMatchObject({ kind: 'changed', count: 1 });

    await world.exporter.getFile(leadOf(db), estimateId);
    expect(await markers.getMarker(leadOf(db), estimateId)).toMatchObject({ kind: 'downloaded', count: 2 });
  });

  it('a first approval after a download of unapproved figures turns the marker amber: the file holds no price', async () => {
    const { estimateId, calculationId } = await calculated();
    await world.exporter.getFile(leadOf(db), estimateId);
    expect(await markers.getMarker(leadOf(db), estimateId)).toMatchObject({ kind: 'downloaded', count: 1 });
    await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId));
    expect(await markers.getMarker(leadOf(db), estimateId)).toMatchObject({ kind: 'changed', count: 1 });
  });

  it('an unlock alone does not turn it amber: the earlier price is still the one in the file until a new approval replaces it (D-29)', async () => {
    const { estimateId, calculationId } = await calculated();
    await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId));
    await world.exporter.getFile(leadOf(db), estimateId);
    await world.unlock.unlock(leadOf(db), estimateId, { reason: 'Invented reason to unlock.', audit: { actorId: db.personId, actorLabel: 'Calculation Lead', requestId: 'request-unlock-0002' } });
    expect((await markers.getMarker(leadOf(db), estimateId)).kind).toBe('downloaded');
  });

  it('the summary of SCR-10 carries the same marker, in the same snapshot as the figures', async () => {
    const { estimateId } = await calculated();
    expect((await world.exporter.getSummary(leadOf(db), estimateId)).download).toEqual({ kind: 'none' });
    await world.exporter.getFile(adminOf(db), estimateId);
    expect((await world.exporter.getSummary(leadOf(db), estimateId)).download).toMatchObject({ kind: 'downloaded', count: 1 });
  });
});

describe('AC-5: the Closed tab reads a page of tasks in one statement', () => {
  it('answers the marker of each task that exists, by task ID, for several estimates at once, and leaves out an ID that is none', async () => {
    const first = await calculated();
    const second = await calculated();
    await db.approvalService.approve(leadOf(db), first.estimateId, requestFor(db, first.calculationId));
    await world.exporter.getFile(leadOf(db), first.estimateId);
    await world.exporter.getFile(leadOf(db), first.estimateId);
    const taskOf = async (estimateId: string): Promise<string> => defined((await db.owner.query<{ task_id: string }>('SELECT task_id FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).task_id;
    const [firstTask, secondTask] = [await taskOf(first.estimateId), await taskOf(second.estimateId)];
    const answer = await markers.getMarkersOfTasks(leadOf(db), [firstTask, secondTask, '00000000-0000-4000-8000-00000000dead', 'not-a-uuid']);
    expect(answer.markers.map((entry) => entry.taskId).sort()).toEqual([firstTask, secondTask].sort());
    expect(answer.markers.find((entry) => entry.taskId === firstTask)?.marker).toMatchObject({ kind: 'downloaded', count: 2 });
    expect(answer.markers.find((entry) => entry.taskId === secondTask)?.marker).toEqual({ kind: 'none' });
  });

  it('reads at most one page of the queue (200) however many IDs are given', async () => {
    const ids = Array.from({ length: 300 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    expect(await markers.getMarkersOfTasks(leadOf(db), ids)).toEqual({ markers: [] });
  });

  it('is served by the two indexes: the latest download and the latest approval of an estimate are each an index scan', async () => {
    const plan = async (sql: string): Promise<string> => {
      const client = db.owner;
      try {
        await client.query('BEGIN');
        // The tables of a test are small, so the planner would read them whole; with a sequential scan off, the plan shows which index each read can use.
        await client.query('SET LOCAL enable_seqscan = off');
        const { rows } = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN ${sql}`, ['00000000-0000-4000-8000-00000000dead']);
        return rows.map((row) => row['QUERY PLAN']).join('\n');
      } finally {
        await client.query('ROLLBACK');
      }
    };
    expect(await plan('SELECT l.approval_id FROM estimate_downloads l WHERE l.estimate_id = $1::uuid ORDER BY l.downloaded_at DESC, l.id DESC LIMIT 1')).toContain('idx_estimate_downloads_estimate_id');
    expect(await plan('SELECT ap.id FROM approvals ap WHERE ap.estimate_id = $1::uuid ORDER BY ap.approved_at DESC, ap.id DESC LIMIT 1')).toContain('idx_approvals_estimate_id');
  });
});
