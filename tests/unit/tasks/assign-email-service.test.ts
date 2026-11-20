import { beforeEach, describe, expect, it } from 'vitest';

import type { AssignInput } from '@/lib/tasks/assign';
import { createFixedClock, type FixedClock } from '@/lib/time';
import type { OutboxMessage } from '@/server/repositories/email-outbox-repository';
import { createTaskMail } from '@/server/services/task-mail';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { createAuditSink } from '../../support/fake-audit-sink';
import { createFakeSettingsRepository, type FakeSettingsRepository } from '../../support/fake-settings';
import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../../support/fake-tasks';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-09.03 AC-1, AC-4, AC-5, AC-6 (the boolean) and AC-7 with the rules and no database: the task service over in-memory storage, the real `createTaskMail` and a recording stand-in for
 * the outbox. The real transaction, the real outbox row and the rollback are `tests/integration/tasks/assign-email.test.ts`. Every name, path and date is invented.
 */

const LEAD: FakePerson = { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Lead', role: 'LEAD', isActive: true };
const OTHER_LEAD: FakePerson = { id: '00000000-0000-4000-8000-0000000000a2', name: 'Invented Other Lead', role: 'LEAD', isActive: true };
const ADMIN: FakePerson = { id: '00000000-0000-4000-8000-0000000000a3', name: 'Invented Admin', role: 'ADMIN', isActive: true };
const ARJUN: FakePerson = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun', role: 'ENGINEER', isActive: true };
const MEERA: FakePerson = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Meera', role: 'ENGINEER', isActive: true };
const GONE: FakePerson = { id: '00000000-0000-4000-8000-0000000000e3', name: 'Invented Gone', role: 'ENGINEER', isActive: false };

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
/** 17:00 IST on 12 November. */
const DEADLINE = new Date('2026-11-12T11:30:00.000Z');

const input = (overrides: Partial<AssignInput> = {}): AssignInput => ({ engineerId: ARJUN.id, folderPath: PATH, deadline: '2026-11-12T17:00', title: 'Hopper cover', notes: 'Sheet-metal parts only.', ...overrides });
const by = (person: FakePerson) => ({ actorId: person.id, actorLabel: person.name, requestId: 'req-assign-email' });

let people: FakePerson[];
let world: FakeTaskWorld;
let clock: FixedClock;
let settings: FakeSettingsRepository;
let queued: OutboxMessage[];
let service: TaskService;
let failEnqueue: Error | null;

beforeEach(() => {
  people = [LEAD, OTHER_LEAD, ADMIN, ARJUN, MEERA, GONE];
  world = createFakeTaskWorld(() => people);
  clock = createFixedClock(NOW);
  settings = createFakeSettingsRepository({ alertsEnabled: true, senderName: 'Invented Portal', senderAddress: 'portal@example.com' });
  queued = [];
  failEnqueue = null;
  const mail = createTaskMail({
    mail: {
      enqueue: (_tx, message) => {
        if (failEnqueue !== null) return Promise.reject(failEnqueue);
        queued.push(message);
        return Promise.resolve('queued' as const);
      },
    },
    settings,
    appOrigin: () => 'https://portal.example.com',
  });
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock, audit: createAuditSink().service, mail });
});

describe('AC-1: assigning with alerts ON writes one row for the Engineer, the assigner copied', () => {
  it('queues task-assigned:<taskId>:1 To the Engineer, Cc the Lead, with the task in the message', async () => {
    const assigned = await service.assignTask(LEAD.id, input());
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ event: 'task-assigned', idempotencyKey: `task-assigned:${assigned.id}:1`, toUserId: ARJUN.id, ccUserIds: [LEAD.id] });
    expect(queued[0]?.bodyText).toContain(assigned.code);
    expect(queued[0]?.bodyText).toContain('Assigned by: Invented Lead');
    expect(queued[0]?.bodyText).toContain('12 Nov 2026, 17:00 IST');
    expect(queued[0]?.bodyText).toContain(`https://portal.example.com/estimates/${assigned.code}`);
  });

  it('an enqueue that fails fails the assignment: no task, no estimate, and the number goes back', async () => {
    failEnqueue = new Error('The outbox could not be written.');
    await refusal(service.assignTask(LEAD.id, input()));
    expect(world.tasks).toHaveLength(0);
    expect(world.estimates).toHaveLength(0);
    expect(world.sequences.get(2026) ?? 0).toBe(0);
    expect(queued).toHaveLength(0);
  });

  it('an assignment that is refused (a past deadline, an inactive Engineer) writes no row', async () => {
    await refusal(service.assignTask(LEAD.id, input({ deadline: '2026-11-08T17:00' })));
    await refusal(service.assignTask(LEAD.id, input({ engineerId: GONE.id })));
    expect(queued).toHaveLength(0);
  });
});

describe('AC-4 (BR-040): alerts OFF', () => {
  it('writes no row, and the task is created exactly as before', async () => {
    settings.current = { ...settings.current, alertsEnabled: false };
    const assigned = await service.assignTask(LEAD.id, input());
    expect(queued).toEqual([]);
    expect(assigned).toMatchObject({ code: 'Q-2026-0001', engineer: { id: ARJUN.id }, estimate: { status: 'DRAFT', customerId: null } });
    expect(world.tasks).toHaveLength(1);
    expect(world.estimates).toHaveLength(1);
  });

  it('a service built without the mail writes no row either (the shape every earlier test uses)', async () => {
    const plain = createTaskService({ tasks: world.repository, transactions: world.transactions, clock });
    await plain.assignTask(LEAD.id, input());
    expect(queued).toEqual([]);
  });
});

describe('AC-5: the Admin as assigner; who is copied is judged when the row is written', () => {
  it('copies the Admin when the Admin assigns', async () => {
    await service.assignTask(ADMIN.id, input());
    expect(queued[0]?.ccUserIds).toEqual([ADMIN.id]);
    expect(queued[0]?.bodyText).toContain('Assigned by: Invented Admin');
  });

  it('does not copy an assigner who is not active at that moment, and still sends to the Engineer', async () => {
    people = people.map((person) => (person.id === LEAD.id ? { ...person, isActive: false } : person));
    await service.assignTask(LEAD.id, input());
    expect(queued[0]).toMatchObject({ toUserId: ARJUN.id, ccUserIds: [] });
  });

  it('takes no address from the call: the only inputs are IDs from the session and the checked input, and the row holds IDs', async () => {
    await service.assignTask(LEAD.id, { ...input(), cc: 'someone@example.com', to: 'someone@example.com' } as AssignInput);
    expect(JSON.stringify(queued)).not.toContain('someone@example.com');
    expect(Object.keys(queued[0] ?? {}).sort()).toEqual(['bodyHtml', 'bodyText', 'ccUserIds', 'event', 'idempotencyKey', 'subject', 'toUserId']);
  });
});

describe('AC-6: the assign context says whether alerts are on, and nothing else of the settings', () => {
  it('answers alertsEnabled true or false with the Engineers, and no other key', async () => {
    const on = await service.getAssignContext();
    expect(on.alertsEnabled).toBe(true);
    expect(Object.keys(on).sort()).toEqual(['alertsEnabled', 'engineers']);
    settings.current = { ...settings.current, alertsEnabled: false };
    expect((await service.getAssignContext()).alertsEnabled).toBe(false);
  });

  it('says false for a service built without the mail: there is nothing to send with', async () => {
    const plain = createTaskService({ tasks: world.repository, transactions: world.transactions, clock });
    expect((await plain.getAssignContext()).alertsEnabled).toBe(false);
  });
});

describe('AC-7: a reassign to another Engineer sends the same message with the new revision', () => {
  let taskId: string;
  beforeEach(() => {
    taskId = world.seed({ code: 'Q-2026-0001', engineerId: ARJUN.id, assignedById: LEAD.id, deadlineAt: DEADLINE, title: 'Hopper cover', notes: 'Invented notes.', folderPath: PATH }).id;
  });

  it('queues task-assigned:<taskId>:2 To the new Engineer, Cc the person who made the change (not the first assigner)', async () => {
    await service.reassignTask(by(OTHER_LEAD), taskId, { engineerId: MEERA.id });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ event: 'task-assigned', idempotencyKey: `task-assigned:${taskId}:2`, toUserId: MEERA.id, ccUserIds: [OTHER_LEAD.id] });
    expect(queued[0]?.bodyText).toContain('Assigned by: Invented Other Lead');
    expect(queued[0]?.bodyText).toContain('Q-2026-0001');
    expect(queued[0]?.bodyText).toContain('Title: Hopper cover');
    expect(queued[0]?.bodyText).toContain('Notes: Invented notes.');
    expect(queued[0]?.bodyText).toContain('12 Nov 2026, 17:00 IST');
  });

  it('shows the new deadline when the Engineer and the deadline change together', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id, deadlineAt: '2026-11-13T18:00:00.000Z' });
    expect(queued[0]?.bodyText).toContain('13 Nov 2026, 23:30 IST');
  });

  it('a deadline-only change sends no assignment e-mail', async () => {
    await service.reassignTask(by(LEAD), taskId, { deadlineAt: '2026-11-13T06:30:00.000Z' });
    expect(queued).toEqual([]);
  });

  it('a save that changes nothing sends nothing', async () => {
    await service.reassignTask(by(LEAD), taskId, { engineerId: ARJUN.id });
    expect(queued).toEqual([]);
  });

  it('writes no row with alerts OFF, and the reassign is made as before', async () => {
    settings.current = { ...settings.current, alertsEnabled: false };
    const result = await service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id });
    expect(queued).toEqual([]);
    expect(result).toMatchObject({ engineerChanged: true, assignmentRevision: 2 });
  });

  it('an enqueue that fails undoes the reassign: the Engineer and the revision stay as they were', async () => {
    failEnqueue = new Error('The outbox could not be written.');
    await refusal(service.reassignTask(by(LEAD), taskId, { engineerId: MEERA.id }));
    expect(world.tasks.find((task) => task.id === taskId)).toMatchObject({ engineerId: ARJUN.id, assignmentRevision: 1 });
  });
});
