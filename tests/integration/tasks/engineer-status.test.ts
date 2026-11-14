import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createFixedClock } from '@/lib/time';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createTaskService, type QueueViewer, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-04.04 T6 (AC-1, AC-3, AC-4, AC-5) against real PostgreSQL in a throwaway database: one task and the status of its estimate through the real task service and
 * repository. The status is read from `estimates.status` in every state, and again after the estimate changes (an unlock puts an approved one back to DRAFT); an
 * Engineer is answered with their own task only, and another Engineer's task, an unknown ID and text that is no ID are all the same `null`; a Lead and an Admin open any,
 * with the same fields; and the answer has exactly the named fields, the customer's name included, whatever else is stored for the task. Every name, path and date is
 * invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const DEADLINE = new Date('2026-11-12T11:30:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';

type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

let db: AuthDatabase;
let service: TaskService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let customerId: string;

const asEngineer = (id: string): QueueViewer => ({ id, role: 'ENGINEER' });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: createTransactionRunner(db.prisma), clock: createFixedClock(NOW) });
  leadId = await insertPersonAsOwner(db, 'Status Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Status Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Status Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Status Priya', 'ENGINEER');
  const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented status customer') RETURNING id::text");
  customerId = defined(customer.rows[0]).id;
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

/** A task and its estimate in any state; returns the task's ID. */
async function seed(code: string, engineerId: string, status: Status, chosenCustomerId: string | null = null, notes: string | null = null): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    'INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, notes) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7) RETURNING id::text',
    [code, engineerId, leadId, PATH, DEADLINE, 'Hopper cover', notes],
  );
  const id = defined(task.rows[0]).id;
  await db.owner.query('INSERT INTO estimates (task_id, customer_id, status) VALUES ($1::uuid, $2::uuid, $3::estimate_status)', [id, chosenCustomerId, status]);
  return id;
}

describe('AC-1: the status is the estimate\'s, in every state', () => {
  it.each(['DRAFT', 'SUBMITTED', 'APPROVED'] as const)('an Engineer opens their own %s task and is told %s', async (status) => {
    const id = await seed('Q-2026-0001', arjunId, status);
    expect((await service.getTask(asEngineer(arjunId), id))?.status).toBe(status);
  });

  it('reads the status again on every call: approved, then unlocked back to DRAFT, is DRAFT at once (nothing is stored on the task)', async () => {
    const id = await seed('Q-2026-0001', arjunId, 'APPROVED');
    expect((await service.getTask(asEngineer(arjunId), id))?.status).toBe('APPROVED');
    await db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE task_id = $1::uuid', [id, 'DRAFT']);
    expect((await service.getTask(asEngineer(arjunId), id))?.status).toBe('DRAFT');
  });

  it('answers the task\'s own fields: the notes, the customer\'s name, the two people\'s names, the folder link and the deadline as an instant', async () => {
    const id = await seed('Q-2026-0001', arjunId, 'SUBMITTED', customerId, 'Sheet metal only.');
    expect(await service.getTask(asEngineer(arjunId), id)).toEqual({
      id,
      code: 'Q-2026-0001',
      title: 'Hopper cover',
      notes: 'Sheet metal only.',
      engineer: { id: arjunId, name: 'Status Arjun' },
      customerName: 'Invented status customer',
      folderPath: PATH,
      folderUrl: 'file:////invented-server/invented-share/RFQ-123',
      deadlineAt: DEADLINE,
      status: 'SUBMITTED',
      assignedByName: 'Status Lead',
    });
  });
});

describe('AC-4: another Engineer\'s task is the same answer as one that does not exist', () => {
  it('is null for another Engineer\'s task, an unknown ID and text that is no UUID (which PostgreSQL would refuse as a statement)', async () => {
    const others = await seed('Q-2026-0002', priyaId, 'SUBMITTED');
    const viewer = asEngineer(arjunId);
    expect(await Promise.all([service.getTask(viewer, others), service.getTask(viewer, UNKNOWN_ID), service.getTask(viewer, 'not-an-id'), service.getTask(viewer, '')])).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('a viewer whose own ID is not a UUID is answered with nothing, and does not make the statement fail', async () => {
    const id = await seed('Q-2026-0001', arjunId, 'DRAFT');
    expect(await service.getTask(asEngineer('not-an-id'), id)).toBeNull();
  });
});

describe('AC-3, AC-5: a Lead and an Admin open any task, with the same fields as the Engineer', () => {
  it.each([
    ['LEAD', () => leadId],
    ['ADMIN', () => adminId],
  ] as const)('%s opens an Engineer\'s task and is told what the Engineer is told', async (role, personId) => {
    const id = await seed('Q-2026-0001', arjunId, 'APPROVED', customerId, 'Sheet metal only.');
    const own = await service.getTask(asEngineer(arjunId), id);
    const seen = await service.getTask({ id: personId(), role }, id);
    expect(seen).toEqual(own);
    expect(seen?.status).toBe('APPROVED');
  });

  it('has exactly the named fields, for an approved task with a customer', async () => {
    const id = await seed('Q-2026-0001', arjunId, 'APPROVED', customerId);
    expect(Object.keys(defined(await service.getTask(asEngineer(arjunId), id))).sort()).toEqual([
      'assignedByName',
      'code',
      'customerName',
      'deadlineAt',
      'engineer',
      'folderPath',
      'folderUrl',
      'id',
      'notes',
      'status',
      'title',
    ]);
  });
});
