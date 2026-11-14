import { beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_DAY } from '@/lib/time';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../../support/fake-tasks';

/**
 * STORY-04.03 T2 (AC-2, AC-3; FR-037): the bell's count by role, with no database. The same seed answers an Engineer (their own overdue tasks), each of two Leads
 * (the overdue tasks that Lead assigned) and the Admin (all of them); a task that closes leaves the count; and a Lead's `assignedBy=me` Overdue tab holds exactly
 * the tasks the bell counted (AC-3). The queries on real rows are `tests/integration/tasks/bell-count.test.ts`. Every name, path and date is invented.
 */

const ARJUN: FakePerson = {
  id: '00000000-0000-4000-8000-0000000000e1',
  name: 'Invented Arjun',
  role: 'ENGINEER',
  isActive: true,
};
const PRIYA: FakePerson = {
  id: '00000000-0000-4000-8000-0000000000e2',
  name: 'Invented Priya',
  role: 'ENGINEER',
  isActive: true,
};
const FIRST_LEAD: FakePerson = {
  id: '00000000-0000-4000-8000-0000000000b1',
  name: 'Invented First Lead',
  role: 'LEAD',
  isActive: true,
};
const SECOND_LEAD: FakePerson = {
  id: '00000000-0000-4000-8000-0000000000b2',
  name: 'Invented Second Lead',
  role: 'LEAD',
  isActive: true,
};
const CHIEF: FakePerson = {
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'Invented Chief',
  role: 'ADMIN',
  isActive: true,
};

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DAY = MILLISECONDS_PER_DAY;
const at = (offsetMilliseconds: number): Date => new Date(NOW.getTime() + offsetMilliseconds);
const asViewer = (person: FakePerson): QueueViewer => ({
  id: person.id,
  role: person.role,
});
const codesOf = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);

let world: FakeTaskWorld;
let service: TaskService;

beforeEach(() => {
  world = createFakeTaskWorld(() => [ARJUN, PRIYA, FIRST_LEAD, SECOND_LEAD, CHIEF]);
  service = createTaskService({
    tasks: world.repository,
    transactions: world.transactions,
    clock: createFixedClock(NOW),
  });
  // Overdue and open: 0001 (Arjun, first Lead), 0002 (Arjun, second Lead), 0003 (Priya, first Lead), 0004 (Priya, second Lead; a millisecond past).
  world.seed({
    code: 'Q-2026-0001',
    engineerId: ARJUN.id,
    assignedById: FIRST_LEAD.id,
    deadlineAt: at(-2 * DAY),
  });
  world.seed({
    code: 'Q-2026-0002',
    engineerId: ARJUN.id,
    assignedById: SECOND_LEAD.id,
    deadlineAt: at(-DAY),
    status: 'SUBMITTED',
  });
  world.seed({
    code: 'Q-2026-0003',
    engineerId: PRIYA.id,
    assignedById: FIRST_LEAD.id,
    deadlineAt: at(-3 * DAY),
  });
  world.seed({
    code: 'Q-2026-0004',
    engineerId: PRIYA.id,
    assignedById: SECOND_LEAD.id,
    deadlineAt: at(-1),
  });
  // Not counted: a deadline exactly now, one ahead, and a closed task with a past deadline.
  world.seed({
    code: 'Q-2026-0005',
    engineerId: ARJUN.id,
    assignedById: FIRST_LEAD.id,
    deadlineAt: at(0),
  });
  world.seed({
    code: 'Q-2026-0006',
    engineerId: PRIYA.id,
    assignedById: FIRST_LEAD.id,
    deadlineAt: at(DAY),
  });
  world.seed({
    code: 'Q-2026-0007',
    engineerId: ARJUN.id,
    assignedById: FIRST_LEAD.id,
    deadlineAt: at(-4 * DAY),
    status: 'APPROVED',
  });
});

describe('AC-2: the bell counts what is relevant to the role', () => {
  it('an Engineer is counted their own overdue tasks', async () => {
    expect(await service.countOverdue(asViewer(ARJUN))).toBe(2);
    expect(await service.countOverdue(asViewer(PRIYA))).toBe(2);
  });

  it("a Lead is counted the overdue tasks that Lead assigned, and not the other Lead's", async () => {
    expect(await service.countOverdue(asViewer(FIRST_LEAD))).toBe(2);
    expect(await service.countOverdue(asViewer(SECOND_LEAD))).toBe(2);
  });

  it('the Admin is counted every overdue task', async () => {
    expect(await service.countOverdue(asViewer(CHIEF))).toBe(4);
  });

  it('is zero for a person with no overdue task', async () => {
    expect(
      await service.countOverdue({
        id: '00000000-0000-4000-8000-0000000000e9',
        role: 'ENGINEER',
      }),
    ).toBe(0);
    expect(
      await service.countOverdue({
        id: '00000000-0000-4000-8000-0000000000b9',
        role: 'LEAD',
      }),
    ).toBe(0);
  });

  it('is judged at the clock of the server: a millisecond later the deadline that was exactly now is overdue (NFR-015)', async () => {
    const clock = createFixedClock(NOW);
    const later = createTaskService({
      tasks: world.repository,
      transactions: world.transactions,
      clock,
    });
    expect(await later.countOverdue(asViewer(CHIEF))).toBe(4);
    clock.advance(1);
    expect(await later.countOverdue(asViewer(CHIEF))).toBe(5);
  });

  it('a task that closes leaves the count', async () => {
    const closing = world.estimates.find((estimate) => estimate.taskId === world.tasks.find((task) => task.code === 'Q-2026-0001')?.id);
    if (closing === undefined) throw new Error('The seeded estimate is missing.');
    Object.assign(closing, { status: 'APPROVED' });
    expect(await service.countOverdue(asViewer(ARJUN))).toBe(1);
    expect(await service.countOverdue(asViewer(FIRST_LEAD))).toBe(1);
    expect(await service.countOverdue(asViewer(CHIEF))).toBe(3);
  });

  it('is the number the Overdue tab counts for the same person', async () => {
    for (const person of [ARJUN, PRIYA, CHIEF]) {
      expect((await service.listQueue(asViewer(person), { tab: 'overdue' })).counts.overdue).toBe(await service.countOverdue(asViewer(person)));
    }
  });
});

describe("AC-3: the Overdue tab a Lead's bell opens holds the set the bell counted", () => {
  it('assignedBy=me gives a Lead the Overdue tab of the tasks that Lead assigned, and the count of every tab cut the same way', async () => {
    const tab = await service.listQueue(asViewer(FIRST_LEAD), {
      tab: 'overdue',
      assignedBy: 'me',
    });
    expect(codesOf(tab)).toEqual(['Q-2026-0003', 'Q-2026-0001']);
    expect(tab.tasks).toHaveLength(await service.countOverdue(asViewer(FIRST_LEAD)));
    expect(tab.counts).toEqual({ open: 4, closed: 1, overdue: 2 });
  });

  it("without assignedBy a Lead still sees the whole queue (STORY-04.02 AC-2): the filter is the bell's, asked for", async () => {
    expect(codesOf(await service.listQueue(asViewer(FIRST_LEAD), { tab: 'overdue' }))).toEqual(['Q-2026-0003', 'Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004']);
  });

  it("assignedBy=me never widens an Engineer's view: it can only narrow it, and an Engineer assigned nothing", async () => {
    expect(
      codesOf(
        await service.listQueue(asViewer(ARJUN), {
          tab: 'overdue',
          assignedBy: 'me',
        }),
      ),
    ).toEqual([]);
  });

  it('assignedBy=me for the Admin is the tasks the Admin assigned', async () => {
    expect(
      codesOf(
        await service.listQueue(asViewer(CHIEF), {
          tab: 'overdue',
          assignedBy: 'me',
        }),
      ),
    ).toEqual([]);
  });
});
