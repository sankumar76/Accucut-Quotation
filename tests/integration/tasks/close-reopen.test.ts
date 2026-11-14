import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { decideTransition, ESTIMATE_STATUSES, type EstimateStatus } from '@/lib/estimate/state-machine';
import { tabsOf } from '@/lib/tasks/task-state';
import { QUEUE_TABS, type QueueTab } from '@/lib/tasks/queue';
import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-04.05 T3 (AC-1 to AC-4, AC-6; FR-038, FR-107, architecture section 4.4) against real PostgreSQL in a throwaway database. The status of an estimate is set directly by
 * the fixture (the approve, unlock and cancel actions are STORY-06.06, 06.08 and 06.12), and the queue, its counts and the bell are read through the real task service and
 * repository after each change:
 *   - DRAFT and SUBMITTED are in Open (AC-1); APPROVED leaves Open and Overdue for Closed, even past its deadline, and the bell count drops by one (AC-2);
 *   - APPROVED back to DRAFT, by the unlock or by the Admin's cancel (the state machine says where each leads), is in Open again, and Overdue again if late (AC-3);
 *   - the SQL `tabFilter` of the repository gives, for every status and three deadlines, the answer of `tabsOf` in TypeScript (AC-4: one rule, two forms, held together);
 *   - an Engineer's Closed tab holds their own closed tasks only, with the status APPROVED and exactly the named fields, no price (AC-6).
 * Every name, path and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DAY = MILLISECONDS_PER_DAY;
const at = (offsetMilliseconds: number): Date => new Date(NOW.getTime() + offsetMilliseconds);
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: TaskService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;

const asLead = (): QueueViewer => ({ id: leadId, role: 'LEAD' });
const asAdmin = (): QueueViewer => ({ id: adminId, role: 'ADMIN' });
const asEngineer = (id: string): QueueViewer => ({ id, role: 'ENGINEER' });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock: createFixedClock(NOW) });
  leadId = await insertPersonAsOwner(db, 'Close Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Close Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Close Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Close Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

/** A task and its estimate in any state; returns the task's ID. */
async function seed(code: string, engineerId: string, deadlineAt: Date, status: EstimateStatus = 'DRAFT'): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    'INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $3::uuid, $4, $5) RETURNING id::text',
    [code, engineerId, leadId, PATH, deadlineAt],
  );
  const id = defined(task.rows[0]).id;
  await db.owner.query('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status)', [id, status]);
  return id;
}

/** What approve, unlock and cancel will do (STORY-06.06, 06.08, 06.12), done directly: the one column the queue reads. */
const setStatus = (taskId: string, status: EstimateStatus): Promise<unknown> =>
  db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE task_id = $1::uuid', [taskId, status]);

async function codesIn(viewer: QueueViewer, tab: QueueTab): Promise<string[]> {
  return (await service.listQueue(viewer, { tab })).tasks.map((task) => task.code);
}

describe('AC-1: a task whose estimate is DRAFT or SUBMITTED is in Open', () => {
  it.each(['DRAFT', 'SUBMITTED'] as const)('%s: in Open, not in Closed, for the Engineer, the Lead and the Admin', async (status) => {
    await seed('Q-2026-0001', arjunId, at(DAY), status);
    for (const viewer of [asEngineer(arjunId), asLead(), asAdmin()]) {
      expect(await codesIn(viewer, 'open')).toEqual(['Q-2026-0001']);
      expect(await codesIn(viewer, 'closed')).toEqual([]);
    }
  });
});

describe('AC-2: the estimate becomes APPROVED, and the task is Closed', () => {
  it('leaves Open and Overdue for Closed, even past its deadline, and the bell count drops by one', async () => {
    const late = await seed('Q-2026-0001', arjunId, at(-2 * DAY), 'SUBMITTED');
    await seed('Q-2026-0002', arjunId, at(-DAY), 'DRAFT');
    const viewer = asEngineer(arjunId);
    expect(await service.countOverdue(viewer)).toBe(2);
    expect(await codesIn(viewer, 'overdue')).toEqual(['Q-2026-0001', 'Q-2026-0002']);

    await setStatus(late, 'APPROVED');

    expect(await codesIn(viewer, 'open')).toEqual(['Q-2026-0002']);
    expect(await codesIn(viewer, 'overdue')).toEqual(['Q-2026-0002']);
    expect(await codesIn(viewer, 'closed')).toEqual(['Q-2026-0001']);
    expect(await service.countOverdue(viewer)).toBe(1);
    // A Lead's and the Admin's bell drop by the same one.
    expect(await service.countOverdue(asLead())).toBe(1);
    expect(await service.countOverdue(asAdmin())).toBe(1);
  });

  it('the tab counts and the bell agree after the change: open, closed and overdue add up, and the bell is the overdue count', async () => {
    const first = await seed('Q-2026-0001', arjunId, at(-DAY));
    await seed('Q-2026-0002', arjunId, at(DAY));
    await seed('Q-2026-0003', priyaId, at(-3 * DAY), 'SUBMITTED');
    for (const status of ['SUBMITTED', 'APPROVED'] as const) {
      await setStatus(first, status);
      for (const viewer of [asLead(), asAdmin(), asEngineer(arjunId)]) {
        const queue = await service.listQueue(viewer, { tab: 'open' });
        const closed = await service.listQueue(viewer, { tab: 'closed' });
        expect(queue.counts.closed).toBe(closed.tasks.length);
        expect(queue.counts.open).toBe(queue.tasks.length);
        expect(await service.countOverdue(viewer)).toBe(queue.counts.overdue);
      }
    }
    const everything = await service.listQueue(asAdmin(), { tab: 'open' });
    expect(everything.counts).toEqual({ open: 2, closed: 1, overdue: 1 });
  });
});

describe('AC-3: an unlock or the Admin\'s cancel puts the task back in Open', () => {
  it.each([
    ['UNLOCK', 'LEAD'],
    ['UNLOCK', 'ADMIN'],
    ['CANCEL', 'ADMIN'],
  ] as const)('%s by %s: APPROVED goes where the state machine says, and the task is Open again and Overdue again past its deadline', async (event, role) => {
    const decision = decideTransition('APPROVED', event, role);
    if (!decision.allowed) throw new Error('The state machine should allow this event.');
    const lateId = await seed('Q-2026-0001', arjunId, at(-DAY), 'APPROVED');
    await seed('Q-2026-0002', arjunId, at(DAY), 'APPROVED');
    const viewer = asEngineer(arjunId);
    expect(await codesIn(viewer, 'closed')).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(await service.countOverdue(viewer)).toBe(0);

    await setStatus(lateId, decision.to);

    expect(await codesIn(viewer, 'open')).toEqual(['Q-2026-0001']);
    expect(await codesIn(viewer, 'overdue')).toEqual(['Q-2026-0001']);
    expect(await codesIn(viewer, 'closed')).toEqual(['Q-2026-0002']);
    expect(await service.countOverdue(viewer)).toBe(1);
  });

  it('closes, reopens, and closes again: the queue follows the estimate every time, with nothing stored on the task', async () => {
    const id = await seed('Q-2026-0001', arjunId, at(-DAY));
    const viewer = asEngineer(arjunId);
    for (const [status, tab] of [
      ['SUBMITTED', 'open'],
      ['APPROVED', 'closed'],
      ['DRAFT', 'open'],
      ['SUBMITTED', 'open'],
      ['APPROVED', 'closed'],
    ] as const) {
      await setStatus(id, status);
      expect(await codesIn(viewer, tab)).toEqual(['Q-2026-0001']);
      expect(await codesIn(viewer, tab === 'open' ? 'closed' : 'open')).toEqual([]);
    }
  });
});

describe('AC-4: the SQL form of the rule gives the answer of the TypeScript rule', () => {
  it('for every status and a deadline in the past, exactly now and ahead, each tab lists exactly the tasks `tabsOf` says it does', async () => {
    const deadlines = [at(-DAY), at(0), at(DAY)];
    const seeded: Array<{ code: string; status: EstimateStatus; deadlineAt: Date }> = [];
    for (const [statusIndex, status] of ESTIMATE_STATUSES.entries()) {
      for (const [deadlineIndex, deadlineAt] of deadlines.entries()) {
        const code = `Q-2026-${String(statusIndex * 10 + deadlineIndex + 1).padStart(4, '0')}`;
        await seed(code, arjunId, deadlineAt, status);
        seeded.push({ code, status, deadlineAt });
      }
    }
    for (const tab of QUEUE_TABS) {
      const expected = seeded.filter((task) => tabsOf(task.status, task.deadlineAt, NOW).includes(tab)).map((task) => task.code);
      expect((await codesIn(asAdmin(), tab)).sort()).toEqual(expected.sort());
    }
  });
});

describe('AC-6: an Engineer opens the Closed tab', () => {
  it('sees their own closed tasks only, with the status APPROVED, and no price or other field beyond the named ones', async () => {
    await seed('Q-2026-0001', arjunId, at(-DAY), 'APPROVED');
    await seed('Q-2026-0002', arjunId, at(DAY), 'SUBMITTED');
    await seed('Q-2026-0003', priyaId, at(DAY), 'APPROVED');
    const closed = await service.listQueue(asEngineer(arjunId), { tab: 'closed' });
    expect(closed.tasks.map((task) => [task.code, task.status])).toEqual([['Q-2026-0001', 'APPROVED']]);
    expect(Object.keys(defined(closed.tasks[0])).sort()).toEqual(
      ['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'status', 'title'].sort(),
    );
    expect(closed.counts).toEqual({ open: 1, closed: 1, overdue: 0 });
  });
});
