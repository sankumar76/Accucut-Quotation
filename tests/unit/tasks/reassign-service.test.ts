import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { TASK_CLOSED_CODE } from '@/lib/tasks/reassign';
import { createFixedClock, type FixedClock } from '@/lib/time';
import type { AuditService } from '@/server/services/audit-service';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { defined } from '../../support/defined';
import { createAuditSink, type AuditSink } from '../../support/fake-audit-sink';
import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../../support/fake-tasks';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-04.07 (AC-3 to AC-7) with the rules and no database: the reassign over in-memory storage, the real audit service over an in-memory sink, and a clock the
 * test sets. The row locks, the race with an approval and the audit entry in PostgreSQL are `tests/integration/tasks/reassign.test.ts`. Every name, path and date
 * is invented.
 */

const LEAD: FakePerson = { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Lead', role: 'LEAD', isActive: true };
const OTHER_LEAD: FakePerson = { id: '00000000-0000-4000-8000-0000000000a2', name: 'Invented Other Lead', role: 'LEAD', isActive: true };
const ADMIN: FakePerson = { id: '00000000-0000-4000-8000-0000000000a3', name: 'Invented Admin', role: 'ADMIN', isActive: true };
const ARJUN: FakePerson = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun', role: 'ENGINEER', isActive: true };
const MEERA: FakePerson = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Meera', role: 'ENGINEER', isActive: true };
const GONE: FakePerson = { id: '00000000-0000-4000-8000-0000000000e3', name: 'Invented Gone', role: 'ENGINEER', isActive: false };

const NOW = new Date('2026-11-09T04:00:00.000Z');
/** 17:00 IST on 12 November. */
const DEADLINE = new Date('2026-11-12T11:30:00.000Z');
const LATER = '2026-11-13T06:30:00.000Z';
const REQUEST_ID = 'req-reassign-1';

const by = (person: FakePerson) => ({ actorId: person.id, actorLabel: person.name, requestId: REQUEST_ID });

let people: FakePerson[];
let world: FakeTaskWorld;
let clock: FixedClock;
let sink: AuditSink;
let service: TaskService;
let taskId: string;

beforeEach(() => {
  people = [LEAD, OTHER_LEAD, ADMIN, ARJUN, MEERA, GONE];
  world = createFakeTaskWorld(() => people);
  clock = createFixedClock(NOW);
  sink = createAuditSink();
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock, audit: sink.service });
  taskId = world.seed({ code: 'Q-2026-0001', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: DEADLINE, title: 'Hopper cover', notes: 'Invented notes.' }).id;
});

const stored = () => defined(world.tasks.find((task) => task.id === taskId));

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error = await refusal(promise);
  if (!(error instanceof FieldValidationError)) throw new Error('Expected a FieldValidationError.');
  return Object.fromEntries(error.fields.map((problem) => [problem.field, problem.message]));
}

describe('AC-3: the change is stored whole, and the answer is the task as the queue shows it', () => {
  it('a new Engineer: stored, the revision goes up, the deadline stays, and the answer names the new Engineer and the original assigner', async () => {
    const result = await service.reassignTask(by(OTHER_LEAD), taskId, { engineerId: MEERA.id });
    expect(stored()).toMatchObject({ engineerId: MEERA.id, deadlineAt: DEADLINE, assignmentRevision: 2, assignedById: LEAD.id });
    expect(result).toMatchObject({ engineerChanged: true, deadlineChanged: false, assignmentRevision: 2 });
    expect(result.task).toMatchObject({ id: taskId, code: 'Q-2026-0001', engineer: { id: MEERA.id, name: MEERA.name }, deadlineAt: DEADLINE, assignedByName: LEAD.name, status: 'DRAFT' });
  });

  it('a new deadline: stored as the instant, the Engineer and the revision stay', async () => {
    const result = await service.reassignTask(by(LEAD), taskId, { deadlineAt: LATER });
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, deadlineAt: new Date(LATER), assignmentRevision: 1 });
    expect(result).toMatchObject({ engineerChanged: false, deadlineChanged: true, assignmentRevision: 1 });
    expect(result.task.deadlineAt).toEqual(new Date(LATER));
  });

  it('both together: both stored, the revision goes up once', async () => {
    const result = await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: LATER });
    expect(stored()).toMatchObject({ engineerId: MEERA.id, deadlineAt: new Date(LATER), assignmentRevision: 2 });
    expect(result).toMatchObject({ engineerChanged: true, deadlineChanged: true });
  });

  it('keeps the folder, title and notes as they were', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: LATER });
    expect(stored()).toMatchObject({ title: 'Hopper cover', notes: 'Invented notes.', folderPath: '\\\\invented-server\\invented-share\\RFQ-1' });
  });

  it('the answer holds no cost, rate or price key, only the keys of a row of the queue', async () => {
    const { task } = await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id });
    expect(Object.keys(task).sort()).toEqual(
      ['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'ignoredRemarks', 'status', 'title'],
    );
  });

  it('a body with neither field, and one with the values already stored, change nothing, write no entry and do not raise the revision', async () => {
    for (const input of [{}, { engineerId: ARJUN.id, deadlineAt: DEADLINE.toISOString() }]) {
      const result = await service.reassignTask(by(LEAD), taskId, input);
      expect(result).toMatchObject({ engineerChanged: false, deadlineChanged: false, assignmentRevision: 1 });
      expect(result.task.engineer.id).toBe(ARJUN.id);
    }
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, deadlineAt: DEADLINE, assignmentRevision: 1 });
    expect(sink.rows).toHaveLength(0);
  });
});

describe('AC-3: the same checks as assigning, against the server\'s clock (D-3)', () => {
  it('refuses a deadline that is not later than now, whatever the browser said, and stores nothing', async () => {
    expect(await fieldsOf(service.reassignTask(by(LEAD), taskId, { deadlineAt: NOW.toISOString() }))).toEqual({ deadlineAt: 'Choose a deadline later than now.' });
    expect(await fieldsOf(service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: '2026-11-01T00:00:00.000Z' }))).toEqual({
      deadlineAt: 'Choose a deadline later than now.',
    });
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, deadlineAt: DEADLINE, assignmentRevision: 1 });
    expect(sink.rows).toHaveLength(0);
  });

  it('judges a new deadline by the clock of the moment: one that was later is refused once the clock passes it', async () => {
    clock.set(new Date('2026-11-14T00:00:00.000Z'));
    expect(await fieldsOf(service.reassignTask(by(LEAD), taskId, { deadlineAt: LATER }))).toEqual({ deadlineAt: 'Choose a deadline later than now.' });
  });

  it('an overdue task can be given to another Engineer with its deadline unchanged, even in the past', async () => {
    clock.set(new Date('2026-11-20T00:00:00.000Z'));
    const result = await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: DEADLINE.toISOString() });
    expect(result.task).toMatchObject({ engineer: { id: MEERA.id }, deadlineAt: DEADLINE });
    expect(stored()).toMatchObject({ engineerId: MEERA.id, deadlineAt: DEADLINE, assignmentRevision: 2 });
  });

  it('an overdue task can be reassigned by the Engineer alone', async () => {
    clock.set(new Date('2026-11-20T00:00:00.000Z'));
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id });
    expect(stored()).toMatchObject({ engineerId: MEERA.id, deadlineAt: DEADLINE });
  });

  it.each([
    ['a deactivated Engineer', GONE.id],
    ['a Lead', OTHER_LEAD.id],
    ['an Admin', ADMIN.id],
    ['an ID nobody has', '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', 'not-an-id'],
    ['an empty choice', ''],
  ])('refuses %s as "Choose an Engineer." under the field, and stores nothing', async (_name, engineerId) => {
    expect(await fieldsOf(service.reassignTask(by(LEAD), taskId, { engineerId }))).toEqual({ engineerId: 'Choose an Engineer.' });
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, assignmentRevision: 1 });
    expect(sink.rows).toHaveLength(0);
  });

  it('a deactivated Engineer who already holds the task does not stop its deadline from being moved (only a changed Engineer is looked up)', async () => {
    world.seed({ code: 'Q-2026-0002', engineerId: GONE.id, assignedById: LEAD.id, deadlineAt: DEADLINE });
    const goneTask = defined(world.tasks.find((task) => task.code === 'Q-2026-0002'));
    await service.reassignTask(by(LEAD), goneTask.id, { engineerId: GONE.id, deadlineAt: LATER });
    expect(world.tasks.find((task) => task.id === goneTask.id)).toMatchObject({ engineerId: GONE.id, deadlineAt: new Date(LATER), assignmentRevision: 1 });
  });

  it('names every problem of the values at once (whether a chosen Engineer is active is looked up after they pass, as in assigning)', async () => {
    expect(await fieldsOf(service.reassignTask(by(LEAD), taskId, { engineerId: '', deadlineAt: 'tomorrow' }))).toEqual({
      engineerId: 'Choose an Engineer.',
      deadlineAt: 'Choose a deadline later than now.',
    });
  });
});

describe('AC-4: one audit entry for one save, in the same transaction', () => {
  it('an Engineer change writes one task.reassigned entry by the person who saved, about the task code, with the Engineer before and after', async () => {
    await service.reassignTask(by(OTHER_LEAD), taskId, { engineerId: MEERA.id });
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      actorId: OTHER_LEAD.id,
      actorLabel: OTHER_LEAD.name,
      event: 'task.reassigned',
      objectType: 'task',
      objectId: taskId,
      objectLabel: 'Q-2026-0001',
      requestId: REQUEST_ID,
      before: { engineer: { id: ARJUN.id, name: ARJUN.name }, deadlineAt: DEADLINE.toISOString() },
      after: { engineer: { id: MEERA.id, name: MEERA.name }, deadlineAt: DEADLINE.toISOString() },
    });
  });

  it('a deadline change writes one entry with the two instants', async () => {
    await service.reassignTask(by(ADMIN), taskId, { deadlineAt: LATER });
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      actorId: ADMIN.id,
      before: { engineer: { id: ARJUN.id }, deadlineAt: DEADLINE.toISOString() },
      after: { engineer: { id: ARJUN.id }, deadlineAt: new Date(LATER).toISOString() },
    });
  });

  it('a change of both writes one entry, not two (D-g)', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: LATER });
    expect(sink.rows).toHaveLength(1);
  });

  it('keeps no cost, folder path, notes, title or e-mail address', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: LATER });
    const text = JSON.stringify(sink.rows);
    for (const word of ['Invented notes', 'Hopper cover', 'RFQ-1', 'invented-server', '@', 'price', 'cost', 'rate']) expect(text, word).not.toContain(word);
  });

  it('a change that cannot be recorded does not happen: the audit service refuses, and the task is as it was', async () => {
    const refusing: AuditService = { ...sink.service, record: () => Promise.reject(new Error('Invented audit failure.')) };
    const failing = createTaskService({ tasks: world.repository, transactions: world.transactions, clock, audit: refusing });
    await expect(failing.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id })).rejects.toThrow('Invented audit failure.');
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, deadlineAt: DEADLINE, assignmentRevision: 1 });
  });

  it('a service built without the audit service refuses to reassign, and changes nothing', async () => {
    const bare = createTaskService({ tasks: world.repository, transactions: world.transactions, clock });
    await expect(bare.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id })).rejects.toThrow('audit');
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, assignmentRevision: 1 });
  });
});

describe('AC-5: the assignment revision (A-09)', () => {
  it('goes up by one for each change of Engineer, and not for a deadline change', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id });
    await service.reassignTask(by(LEAD), taskId, { deadlineAt: LATER });
    expect(stored().assignmentRevision).toBe(2);
    await service.reassignTask(by(LEAD), taskId, { engineerId: ARJUN.id });
    expect(stored().assignmentRevision).toBe(3);
  });
});

describe('AC-6 (A-14): an approved task cannot be changed', () => {
  it('refuses with 409 TASK_CLOSED and changes nothing and writes no entry', async () => {
    world.setStatus(taskId, 'APPROVED');
    const error = await refusal(service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: LATER }));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: TASK_CLOSED_CODE });
    expect(TASK_CLOSED_CODE).toBe('TASK_CLOSED');
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, deadlineAt: DEADLINE, assignmentRevision: 1 });
    expect(sink.rows).toHaveLength(0);
  });

  it('refuses a body that changes nothing as well: the task is closed, whatever is asked', async () => {
    world.setStatus(taskId, 'APPROVED');
    await expect(service.reassignTask(by(LEAD), taskId, {})).rejects.toBeInstanceOf(ConflictError);
  });

  it('reads the status when the task is locked, not when the form was opened: approved in between is refused', async () => {
    await service.reassignTask(by(LEAD), taskId, { deadlineAt: LATER });
    world.setStatus(taskId, 'APPROVED');
    await expect(service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id })).rejects.toMatchObject({ code: TASK_CLOSED_CODE });
  });

  it.each(['DRAFT', 'PREPARED'] as const)('lets a %s task be changed (A-3)', async (status) => {
    world.setStatus(taskId, status);
    const result = await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id });
    expect(result.task).toMatchObject({ engineer: { id: MEERA.id }, status });
  });
});

describe('AC-7: a task that is not there', () => {
  it.each(['00000000-0000-4000-8000-00000000dead', 'not-an-id', ''])('%j is a 404 and nothing is written', async (id) => {
    await expect(service.reassignTask(by(LEAD), id, { engineerId: MEERA.id })).rejects.toBeInstanceOf(NotFoundError);
    expect(sink.rows).toHaveLength(0);
  });

  it('any Lead and the Admin may change a task they did not assign (D-f)', async () => {
    await service.reassignTask(by(OTHER_LEAD), taskId, { engineerId: MEERA.id });
    await service.reassignTask(by(ADMIN), taskId, { engineerId: ARJUN.id });
    expect(stored()).toMatchObject({ engineerId: ARJUN.id, assignedById: LEAD.id, assignmentRevision: 3 });
    expect(sink.rows.map((row) => row.actorId)).toEqual([OTHER_LEAD.id, ADMIN.id]);
  });
});

describe('AC-8: who sees it now', () => {
  it('the old Engineer\'s queue no longer holds the task, the new one\'s does, with its status and no price', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id });
    const arjun = await service.listQueue({ id: ARJUN.id, role: 'ENGINEER' }, { tab: 'open' });
    const meera = await service.listQueue({ id: MEERA.id, role: 'ENGINEER' }, { tab: 'open' });
    expect(arjun.tasks).toHaveLength(0);
    expect(arjun.counts).toEqual({ open: 0, closed: 0, overdue: 0, ignored: 0 });
    expect(meera.tasks.map((task) => task.code)).toEqual(['Q-2026-0001']);
    expect(await service.getTask({ id: ARJUN.id, role: 'ENGINEER' }, taskId)).toBeNull();
    expect(await service.getTask({ id: MEERA.id, role: 'ENGINEER' }, taskId)).toMatchObject({ code: 'Q-2026-0001', status: 'DRAFT' });
  });
});
