import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client';
import type { QueueCounts, QueueTab } from '../../lib/tasks/queue';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of tasks and their estimates (STORY-04.01; architecture sections 4.1, 5.1 and 6). Three tables: `tasks`, `estimates` and `task_sequences`.
 * STORY-04.01 added the writes of "Assign task" and the list of Engineers it chooses from; STORY-04.02 adds the reads of the queue (`listQueue`, `countQueue`).
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

/**
 * Whose tasks a read covers: one Engineer's own (`engineerId`), the tasks one person assigned (`assignedById`, a Lead's bell and the `assignedBy=me` view of STORY-04.03),
 * both, or every task (`null` for each). Decided by the service from the session, never from a request.
 */
export interface QueueScope {
  readonly engineerId: string | null;
  readonly assignedById: string | null;
}

/** A place in the queue's order (deadline, then code): tasks strictly after this one come next. */
export interface QueuePosition {
  readonly deadlineAt: Date;
  readonly code: string;
}

/** A task as a row of the queue reads it: the task, the people's names, the customer's name and the status of its estimate. Nothing about cost. */
export interface QueueRow {
  readonly id: string;
  readonly code: string;
  readonly title: string | null;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly engineer: EngineerRecord;
  readonly assignedByName: string;
  /** Null until the Engineer chooses the customer. */
  readonly customerName: string | null;
  readonly status: EstimateStatus;
}

export interface QueueRequest {
  readonly tab: QueueTab;
  readonly scope: QueueScope;
  /** The instant "overdue" is judged at: a task is overdue when its deadline is before it and it is not closed. */
  readonly now: Date;
  readonly limit: number;
  readonly after: QueuePosition | null;
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
  /** Up to `limit` tasks of the tab, earliest deadline first and then by code, after `after` when it is given (STORY-04.02 AC-1, AC-2). */
  listQueue(request: QueueRequest): Promise<ReadonlyArray<QueueRow>>;
  /** How many tasks each tab holds in this scope at `now` (STORY-04.02 AC-1). An overdue task is counted in Open as well. */
  countQueue(scope: QueueScope, now: Date): Promise<QueueCounts>;
  /** How many tasks in this scope are overdue at `now`: the bell's count (STORY-04.03 AC-2), by the same rule as the Overdue tab and as one count, not three. */
  countOverdue(scope: QueueScope, now: Date): Promise<number>;
}

const ENGINEER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string() }));
const NUMBER_ROWS = z.array(z.strictObject({ lastValue: z.number().int().positive() }));

const QUEUE_SELECT = {
  id: true,
  code: true,
  title: true,
  folderPath: true,
  deadlineAt: true,
  engineer: { select: { id: true, name: true } },
  assignedBy: { select: { name: true } },
  estimate: { select: { status: true, customer: { select: { name: true } } } },
} satisfies Prisma.TaskSelect;

/** The tab as a filter on the task and on the status of its estimate; Open and Closed are derived from `estimates.status`, never stored (architecture section 4.4). */
function tabFilter(tab: QueueTab, now: Date): Prisma.TaskWhereInput {
  switch (tab) {
    case 'open':
      return { estimate: { is: { status: { not: 'APPROVED' } } } };
    case 'closed':
      return { estimate: { is: { status: 'APPROVED' } } };
    case 'overdue':
      return { estimate: { is: { status: { not: 'APPROVED' } } }, deadlineAt: { lt: now } };
  }
}

function afterFilter(after: QueuePosition | null): Prisma.TaskWhereInput {
  if (after === null) return {};
  return { OR: [{ deadlineAt: { gt: after.deadlineAt } }, { deadlineAt: after.deadlineAt, code: { gt: after.code } }] };
}

const scopeFilter = (scope: QueueScope): Prisma.TaskWhereInput => ({
  ...(scope.engineerId === null ? {} : { engineerId: scope.engineerId }),
  ...(scope.assignedById === null ? {} : { assignedById: scope.assignedById }),
});

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** An ID that is not a UUID would make PostgreSQL refuse the statement; the session's ID always is one, but nothing here trusts that. Such a scope holds no task. */
const isReadable = (scope: QueueScope): boolean => [scope.engineerId, scope.assignedById].every((id) => id === null || isUuid(id));

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

    listQueue: ({ tab, scope, now, limit, after }) =>
      withDatabaseErrors(async () => {
        if (!isReadable(scope)) return [];
        const rows = await db.task.findMany({
          where: { AND: [scopeFilter(scope), tabFilter(tab, now), afterFilter(after)] },
          orderBy: [{ deadlineAt: 'asc' }, { code: 'asc' }],
          take: limit,
          select: QUEUE_SELECT,
        });
        return rows.flatMap((row): QueueRow[] =>
          // Every task has an estimate (made in the same transaction), and every tab filters on it, so this only narrows the type.
          row.estimate === null
            ? []
            : [
                {
                  id: row.id,
                  code: row.code,
                  title: row.title,
                  folderPath: row.folderPath,
                  deadlineAt: row.deadlineAt,
                  engineer: row.engineer,
                  assignedByName: row.assignedBy.name,
                  customerName: row.estimate.customer?.name ?? null,
                  status: row.estimate.status,
                },
              ],
        );
      }),

    countQueue: (scope, now) =>
      withDatabaseErrors(async () => {
        if (!isReadable(scope)) return { open: 0, closed: 0, overdue: 0 };
        const count = (tab: QueueTab): Promise<number> => db.task.count({ where: { AND: [scopeFilter(scope), tabFilter(tab, now)] } });
        const [open, closed, overdue] = await Promise.all([count('open'), count('closed'), count('overdue')]);
        return { open, closed, overdue };
      }),

    countOverdue: (scope, now) =>
      withDatabaseErrors(async () => {
        if (!isReadable(scope)) return 0;
        // `idx_tasks_deadline_at` serves the deadline bound; the status of the estimate is the one join.
        return db.task.count({ where: { AND: [scopeFilter(scope), tabFilter('overdue', now)] } });
      }),
  };
}
