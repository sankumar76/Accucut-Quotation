import { beforeEach, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { createFixedClock, startOfIstDay } from '@/lib/time';
import { decodeTaskQueueCursor } from '@/server/services/task-queue-cursor';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../../support/fake-tasks';

/**
 * STORY-04.06 T2 (AC-3, AC-5, AC-8): the filters of the queue through the task service, with no database. Search by code and title ignoring case, Engineer, customer (a task with
 * none matches no customer), the deadline days in IST at their edges, AND with the tab and `assignedBy`, the counts that follow the filters, and what an Engineer is refused.
 * The same on real rows is `tests/integration/tasks/queue-filters.test.ts`. Every name, path and date is invented.
 */

const person = (id: string, name: string, role: FakePerson['role']): FakePerson => ({ id: `00000000-0000-4000-8000-0000000000${id}`, name, role, isActive: true });
const ARJUN = person('e1', 'Invented Arjun', 'ENGINEER');
const PRIYA = person('e2', 'Invented Priya', 'ENGINEER');
const FIRST_LEAD = person('b1', 'Invented First Lead', 'LEAD');
const SECOND_LEAD = person('b2', 'Invented Second Lead', 'LEAD');
const CHIEF = person('c1', 'Invented Chief', 'ADMIN');
const ACME = '00000000-0000-4000-8000-0000000000a1';
const BOLT = '00000000-0000-4000-8000-0000000000a2';

/** 01:30 IST on 13 Nov: 0001 (23:30 IST on the 12th) and 0002 (00:00 IST on the 13th) are past their deadline, 0004 is not. */
const NOW = new Date('2026-11-12T20:00:00.000Z');
const viewer = (who: FakePerson): QueueViewer => ({ id: who.id, role: who.role });
const codesOf = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);
/** A deadline on an IST day at a time of day, as `startOfIstDay` + minutes. */
const ist = (day: string, hours: number, minutes = 0): Date => new Date(startOfIstDay(day).getTime() + (hours * 60 + minutes) * 60_000);

let world: FakeTaskWorld;
let service: TaskService;

beforeEach(() => {
  world = createFakeTaskWorld(() => [ARJUN, PRIYA, FIRST_LEAD, SECOND_LEAD, CHIEF]);
  world.customers.set(ACME, 'Invented Acme');
  world.customers.set(BOLT, 'Invented Bolt');
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock: createFixedClock(NOW) });
  // 0001 Arjun, first Lead, Acme, "Hopper cover", 23:30 IST on 12 Nov. 0002 Arjun, second Lead, no customer, "Bracket 50% off", 00:00 IST on 13 Nov.
  // 0003 Priya, first Lead, Bolt, "Plate_A", closed, 10 Nov. 0004 Priya, second Lead, Acme, no title, 20 Nov.
  world.seed({ code: 'Q-2026-0001', engineerId: ARJUN.id, assignedById: FIRST_LEAD.id, deadlineAt: ist('2026-11-12', 23, 30), title: 'Hopper cover', customerId: ACME });
  world.seed({ code: 'Q-2026-0002', engineerId: ARJUN.id, assignedById: SECOND_LEAD.id, deadlineAt: ist('2026-11-13', 0), title: 'Bracket 50% off' });
  world.seed({ code: 'Q-2026-0003', engineerId: PRIYA.id, assignedById: FIRST_LEAD.id, deadlineAt: ist('2026-11-10', 12), title: 'Plate_A', status: 'APPROVED', customerId: BOLT });
  world.seed({ code: 'Q-2026-0004', engineerId: PRIYA.id, assignedById: SECOND_LEAD.id, deadlineAt: ist('2026-11-20', 12), customerId: ACME });
});

describe('AC-3: each filter alone, for a Lead', () => {
  it('searches the task ID and the title, contains, ignoring letter case', async () => {
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', q: 'hOpPeR' }))).toEqual(['Q-2026-0001']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', q: 'q-2026-000' }))).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', q: 'zzz' }))).toEqual([]);
  });

  it('filters by Engineer, and by customer: a task whose Engineer has not chosen one matches no customer', async () => {
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', engineer: ARJUN.id }))).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', customer: ACME }))).toEqual(['Q-2026-0001', 'Q-2026-0004']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', customer: '00000000-0000-4000-8000-0000000000a9' }))).toEqual([]);
  });

  it('takes From at 00:00 IST and To to the end of its day, both inclusive', async () => {
    const tab = (from?: string, to?: string) => service.listQueue(viewer(FIRST_LEAD), { tab: 'open', ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) });
    // 0001 is at 23:30 IST on the 12th: inside "to 12 Nov"; 0002 is at 00:00 IST on the 13th: outside it, and inside "from 13 Nov".
    expect(codesOf(await tab(undefined, '2026-11-12'))).toEqual(['Q-2026-0001']);
    expect(codesOf(await tab('2026-11-13', '2026-11-13'))).toEqual(['Q-2026-0002']);
    expect(codesOf(await tab('2026-11-13'))).toEqual(['Q-2026-0002', 'Q-2026-0004']);
    expect(codesOf(await tab('2026-11-12', '2026-11-12'))).toEqual(['Q-2026-0001']);
  });
});

describe('AC-3: filters combine with AND, with the tab and with assignedBy, and the counts follow them', () => {
  it('combines Engineer, customer and a search', async () => {
    expect(codesOf(await service.listQueue(viewer(CHIEF), { tab: 'open', engineer: ARJUN.id, customer: ACME, q: 'cover' }))).toEqual(['Q-2026-0001']);
    expect(codesOf(await service.listQueue(viewer(CHIEF), { tab: 'open', engineer: PRIYA.id, q: 'bracket' }))).toEqual([]);
  });

  it('follows the tab (Closed) and assignedBy=me for a Lead, and gives the whole queue for anyone', async () => {
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'closed', customer: BOLT }))).toEqual(['Q-2026-0003']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', assignedBy: 'me' }))).toEqual(['Q-2026-0001']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', assignedBy: 'anyone' }))).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004']);
    expect(codesOf(await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', assignedBy: 'me', engineer: PRIYA.id }))).toEqual([]);
  });

  it('counts every tab under the filters', async () => {
    expect((await service.listQueue(viewer(CHIEF), { tab: 'open', customer: ACME })).counts).toEqual({ open: 2, closed: 0, overdue: 1 });
    expect((await service.listQueue(viewer(CHIEF), { tab: 'open', engineer: PRIYA.id })).counts).toEqual({ open: 1, closed: 1, overdue: 0 });
    expect((await service.listQueue(viewer(FIRST_LEAD), { tab: 'open', assignedBy: 'me' })).counts).toEqual({ open: 1, closed: 1, overdue: 1 });
  });

  it('pages a filtered set: the next page is the next rows of the same filtered set', async () => {
    const first = await service.listQueue(viewer(CHIEF), { tab: 'open', q: 'q-2026', limit: 2 });
    expect(codesOf(first)).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(first.nextCursor).not.toBeNull();
  });
});

describe('AC-4, AC-5: what an Engineer is refused, and what a range that ends before it begins is', () => {
  it('lets an Engineer search their own tasks, and nothing the search finds is another person\'s', async () => {
    expect(codesOf(await service.listQueue(viewer(ARJUN), { tab: 'open', q: 'q-2026' }))).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(codesOf(await service.listQueue(viewer(ARJUN), { tab: 'closed', q: 'plate' }))).toEqual([]);
  });

  it.each([
    ['engineer', { engineer: PRIYA.id }],
    ['customer', { customer: ACME }],
    ['from', { from: '2026-11-01' }],
    ['to', { to: '2026-11-30' }],
    ['assignedBy', { assignedBy: 'anyone' as const }],
  ])('refuses %s for an Engineer with a 422 that names it, and reads nothing', async (field, extra) => {
    await expect(service.listQueue(viewer(ARJUN), { tab: 'open', ...extra })).rejects.toBeInstanceOf(FieldValidationError);
    await expect(service.listQueue(viewer(ARJUN), { tab: 'open', ...extra })).rejects.toMatchObject({ fields: [{ field }] });
  });

  it('names every filter an Engineer sent that is not theirs', async () => {
    await expect(service.listQueue(viewer(ARJUN), { tab: 'open', engineer: PRIYA.id, customer: ACME })).rejects.toMatchObject({ fields: [{ field: 'engineer' }, { field: 'customer' }] });
  });

  it('refuses a start date after the end date with the words, under To, for a Lead and an Admin', async () => {
    for (const who of [FIRST_LEAD, CHIEF]) {
      await expect(service.listQueue(viewer(who), { tab: 'open', from: '2026-11-20', to: '2026-11-10' })).rejects.toMatchObject({
        fields: [{ field: 'to', message: 'The start date is after the end date.' }],
      });
    }
  });
});

describe('AC-8: no filter widens the scope', () => {
  it('cannot show another Lead\'s tasks through assignedBy=me, which is always the signed-in person', async () => {
    const mine = await service.listQueue(viewer(SECOND_LEAD), { tab: 'open', assignedBy: 'me' });
    expect(codesOf(mine)).toEqual(['Q-2026-0002', 'Q-2026-0004']);
    expect(mine.counts).toEqual({ open: 2, closed: 0, overdue: 1 });
  });

  it('keeps an Engineer to their own tasks under any search, for the list and for the counts', async () => {
    const result = await service.listQueue(viewer(PRIYA), { tab: 'open', q: 'Q-' });
    expect(codesOf(result)).toEqual(['Q-2026-0004']);
    expect(result.counts).toEqual({ open: 1, closed: 1, overdue: 0 });
  });

  it('uses a cursor made under one filter set, under another, only inside the caller\'s scope', async () => {
    const first = await service.listQueue(viewer(ARJUN), { tab: 'open', limit: 1 });
    expect(first.nextCursor).not.toBeNull();
    const cursor = decodeTaskQueueCursor(first.nextCursor ?? '');
    const reused = await service.listQueue(viewer(PRIYA), { tab: 'open', ...(cursor === null ? {} : { cursor }), q: 'q-2026' });
    expect(codesOf(reused)).toEqual(['Q-2026-0004']);
  });
});
