import { beforeEach, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import type { AssignInput } from '@/lib/tasks/assign';
import { createFixedClock, type FixedClock } from '@/lib/time';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { defined } from '../support/defined';
import { createFakeTaskWorld, type FakePerson, type FakeTaskWorld } from '../support/fake-tasks';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-04.01 T3 (AC-1, AC-2, AC-3, AC-4, AC-6) with the rules and no database: the task service over in-memory storage and a clock the test sets. The
 * queries, the lock and the constraints are `tests/integration/tasks/assign.test.ts`. Every name, path and date is invented.
 */

const LEAD_ID = '00000000-0000-4000-8000-0000000000a1';
const ARJUN: FakePerson = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun', role: 'ENGINEER', isActive: true };
const PRIYA: FakePerson = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Priya', role: 'ENGINEER', isActive: true };
const GONE: FakePerson = { id: '00000000-0000-4000-8000-0000000000e3', name: 'Invented Gone', role: 'ENGINEER', isActive: false };
const BOSS: FakePerson = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Boss', role: 'LEAD', isActive: true };

const ACME_ID = '00000000-0000-4000-8000-0000000000c1';
const GONE_CUSTOMER_ID = '00000000-0000-4000-8000-0000000000c2';

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

const input = (overrides: Partial<AssignInput> = {}): AssignInput => ({
  engineerId: ARJUN.id,
  customerId: ACME_ID,
  folderPath: PATH,
  deadline: '2026-11-12T17:00',
  title: 'Hopper cover',
  subject: 'Feed hopper',
  notes: 'Sheet-metal parts only.',
  ...overrides,
});

let people: FakePerson[];
let world: FakeTaskWorld;
let clock: FixedClock;
let service: TaskService;

beforeEach(() => {
  people = [ARJUN, PRIYA, GONE, BOSS];
  world = createFakeTaskWorld(() => people);
  world.customers.set(ACME_ID, 'Invented Acme');
  world.customerShortNames.set(ACME_ID, 'ACM');
  world.customers.set(GONE_CUSTOMER_ID, 'Invented Gone Works');
  world.customerShortNames.set(GONE_CUSTOMER_ID, 'GONE');
  world.deletedCustomers.add(GONE_CUSTOMER_ID);
  clock = createFixedClock(NOW);
  service = createTaskService({ tasks: world.repository, transactions: world.transactions, clock });
});

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error = await refusal(promise);
  if (!(error instanceof FieldValidationError)) throw new Error('Expected a FieldValidationError.');
  return Object.fromEntries(error.fields.map((problem) => [problem.field, problem.message]));
}

describe('AC-1: a task and an empty estimate are made together', () => {
  it('stores the task for the chosen Engineer, assigned by the caller, with the deadline as a UTC instant, its subject, and an estimate in DRAFT that already has the customer', async () => {
    const assigned = await service.assignTask(LEAD_ID, input());
    expect(assigned).toMatchObject({
      code: 'Q-2026-0001',
      engineer: { id: ARJUN.id, name: ARJUN.name },
      folderPath: PATH,
      deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
      title: 'Hopper cover',
      subject: 'Feed hopper',
      customer: { id: ACME_ID, name: 'Invented Acme', shortName: 'ACM' },
      notes: 'Sheet-metal parts only.',
      estimate: { status: 'DRAFT', customerId: ACME_ID },
    });
    expect(world.tasks).toHaveLength(1);
    expect(world.tasks[0]).toMatchObject({ engineerId: ARJUN.id, assignedById: LEAD_ID, assignmentRevision: 1 });
    expect(world.tasks[0]).toMatchObject({ subject: 'Feed hopper', title: 'Hopper cover' });
    expect(world.estimates).toEqual([{ id: assigned.estimate.id, taskId: assigned.id, customerId: ACME_ID, status: 'DRAFT' }]);
  });

  it('keeps empty notes as null (the notes are the only optional field since CR-01 item 6) and trims the subject and the title', async () => {
    const assigned = await service.assignTask(LEAD_ID, input({ notes: '  ', title: ' Hopper cover ', subject: '  Feed hopper  ' }));
    expect([assigned.notes, assigned.title, assigned.subject]).toEqual([null, 'Hopper cover', 'Feed hopper']);
  });

  it('reads the short name from the Customer master and never from the request: it is the master\'s, and a later edit of the master changes what a later assignment shows', async () => {
    world.customerShortNames.set(ACME_ID, 'NEW');
    expect((await service.assignTask(LEAD_ID, input())).customer.shortName).toBe('NEW');
  });

  it('if the estimate cannot be made, no task exists and the number goes back (one transaction)', async () => {
    world.failNextEstimateWith(new Error('invented late failure'));
    await expect(service.assignTask(LEAD_ID, input())).rejects.toThrow('invented late failure');
    expect(world.tasks).toHaveLength(0);
    expect(world.estimates).toHaveLength(0);
    expect(world.sequences.size).toBe(0);
    // Nothing of the assignment was written: not the task, not its subject, not the customer on the estimate (AC-6).
    expect((await service.assignTask(LEAD_ID, input())).code).toBe('Q-2026-0001');
  });
});

describe('AC-2: the code is Q, the year in IST and the running number', () => {
  it('numbers tasks one after another in a year', async () => {
    const codes = [
      (await service.assignTask(LEAD_ID, input())).code,
      (await service.assignTask(LEAD_ID, input({ engineerId: PRIYA.id }))).code,
      (await service.assignTask(LEAD_ID, input())).code,
    ];
    expect(codes).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0003']);
  });

  it('gives two assignments at the same moment different codes', async () => {
    const both = await Promise.all([service.assignTask(LEAD_ID, input()), service.assignTask(LEAD_ID, input({ engineerId: PRIYA.id }))]);
    expect(new Set(both.map((task) => task.code)).size).toBe(2);
  });

  it('takes the year in IST: 2026-12-31 18:31 UTC is 00:01 on 1 January 2027, so the code is a 2027 code and restarts at 0001', async () => {
    expect((await service.assignTask(LEAD_ID, input())).code).toBe('Q-2026-0001');
    clock.set(new Date('2026-12-31T18:31:00.000Z'));
    expect((await service.assignTask(LEAD_ID, input({ deadline: '2027-01-05T10:00' }))).code).toBe('Q-2027-0001');
  });

  it('is still a 2026 code at 2026-12-31 18:29 UTC (23:59 IST)', async () => {
    clock.set(new Date('2026-12-31T18:29:00.000Z'));
    expect((await service.assignTask(LEAD_ID, input({ deadline: '2027-01-05T10:00' }))).code).toBe('Q-2026-0001');
  });
});

describe('AC-3: what is refused, with the words of the spec, and nothing stored', () => {
  it('names every field at once for an empty form', async () => {
    const fields = await fieldsOf(service.assignTask(LEAD_ID, input({ engineerId: '', customerId: '', folderPath: '', deadline: '', title: '', subject: '' })));
    expect(fields).toEqual({
      engineerId: 'Choose an Engineer.',
      customerId: 'Choose a customer.',
      title: 'Enter a title.',
      subject: 'Enter the subject.',
      folderPath: 'Enter the network folder path. It starts with two backslashes, like \\\\server\\share\\RFQ-123.',
      deadline: 'Choose a deadline later than now.',
    });
    expect(world.tasks).toHaveLength(0);
  });

  it('checks the deadline against the server clock: a deadline that was later when the form was filled but is not now is refused', async () => {
    clock.set(new Date('2026-11-12T11:30:00.000Z'));
    expect(await fieldsOf(service.assignTask(LEAD_ID, input()))).toEqual({ deadline: 'Choose a deadline later than now.' });
    clock.set(new Date('2026-11-12T11:29:00.000Z'));
    await expect(service.assignTask(LEAD_ID, input())).resolves.toMatchObject({ code: 'Q-2026-0001' });
  });

  it('refuses a title and notes that are too long', async () => {
    expect(await fieldsOf(service.assignTask(LEAD_ID, input({ title: 'T'.repeat(121), notes: 'N'.repeat(1_001) })))).toEqual({
      title: 'Keep the title under 120 characters.',
      notes: 'Keep the notes under 1,000 characters.',
    });
  });

  it.each([
    ['an inactive Engineer', GONE.id],
    ['a Lead', BOSS.id],
    ['an ID nobody has', '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', 'not-an-id'],
  ])('refuses %s with "Choose an Engineer." under the Engineer field, and stores nothing', async (_name, engineerId) => {
    expect(await fieldsOf(service.assignTask(LEAD_ID, input({ engineerId })))).toEqual({ engineerId: 'Choose an Engineer.' });
    expect(world.tasks).toHaveLength(0);
    expect(world.sequences.size).toBe(0);
  });

  it.each([
    ['a customer nobody has', '00000000-0000-4000-8000-00000000dead'],
    ['a customer the Admin has deleted', GONE_CUSTOMER_ID],
    ['text that is not an ID', 'not-an-id'],
  ])('refuses %s with "Choose a customer." under customerId, and stores nothing (AC-5)', async (_name, customerId) => {
    expect(await fieldsOf(service.assignTask(LEAD_ID, input({ customerId })))).toEqual({ customerId: 'Choose a customer.' });
    expect(world.tasks).toHaveLength(0);
    expect(world.estimates).toHaveLength(0);
    expect(world.sequences.size).toBe(0);
  });

  it('names a wrong Engineer and a wrong customer together, and a customer deleted after the page was opened is refused', async () => {
    expect(await fieldsOf(service.assignTask(LEAD_ID, input({ engineerId: GONE.id, customerId: GONE_CUSTOMER_ID })))).toEqual({
      engineerId: 'Choose an Engineer.',
      customerId: 'Choose a customer.',
    });
    world.deletedCustomers.add(ACME_ID);
    expect(await fieldsOf(service.assignTask(LEAD_ID, input()))).toEqual({ customerId: 'Choose a customer.' });
  });

  it('refuses a subject over SUBJECT_MAX_LENGTH, with the number from the constant, and accepts exactly that many', async () => {
    expect(await fieldsOf(service.assignTask(LEAD_ID, input({ subject: 'S'.repeat(81) })))).toEqual({ subject: 'Keep the subject under 80 characters.' });
    await expect(service.assignTask(LEAD_ID, input({ subject: 'S'.repeat(80) }))).resolves.toMatchObject({ subject: 'S'.repeat(80) });
  });

  it('refuses an Engineer who was deactivated after the page was opened', async () => {
    people = [ARJUN, { ...PRIYA, isActive: false }];
    expect(await fieldsOf(service.assignTask(LEAD_ID, input({ engineerId: PRIYA.id })))).toEqual({ engineerId: 'Choose an Engineer.' });
  });
});

describe('AC-4, AC-6: the link is built on the server, and text is kept as typed', () => {
  it('builds the file link from the path', async () => {
    expect((await service.assignTask(LEAD_ID, input())).folderUrl).toBe('file:////invented-server/invented-share/RFQ-123');
  });

  it('keeps script text in the title and notes as plain text, unchanged', async () => {
    const assigned = await service.assignTask(LEAD_ID, input({ title: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>' }));
    expect([assigned.title, assigned.notes]).toEqual(['<script>alert(1)</script>', '<img src=x onerror=alert(1)>']);
  });

  it('refuses a javascript: address and a path with script text in it: there is no link to make', async () => {
    expect(Object.keys(await fieldsOf(service.assignTask(LEAD_ID, input({ folderPath: 'javascript:alert(1)' }))))).toEqual(['folderPath']);
    expect(Object.keys(await fieldsOf(service.assignTask(LEAD_ID, input({ folderPath: '\\\\server\\share\\<script>' }))))).toEqual(['folderPath']);
  });
});

describe('the Customer Name field offers the customers that are not deleted, by name, with their short names', () => {
  it('lists id, name and short name only, in name order, and not a deleted customer', async () => {
    world.customers.set('00000000-0000-4000-8000-0000000000c3', 'Another Works');
    const context = await service.getAssignContext();
    expect(context.customers).toEqual([
      { id: '00000000-0000-4000-8000-0000000000c3', name: 'Another Works', shortName: 'SHORT' },
      { id: ACME_ID, name: 'Invented Acme', shortName: 'ACM' },
    ]);
    expect(Object.keys(defined(context.customers[0])).sort()).toEqual(['id', 'name', 'shortName']);
  });
});

describe('the Engineer field offers the active Engineers by name', () => {
  it('lists the active Engineers, by ID and name only, and not a Lead or a deactivated person', async () => {
    const context = await service.getAssignContext();
    expect(context.engineers).toEqual([
      { id: ARJUN.id, name: ARJUN.name },
      { id: PRIYA.id, name: PRIYA.name },
    ]);
    expect(defined(context.engineers[0])).not.toHaveProperty('email');
  });
});
