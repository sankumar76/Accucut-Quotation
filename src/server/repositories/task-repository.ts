import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of tasks and their estimates (STORY-04.01; architecture sections 4.1, 5.1 and 6). Three tables: `tasks`, `estimates` and `task_sequences`.
 * This story adds the writes of "Assign task" and the list of Engineers it chooses from; the queue's reads arrive with STORY-04.02.
 *
 * **One transaction.** A task, its empty estimate and the number that names it are written with the caller's `Transaction`, so a failure of any
 * insert leaves none of them (AC-1). Every write method takes `tx` as required: none can run alone.
 *
 * **The number** is taken with one `INSERT ... ON CONFLICT DO UPDATE` on the year's row. That statement locks the row until the transaction ends,
 * so two requests at once get different numbers (AC-2), and a task that fails to save gives its number back, so a code is never skipped.
 *
 * **The Engineer** is read with `FOR SHARE` in the same transaction: a person who is deactivated, or whose role is changed, while the task is being
 * written makes that update wait for the task, and one who is already deactivated is not found (AC-3).
 */

export type EstimateStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

/** An Engineer as a choice: the ID and the name, and nothing else (the e-mail address is not sent to the screen). */
export interface EngineerRecord {
  readonly id: string;
  readonly name: string;
}

export interface NewTask {
  readonly code: string;
  readonly engineerId: string;
  readonly assignedById: string;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly title: string | null;
  readonly notes: string | null;
}

export interface TaskRecord extends NewTask {
  readonly id: string;
  readonly assignmentRevision: number;
}

export interface EstimateRecord {
  readonly id: string;
  readonly taskId: string;
  /** Null until the Engineer chooses the customer. */
  readonly customerId: string | null;
  readonly status: EstimateStatus;
}

export interface TaskRepository {
  /** The active Engineers by name, ignoring letter case. Deactivated people and the other roles are not listed. */
  listActiveEngineers(): Promise<ReadonlyArray<EngineerRecord>>;
  /** The active Engineer with this ID, **locked for share until the transaction ends**; null for an unknown ID, an inactive person or another role. */
  findActiveEngineer(id: string, tx: Transaction): Promise<EngineerRecord | null>;
  /** The next running number of the year (1 for the first), taking the year's lock until the transaction ends. */
  takeNextNumber(year: number, tx: Transaction): Promise<number>;
  createTask(task: NewTask, tx: Transaction): Promise<TaskRecord>;
  /** An empty estimate for the task: DRAFT, no customer. */
  createEstimate(taskId: string, tx: Transaction): Promise<EstimateRecord>;
}

const ENGINEER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string() }));
const NUMBER_ROWS = z.array(z.strictObject({ lastValue: z.number().int().positive() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** Builds the task methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createTaskRepository(db: PrismaClient): TaskRepository {
  return {
    listActiveEngineers: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT id::text AS "id", name FROM users WHERE role = 'ENGINEER' AND is_active ORDER BY lower(name), name, id`;
        return ENGINEER_ROWS.parse(rows);
      }),

    findActiveEngineer: (id, tx) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; an Engineer asked for by one is not found.
        if (!isUuid(id)) return null;
        // Prisma has no row lock, so the read is a raw statement: the ID is a bound parameter.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name FROM users WHERE id = ${id}::uuid AND role = 'ENGINEER' AND is_active FOR SHARE`;
        return ENGINEER_ROWS.parse(rows)[0] ?? null;
      }),

    takeNextNumber: (year, tx) =>
      withDatabaseErrors(async () => {
        const rows = await clientFor(db, tx).$queryRaw`
          INSERT INTO task_sequences (year, last_value) VALUES (${year}::int, 1)
          ON CONFLICT (year) DO UPDATE SET last_value = task_sequences.last_value + 1, updated_at = now()
          RETURNING last_value::int AS "lastValue"`;
        const [row] = NUMBER_ROWS.parse(rows);
        if (row === undefined) throw new Error('The task number was not issued.');
        return row.lastValue;
      }),

    createTask: (task, tx) =>
      withDatabaseErrors(async () => {
        const created = await clientFor(db, tx).task.create({
          data: {
            code: task.code,
            engineerId: task.engineerId,
            assignedById: task.assignedById,
            folderPath: task.folderPath,
            deadlineAt: task.deadlineAt,
            title: task.title,
            notes: task.notes,
          },
          select: { id: true, assignmentRevision: true },
        });
        return { ...task, id: created.id, assignmentRevision: created.assignmentRevision };
      }),

    createEstimate: (taskId, tx) =>
      withDatabaseErrors(() =>
        clientFor(db, tx).estimate.create({ data: { taskId }, select: { id: true, taskId: true, customerId: true, status: true } }),
      ),
  };
}
