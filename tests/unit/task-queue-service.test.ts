import { beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import { decodeTaskQueueCursor, type TaskQueueCursor } from '@/server/services/task-queue-cursor';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { defined } from '../support/defined';
import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../support/fake-tasks';

/**
 * STORY-04.02 T2 (AC-1, AC-2, AC-3): the rules of the queue with no database: which tab a task is in, the order, who sees which tasks, the counts and the paging.
 * The queries themselves (the filters, the order and the cursor on real rows) are `tests/integration/tasks/queue.test.ts`. Every name, path and date is invented.
 */

const ARJUN: FakePerson = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun', role: 'ENGINEER', isActive: true };
const PRIYA: FakePerson = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Priya', role: 'ENGINEER', isActive: true };
const BOSS: FakePerson = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Boss', role: 'LEAD', isActive: true };
const CHIEF: FakePerson = { id: '00000000-0000-4000-8000-0000000000c1', name: 'Invented Chief', role: 'ADMIN', isActive: true };
const OTHER_ENGINEER_ID = '00000000-0000-4000-8000-0000000000e9';
const CUSTOMER_ID = '00000000-0000-4000-8000-0000000000d1';

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DAY = MILLISECONDS_PER_DAY;
const at = (offsetMilliseconds: number): Date => new Date(NOW.getTime() + offsetMilliseconds);

const asViewer = (person: FakePerson): QueueViewer => ({ id: person.id, role: person.role });
const codesOf = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);
const ALL_OPEN = ['Q-2026-0001', 'Q-2026-0005', 'Q-2026-0004', 'Q-2026-0002', 'Q-2026-0006'];

let world: FakeTaskWorld;
let service: TaskService;

beforeEach(() => {
  world = createFakeTaskWorld(() => [ARJUN, PRIYA, BOSS, CHIEF]);
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock: createFixedClock(NOW) });
  world.customers.set(CUSTOMER_ID, 'Invented Customer Ltd');
  const by = BOSS.id;
  // Arjun: one overdue and open, one open, one closed (approved, with a deadline in the past: closed is never overdue).
  world.seed({ code: 'Q-2026-0001', engineerId: ARJUN.id, assignedById: by, deadlineAt: at(-2 * DAY), title: 'Overdue hopper' });
  world.seed({ code: 'Q-2026-0002', engineerId: ARJUN.id, assignedById: by, deadlineAt: at(DAY), status: 'SUBMITTED' });
  world.seed({ code: 'Q-2026-0003', engineerId: ARJUN.id, assignedById: by, deadlineAt: at(-5 * DAY), status: 'APPROVED', customerId: CUSTOMER_ID });
  // Priya: a deadline exactly now (not overdue yet), one millisecond ago (overdue), and one on the same deadline as 0002, to show the tie broken by code.
  world.seed({ code: 'Q-2026-0004', engineerId: PRIYA.id, assignedById: by, deadlineAt: at(0) });
  world.seed({ code: 'Q-2026-0005', engineerId: PRIYA.id, assignedById: by, deadlineAt: at(-1) });
  world.seed({ code: 'Q-2026-0006', engineerId: PRIYA.id, assignedById: by, deadlineAt: at(DAY), customerId: CUSTOMER_ID });
});

describe('AC-1: Open, Closed and Overdue, each by deadline, earliest first', () => {
  it('Open is every task whose estimate is not approved, and an overdue task is in it too', async () => {
    expect(codesOf(await service.listQueue(asViewer(BOSS), { tab: 'open' }))).toEqual(ALL_OPEN);
  });

  it('Closed is the approved estimates, even when the deadline is past', async () => {
    expect(codesOf(await service.listQueue(asViewer(BOSS), { tab: 'closed' }))).toEqual(['Q-2026-0003']);
  });

  it('Overdue is open and past its deadline: the boundary is strict, so a deadline exactly now is not overdue and one millisecond ago is', async () => {
    expect(codesOf(await service.listQueue(asViewer(BOSS), { tab: 'overdue' }))).toEqual(['Q-2026-0001', 'Q-2026-0005']);
  });

  it('puts two tasks with the same deadline in order of code', async () => {
    const open = codesOf(await service.listQueue(asViewer(BOSS), { tab: 'open' }));
    expect(open.indexOf('Q-2026-0002')).toBeLessThan(open.indexOf('Q-2026-0006'));
  });

  it('counts every tab, whichever tab is shown, and an overdue task counts in Open as well', async () => {
    for (const tab of ['open', 'closed', 'overdue'] as const) {
      expect((await service.listQueue(asViewer(BOSS), { tab })).counts).toEqual({ open: 5, closed: 1, overdue: 2 });
    }
  });

  it('judges overdue at the clock of the server: a millisecond later the deadline that was exactly now is overdue', async () => {
    const clock = createFixedClock(NOW);
    const later = createTaskService({ tasks: world.repository, transactions: world.transactions, clock });
    clock.advance(1);
    expect(codesOf(await later.listQueue(asViewer(BOSS), { tab: 'overdue' }))).toEqual(['Q-2026-0001', 'Q-2026-0005', 'Q-2026-0004']);
  });

  it('answers an Engineer with nothing assigned with empty tabs and zero counts', async () => {
    const empty = await service.listQueue({ id: OTHER_ENGINEER_ID, role: 'ENGINEER' }, { tab: 'closed' });
    expect(empty).toEqual({ tab: 'closed', tasks: [], counts: { open: 0, closed: 0, overdue: 0 }, nextCursor: null });
  });
});

describe('AC-2: an Engineer gets their own tasks, a Lead and an Admin get all', () => {
  it('an Engineer sees only the tasks assigned to them, in every tab, with counts of their own', async () => {
    const arjun = await service.listQueue(asViewer(ARJUN), { tab: 'open' });
    expect(codesOf(arjun)).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(arjun.counts).toEqual({ open: 2, closed: 1, overdue: 1 });
    expect(codesOf(await service.listQueue(asViewer(ARJUN), { tab: 'closed' }))).toEqual(['Q-2026-0003']);
    expect(codesOf(await service.listQueue(asViewer(PRIYA), { tab: 'overdue' }))).toEqual(['Q-2026-0005']);
  });

  it('two Engineers never see each other\'s tasks', async () => {
    const theirs = new Set(['Q-2026-0004', 'Q-2026-0005', 'Q-2026-0006']);
    for (const tab of ['open', 'closed', 'overdue'] as const) {
      expect(codesOf(await service.listQueue(asViewer(ARJUN), { tab })).filter((code) => theirs.has(code))).toEqual([]);
    }
  });

  it('a Lead and an Admin see the same, whole queue', async () => {
    const lead = await service.listQueue(asViewer(BOSS), { tab: 'open' });
    const admin = await service.listQueue(asViewer(CHIEF), { tab: 'open' });
    expect(codesOf(admin)).toEqual(codesOf(lead));
    expect(codesOf(lead)).toHaveLength(5);
  });

  it('a page after a cursor is still cut to the Engineer: a cursor cannot reach another person\'s task', async () => {
    const first = await service.listQueue(asViewer(BOSS), { tab: 'open', limit: 1 });
    const cursor = defined(decodeTaskQueueCursor(defined(first.nextCursor)));
    expect(codesOf(await service.listQueue(asViewer(ARJUN), { tab: 'open', cursor }))).toEqual(['Q-2026-0002']);
  });
});

describe('AC-3: what a row carries', () => {
  it('has the code, the title, both names, the customer\'s name, the path with its file link, the deadline and the status', async () => {
    const queue = await service.listQueue(asViewer(BOSS), { tab: 'closed' });
    expect(queue.tasks).toEqual([
      {
        id: expect.any(String),
        code: 'Q-2026-0003',
        title: null,
        engineer: { id: ARJUN.id, name: ARJUN.name },
        customerName: 'Invented Customer Ltd',
        folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
        folderUrl: 'file:////invented-server/invented-share/RFQ-1',
        deadlineAt: at(-5 * DAY),
        status: 'APPROVED',
        assignedByName: BOSS.name,
      },
    ]);
  });

  it('has no customer until the Engineer chooses one ("Not chosen yet" is the screen\'s word for null)', async () => {
    const [first] = (await service.listQueue(asViewer(BOSS), { tab: 'open' })).tasks;
    expect(defined(first).customerName).toBeNull();
  });

  it('has no link, and keeps the path, for a stored path the portal would not have accepted', async () => {
    world.seed({ code: 'Q-2026-0007', engineerId: ARJUN.id, assignedById: BOSS.id, deadlineAt: at(10 * DAY), folderPath: '\\\\invented-server\\share*' });
    const queue = await service.listQueue(asViewer(ARJUN), { tab: 'open' });
    const row = defined(queue.tasks.find((task) => task.code === 'Q-2026-0007'));
    expect([row.folderPath, row.folderUrl]).toEqual(['\\\\invented-server\\share*', null]);
  });
});

describe('paging by deadline, then code (architecture section 6)', () => {
  it('returns a cursor while more follow and none on the last page; the pages together are the whole tab, once each', async () => {
    const seen: string[] = [];
    let cursor: TaskQueueCursor | undefined;
    for (let pages = 0; pages < 10; pages += 1) {
      const page = await service.listQueue(asViewer(BOSS), { tab: 'open', limit: 2, cursor });
      seen.push(...codesOf(page));
      expect(page.tasks.length).toBeLessThanOrEqual(2);
      if (page.nextCursor === null) break;
      cursor = defined(decodeTaskQueueCursor(page.nextCursor));
    }
    expect(seen).toEqual(ALL_OPEN);
  });

  it('has no next page when the tab holds exactly one page', async () => {
    const page = await service.listQueue(asViewer(BOSS), { tab: 'open', limit: 5 });
    expect(page.nextCursor).toBeNull();
    expect(page.tasks).toHaveLength(5);
  });

  it('puts the deadline and the code of the last task of the page in the cursor', async () => {
    const page = await service.listQueue(asViewer(BOSS), { tab: 'open', limit: 3 });
    expect(decodeTaskQueueCursor(defined(page.nextCursor))).toEqual({ deadlineAt: at(0), code: 'Q-2026-0004' });
  });

  it('pages at 50 when no limit is given', async () => {
    for (let index = 0; index < 60; index += 1) {
      world.seed({ code: `Q-2026-${String(100 + index).padStart(4, '0')}`, engineerId: ARJUN.id, assignedById: BOSS.id, deadlineAt: at((10 + index) * DAY) });
    }
    const page = await service.listQueue(asViewer(ARJUN), { tab: 'open' });
    expect(page.tasks).toHaveLength(50);
    expect(page.nextCursor).not.toBeNull();
  });
});
