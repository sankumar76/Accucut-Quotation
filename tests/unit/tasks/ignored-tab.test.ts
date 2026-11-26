import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError } from '@/lib/errors';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { engineerSeesIgnored, QUEUE_TAB_LABELS, QUEUE_TABS } from '@/lib/tasks/queue';
import { createFixedClock } from '@/lib/time';
import { createAuditSink } from '../../support/fake-audit-sink';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../../support/fake-tasks';

/**
 * CR-01 item 7D, AC-3, AC-6, AC-7, AC-9 (AQP-401; FR-037, FR-102; A-CR01-2 and A-CR01-8 confirmed): the Ignored tab through the task service, with no database. An ignored task is in the Ignored tab alone, with its remarks
 * and the display status `IGNORED`; no other tab holds a row with remarks; the counts gain `ignored`; an Engineer's tab, count and task read are their own only, and another Engineer's ignored task is not found; the
 * task page carries who, when and the remarks (by name) for every role; and a reassign is refused 409 `ESTIMATE_IGNORED`, whatever the status underneath. The same on real rows is
 * `tests/integration/tasks/ignored-tab.test.ts`. Every name, path and date is invented.
 */

const person = (id: string, name: string, role: FakePerson['role']): FakePerson => ({ id: `00000000-0000-4000-8000-0000000000${id}`, name, role, isActive: true });
const ARJUN = person('e1', 'Invented Arjun', 'ENGINEER');
const PRIYA = person('e2', 'Invented Priya', 'ENGINEER');
const LEAD = person('b1', 'Invented Lead', 'LEAD');
const OTHER_LEAD = person('b2', 'Invented Other Lead', 'LEAD');
const CHIEF = person('c1', 'Invented Chief', 'ADMIN');

const NOW = new Date('2026-11-23T04:00:00.000Z');
const PAST = new Date('2026-11-01T11:30:00.000Z');
const AHEAD = new Date('2026-12-01T11:30:00.000Z');
const IGNORED_AT = new Date('2026-11-05T06:35:00.000Z');
const REMARKS = 'Not taken forward.\nThe customer chose another supplier.';

const viewer = (who: FakePerson): QueueViewer => ({ id: who.id, role: who.role });
const codesOf = (queue: { readonly tasks: ReadonlyArray<{ readonly code: string }> }): string[] => queue.tasks.map((task) => task.code);

let world: FakeTaskWorld;
let service: TaskService;
let audit: ReturnType<typeof createAuditSink>;

beforeEach(() => {
  world = createFakeTaskWorld(() => [ARJUN, PRIYA, LEAD, OTHER_LEAD, CHIEF]);
  audit = createAuditSink();
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock: createFixedClock(NOW), audit: audit.service });
  // 0001 Arjun, Draft, ignored, past its deadline. 0002 Arjun, Approved, ignored. 0003 Arjun, Draft, open and late. 0004 Priya, Prepared, ignored. 0005 Priya, Approved, closed.
  world.seed({ code: 'Q-2026-0001', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: PAST, status: 'DRAFT', ignored: { remarks: REMARKS, byName: LEAD.name, at: IGNORED_AT } });
  world.seed({ code: 'Q-2026-0002', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: AHEAD, status: 'APPROVED', ignored: { remarks: 'Rejected by the customer.', byName: OTHER_LEAD.name, at: IGNORED_AT } });
  world.seed({ code: 'Q-2026-0003', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: PAST, status: 'DRAFT' });
  world.seed({ code: 'Q-2026-0004', engineerId: PRIYA.id, assignedById: OTHER_LEAD.id, deadlineAt: AHEAD, status: 'PREPARED', ignored: { remarks: 'Invented Priya remarks.', byName: LEAD.name, at: IGNORED_AT } });
  world.seed({ code: 'Q-2026-0005', engineerId: PRIYA.id, assignedById: OTHER_LEAD.id, deadlineAt: PAST, status: 'APPROVED' });
});

describe('AC-3: the four tabs, Ignored last', () => {
  it('is open, overdue, closed, ignored (FR-034), labelled Ignored', () => {
    expect(QUEUE_TABS).toEqual(['open', 'overdue', 'closed', 'ignored']);
    expect(QUEUE_TAB_LABELS.ignored).toBe('Ignored');
  });

  it('an ignored task is in the Ignored tab alone: not Open, not Closed, not Overdue, whatever its status or deadline', async () => {
    expect(codesOf(await service.listQueue(viewer(CHIEF), { tab: 'ignored' }))).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004']);
    expect(codesOf(await service.listQueue(viewer(CHIEF), { tab: 'open' }))).toEqual(['Q-2026-0003']);
    expect(codesOf(await service.listQueue(viewer(CHIEF), { tab: 'closed' }))).toEqual(['Q-2026-0005']);
    expect(codesOf(await service.listQueue(viewer(CHIEF), { tab: 'overdue' }))).toEqual(['Q-2026-0003']);
  });

  it('the counts gain `ignored`, and no ignored task is counted in the other three', async () => {
    expect((await service.listQueue(viewer(CHIEF), { tab: 'open' })).counts).toEqual({ open: 1, closed: 1, overdue: 1, ignored: 3 });
  });

  it('the bell does not count an ignored task, however late its deadline (it rings for 0003 alone)', async () => {
    expect(await service.countOverdue(viewer(CHIEF))).toBe(1);
    expect(await service.countOverdue(viewer(ARJUN))).toBe(1);
  });

  it('each tab sorts by deadline, earliest first', async () => {
    const deadlines = (await service.listQueue(viewer(CHIEF), { tab: 'ignored' })).tasks.map((task) => task.deadlineAt.getTime());
    expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));
  });
});

describe('AC-3, AC-9: a row carries the display status, and the remarks only on the Ignored tab', () => {
  it('an Ignored-tab row has the status IGNORED and the remarks, and nothing of who and when', async () => {
    const [first] = (await service.listQueue(viewer(CHIEF), { tab: 'ignored' })).tasks;
    expect(first).toMatchObject({ code: 'Q-2026-0001', status: 'IGNORED', ignoredRemarks: REMARKS });
    expect(Object.keys(first ?? {}).sort()).toEqual(['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'ignoredRemarks', 'status', 'title']);
  });

  it('a row of every other tab has no remarks, and its own status', async () => {
    for (const tab of ['open', 'closed', 'overdue'] as const) {
      const { tasks } = await service.listQueue(viewer(CHIEF), { tab });
      expect(tasks.length, tab).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(task.ignoredRemarks, `${tab} ${task.code}`).toBeNull();
        expect(task.status).not.toBe('IGNORED');
      }
    }
  });

  it('the row after a reassign answer holds no remarks either (it is never ignored)', async () => {
    const { task } = await service.reassignTask({ actorId: LEAD.id, actorLabel: LEAD.name, requestId: 'r' }, taskIdOf('Q-2026-0003'), { engineerId: PRIYA.id });
    expect(task.ignoredRemarks).toBeNull();
  });
});

describe('AC-7: an Engineer sees their own ignored tasks, and never another Engineer\'s', () => {
  it('is decided in one predicate, which says yes (A-CR01-2: "Yes, Ignored tab")', () => {
    expect(engineerSeesIgnored()).toBe(true);
  });

  it('lists only their own in the Ignored tab, and counts only their own', async () => {
    const mine = await service.listQueue(viewer(ARJUN), { tab: 'ignored' });
    expect(codesOf(mine)).toEqual(['Q-2026-0001', 'Q-2026-0002']);
    expect(mine.counts).toEqual({ open: 1, closed: 0, overdue: 1, ignored: 2 });
    const priyas = await service.listQueue(viewer(PRIYA), { tab: 'ignored' });
    expect(codesOf(priyas)).toEqual(['Q-2026-0004']);
    expect(priyas.counts.ignored).toBe(1);
  });

  it('shows them the remarks of their own ignored task', async () => {
    const [first] = (await service.listQueue(viewer(ARJUN), { tab: 'ignored' })).tasks;
    expect(first?.ignoredRemarks).toBe(REMARKS);
  });

  it('opens their own ignored task, and finds another Engineer\'s as not found, as any task that is not theirs', async () => {
    expect(await service.getTask(viewer(ARJUN), taskIdOf('Q-2026-0001'))).not.toBeNull();
    expect(await service.getTask(viewer(ARJUN), taskIdOf('Q-2026-0004'))).toBeNull();
    expect(await service.getTask(viewer(PRIYA), taskIdOf('Q-2026-0001'))).toBeNull();
  });
});

describe('AC-9: the task page carries the Ignored layer for every role, by name and with no ID', () => {
  it.each([
    ['an Engineer', ARJUN],
    ['a Lead', LEAD],
    ['an Admin', CHIEF],
  ] as const)('%s reads who ignored it, when and the remarks, and the status underneath', async (_name, who) => {
    const detail = await service.getTask(viewer(who), taskIdOf('Q-2026-0002'));
    expect(detail?.status).toBe('APPROVED');
    expect(detail?.ignored).toEqual({ at: IGNORED_AT, byName: OTHER_LEAD.name, remarks: 'Rejected by the customer.' });
  });

  it('is null for a task that is not ignored', async () => {
    expect((await service.getTask(viewer(CHIEF), taskIdOf('Q-2026-0003')))?.ignored).toBeNull();
  });
});

describe('AC-6: a reassign is refused while the task is ignored (FR-040: restore it first)', () => {
  const context = { actorId: LEAD.id, actorLabel: LEAD.name, requestId: 'request-1' };

  it.each(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0004'])('%s: 409 ESTIMATE_IGNORED with the state machine\'s words, whatever the status underneath, and nothing is written', async (code) => {
    const id = taskIdOf(code);
    const before = world.tasks.map((task) => ({ ...task }));
    const error: unknown = await service.reassignTask(context, id, { engineerId: ARJUN.id, deadlineAt: AHEAD.toISOString() }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.IGNORED.code, message: TRANSITION_REFUSALS.IGNORED.message });
    expect(world.tasks).toEqual(before);
    expect(audit.rows).toEqual([]);
  });

  it('is allowed again once the layer is cleared (Restore): the same task is reassigned', async () => {
    const id = taskIdOf('Q-2026-0001');
    world.setIgnored(id, null);
    const result = await service.reassignTask(context, id, { engineerId: PRIYA.id });
    expect(result.engineerChanged).toBe(true);
  });

  it('an unknown task is still not found', async () => {
    await expect(service.reassignTask(context, '00000000-0000-4000-8000-00000000ffff', { engineerId: ARJUN.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

/** The ID of the seeded task with this code. */
function taskIdOf(code: string): string {
  const found = world.tasks.find((task) => task.code === code);
  if (found === undefined) throw new Error(`No seeded task ${code}.`);
  return found.id;
}
