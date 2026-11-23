import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client';
import { escapeLike } from '../../lib/escape-like';
import type { QueueCounts, QueueTab } from '../../lib/tasks/queue';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of tasks and their estimates (STORY-04.01; architecture sections 4.1, 5.1 and 6). Three tables: `tasks`, `estimates` and `task_sequences`.
 * STORY-04.01 added the writes of "Assign task" and the list of Engineers it chooses from; STORY-04.02 the reads of the queue (`listQueue`, `countQueue`), STORY-04.06 their filters.
 *
 * **One transaction.** A task, its empty estimate and the number that names it are written with the caller's `Transaction`, so a failure of any
 * insert leaves none of them (AC-1). Every write method takes `tx` as required: none can run alone.
 *
 * **The number** is taken with one `INSERT ... ON CONFLICT DO UPDATE` on the year's row. That statement locks the row until the transaction ends,
 * so two requests at once get different numbers (AC-2), and a task that fails to save gives its number back, so a code is never skipped.
 *
 * **The customer** (CR-01 item 6, AQP-390) is read `WHERE deleted_at IS NULL ... FOR SHARE` in the same transaction, so a concurrent soft delete of it (an UPDATE) waits for the task, and then sees the open
 * estimate that has it (BR-053); one that is already deleted is not found. It is set on the estimate (`estimates.customer_id`, the one place it is stored) in the statement that creates the estimate.
 *
 * **The Engineer** is read with `FOR SHARE` in the same transaction: a person who is deactivated, or whose role is changed, while the task is being
 * written makes that update wait for the task, and one who is already deactivated is not found (AC-3).
 *
 * **A reassign** (STORY-04.07) reads the task with `findTaskForUpdate`, which takes the estimate's row and then the task's row `FOR UPDATE`, the order of the estimate
 * workflow (`lockEstimate` takes the estimate `FOR UPDATE` and the task `FOR SHARE`), so the two cannot wait for each other. An approval that is being committed makes
 * the reassign wait, and the status it reads once the lock is granted is the one that decides whether the task is still open (AC-6).
 */

export type EstimateStatus = 'DRAFT' | 'PREPARED' | 'APPROVED';

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
  readonly title: string;
  /** The project name (CR-01 item 6). */
  readonly subject: string;
  readonly notes: string | null;
}

/** A customer as the assignment reads it and the answers carry it: the ID, the name and the short name (class Internal). No contact detail and no rate (NFR-002). */
export interface AssignCustomer {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
}

export interface TaskRecord extends NewTask {
  readonly id: string;
  readonly assignmentRevision: number;
}

export interface EstimateRecord {
  readonly id: string;
  readonly taskId: string;
  /** Set when a task is assigned (CR-01 item 6). Null only for an estimate made before that, whose customer a Lead or an Admin sets. */
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
  readonly title: string;
  readonly subject: string;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly engineer: EngineerRecord;
  readonly assignedByName: string;
  /** Null only for an estimate made before CR-01 item 6, which has no customer yet. A customer deleted since it was chosen is still named. */
  readonly customer: AssignCustomer | null;
  readonly status: EstimateStatus;
}

/** One task as the task route reads it: the row of the queue and the notes typed when it was assigned. Still nothing about cost. */
export interface TaskDetailRow extends QueueRow {
  readonly notes: string | null;
}

/** A task as a reassign reads it, under the task's and the estimate's row locks: what it holds now and the status of its estimate. */
export interface LockedTask {
  readonly id: string;
  readonly code: string;
  readonly engineer: EngineerRecord;
  readonly deadlineAt: Date;
  readonly assignmentRevision: number;
  readonly status: EstimateStatus;
  /** What the assignment e-mail of a change of Engineer shows (STORY-09.03 AC-7): plain fields of the task, read under the same lock. */
  readonly folderPath: string;
  readonly title: string;
  readonly notes: string | null;
}

/** The person who assigned a task, or who changed its Engineer, as the assignment e-mail needs them (STORY-09.03): the name, and whether they are active now. */
export interface AssignerRecord {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

/** What a reassign writes: the whole assignment, so the service decides every value and the repository stores what it is given. */
export interface AssignmentState {
  readonly engineerId: string;
  readonly deadlineAt: Date;
  readonly assignmentRevision: number;
}

/** What the filter row narrows a read to (STORY-04.06 AC-3), ANDed with the scope and the tab so it can only narrow. Null is "not set"; the service has judged every value. */
export interface QueueFilter {
  /** Task ID or title, contains, ignoring letter case, with no wildcard of its own. */
  readonly text: string | null;
  readonly engineerId: string | null;
  /** The customer on the task's estimate; a task whose estimate has none matches no customer. */
  readonly customerId: string | null;
  /** A deadline at or after this instant (00:00 IST of the From day) and before that one (00:00 IST of the day after the To day, so the To day is inclusive). */
  readonly deadlineFrom: Date | null;
  readonly deadlineBefore: Date | null;
}

export interface QueueRequest {
  readonly tab: QueueTab;
  readonly scope: QueueScope;
  readonly filter: QueueFilter;
  /** The instant "overdue" is judged at: a task is overdue when its deadline is before it and it is not closed. */
  readonly now: Date;
  readonly limit: number;
  readonly after: QueuePosition | null;
}

export interface TaskRepository {
  /** The active Engineers by name, ignoring letter case. Deactivated people and the other roles are not listed. */
  listActiveEngineers(): Promise<ReadonlyArray<EngineerRecord>>;
  /** The customers that are not deleted, by name ignoring letter case, with their short names (SCR-04's Customer Name field). Nothing else of a customer is read. */
  listActiveCustomers(): Promise<ReadonlyArray<AssignCustomer>>;
  /** The customer with this ID that is not deleted, **locked for share until the transaction ends**; null for an unknown ID, a deleted customer and an ID that is not a UUID. */
  findActiveCustomer(id: string, tx: Transaction): Promise<AssignCustomer | null>;
  /** The active Engineer with this ID, **locked for share until the transaction ends**; null for an unknown ID, an inactive person or another role. */
  findActiveEngineer(id: string, tx: Transaction): Promise<EngineerRecord | null>;
  /**
   * The Lead or Admin with this ID, in the caller's transaction, with whether they are active now (STORY-09.03 AC-5: the Cc of the assignment e-mail is judged when its row is written).
   * Null for an unknown ID, an ID that is not a UUID and an Engineer: only the two roles that assign are found.
   */
  findAssigner(id: string, tx: Transaction): Promise<AssignerRecord | null>;
  /** The next running number of the year (1 for the first), taking the year's lock until the transaction ends. */
  takeNextNumber(year: number, tx: Transaction): Promise<number>;
  createTask(task: NewTask, tx: Transaction): Promise<TaskRecord>;
  /** An empty estimate for the task: DRAFT, with the customer the task was assigned for. */
  createEstimate(taskId: string, customerId: string, tx: Transaction): Promise<EstimateRecord>;
  /**
   * The task with this ID **inside this scope**, or null: an ID that is not a UUID, an unknown one and a task outside the scope (an Engineer's other-person task) are all
   * the same null, so nothing tells a task that exists from one that does not (STORY-04.04 AC-4). The scope is cut in the query, so another Engineer's row is never read.
   */
  findTask(id: string, scope: QueueScope): Promise<TaskDetailRow | null>;
  /**
   * The task with this ID and the status of its estimate, **with the estimate's row and the task's row locked until the transaction ends**; null for an ID that is not a
   * UUID and for an unknown one (STORY-04.07 AC-3, AC-6). The status is read once the locks are granted, so an approval that was committing is already seen.
   */
  findTaskForUpdate(id: string, tx: Transaction): Promise<LockedTask | null>;
  /** Stores the Engineer, the deadline and the assignment revision of a task whose row this transaction holds locked (STORY-04.07 AC-3, AC-5). */
  setAssignment(id: string, state: AssignmentState, tx: Transaction): Promise<void>;
  /** Up to `limit` tasks of the tab, earliest deadline first and then by code, after `after` when it is given (STORY-04.02 AC-1, AC-2). */
  listQueue(request: QueueRequest): Promise<ReadonlyArray<QueueRow>>;
  /** How many tasks each tab holds in this scope, under this filter, at `now` (STORY-04.02 AC-1, STORY-04.06 AC-3). An overdue task is counted in Open as well. */
  countQueue(scope: QueueScope, now: Date, filter: QueueFilter): Promise<QueueCounts>;
  /** How many tasks in this scope are overdue at `now`: the bell's count (STORY-04.03 AC-2), by the same rule as the Overdue tab and as one count, not three. */
  countOverdue(scope: QueueScope, now: Date): Promise<number>;
}

const ENGINEER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string() }));
const LOCKED_ROWS = z.array(
  z.strictObject({
    id: z.string(),
    code: z.string(),
    engineerId: z.string(),
    engineerName: z.string(),
    deadlineAt: z.date(),
    assignmentRevision: z.number().int().positive(),
    status: z.enum(['DRAFT', 'PREPARED', 'APPROVED']),
    folderPath: z.string(),
    title: z.string(),
    notes: z.string().nullable(),
  }),
);
const CUSTOMER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), shortName: z.string() }));
const ASSIGNER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), isActive: z.boolean() }));
const NUMBER_ROWS = z.array(z.strictObject({ lastValue: z.number().int().positive() }));

const QUEUE_SELECT = {
  id: true,
  code: true,
  title: true,
  subject: true,
  folderPath: true,
  deadlineAt: true,
  engineer: { select: { id: true, name: true } },
  assignedBy: { select: { name: true } },
  estimate: { select: { status: true, customer: { select: { id: true, name: true, shortName: true } } } },
} satisfies Prisma.TaskSelect;

const DETAIL_SELECT = { ...QUEUE_SELECT, notes: true } satisfies Prisma.TaskSelect;

type QueueSelected = Prisma.TaskGetPayload<{ select: typeof QUEUE_SELECT }>;

/** A task's row as the queue and the task route both read it. Every task has an estimate (made in the same transaction), so a row without one is not a row. */
function toQueueRow(row: QueueSelected): QueueRow | null {
  if (row.estimate === null) return null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    subject: row.subject,
    folderPath: row.folderPath,
    deadlineAt: row.deadlineAt,
    engineer: row.engineer,
    assignedByName: row.assignedBy.name,
    customer: row.estimate.customer,
    status: row.estimate.status,
  };
}

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

/** The filter row as a `where` (STORY-04.06 AC-3): every part ANDed, a case-insensitive `contains` on the code and the title; an empty filter is an empty AND. */
function filterWhere(filter: QueueFilter): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [];
  if (filter.text !== null) {
    const contains = { contains: escapeLike(filter.text), mode: 'insensitive' as const };
    conditions.push({ OR: [{ code: contains }, { title: contains }] });
  }
  if (filter.engineerId !== null) conditions.push({ engineerId: filter.engineerId });
  if (filter.customerId !== null) conditions.push({ estimate: { is: { customerId: filter.customerId } } });
  if (filter.deadlineFrom !== null) conditions.push({ deadlineAt: { gte: filter.deadlineFrom } });
  if (filter.deadlineBefore !== null) conditions.push({ deadlineAt: { lt: filter.deadlineBefore } });
  return { AND: conditions };
}

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

    listActiveCustomers: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT id::text AS "id", name, short_name AS "shortName" FROM customers WHERE deleted_at IS NULL ORDER BY lower(name), name, id`;
        return CUSTOMER_ROWS.parse(rows);
      }),

    findActiveCustomer: (id, tx) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; a customer asked for by one is not found.
        if (!isUuid(id)) return null;
        // Prisma has no row lock, so the read is a raw statement: the ID is a bound parameter. `FOR SHARE` makes a soft delete of this customer (an UPDATE) wait until this transaction ends (BR-053).
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name, short_name AS "shortName" FROM customers WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`;
        return CUSTOMER_ROWS.parse(rows)[0] ?? null;
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

    findAssigner: (id, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name, is_active AS "isActive" FROM users WHERE id = ${id}::uuid AND role IN ('LEAD', 'ADMIN')`;
        return ASSIGNER_ROWS.parse(rows)[0] ?? null;
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
            subject: task.subject,
            notes: task.notes,
          },
          select: { id: true, assignmentRevision: true },
        });
        return { ...task, id: created.id, assignmentRevision: created.assignmentRevision };
      }),

    createEstimate: (taskId, customerId, tx) =>
      withDatabaseErrors(() =>
        clientFor(db, tx).estimate.create({ data: { taskId, customerId }, select: { id: true, taskId: true, customerId: true, status: true } }),
      ),

    findTaskForUpdate: (id, tx) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; a task asked for by one is not found.
        if (!isUuid(id)) return null;
        // Prisma has no row lock, so the read is a raw statement: the ID is a bound parameter. The estimate's row first and then the task's, as `lockEstimate` does. The
        // Engineer's name is a sub-select and not a join: a save that waited for the lock re-checks the joined rows against the task as the save before it left it, and a join on
        // `engineer_id` would then drop the row when that save had changed the Engineer (the second of two saves at once would find no task).
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT t.id::text AS "id", t.code AS "code", t.engineer_id::text AS "engineerId", (SELECT u.name FROM users u WHERE u.id = t.engineer_id) AS "engineerName",
                 t.deadline_at AS "deadlineAt", t.assignment_revision::int AS "assignmentRevision", e.status::text AS "status",
                 t.folder_path AS "folderPath", t.title AS "title", t.notes AS "notes"
          FROM estimates e JOIN tasks t ON t.id = e.task_id
          WHERE t.id = ${id}::uuid
          FOR UPDATE OF e, t`;
        const [row] = LOCKED_ROWS.parse(rows);
        if (row === undefined) return null;
        const { engineerId, engineerName, ...rest } = row;
        return { ...rest, engineer: { id: engineerId, name: engineerName } };
      }),

    setAssignment: (id, state, tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).task.update({
          where: { id },
          data: { engineerId: state.engineerId, deadlineAt: state.deadlineAt, assignmentRevision: state.assignmentRevision },
          select: { id: true },
        });
      }),

    findTask: (id, scope) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; a task asked for by one is not found.
        if (!isUuid(id) || !isReadable(scope)) return null;
        const row = await db.task.findFirst({ where: { AND: [{ id }, scopeFilter(scope)] }, select: DETAIL_SELECT });
        const mapped = row === null ? null : toQueueRow(row);
        return row === null || mapped === null ? null : { ...mapped, notes: row.notes };
      }),

    listQueue: ({ tab, scope, now, limit, after, filter }) =>
      withDatabaseErrors(async () => {
        if (!isReadable(scope)) return [];
        const rows = await db.task.findMany({
          where: { AND: [scopeFilter(scope), tabFilter(tab, now), afterFilter(after), filterWhere(filter)] },
          orderBy: [{ deadlineAt: 'asc' }, { code: 'asc' }],
          take: limit,
          select: QUEUE_SELECT,
        });
        // Every task has an estimate and every tab filters on it, so `toQueueRow` only narrows the type.
        return rows.flatMap((row): QueueRow[] => {
          const mapped = toQueueRow(row);
          return mapped === null ? [] : [mapped];
        });
      }),

    countQueue: (scope, now, filter) =>
      withDatabaseErrors(async () => {
        if (!isReadable(scope)) return { open: 0, closed: 0, overdue: 0 };
        const narrowed = filterWhere(filter);
        const count = (tab: QueueTab): Promise<number> => db.task.count({ where: { AND: [scopeFilter(scope), tabFilter(tab, now), narrowed] } });
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
