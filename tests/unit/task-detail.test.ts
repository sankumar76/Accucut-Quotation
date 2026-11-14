import { beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock } from '@/lib/time';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../support/fake-tasks';

/**
 * STORY-04.04 T4 (AC-1, AC-3, AC-4, AC-5): the task service's `getTask`, which answers one task and the status of its estimate, with the rules and no database. An
 * Engineer is answered with their own task only; another Engineer's task and an ID that is no task are the same answer (`null`, which the route turns into the
 * same 404), a Lead and an Admin may open any. What the answer holds is a task's own words and the status of its estimate, nothing about cost. The queries are
 * `tests/integration/tasks/engineer-status.test.ts`. Every name, path and date is invented.
 */

const LEAD: FakePerson = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Boss', role: 'LEAD', isActive: true };
const ADMIN: FakePerson = { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Admin', role: 'ADMIN', isActive: true };
const ARJUN: FakePerson = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun', role: 'ENGINEER', isActive: true };
const PRIYA: FakePerson = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Priya', role: 'ENGINEER', isActive: true };

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DEADLINE = new Date('2026-11-12T11:30:00.000Z');

let world: FakeTaskWorld;
let service: TaskService;
let draft: string;
let submitted: string;
let approved: string;
let others: string;

beforeEach(() => {
  world = createFakeTaskWorld(() => [LEAD, ADMIN, ARJUN, PRIYA]);
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock: createFixedClock(NOW) });
  draft = world.seed({ code: 'Q-2026-0001', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: DEADLINE, title: 'Hopper cover', status: 'DRAFT', notes: 'Sheet metal only.' }).id;
  submitted = world.seed({ code: 'Q-2026-0002', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: DEADLINE, status: 'SUBMITTED' }).id;
  approved = world.seed({ code: 'Q-2026-0003', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: DEADLINE, status: 'APPROVED' }).id;
  others = world.seed({ code: 'Q-2026-0004', engineerId: PRIYA.id, assignedById: LEAD.id, deadlineAt: DEADLINE, status: 'SUBMITTED' }).id;
});

describe('AC-1: the task and the status of its estimate, in every state', () => {
  it.each([
    ['DRAFT', () => draft],
    ['SUBMITTED', () => submitted],
    ['APPROVED', () => approved],
  ] as const)('an Engineer opens their own %s task and is told its status, derived from the estimate', async (status, id) => {
    expect((await service.getTask({ id: ARJUN.id, role: 'ENGINEER' }, id()))?.status).toBe(status);
  });

  it('answers the task\'s own fields: code, title, notes, the people\'s names, the folder, the deadline and the customer\'s name', async () => {
    const task = await service.getTask({ id: ARJUN.id, role: 'ENGINEER' }, draft);
    expect(task).toEqual({
      id: draft,
      code: 'Q-2026-0001',
      title: 'Hopper cover',
      notes: 'Sheet metal only.',
      engineer: { id: ARJUN.id, name: 'Invented Arjun' },
      customerName: null,
      folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
      folderUrl: 'file:////invented-server/invented-share/RFQ-1',
      deadlineAt: DEADLINE,
      status: 'DRAFT',
      assignedByName: 'Invented Boss',
    });
  });

  it('reads the status again on every call, so an unlock (APPROVED back to DRAFT) is the new word at once', async () => {
    const engineer = { id: ARJUN.id, role: 'ENGINEER' } as const;
    expect((await service.getTask(engineer, approved))?.status).toBe('APPROVED');
    world.setStatus(approved, 'DRAFT');
    expect((await service.getTask(engineer, approved))?.status).toBe('DRAFT');
  });
});

describe('AC-4: an Engineer cannot tell another Engineer\'s task from one that does not exist', () => {
  it('answers null for another Engineer\'s task, for an unknown ID and for text that is no ID, all the same', async () => {
    const engineer = { id: ARJUN.id, role: 'ENGINEER' } as const;
    const answers = await Promise.all([service.getTask(engineer, others), service.getTask(engineer, '00000000-0000-4000-8000-0000000000fe'), service.getTask(engineer, 'invented-id')]);
    expect(answers).toEqual([null, null, null]);
  });

});

describe('AC-3, AC-5: a Lead and an Admin open any task and are told the same words', () => {
  it.each([
    ['LEAD', LEAD],
    ['ADMIN', ADMIN],
  ] as const)('%s opens another Engineer\'s task with the same shape as an Engineer\'s', async (role, person) => {
    const own = await service.getTask({ id: ARJUN.id, role: 'ENGINEER' }, submitted);
    const seen = await service.getTask({ id: person.id, role }, submitted);
    expect(seen).toEqual(own);
    expect((await service.getTask({ id: person.id, role }, others))?.status).toBe('SUBMITTED');
  });

  it('has the same keys for every role and no key that could hold a figure, an approver or a reason', async () => {
    const keys = async (viewer: { id: string; role: 'ENGINEER' | 'LEAD' | 'ADMIN' }): Promise<string[]> => Object.keys((await service.getTask(viewer, approved)) ?? {}).sort();
    const engineerKeys = await keys({ id: ARJUN.id, role: 'ENGINEER' });
    expect(await keys({ id: LEAD.id, role: 'LEAD' })).toEqual(engineerKeys);
    expect(await keys({ id: ADMIN.id, role: 'ADMIN' })).toEqual(engineerKeys);
    expect(engineerKeys).toEqual(['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'notes', 'status', 'title']);
  });
});
