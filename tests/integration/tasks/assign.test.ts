import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import type { AssignInput } from '@/lib/tasks/assign';
import { createFixedClock } from '@/lib/time';
import { createTaskRepository, type TaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-04.01 T1, T3, T7 (AC-1, AC-2, AC-3, AC-5) against real PostgreSQL in a throwaway database: what the three tables keep whoever writes to them (a UNC
 * path, the lengths, one code, one estimate per task, the foreign keys, no DELETE for the runtime role), and the task service over the real repository (a task
 * and its empty estimate in one transaction that rolls back whole, a code from the locked sequence that two requests at once cannot share, the year taken in
 * IST, an inactive or non-Engineer person refused). Every name, path and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let repository: TaskRepository;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let inactiveId: string;

const clock = createFixedClock(NOW);
let service: TaskService;

const input = (overrides: Partial<AssignInput> = {}): AssignInput => ({
  engineerId: arjunId,
  folderPath: PATH,
  deadline: '2026-11-12T17:00',
  title: 'Hopper cover',
  notes: 'Sheet-metal parts only.',
  ...overrides,
});

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createTaskRepository(db.prisma);
  service = createTaskService({ tasks: repository, transactions: createTransactionRunner(db.prisma), clock });
  leadId = await insertPersonAsOwner(db, 'Task Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Task Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Task Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Task Priya', 'ENGINEER');
  inactiveId = await insertPersonAsOwner(db, 'Task Gone', 'ENGINEER', false);
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  clock.set(NOW);
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query('DELETE FROM task_sequences');
});

const count = async (table: 'tasks' | 'estimates' | 'task_sequences'): Promise<number> => {
  const { rows } = await db.owner.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`);
  return Number(rows[0]?.n);
};

const insertTask = (code: string, folderPath: string, title: string | null = null, notes: string | null = null) =>
  db.owner.query(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, notes) VALUES ($1, $2::uuid, $3::uuid, $4, now(), $5, $6) RETURNING id::text`,
    [code, arjunId, leadId, folderPath, title, notes],
  );

describe('AC-1 (T1): what the tables keep, whoever writes to them', () => {
  it('accepts a UNC path, with or without a trailing backslash, and refuses a path that is not one', async () => {
    await insertTask('Q-2026-9001', '\\\\server\\share');
    await insertTask('Q-2026-9002', '\\\\server\\share\\folder\\');
    for (const [index, path] of ['server\\share', '\\\\server', '\\server\\share', '//server/share', 'C:\\folder'].entries()) {
      await expect(insertTask(`Q-2026-910${index}`, path), path).rejects.toMatchObject({ constraint: 'ck_tasks_folder_path_is_unc' });
    }
  });

  it('refuses a title over 120 characters, notes over 1,000, a path over 500, and keeps the limits themselves', async () => {
    await insertTask('Q-2026-9003', PATH, 'T'.repeat(120), 'N'.repeat(1_000));
    await expect(insertTask('Q-2026-9004', PATH, 'T'.repeat(121))).rejects.toMatchObject({ constraint: 'ck_tasks_title_length' });
    await expect(insertTask('Q-2026-9005', PATH, null, 'N'.repeat(1_001))).rejects.toMatchObject({ constraint: 'ck_tasks_notes_length' });
    await expect(insertTask('Q-2026-9006', `\\\\server\\share\\${'a'.repeat(500)}`)).rejects.toMatchObject({ constraint: 'ck_tasks_folder_path_length' });
  });

  it('holds one task per code, a person for both foreign keys, and one estimate per task', async () => {
    const { rows } = await insertTask('Q-2026-9007', PATH);
    const taskId = defined(rows[0]).id;
    await expect(insertTask('Q-2026-9007', PATH)).rejects.toMatchObject({ constraint: 'uq_tasks_code' });
    const nobody = '00000000-0000-4000-8000-00000000dead';
    await expect(
      db.owner.query('INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $3::uuid, $4, now())', ['Q-2026-9008', nobody, leadId, PATH]),
    ).rejects.toMatchObject({ constraint: 'fk_tasks_engineer_id' });
    await expect(
      db.owner.query('INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $3::uuid, $4, now())', ['Q-2026-9009', arjunId, nobody, PATH]),
    ).rejects.toMatchObject({ constraint: 'fk_tasks_assigned_by' });
    await db.owner.query('INSERT INTO estimates (task_id) VALUES ($1::uuid)', [taskId]);
    await expect(db.owner.query('INSERT INTO estimates (task_id) VALUES ($1::uuid)', [taskId])).rejects.toMatchObject({ constraint: 'uq_estimates_task_id' });
    await expect(db.owner.query('INSERT INTO estimates (task_id) VALUES ($1::uuid)', [nobody])).rejects.toMatchObject({ constraint: 'fk_estimates_task_id' });
  });

  it('starts an estimate in DRAFT with no customer and an inputs revision of 0, and a task at assignment revision 1', async () => {
    const { rows } = await insertTask('Q-2026-9010', PATH);
    const taskId = defined(rows[0]).id;
    const estimate = await db.owner.query<{ status: string; customer_id: string | null; inputs_revision: number }>(
      'INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING status::text, customer_id::text, inputs_revision',
      [taskId],
    );
    expect(estimate.rows[0]).toEqual({ status: 'DRAFT', customer_id: null, inputs_revision: 0 });
    const task = await db.owner.query<{ assignment_revision: number }>('SELECT assignment_revision FROM tasks WHERE id = $1::uuid', [taskId]);
    expect(task.rows[0]?.assignment_revision).toBe(1);
  });

  it('keeps a sequence to one row per four-digit year with at least one number issued', async () => {
    await expect(db.owner.query('INSERT INTO task_sequences (year, last_value) VALUES (1999, 1)')).rejects.toMatchObject({ constraint: 'ck_task_sequences_year' });
    await expect(db.owner.query('INSERT INTO task_sequences (year, last_value) VALUES (2026, 0)')).rejects.toMatchObject({ constraint: 'ck_task_sequences_last_value_positive' });
  });

  it('gives the runtime role no DELETE and no TRUNCATE on the three tables, and read, insert and update', async () => {
    const privileges = await db.owner.query<{ tableName: string; privilege: string; granted: boolean }>(
      `SELECT t AS "tableName", p AS privilege, has_table_privilege('accucut_app', t, p) AS granted
       FROM unnest(ARRAY['tasks', 'estimates', 'task_sequences']) AS t, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p`,
    );
    for (const table of ['tasks', 'estimates', 'task_sequences']) {
      const granted = Object.fromEntries(privileges.rows.filter((row) => row.tableName === table).map((row) => [row.privilege, row.granted]));
      expect(granted, table).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: false, TRUNCATE: false });
    }
  });
});

describe('AC-1 (T3, T7): a task and its empty estimate are one transaction', () => {
  it('stores the task for the Engineer, assigned by the caller, with the deadline in UTC, and an empty DRAFT estimate', async () => {
    const assigned = await service.assignTask(leadId, input());
    expect(assigned).toMatchObject({ code: 'Q-2026-0001', engineer: { id: arjunId, name: 'Invented Task Arjun' }, estimate: { status: 'DRAFT', customerId: null } });
    const { rows } = await db.owner.query<{ engineer_id: string; assigned_by: string; deadline_at: Date; folder_path: string; title: string; estimate_status: string; customer_id: string | null }>(
      `SELECT t.engineer_id::text, t.assigned_by::text, t.deadline_at, t.folder_path, t.title, e.status::text AS estimate_status, e.customer_id::text
       FROM tasks t JOIN estimates e ON e.task_id = t.id WHERE t.code = 'Q-2026-0001'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ engineer_id: arjunId, assigned_by: leadId, folder_path: PATH, title: 'Hopper cover', estimate_status: 'DRAFT', customer_id: null });
    expect(rows[0]?.deadline_at.toISOString()).toBe('2026-11-12T11:30:00.000Z');
  });

  it('records an Admin as the one who assigned', async () => {
    await service.assignTask(adminId, input());
    const { rows } = await db.owner.query<{ assigned_by: string }>('SELECT assigned_by::text FROM tasks');
    expect(rows).toEqual([{ assigned_by: adminId }]);
  });

  it('rolls back the task and the number when the estimate cannot be made: neither exists afterwards', async () => {
    clock.set(new Date('2031-03-01T10:00:00.000Z'));
    const failing = createTaskService({
      tasks: { ...repository, createEstimate: () => Promise.reject(new Error('invented late failure')) },
      transactions: createTransactionRunner(db.prisma),
      clock,
    });
    await expect(failing.assignTask(leadId, input({ deadline: '2031-03-05T10:00' }))).rejects.toThrow('invented late failure');
    expect([await count('tasks'), await count('estimates'), await count('task_sequences')]).toEqual([0, 0, 0]);
    expect((await service.assignTask(leadId, input({ deadline: '2031-03-05T10:00' }))).code).toBe('Q-2031-0001');
  });

  it('rolls back the task and the estimate when the number cannot be issued', async () => {
    const failing = createTaskService({
      tasks: { ...repository, createTask: () => Promise.reject(new Error('invented insert failure')) },
      transactions: createTransactionRunner(db.prisma),
      clock,
    });
    await expect(failing.assignTask(leadId, input())).rejects.toThrow('invented insert failure');
    expect([await count('tasks'), await count('estimates'), await count('task_sequences')]).toEqual([0, 0, 0]);
  });
});

describe('AC-2 (T7): codes are unique, from the locked sequence, with the year taken in IST', () => {
  it('numbers one after another', async () => {
    const codes: string[] = [];
    for (const engineerId of [arjunId, priyaId, arjunId]) codes.push((await service.assignTask(leadId, input({ engineerId }))).code);
    expect(codes).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2026-0003']);
  });

  it('gives twelve assignments at the same moment twelve different codes, none skipped', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => service.assignTask(index % 2 === 0 ? leadId : adminId, input({ engineerId: index % 3 === 0 ? arjunId : priyaId }))));
    const codes = results.map((task) => task.code).sort();
    expect(new Set(codes).size).toBe(12);
    expect(codes).toEqual(Array.from({ length: 12 }, (_, index) => `Q-2026-${String(index + 1).padStart(4, '0')}`));
    expect(await count('tasks')).toBe(12);
    expect(await count('estimates')).toBe(12);
  });

  it('makes the first assignment of the new year in IST a 2027 code: 2026-12-31 18:31 UTC is 00:01 on 1 January 2027', async () => {
    await service.assignTask(leadId, input());
    clock.set(new Date('2026-12-31T18:31:00.000Z'));
    const first = await service.assignTask(leadId, input({ deadline: '2027-01-05T10:00' }));
    expect(first.code).toBe('Q-2027-0001');
    clock.set(new Date('2026-12-31T18:29:00.000Z'));
    expect((await service.assignTask(leadId, input({ deadline: '2027-01-05T10:00' }))).code).toBe('Q-2026-0002');
  });
});

describe('AC-3 (T3): who can be assigned', () => {
  it.each([
    ['an inactive Engineer', () => inactiveId],
    ['a Lead', () => leadId],
    ['an Admin', () => adminId],
    ['an ID nobody has', () => '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', () => 'not-an-id'],
  ])('refuses %s with a 422 under the Engineer field and stores nothing', async (_name, engineerOf) => {
    const error = await refusal(service.assignTask(leadId, input({ engineerId: engineerOf() })));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ httpStatus: 422, fields: [{ field: 'engineerId', message: 'Choose an Engineer.' }] });
    expect([await count('tasks'), await count('estimates'), await count('task_sequences')]).toEqual([0, 0, 0]);
  });

  it('refuses an Engineer who was deactivated after the page was opened', async () => {
    const { rows } = await db.owner.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Invented Soon Gone', 'soon.gone@example.test', 'invented-hash', 'ENGINEER') RETURNING id::text`,
    );
    const soonGone = defined(rows[0]).id;
    expect((await service.getAssignContext()).engineers.map((engineer) => engineer.id)).toContain(soonGone);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [soonGone]);
    await expect(service.assignTask(leadId, input({ engineerId: soonGone }))).rejects.toBeInstanceOf(FieldValidationError);
    expect((await service.getAssignContext()).engineers.map((engineer) => engineer.id)).not.toContain(soonGone);
  });

  it('lists the active Engineers by name, and no Lead, Admin or inactive person', async () => {
    const { engineers } = await service.getAssignContext();
    const ids = engineers.map((engineer) => engineer.id);
    expect(ids).toEqual(expect.arrayContaining([arjunId, priyaId]));
    for (const excluded of [leadId, adminId, inactiveId]) expect(ids).not.toContain(excluded);
  });
});

describe('AC-6: script text is stored as text', () => {
  it('stores the title and notes exactly as typed', async () => {
    await service.assignTask(leadId, input({ title: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>' }));
    const { rows } = await db.owner.query<{ title: string; notes: string }>('SELECT title, notes FROM tasks');
    expect(rows).toEqual([{ title: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>' }]);
  });
});
