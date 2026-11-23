import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError } from '@/lib/errors';
import { ESTIMATE_STATUSES, TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import { QUEUE_TABS, type QueueTab } from '@/lib/tasks/queue';
import { tabsOf } from '@/lib/tasks/task-state';
import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

/**
 * CR-01 item 7D, AC-3, AC-6, AC-7, AC-9 (AQP-401; FR-037, FR-040, FR-102; A-CR01-2 and A-CR01-8 confirmed) against real PostgreSQL in a throwaway database. The SQL form of the tabs (`tabFilter`) gives, for every status and three
 * deadlines, the answer of `tabsOf` for an **ignored** task: the Ignored tab and no other; the counts gain `ignored`; the bell does not count it; the remarks come in the rows of the Ignored tab and in no other; an Engineer's
 * tab, count and task read are their own only, and another Engineer's ignored task is not found; the task page names who ignored it by name; a reassign is refused 409 `ESTIMATE_IGNORED` under the real task and estimate
 * locks, and goes through again once the layer is cleared; and Restore (the three columns cleared) puts the task back in the tab its status fits. Every name, path and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DAY = MILLISECONDS_PER_DAY;
const at = (offsetMilliseconds: number): Date => new Date(NOW.getTime() + offsetMilliseconds);
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const REMARKS = 'Not taken forward.\nThe customer chose another supplier.';

let db: AuditDatabase;
let service: TaskService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;

const asLead = (): QueueViewer => ({ id: leadId, role: 'LEAD' });
const asAdmin = (): QueueViewer => ({ id: adminId, role: 'ADMIN' });
const asEngineer = (id: string): QueueViewer => ({ id, role: 'ENGINEER' });

beforeAll(async () => {
  db = await openAuditDatabase();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock: createFixedClock(NOW), audit: db.audit });
  leadId = await insertPersonAsOwner(db, 'Ignored Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Ignored Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Ignored Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Ignored Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

/** A task and its estimate in any state; `ignored` sets the three columns of the layer, as Ignore does (a Quoted estimate is never ignored, `ck_estimates_quoted_not_ignored`). Returns the task's ID. */
async function seed(code: string, engineerId: string, deadlineAt: Date, status: EstimateStatus = 'DRAFT', ignored = false): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    'INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, $5, \'Invented task\', \'Invented subject\') RETURNING id::text',
    [code, engineerId, leadId, PATH, deadlineAt],
  );
  const id = defined(task.rows[0]).id;
  await db.owner.query(
    `INSERT INTO estimates (task_id, status, quoted_at, quoted_by, ignored_at, ignored_by, ignore_remarks)
     VALUES ($1::uuid, $2::estimate_status,
             CASE WHEN $2 = 'QUOTED' THEN now() END, CASE WHEN $2 = 'QUOTED' THEN $3::uuid END,
             CASE WHEN $4::boolean THEN now() END, CASE WHEN $4::boolean THEN $3::uuid END, CASE WHEN $4::boolean THEN $5 END)`,
    [id, status, leadId, ignored, REMARKS],
  );
  return id;
}

/** What Ignore and Restore write, done directly: the three columns, the status untouched. */
const setLayer = (taskId: string, on: boolean): Promise<unknown> =>
  db.owner.query(
    `UPDATE estimates SET ignored_at = CASE WHEN $2::boolean THEN now() END, ignored_by = CASE WHEN $2::boolean THEN $3::uuid END, ignore_remarks = CASE WHEN $2::boolean THEN $4 END WHERE task_id = $1::uuid`,
    [taskId, on, leadId, REMARKS],
  );

const codesIn = async (viewer: QueueViewer, tab: QueueTab): Promise<string[]> => (await service.listQueue(viewer, { tab })).tasks.map((task) => task.code);

describe('AC-3: the SQL form of the four tabs gives the answer of `tabsOf` for every status, ignored or not', () => {
  const statuses = ESTIMATE_STATUSES;
  const deadlines = [at(-DAY), at(0), at(DAY)];

  it('lists an ignored task in the Ignored tab and in no other, at every status and deadline; and every other task exactly where `tabsOf` says', async () => {
    const expected = new Map<string, ReadonlyArray<QueueTab>>();
    let number = 0;
    for (const status of statuses) {
      for (const deadline of deadlines) {
        for (const ignored of [false, true]) {
          // A Quoted estimate is never ignored: the database refuses that pair, so it is not seeded.
          if (ignored && status === 'QUOTED') continue;
          number += 1;
          const code = `Q-2026-${String(1000 + number)}`;
          await seed(code, arjunId, deadline, status, ignored);
          expected.set(code, tabsOf(status, deadline, NOW, ignored));
        }
      }
    }
    for (const tab of QUEUE_TABS) {
      const shown = await codesIn(asAdmin(), tab);
      const should = [...expected].filter(([, tabs]) => tabs.includes(tab)).map(([code]) => code).sort();
      expect(shown.slice().sort(), tab).toEqual(should);
    }
    // The tabs are exclusive for an ignored task: it is in the Ignored tab and in no other.
    for (const [code, tabs] of expected) if (tabs.includes('ignored')) expect(tabs, code).toEqual(['ignored']);
  });

  it('counts every tab, the Ignored tab included, and the bell counts neither an ignored task nor a late one that is closed', async () => {
    await seed('Q-2026-0001', arjunId, at(-DAY), 'DRAFT', true);
    await seed('Q-2026-0002', arjunId, at(-DAY), 'DRAFT');
    await seed('Q-2026-0003', arjunId, at(DAY), 'APPROVED', true);
    await seed('Q-2026-0004', priyaId, at(-DAY), 'APPROVED');
    const counts = (await service.listQueue(asAdmin(), { tab: 'open' })).counts;
    expect(counts).toEqual({ open: 1, closed: 1, overdue: 1, ignored: 2 });
    expect(await service.countOverdue(asAdmin())).toBe(1);
    expect(await service.countOverdue(asEngineer(arjunId))).toBe(1);
  });
});

describe('AC-3, AC-9: the remarks are in the rows of the Ignored tab and in no other', () => {
  it('an Ignored-tab row has the status IGNORED and the remarks; every other tab\'s rows have none and their own status', async () => {
    await seed('Q-2026-0001', arjunId, at(-DAY), 'PREPARED', true);
    await seed('Q-2026-0002', arjunId, at(-DAY), 'PREPARED');
    await seed('Q-2026-0003', arjunId, at(DAY), 'APPROVED');
    expect((await service.listQueue(asLead(), { tab: 'ignored' })).tasks).toMatchObject([{ code: 'Q-2026-0001', status: 'IGNORED', ignoredRemarks: REMARKS }]);
    for (const tab of ['open', 'overdue', 'closed'] as const) {
      const { tasks } = await service.listQueue(asLead(), { tab });
      expect(tasks.length, tab).toBeGreaterThan(0);
      for (const task of tasks) expect([task.status === 'IGNORED', task.ignoredRemarks], `${tab} ${task.code}`).toEqual([false, null]);
    }
  });
});

describe('AC-7: an Engineer sees their own ignored tasks and never another Engineer\'s', () => {
  it('the Ignored tab, its count and the task read are their own only; another Engineer\'s ignored task is not found', async () => {
    const mine = await seed('Q-2026-0001', arjunId, at(DAY), 'PREPARED', true);
    const theirs = await seed('Q-2026-0002', priyaId, at(DAY), 'PREPARED', true);
    expect(await codesIn(asEngineer(arjunId), 'ignored')).toEqual(['Q-2026-0001']);
    expect((await service.listQueue(asEngineer(arjunId), { tab: 'ignored' })).counts.ignored).toBe(1);
    expect(await codesIn(asEngineer(priyaId), 'ignored')).toEqual(['Q-2026-0002']);
    expect(defined(await service.getTask(asEngineer(arjunId), mine)).ignored).toMatchObject({ byName: 'Invented Ignored Lead', remarks: REMARKS });
    expect(await service.getTask(asEngineer(arjunId), theirs)).toBeNull();
  });

  it('the Engineer\'s ignored rows carry exactly the named fields: the remarks, and no price or other field', async () => {
    await seed('Q-2026-0001', arjunId, at(DAY), 'APPROVED', true);
    const [task] = (await service.listQueue(asEngineer(arjunId), { tab: 'ignored' })).tasks;
    expect(Object.keys(defined(task)).sort()).toEqual(['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'ignoredRemarks', 'status', 'title']);
  });
});

describe('AC-9: the task page names who ignored it, when, and the remarks, for every role', () => {
  it.each([
    ['an Engineer', () => asEngineer(arjunId)],
    ['a Lead', asLead],
    ['an Admin', asAdmin],
  ] as const)('%s reads the layer by name, and the status underneath', async (_name, viewer) => {
    const id = await seed('Q-2026-0001', arjunId, at(DAY), 'APPROVED', true);
    const detail = defined(await service.getTask(viewer(), id));
    expect(detail.status).toBe('APPROVED');
    expect(detail.ignored).toEqual({ at: expect.any(Date), byName: 'Invented Ignored Lead', remarks: REMARKS });
  });

  it('is null for a task that is not ignored, and again after Restore', async () => {
    const id = await seed('Q-2026-0001', arjunId, at(DAY), 'PREPARED', true);
    await setLayer(id, false);
    expect(defined(await service.getTask(asLead(), id)).ignored).toBeNull();
  });
});

describe('AC-6: a reassign is refused 409 ESTIMATE_IGNORED under the real locks, and goes through after Restore (FR-040)', () => {
  const context = () => ({ actorId: leadId, actorLabel: 'Invented Ignored Lead', requestId: 'request-ignored-0001' });

  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('an ignored %s task: nothing is written, no entry is made', async (status) => {
    const id = await seed('Q-2026-0001', arjunId, at(DAY), status, true);
    const error: unknown = await service.reassignTask(context(), id, { engineerId: priyaId }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code, message: TRANSITION_REFUSALS.IGNORED.message });
    const row = defined((await db.owner.query<{ engineer_id: string; assignment_revision: number }>('SELECT engineer_id::text, assignment_revision FROM tasks WHERE id = $1::uuid', [id])).rows[0]);
    expect(row).toEqual({ engineer_id: arjunId, assignment_revision: 1 });
    expect(defined((await db.owner.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE event = 'task.reassigned'")).rows[0]).n).toBe(0);
  });

  it('once the layer is cleared the same task is reassigned', async () => {
    const id = await seed('Q-2026-0001', arjunId, at(DAY), 'PREPARED', true);
    await setLayer(id, false);
    const result = await service.reassignTask(context(), id, { engineerId: priyaId });
    expect(result).toMatchObject({ engineerChanged: true });
    expect(await codesIn(asEngineer(priyaId), 'open')).toEqual(['Q-2026-0001']);
  });
});

describe('AC-4: Restore puts the task back in the tab its status fits', () => {
  it.each([
    ['DRAFT', -DAY, ['open', 'overdue']],
    ['PREPARED', DAY, ['open']],
    ['APPROVED', -DAY, ['closed']],
  ] as const)('a %s task, ignored and restored, is in %j again', async (status, offset, tabs) => {
    const id = await seed('Q-2026-0001', arjunId, at(offset), status, true);
    expect(await codesIn(asLead(), 'ignored')).toEqual(['Q-2026-0001']);
    await setLayer(id, false);
    expect(await codesIn(asLead(), 'ignored')).toEqual([]);
    for (const tab of QUEUE_TABS) expect(await codesIn(asLead(), tab), tab).toEqual((tabs as ReadonlyArray<QueueTab>).includes(tab) ? ['Q-2026-0001'] : []);
  });
});
