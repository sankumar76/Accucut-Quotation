import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { decodeTaskQueueCursor, type TaskQueueCursor } from '@/server/services/task-queue-cursor';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-04.02 T2 (AC-1, AC-2, AC-3) against real PostgreSQL in a throwaway database: the Open, Closed and Overdue filters on `estimates.status` and the deadline,
 * the order (deadline, then code), the cut to one Engineer's own tasks, the counts, the name of the customer and of the two people, and the paging by cursor on
 * real rows, through the real task service and repository. Every name, path and date is invented.
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
let customerId: string;

const asEngineer = (id: string): QueueViewer => ({ id, role: 'ENGINEER' });
const codes = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock: createFixedClock(NOW) });
  leadId = await insertPersonAsOwner(db, 'Queue Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Queue Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Queue Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Queue Priya', 'ENGINEER');
  const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented queue customer') RETURNING id::text");
  customerId = defined(customer.rows[0]).id;
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

/** A task and its estimate, in any state: the assignment would refuse a deadline that is not later than now. */
async function seed(code: string, engineerId: string, deadlineAt: Date, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT', chosenCustomerId: string | null = null, title: string | null = null): Promise<void> {
  const task = await db.owner.query<{ id: string }>(
    'INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6) RETURNING id::text',
    [code, engineerId, leadId, PATH, deadlineAt, title],
  );
  await db.owner.query('INSERT INTO estimates (task_id, customer_id, status) VALUES ($1::uuid, $2::uuid, $3::estimate_status)', [defined(task.rows[0]).id, chosenCustomerId, status]);
}

/** The same six tasks as the unit test: three of Arjun's and three of Priya's, in every state. */
async function seedSix(): Promise<void> {
  await seed('Q-2026-0001', arjunId, at(-2 * DAY), 'DRAFT', null, 'Overdue hopper');
  await seed('Q-2026-0002', arjunId, at(DAY), 'SUBMITTED');
  await seed('Q-2026-0003', arjunId, at(-5 * DAY), 'APPROVED', customerId);
  await seed('Q-2026-0004', priyaId, at(0));
  await seed('Q-2026-0005', priyaId, at(-1));
  await seed('Q-2026-0006', priyaId, at(DAY), 'DRAFT', customerId);
}

describe('AC-1: Open, Closed and Overdue on the real tables', () => {
  it('Open is every estimate that is not approved, Closed the approved ones, each by deadline and then by code', async () => {
    await seedSix();
    const lead: QueueViewer = { id: leadId, role: 'LEAD' };
    expect(codes(await service.listQueue(lead, { tab: 'open' }))).toEqual(['Q-2026-0001', 'Q-2026-0005', 'Q-2026-0004', 'Q-2026-0002', 'Q-2026-0006']);
    expect(codes(await service.listQueue(lead, { tab: 'closed' }))).toEqual(['Q-2026-0003']);
  });

  it('Overdue is open and strictly past its deadline: exactly now is not overdue, a millisecond ago is, and an approved task is never overdue', async () => {
    await seedSix();
    expect(codes(await service.listQueue({ id: leadId, role: 'LEAD' }, { tab: 'overdue' }))).toEqual(['Q-2026-0001', 'Q-2026-0005']);
  });

  it('counts every tab for the person asking, with an overdue task in Open as well', async () => {
    await seedSix();
    expect((await service.listQueue({ id: adminId, role: 'ADMIN' }, { tab: 'closed' })).counts).toEqual({ open: 5, closed: 1, overdue: 2 });
  });

  it('breaks a tie of deadlines by code', async () => {
    await seed('Q-2026-0020', arjunId, at(DAY));
    await seed('Q-2026-0010', priyaId, at(DAY));
    await seed('Q-2026-0015', arjunId, at(DAY));
    expect(codes(await service.listQueue({ id: leadId, role: 'LEAD' }, { tab: 'open' }))).toEqual(['Q-2026-0010', 'Q-2026-0015', 'Q-2026-0020']);
  });

  it('answers an empty database with empty tabs and zero counts', async () => {
    expect(await service.listQueue({ id: leadId, role: 'LEAD' }, { tab: 'open' })).toEqual({ tab: 'open', tasks: [], counts: { open: 0, closed: 0, overdue: 0 }, nextCursor: null });
  });
});

describe('AC-2: an Engineer gets their own tasks, a Lead and an Admin get all', () => {
  it('cuts every tab and every count to the Engineer\'s own tasks', async () => {
    await seedSix();
    const arjun = await service.listQueue(asEngineer(arjunId), { tab: 'open' });
    expect(codes(arjun)).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(arjun.counts).toEqual({ open: 2, closed: 1, overdue: 1 });
    expect(codes(await service.listQueue(asEngineer(arjunId), { tab: 'closed' }))).toEqual(['Q-2026-0003']);
    expect(codes(await service.listQueue(asEngineer(priyaId), { tab: 'overdue' }))).toEqual(['Q-2026-0005']);
  });

  it('shows two Engineers nothing of each other\'s, and a Lead and an Admin the same whole queue', async () => {
    await seedSix();
    const theirs = new Set(['Q-2026-0004', 'Q-2026-0005', 'Q-2026-0006']);
    expect(codes(await service.listQueue(asEngineer(arjunId), { tab: 'open' })).filter((code) => theirs.has(code))).toEqual([]);
    const lead = await service.listQueue({ id: leadId, role: 'LEAD' }, { tab: 'open' });
    expect(codes(await service.listQueue({ id: adminId, role: 'ADMIN' }, { tab: 'open' }))).toEqual(codes(lead));
  });

  it('answers a person who is not a UUID with nothing, and never an error or another person\'s tasks', async () => {
    await seedSix();
    const queue = await service.listQueue({ id: 'not-a-uuid', role: 'ENGINEER' }, { tab: 'open' });
    expect(queue).toEqual({ tab: 'open', tasks: [], counts: { open: 0, closed: 0, overdue: 0 }, nextCursor: null });
  });
});

describe('AC-3: what a row carries', () => {
  it('has the names of the Engineer, the assigner and the customer, the title, the path with its link, the deadline and the status', async () => {
    await seed('Q-2026-0030', arjunId, at(-5 * DAY), 'APPROVED', customerId, 'Hopper cover');
    const [task] = (await service.listQueue({ id: leadId, role: 'LEAD' }, { tab: 'closed' })).tasks;
    expect(task).toEqual({
      id: expect.any(String),
      code: 'Q-2026-0030',
      title: 'Hopper cover',
      engineer: { id: arjunId, name: 'Invented Queue Arjun' },
      customerName: 'Invented queue customer',
      folderPath: PATH,
      folderUrl: 'file:////invented-server/invented-share/RFQ-123',
      deadlineAt: at(-5 * DAY),
      status: 'APPROVED',
      assignedByName: 'Invented Queue Lead',
    });
  });

  it('has no customer until one is chosen', async () => {
    await seed('Q-2026-0031', arjunId, at(DAY));
    const [task] = (await service.listQueue(asEngineer(arjunId), { tab: 'open' })).tasks;
    expect(defined(task).customerName).toBeNull();
  });
});

describe('paging by deadline, then code, on real rows', () => {
  it('walks the whole tab in pages of two, each task once, with a cursor until the last page', async () => {
    await seedSix();
    const seen: string[] = [];
    let cursor: TaskQueueCursor | undefined;
    for (let pages = 0; pages < 10; pages += 1) {
      const page = await service.listQueue({ id: leadId, role: 'LEAD' }, { tab: 'open', limit: 2, cursor });
      seen.push(...codes(page));
      if (page.nextCursor === null) break;
      cursor = defined(decodeTaskQueueCursor(page.nextCursor));
    }
    expect(seen).toEqual(['Q-2026-0001', 'Q-2026-0005', 'Q-2026-0004', 'Q-2026-0002', 'Q-2026-0006']);
  });

  it('continues after a task whose deadline is shared with others, without skipping or repeating one', async () => {
    for (const code of ['Q-2026-0040', 'Q-2026-0041', 'Q-2026-0042', 'Q-2026-0043']) await seed(code, arjunId, at(DAY));
    const first = await service.listQueue(asEngineer(arjunId), { tab: 'open', limit: 2 });
    const cursor = defined(decodeTaskQueueCursor(defined(first.nextCursor)));
    expect(codes(first)).toEqual(['Q-2026-0040', 'Q-2026-0041']);
    const second = await service.listQueue(asEngineer(arjunId), { tab: 'open', limit: 2, cursor });
    expect(codes(second)).toEqual(['Q-2026-0042', 'Q-2026-0043']);
    expect(second.nextCursor).toBeNull();
  });

  it('keeps the cursor of an Engineer cut to their own tasks', async () => {
    await seedSix();
    const cursor: TaskQueueCursor = { deadlineAt: at(-3 * DAY), code: 'Q-2026-0000' };
    expect(codes(await service.listQueue(asEngineer(arjunId), { tab: 'open', cursor }))).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(codes(await service.listQueue(asEngineer(arjunId), { tab: 'open', cursor: { deadlineAt: at(0), code: 'Q-2026-0000' } }))).toEqual(['Q-2026-0002']);
  });
});
