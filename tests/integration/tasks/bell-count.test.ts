import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { isOverdue } from '@/lib/tasks/overdue';
import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-04.03 T4 (AC-2, AC-3, AC-6; FR-037, NFR-015) against real PostgreSQL in a throwaway database: the bell's count by role from one seed (an Engineer's own overdue
 * tasks, the overdue tasks each of two Leads assigned, and all of them for the Admin), a task that closes leaving the count, the strict boundary on the real
 * `deadline_at` (a deadline exactly now is not overdue, one millisecond ago is, the same answer as `isOverdue`), and a Lead's `assignedBy=me` Overdue tab holding exactly
 * the tasks the bell counted. Every name, path and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DAY = MILLISECONDS_PER_DAY;
const at = (offsetMilliseconds: number): Date => new Date(NOW.getTime() + offsetMilliseconds);
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: TaskService;
let firstLeadId: string;
let secondLeadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;

const as = (id: string, role: QueueViewer['role']): QueueViewer => ({ id, role });
const codes = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock: createFixedClock(NOW) });
  firstLeadId = await insertPersonAsOwner(db, 'Bell First Lead', 'LEAD');
  secondLeadId = await insertPersonAsOwner(db, 'Bell Second Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Bell Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Bell Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Bell Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

async function seed(code: string, engineerId: string, assignedById: string, deadlineAt: Date, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT'): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    'INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $3::uuid, $4, $5) RETURNING id::text',
    [code, engineerId, assignedById, PATH, deadlineAt],
  );
  const id = defined(task.rows[0]).id;
  await db.owner.query('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status)', [id, status]);
  return id;
}

/** Overdue and open: 0001 (Arjun, first Lead), 0002 (Arjun, second Lead), 0003 (Priya, first Lead), 0004 (Priya, second Lead, one millisecond past). Not counted: 0005 (exactly now), 0006 (ahead), 0007 (closed). */
async function seedSeven(): Promise<void> {
  await seed('Q-2026-0001', arjunId, firstLeadId, at(-2 * DAY));
  await seed('Q-2026-0002', arjunId, secondLeadId, at(-DAY), 'SUBMITTED');
  await seed('Q-2026-0003', priyaId, firstLeadId, at(-3 * DAY));
  await seed('Q-2026-0004', priyaId, secondLeadId, at(-1));
  await seed('Q-2026-0005', arjunId, firstLeadId, at(0));
  await seed('Q-2026-0006', priyaId, firstLeadId, at(DAY));
  await seed('Q-2026-0007', arjunId, firstLeadId, at(-4 * DAY), 'APPROVED');
}

describe('AC-2: the bell counts what is relevant to the role, on the real tables', () => {
  it('an Engineer is counted their own overdue tasks, each Lead the ones they assigned, and the Admin all of them', async () => {
    await seedSeven();
    expect(await service.countOverdue(as(arjunId, 'ENGINEER'))).toBe(2);
    expect(await service.countOverdue(as(priyaId, 'ENGINEER'))).toBe(2);
    expect(await service.countOverdue(as(firstLeadId, 'LEAD'))).toBe(2);
    expect(await service.countOverdue(as(secondLeadId, 'LEAD'))).toBe(2);
    expect(await service.countOverdue(as(adminId, 'ADMIN'))).toBe(4);
  });

  it('is zero for a person with nothing overdue, and for an ID that is not a UUID, never an error', async () => {
    await seedSeven();
    expect(await service.countOverdue(as(adminId, 'LEAD'))).toBe(0);
    expect(await service.countOverdue(as('not-a-uuid', 'ENGINEER'))).toBe(0);
    expect(await service.countOverdue(as('not-a-uuid', 'LEAD'))).toBe(0);
  });

  it('a task that closes leaves the count, and one that is submitted stays in it', async () => {
    await seedSeven();
    await db.owner.query("UPDATE estimates SET status = 'APPROVED' WHERE task_id = (SELECT id FROM tasks WHERE code = 'Q-2026-0001')");
    expect(await service.countOverdue(as(arjunId, 'ENGINEER'))).toBe(1);
    expect(await service.countOverdue(as(firstLeadId, 'LEAD'))).toBe(1);
    expect(await service.countOverdue(as(adminId, 'ADMIN'))).toBe(3);
  });

  it('is the number the Overdue tab counts for the same person', async () => {
    await seedSeven();
    for (const viewer of [as(arjunId, 'ENGINEER'), as(adminId, 'ADMIN')]) {
      expect((await service.listQueue(viewer, { tab: 'overdue' })).counts.overdue).toBe(await service.countOverdue(viewer));
    }
  });
});

describe('AC-6 (NFR-015): overdue flips exactly at the deadline instant, on the real deadline_at', () => {
  it('a deadline exactly now is not overdue, one millisecond before it is, and the SQL gives the answer of isOverdue', async () => {
    await seed('Q-2026-0001', arjunId, firstLeadId, at(0));
    expect(await service.countOverdue(as(arjunId, 'ENGINEER'))).toBe(0);
    expect(isOverdue(at(0), NOW)).toBe(false);

    const clock = createFixedClock(NOW);
    const later = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock });
    clock.advance(1);
    expect(await later.countOverdue(as(arjunId, 'ENGINEER'))).toBe(1);
    expect(isOverdue(at(0), clock.now())).toBe(true);
  });
});

describe('AC-3: the Overdue tab a Lead\'s bell opens holds the set the bell counted', () => {
  it('assignedBy=me gives the tasks that Lead assigned, as many as the bell says, with every count cut the same way', async () => {
    await seedSeven();
    const lead = as(firstLeadId, 'LEAD');
    const tab = await service.listQueue(lead, { tab: 'overdue', assignedBy: 'me' });
    expect(codes(tab)).toEqual(['Q-2026-0003', 'Q-2026-0001']);
    expect(tab.tasks).toHaveLength(await service.countOverdue(lead));
    expect(tab.counts).toEqual({ open: 4, closed: 1, overdue: 2 });
  });

  it('without assignedBy a Lead still sees the whole queue, and assignedBy=me never widens an Engineer\'s own tasks', async () => {
    await seedSeven();
    expect(codes(await service.listQueue(as(firstLeadId, 'LEAD'), { tab: 'overdue' }))).toEqual(['Q-2026-0003', 'Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004']);
    expect(codes(await service.listQueue(as(arjunId, 'ENGINEER'), { tab: 'overdue', assignedBy: 'me' }))).toEqual([]);
  });
});
