import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { createFixedClock, type FixedClock } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { AUDIT_EVENTS } from '@/server/services/audit-events';
import type { AuditService } from '@/server/services/audit-service';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { AUDIT_REQUEST_ID, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { insertAssignCustomer } from '../../support/assign-customer';

/**
 * STORY-04.07 (AC-3 to AC-8; FR-040, NFR-007; architecture sections 4.4, 5.1 and 8) against real PostgreSQL in a throwaway database, as the runtime role: a reassign is one
 * transaction under the estimate's and the task's real row locks, so the Engineer, the deadline, the revision and the audit entry exist together or not at all; an unchanged
 * value is not judged (an overdue task can be given to another Engineer); an approved task is refused, including one approved while the call waited for the lock; two saves at once
 * are serialised, each entry's "before" being the one before's "after"; and the Engineers see the task where it belongs afterwards. Every lock-wait test holds the lock until
 * `pg_locks` shows the call waiting, so it fails if the call does not take the lock. Every name, path and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
/** 17:00 IST on 12 November. */
const DEADLINE = '2026-11-12T11:30:00.000Z';
const LATER = '2026-11-13T18:00:00.000Z';

let db: AuditDatabase;
let service: TaskService;
let clock: FixedClock;
let leadId: string;
let otherLeadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let meeraId: string;
let goneId: string;
let taskId: string;
let customerId: string;

const by = (actorId: string, actorLabel: string) => ({ actorId, actorLabel, requestId: AUDIT_REQUEST_ID });
const asLead = () => by(leadId, 'Invented Reassign Lead');

beforeAll(async () => {
  db = await openAuditDatabase();
  clock = createFixedClock(NOW);
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock, audit: db.audit });
  leadId = await insertPersonAsOwner(db, 'Reassign Lead', 'LEAD');
  otherLeadId = await insertPersonAsOwner(db, 'Reassign Other Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Reassign Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Reassign Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Reassign Priya', 'ENGINEER');
  meeraId = await insertPersonAsOwner(db, 'Reassign Meera', 'ENGINEER');
  goneId = await insertPersonAsOwner(db, 'Reassign Gone', 'ENGINEER', false);
  customerId = await insertAssignCustomer(db.owner, 'Reassign Customer');
});

afterAll(async () => {
  await db.close();
});

/** A fresh task for each test: assigned by the Lead to Arjun, due at 17:00 IST on 12 November, with the first number of the year. */
beforeEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query('DELETE FROM task_sequences');
  clock.set(NOW);
  const assigned = await service.assignTask(leadId, { engineerId: arjunId, customerId, folderPath: PATH, deadline: '2026-11-12T17:00', title: 'Hopper cover', subject: 'Feed hopper', notes: 'Invented notes.' });
  taskId = assigned.id;
});

interface TaskRow {
  readonly engineer_id: string;
  readonly deadline_at: Date;
  readonly assignment_revision: number;
  readonly assigned_by: string;
  readonly title: string | null;
  readonly notes: string | null;
  readonly folder_path: string;
}

async function taskRow(): Promise<TaskRow> {
  const { rows } = await db.owner.query<TaskRow>(
    'SELECT engineer_id::text, deadline_at, assignment_revision, assigned_by::text, title, notes, folder_path FROM tasks WHERE id = $1::uuid',
    [taskId],
  );
  return defined(rows[0]);
}

const setStatus = (status: 'DRAFT' | 'SUBMITTED' | 'APPROVED') =>
  db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE task_id = $1::uuid', [taskId, status]);

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  if (!(error instanceof FieldValidationError)) throw new Error('Expected a FieldValidationError.');
  return Object.fromEntries(error.fields.map((problem) => [problem.field, problem.message]));
}

const entries = () => entriesFor(db, taskId);

/** Resolves once a session of this database waits for a lock; throws when none does within the limit (a holder that returned at once could commit before the call asked for the lock). */
async function untilALockWaits(): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const { rows } = await db.owner.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_locks l WHERE NOT l.granted AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())`,
    );
    if (defined(rows[0]).n > 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  throw new Error('No session waited for a lock: the call did not wait for the row lock.');
}

/** A transaction of its own, on its own connection, that holds `lockSql` until `finish` is called: what a concurrent approval or another save looks like to the call under test. */
async function holding(lockSql: string): Promise<{ readonly client: Client; finish(commit?: string): Promise<void> }> {
  const client = new Client({ connectionString: db.database.ownerUrl });
  await client.connect();
  await client.query('BEGIN');
  await client.query(lockSql, [taskId]);
  return {
    client,
    async finish(statement = 'COMMIT') {
      try {
        await client.query(statement);
      } finally {
        await client.end();
      }
    },
  };
}

describe('AC-3: the change is stored whole, in one transaction', () => {
  it('a new Engineer: stored, the revision goes up, the deadline, folder, title, notes and assigner stay; the estimate stays with the task', async () => {
    const before = await db.owner.query<{ id: string; status: string; customer_id: string | null }>('SELECT id::text, status::text, customer_id::text FROM estimates WHERE task_id = $1::uuid', [taskId]);
    const result = await service.reassignTask(asLead(), taskId, { engineerId: priyaId });
    expect(result).toMatchObject({ engineerChanged: true, deadlineChanged: false, assignmentRevision: 2 });
    expect(result.task).toMatchObject({ id: taskId, engineer: { id: priyaId, name: 'Invented Reassign Priya' }, status: 'DRAFT', assignedByName: 'Invented Reassign Lead' });
    const row = await taskRow();
    expect(row).toMatchObject({ engineer_id: priyaId, assignment_revision: 2, assigned_by: leadId, title: 'Hopper cover', notes: 'Invented notes.', folder_path: PATH });
    expect(row.deadline_at.toISOString()).toBe(DEADLINE);
    const after = await db.owner.query('SELECT id::text, status::text, customer_id::text FROM estimates WHERE task_id = $1::uuid', [taskId]);
    expect(after.rows).toEqual(before.rows);
  });

  it('a new deadline: stored as the instant; the Engineer and the revision stay', async () => {
    const result = await service.reassignTask(asLead(), taskId, { deadlineAt: LATER });
    expect(result).toMatchObject({ engineerChanged: false, deadlineChanged: true, assignmentRevision: 1 });
    const row = await taskRow();
    expect(row).toMatchObject({ engineer_id: arjunId, assignment_revision: 1 });
    expect(row.deadline_at.toISOString()).toBe(LATER);
    expect(result.task.deadlineAt.toISOString()).toBe(LATER);
  });

  it('both together: both stored, the revision goes up once', async () => {
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: LATER });
    const row = await taskRow();
    expect(row).toMatchObject({ engineer_id: priyaId, assignment_revision: 2 });
    expect(row.deadline_at.toISOString()).toBe(LATER);
  });

  it('a body with neither field, and one with the values already stored, change nothing: no entry, the revision and the time of change unchanged', async () => {
    const stamp = () => db.owner.query<{ updated_at: Date }>('SELECT updated_at FROM tasks WHERE id = $1::uuid', [taskId]);
    const stampBefore = defined((await stamp()).rows[0]).updated_at;
    const entriesBefore = await entryCount(db);
    for (const input of [{}, { engineerId: arjunId, deadlineAt: DEADLINE }]) {
      expect(await service.reassignTask(asLead(), taskId, input)).toMatchObject({ engineerChanged: false, deadlineChanged: false, assignmentRevision: 1 });
    }
    expect((await taskRow()).assignment_revision).toBe(1);
    expect(defined((await stamp()).rows[0]).updated_at).toEqual(stampBefore);
    expect(await entryCount(db)).toBe(entriesBefore);
  });
});

describe('AC-3 (D-3): the same checks as assigning, and only for what differs', () => {
  it('refuses a deadline that is not later than now, by the server\'s clock, and stores nothing', async () => {
    const entriesBefore = await entryCount(db);
    expect(await fieldsOf(service.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: NOW.toISOString() }))).toEqual({ deadlineAt: 'Choose a deadline later than now.' });
    expect(await taskRow()).toMatchObject({ engineer_id: arjunId, assignment_revision: 1 });
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it('an overdue task is given to another Engineer with its past deadline unchanged: accepted, with the Engineer change and nothing else', async () => {
    clock.set(new Date('2026-11-20T00:00:00.000Z'));
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: DEADLINE });
    const row = await taskRow();
    expect(row).toMatchObject({ engineer_id: priyaId, assignment_revision: 2 });
    expect(row.deadline_at.toISOString()).toBe(DEADLINE);
    // And a changed deadline in the past is still refused on the same task.
    expect(await fieldsOf(service.reassignTask(asLead(), taskId, { deadlineAt: '2026-11-19T00:00:00.000Z' }))).toEqual({ deadlineAt: 'Choose a deadline later than now.' });
  });

  it.each([
    ['a deactivated Engineer', () => goneId],
    ['a Lead', () => otherLeadId],
    ['an Admin', () => adminId],
    ['an ID nobody has', () => '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', () => 'not-an-id'],
  ])('refuses %s as "Choose an Engineer." under the field, and stores nothing', async (_name, who) => {
    expect(await fieldsOf(service.reassignTask(asLead(), taskId, { engineerId: who() }))).toEqual({ engineerId: 'Choose an Engineer.' });
    expect(await taskRow()).toMatchObject({ engineer_id: arjunId, assignment_revision: 1 });
  });

  it('a task whose Engineer was deactivated since can still have its deadline moved', async () => {
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [arjunId]);
    try {
      await service.reassignTask(asLead(), taskId, { engineerId: arjunId, deadlineAt: LATER });
      expect((await taskRow()).deadline_at.toISOString()).toBe(LATER);
    } finally {
      await db.owner.query('UPDATE users SET is_active = true WHERE id = $1::uuid', [arjunId]);
    }
  });

  it('a task that is not there is a 404, whether the ID is unknown or is no ID', async () => {
    for (const id of ['00000000-0000-4000-8000-00000000dead', 'not-an-id']) {
      await expect(service.reassignTask(asLead(), id, { engineerId: priyaId })).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});

describe('AC-4: one audit entry for one save, in the same transaction', () => {
  it('an Engineer change: one entry by the person who saved, about the task code, with the Engineer before and after, read as "Name to Name"', async () => {
    await service.reassignTask(by(otherLeadId, 'Invented Reassign Other Lead'), taskId, { engineerId: priyaId });
    const written = await entries();
    expect(written).toHaveLength(1);
    const entry = defined(written[0]);
    expect(entry).toMatchObject({
      event: 'task.reassigned',
      actor_id: otherLeadId,
      actor_label: 'Invented Reassign Other Lead',
      object_type: 'task',
      object_id: taskId,
      object_label: 'Q-2026-0001',
      request_id: AUDIT_REQUEST_ID,
      before: { engineer: { id: arjunId, name: 'Invented Reassign Arjun' }, deadlineAt: DEADLINE },
      after: { engineer: { id: priyaId, name: 'Invented Reassign Priya' }, deadlineAt: DEADLINE },
    });
    expect(AUDIT_EVENTS['task.reassigned'].describeStored(entry.before, entry.after)).toEqual({ before: 'Invented Reassign Arjun', after: 'Invented Reassign Priya' });
  });

  it('a deadline change: one entry with the two instants, read in IST (a 23:30 IST deadline is 23:30, not the next UTC day)', async () => {
    await service.reassignTask(by(adminId, 'Invented Reassign Admin'), taskId, { deadlineAt: LATER });
    const written = await entries();
    expect(written).toHaveLength(1);
    const entry = defined(written[0]);
    expect(entry).toMatchObject({ actor_id: adminId, before: { deadlineAt: DEADLINE }, after: { deadlineAt: LATER } });
    expect(AUDIT_EVENTS['task.reassigned'].describeStored(entry.before, entry.after)).toEqual({ before: '12 Nov 2026, 17:00 IST', after: '13 Nov 2026, 23:30 IST' });
  });

  it('a change of both is one entry, reading both', async () => {
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: LATER });
    const written = await entries();
    expect(written).toHaveLength(1);
    const entry = defined(written[0]);
    expect(AUDIT_EVENTS['task.reassigned'].describeStored(entry.before, entry.after)).toEqual({
      before: 'Invented Reassign Arjun, 12 Nov 2026, 17:00 IST',
      after: 'Invented Reassign Priya, 13 Nov 2026, 23:30 IST',
    });
  });

  it('keeps no cost, folder path, notes, title or e-mail address in the stored entry', async () => {
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: LATER });
    const entry = defined((await entries())[0]);
    const text = `${entry.before_text}${entry.after_text}${entry.object_label}`;
    for (const word of ['Invented notes', 'Hopper cover', 'RFQ-123', 'invented-server', '@', 'price', 'cost']) expect(text, word).not.toContain(word);
  });

  it('a change that cannot be recorded does not happen: the audit service refuses, and the task, the revision and the log are as they were', async () => {
    const refusing: AuditService = { ...db.audit, record: () => Promise.reject(new Error('Invented audit failure.')) };
    const failing = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock, audit: refusing });
    const entriesBefore = await entryCount(db);
    await expect(failing.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: LATER })).rejects.toThrow('Invented audit failure.');
    expect(await taskRow()).toMatchObject({ engineer_id: arjunId, assignment_revision: 1 });
    expect((await taskRow()).deadline_at.toISOString()).toBe(DEADLINE);
    expect(await entryCount(db)).toBe(entriesBefore);
  });
});

describe('AC-5 (A-09): the assignment revision', () => {
  it('goes up with each change of Engineer and not with a change of deadline', async () => {
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId });
    await service.reassignTask(asLead(), taskId, { deadlineAt: LATER });
    expect((await taskRow()).assignment_revision).toBe(2);
    await service.reassignTask(asLead(), taskId, { engineerId: arjunId });
    expect((await taskRow()).assignment_revision).toBe(3);
  });
});

describe('AC-6 (A-14): an approved task cannot be changed', () => {
  it('is refused with 409 TASK_CLOSED, and nothing changes: the task, the revision and the log', async () => {
    await setStatus('APPROVED');
    const entriesBefore = await entryCount(db);
    const error = await service.reassignTask(asLead(), taskId, { engineerId: priyaId, deadlineAt: LATER }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: 'TASK_CLOSED' });
    expect(await taskRow()).toMatchObject({ engineer_id: arjunId, assignment_revision: 1 });
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it.each(['DRAFT', 'SUBMITTED'] as const)('lets a %s task be changed (A-3)', async (status) => {
    await setStatus(status);
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId });
    expect((await taskRow()).engineer_id).toBe(priyaId);
  });

  it('an approval that is committing when the save asks for the lock is seen: the save waits, then is refused with 409, and nothing changes', async () => {
    const approval = await holding('SELECT id FROM estimates WHERE task_id = $1::uuid FOR UPDATE');
    let call: Promise<unknown> | undefined;
    try {
      call = service.reassignTask(asLead(), taskId, { engineerId: priyaId }).then(
        () => undefined,
        (thrown: unknown) => thrown,
      );
      await untilALockWaits();
      await approval.client.query("UPDATE estimates SET status = 'APPROVED' WHERE task_id = $1::uuid", [taskId]);
    } finally {
      await approval.finish();
    }
    const error = await call;
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: 'TASK_CLOSED' });
    expect(await taskRow()).toMatchObject({ engineer_id: arjunId, assignment_revision: 1 });
  });

  it('a save that waited for an estimate lock that ends without an approval goes through', async () => {
    const holder = await holding('SELECT id FROM estimates WHERE task_id = $1::uuid FOR UPDATE');
    let call: Promise<unknown> | undefined;
    try {
      call = service.reassignTask(asLead(), taskId, { engineerId: priyaId });
      await untilALockWaits();
    } finally {
      await holder.finish();
    }
    await call;
    expect((await taskRow()).engineer_id).toBe(priyaId);
  });
});

describe('AC-3: two saves at once are serialised under the task\'s row lock', () => {
  it('waits for another transaction that holds the task row, and applies after it', async () => {
    const holder = await holding('SELECT id FROM tasks WHERE id = $1::uuid FOR UPDATE');
    let call: Promise<unknown> | undefined;
    try {
      call = service.reassignTask(asLead(), taskId, { engineerId: priyaId });
      await untilALockWaits();
      // Still as it was while the lock is held.
      expect((await taskRow()).engineer_id).toBe(arjunId);
    } finally {
      await holder.finish();
    }
    await call;
    expect((await taskRow()).engineer_id).toBe(priyaId);
  });

  it('two Leads saving at once: both are applied one after the other, and each entry\'s "before" is the one before\'s "after" (no lost update)', async () => {
    const results = await Promise.all([
      service.reassignTask(by(leadId, 'Invented Reassign Lead'), taskId, { engineerId: priyaId }),
      service.reassignTask(by(otherLeadId, 'Invented Reassign Other Lead'), taskId, { engineerId: meeraId }),
    ]);
    expect(results.map((result) => result.assignmentRevision).sort()).toEqual([2, 3]);
    const written = (await entries()).map((entry) => entry as unknown as { before: { engineer: { id: string } }; after: { engineer: { id: string } } });
    expect(written).toHaveLength(2);
    // The order of the two is told by what each saw, not by the time stamp: the one that saw Arjun went first, and the other saw what the first made.
    const first = defined(written.find((entry) => entry.before.engineer.id === arjunId));
    const second = defined(written.find((entry) => entry !== first));
    expect(second.before.engineer.id).toBe(first.after.engineer.id);
    expect((await taskRow()).engineer_id).toBe(second.after.engineer.id);
    expect((await taskRow()).assignment_revision).toBe(3);
  });

  it('a save and the estimate workflow\'s lock order cannot deadlock: a transaction that takes the estimate and then the task, as the workflow does, and a save at once both finish', async () => {
    const workflow = await holding('SELECT e.id FROM estimates e JOIN tasks t ON t.id = e.task_id WHERE t.id = $1::uuid FOR UPDATE OF e FOR SHARE OF t');
    let call: Promise<unknown> | undefined;
    try {
      call = service.reassignTask(asLead(), taskId, { engineerId: priyaId });
      await untilALockWaits();
    } finally {
      await workflow.finish();
    }
    await call;
    expect((await taskRow()).engineer_id).toBe(priyaId);
  });
});

describe('AC-8: who sees it now', () => {
  it('the old Engineer no longer sees the task in any tab or by a direct open; the new one sees it in Open with its status, and no price', async () => {
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId });
    const arjun = { id: arjunId, role: 'ENGINEER' } as const;
    const priya = { id: priyaId, role: 'ENGINEER' } as const;
    for (const tab of ['open', 'closed', 'overdue'] as const) expect((await service.listQueue(arjun, { tab })).tasks, tab).toHaveLength(0);
    expect(await service.getTask(arjun, taskId)).toBeNull();
    const queue = await service.listQueue(priya, { tab: 'open' });
    expect(queue.tasks.map((task) => task.code)).toEqual(['Q-2026-0001']);
    expect(Object.keys(defined(queue.tasks[0])).sort()).toEqual(
      ['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'status', 'title'],
    );
    expect(await service.getTask(priya, taskId)).toMatchObject({ code: 'Q-2026-0001', status: 'DRAFT', notes: 'Invented notes.' });
  });

  it('a task reassigned while SUBMITTED keeps its status and reaches the new Engineer as SUBMITTED', async () => {
    await setStatus('SUBMITTED');
    await service.reassignTask(asLead(), taskId, { engineerId: priyaId });
    expect(await service.getTask({ id: priyaId, role: 'ENGINEER' }, taskId)).toMatchObject({ status: 'SUBMITTED' });
  });
});
