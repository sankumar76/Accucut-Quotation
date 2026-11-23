import type { RoleName } from '../../lib/auth/roles';
import { ConflictError, FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { TRANSITION_REFUSALS, type EstimateStatus } from '../../lib/estimate/state-machine';
import { displayStatusOf, isTaskClosed } from '../../lib/estimate/task-status';
import { checkAssign, CUSTOMER_MESSAGE, ENGINEER_MESSAGE, type AssignInput } from '../../lib/tasks/assign';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import { engineerSeesIgnored, QUEUE_DEFAULT_LIMIT, type QueueCounts, type QueueTab, type TaskEstimateStatus } from '../../lib/tasks/queue';
import { DATE_ORDER_MESSAGE } from '../../lib/tasks/queue-filters';
import { checkReassign, TASK_CLOSED_CODE, TASK_CLOSED_MESSAGE, type ReassignInput } from '../../lib/tasks/reassign';
import { formatTaskCode } from '../../lib/tasks/task-code';
import { istYearOf, startOfIstDay, startOfNextIstDay, type Clock } from '../../lib/time';
import type { AssignCustomer, EngineerRecord, EstimateRecord, QueueFilter, QueueRow, QueueScope, TaskRepository } from '../repositories/task-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import type { TaskMail, TaskMailTask } from './task-mail';
import { encodeTaskQueueCursor, type TaskQueueCursor } from './task-queue-cursor';

/**
 * Tasks (STORY-04.01; FR-032, FR-033, FR-041; architecture sections 4.1, 5.1, 6 and 8). A Lead or an Admin assigns a task to an Engineer. Who may call is
 * decided before this is reached (`withRoute`, the manifest, BR-004); this file holds the rules that stay true whoever asks:
 *
 *   - **The input is checked again here, against the server's clock** (AC-3): the same rules as the form (`lib/tasks/assign.ts`), so the words are the
 *     same, and every problem is named at once. A deadline that is not later than now is refused whatever the browser said.
 *   - **The Engineer is looked up in the same transaction** (AC-3): an inactive person, a Lead, an Admin and an unknown ID are all "Choose an Engineer.",
 *     a 422 under that field, and nothing is stored.
 *   - **The customer is looked up in the same transaction, locked for share** (CR-01 item 6, AQP-390): an unknown or deleted customer is "Choose a customer.", a 422 under `customerId`,
 *     reported together with an Engineer that is wrong; the customer's short name is read from the master here and never taken from the request. A concurrent soft delete of the
 *     customer waits for the task and then sees the open estimate (BR-053). The estimate is made with the customer already set.
 *   - **A task, its empty estimate and its number are one transaction** (AC-1, AC-2): if any insert fails none exists, and the number goes back. The
 *     code is `Q-<year>-<number>`, the year read in IST (FR-041, NFR-015), the number from the locked sequence.
 *   - **The `file:` link is built here**, from the validated UNC path (AC-4); the browser is never asked to build one.
 *
 * There is no audit entry for the assignment: the audit log of architecture section 8 lists a task change (STORY-04.07), not the first assignment.
 *
 * The assignment e-mail (STORY-09.03; FR-081, BR-040, architecture section 4.7): with alerts ON, the outbox row of the message is written **in the same transaction** as the task and its
 * estimate (and, for a change of Engineer, as the reassign), so a rolled-back task has no message. With alerts OFF nothing is written and the task is made exactly as before. The service
 * reads the Engineer and the assigner in the transaction and hands them to `TaskMail` by ID: no address is read here or taken from a request. A service built without `mail` writes none.
 *
 * Reassign or change the deadline (STORY-04.07; FR-040, architecture sections 4.4, 6 and 8): `reassignTask` is the one place an open task's Engineer or deadline changes.
 *
 *   - **One transaction under the row locks** (AC-3): the estimate's row and the task's row are locked, the status of the estimate is read once they are held, and the change, its
 *     revision and its audit entry are written together or not at all (AC-4). An approval that was committing makes the call wait and is then seen (AC-6).
 *   - **Only what differs is judged** (AC-3, D-3): the same rules as assigning, against the server's clock, but a deadline or an Engineer equal to the stored one is not checked, so
 *     an overdue task can be given to another Engineer. A save that changes nothing writes no entry and leaves the revision alone.
 *   - **The revision rises with the Engineer, not with the deadline** (AC-5, A-09): the assignment e-mail (STORY-09.03) is keyed on it, the overdue e-mail on the deadline.
 *   - **Any Lead or Admin may change any open task** (D-f): who may call is the route's (the manifest); nothing here narrows it to the person who assigned the task.
 *
 * The queue (STORY-04.02; FR-034, architecture sections 4.4 and 6): the Open, Closed and Overdue tabs, each sorted by deadline and then by code.
 *
 *   - **Who sees what is decided here, from the session's role** (AC-2): an Engineer is scoped to their own tasks by their own ID, a Lead and an Admin see every
 *     task. No part of a request can widen the scope, because the request has no field for it (the filters of STORY-04.06 arrive with their own rules).
 *   - **Open, Closed and Overdue are derived at read time** from the status of the estimate and the deadline against the server's clock (AC-1): a task whose
 *     deadline is exactly now is not overdue yet, one a millisecond past it is; an overdue task is also in Open.
 *   - **The bell** (STORY-04.03; FR-037): `countOverdue` is one count of the overdue tasks relevant to the role, read at the server's clock on page load.
 *   - **A row carries no cost** (AC-8): the code, the title, the people's names, the customer's name, the folder, the deadline and the status of the estimate.
 */

/** A task as an assignment answers: what was stored, the link built from the path, and the empty estimate that was made with it. */
export interface AssignedTask {
  readonly id: string;
  readonly code: string;
  readonly engineer: EngineerRecord;
  readonly folderPath: string;
  readonly folderUrl: string;
  readonly deadlineAt: Date;
  readonly title: string;
  readonly subject: string;
  /** The customer the task was assigned for, with the short name read from the master. */
  readonly customer: AssignCustomer;
  readonly notes: string | null;
  readonly estimate: Pick<EstimateRecord, 'id' | 'status' | 'customerId'>;
}

/** What SCR-04 chooses from. */
export interface AssignContext {
  readonly engineers: ReadonlyArray<EngineerRecord>;
  /** The customers that are not deleted, by name, with their short names (CR-01 item 6). Names and short names only: no contact detail and no rate. */
  readonly customers: ReadonlyArray<AssignCustomer>;
  /** Whether e-mail alerts are on: the one fact of the settings a Lead may see, for the notice "E-mail alerts are OFF" (STORY-09.03 AC-6). */
  readonly alertsEnabled: boolean;
}

/** A task as a row of the queue shows it. The deadline is an instant in UTC; the screen shows it in IST. */
export interface QueueTask {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly engineer: EngineerRecord;
  /** Null only for an estimate made before CR-01 item 6, which has no customer yet ("Not chosen yet"). */
  readonly customerName: string | null;
  readonly folderPath: string;
  /** Built here from the path; null only for a path the portal would not have accepted, so the row then shows the path as text. */
  readonly folderUrl: string | null;
  readonly deadlineAt: Date;
  /** What a row shows (`displayStatusOf`): the estimate's status, or `IGNORED` while the layer over it is set (CR-01 item 7D). */
  readonly status: TaskEstimateStatus;
  readonly assignedByName: string;
  /**
   * The remarks the Lead gave when they ignored the task: **non-null only on a row of the Ignored tab** (AC-3, AC-9), because every other tab holds only tasks that are not ignored. Who ignored it and when are not in a
   * row; the task page has them (`TaskDetail.ignored`). No figure (NFR-002).
   */
  readonly ignoredRemarks: string | null;
}

/** What a reassign did, for the route (the task as the queue shows it) and for what follows a change of Engineer (STORY-09.03 calls its e-mail from here, with the new revision). */
export interface ReassignResult {
  readonly task: QueueTask;
  readonly engineerChanged: boolean;
  readonly deadlineChanged: boolean;
  /** The assignment revision after the save: one more than before when the Engineer changed. */
  readonly assignmentRevision: number;
}

/**
 * One task as the task route answers it: a row of the queue and the notes typed when it was assigned (STORY-04.04). The status is the estimate's own (the one underneath the Ignored layer, which is the
 * separate `ignored` field), worded by `taskStatusOf`.
 */
export interface TaskDetail extends Omit<QueueTask, 'status' | 'ignoredRemarks'> {
  readonly status: EstimateStatus;
  readonly notes: string | null;
  /** The project name and the customer with its short name (CR-01 item 7D and item 6): the same for every role, names only. */
  readonly subject: string;
  readonly customer: AssignCustomer | null;
  /** Who ignored the task, when and with which remarks (CR-01 item 7D, AC-9), or `null`: the same for every role, by name and never an ID, with no figure (NFR-002). */
  readonly ignored: { readonly at: Date; readonly byName: string; readonly remarks: string } | null;
}

/** One page of one tab, and how many tasks each tab holds for this person. */
export interface TaskQueue {
  readonly tab: QueueTab;
  readonly tasks: ReadonlyArray<QueueTask>;
  readonly counts: QueueCounts;
  /** Where the next page begins, or null on the last page. */
  readonly nextCursor: string | null;
  /** The instant "overdue" was judged at (the server's clock), so a row's "Overdue by" text is worded against the same instant as the counts (STORY-04.03 AC-1). */
  readonly asOf: Date;
}

/** The person asking, from the session. */
export interface QueueViewer {
  readonly id: string;
  readonly role: RoleName;
}

export interface QueueQuery {
  readonly tab: QueueTab;
  readonly limit?: number | undefined;
  readonly cursor?: TaskQueueCursor | undefined;
  /** `me`: only the tasks the viewer assigned (STORY-04.03); `anyone` or absent: no cut by assigner. The Lead's default `me` is applied by the page from the address (STORY-04.06 A-1), not here. */
  readonly assignedBy?: 'me' | 'anyone' | undefined;
  /** Task ID or title, contains, ignoring letter case (STORY-04.06 AC-3). */
  readonly q?: string | undefined;
  /** An Engineer's ID (a Lead and an Admin only). */
  readonly engineer?: string | undefined;
  /** A customer's ID (a Lead and an Admin only): a task whose estimate has no customer yet matches none. */
  readonly customer?: string | undefined;
  /** First and last deadline day in IST, `YYYY-MM-DD`, both inclusive (a Lead and an Admin only). */
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

export interface TaskService {
  /** The active Engineers and the customers that are not deleted, for the Engineer and Customer Name fields (`GET /api/v1/options/assign-context`). */
  getAssignContext(): Promise<AssignContext>;
  /**
   * Assigns a task to an Engineer and makes its empty estimate. `assignedById` is the caller, taken from the session by the route and never from the body.
   * Refused with a 422 naming each field that is wrong; nothing is stored then.
   */
  assignTask(assignedById: string, input: AssignInput): Promise<AssignedTask>;
  /** A page of a tab for this person, with the count of every tab (STORY-04.02 AC-1, AC-2). */
  listQueue(viewer: QueueViewer, query: QueueQuery): Promise<TaskQueue>;
  /**
   * One task for this person with the status of its estimate (STORY-04.04 AC-1, AC-4; `GET /api/v1/tasks/{id}`): an Engineer's own, or any for a Lead and an Admin. Null
   * for an ID that is no task, and for an Engineer asking for another's task: the same answer, so the route's 404 cannot be used to probe which tasks exist (CR-33). The
   * answer has the same shape for every role and no cost.
   */
  getTask(viewer: QueueViewer, id: string): Promise<TaskDetail | null>;
  /**
   * Gives an open task to another Engineer, moves its deadline, or both (STORY-04.07; `PATCH /api/v1/tasks/{id}`). `audit` is who is saving and on which request, from the session
   * and the request. 404 for an ID that is no task; 409 `TASK_CLOSED` for a task whose estimate is approved; 422 naming each field that is wrong. Nothing is stored then.
   */
  reassignTask(audit: AuditContext, id: string, input: ReassignInput): Promise<ReassignResult>;
  /** The bell's count for this person at the server's clock: own overdue (Engineer), overdue they assigned (Lead), all overdue (Admin). STORY-04.03 AC-2. */
  countOverdue(viewer: QueueViewer): Promise<number>;
}

export interface TaskDependencies {
  readonly tasks: TaskRepository;
  readonly transactions: TransactionRunner;
  readonly clock: Clock;
  /** Needed by `reassignTask` alone (its entry is written in its own transaction); a service built without it refuses to reassign. */
  readonly audit?: AuditService | undefined;
  /** The assignment e-mail (STORY-09.03). A service built without it writes no row and reports alerts as off. */
  readonly mail?: TaskMail | undefined;
}

/** Every task, whoever it is assigned to or by: what a reassign reads back for its answer (the caller's right to change it was decided by the route). */
const EVERY_TASK: QueueScope = { engineerId: null, assignedById: null };

/**
 * An Engineer sees their own tasks; a Lead and an Admin see all (AC-2). `assignedBy: 'me'` narrows that to the tasks the viewer assigned (the Lead's bell, STORY-04.03
 * AC-3): it is ANDed with the role's cut, so it can only narrow, and the person it names is the session's, never the request's. A switch, so a fourth role cannot
 * compile without a decision.
 */
function scopeOf(viewer: QueueViewer, assignedBy?: 'me' | 'anyone'): QueueScope {
  const assignedById = assignedBy === 'me' ? viewer.id : null;
  switch (viewer.role) {
    case 'ENGINEER':
      return { engineerId: viewer.id, assignedById };
    case 'LEAD':
    case 'ADMIN':
      return { engineerId: null, assignedById };
  }
}

const ENGINEER_FILTER_MESSAGE = 'Only a Lead or an Admin can use this filter.';
const FILTER_FIELDS = ['assignedBy', 'engineer', 'customer', 'from', 'to'] as const;

/**
 * The filter row of a query as the repository reads it (STORY-04.06 AC-3, AC-4, AC-5). An Engineer may search and nothing else: any other filter is a 422 naming it, so a
 * hostile `engineer=` or `assignedBy=anyone` is refused and never ignored in silence. A range that ends before it begins is a 422 under To. The values are narrowing only:
 * they are ANDed with the scope, which comes from the session.
 */
function filterOf(viewer: QueueViewer, query: QueueQuery): QueueFilter {
  if (viewer.role === 'ENGINEER') {
    const refused = FILTER_FIELDS.filter((field) => query[field] !== undefined);
    if (refused.length > 0) throw new FieldValidationError(refused.map((field) => ({ field, message: ENGINEER_FILTER_MESSAGE })));
  }
  if (query.from !== undefined && query.to !== undefined && query.from > query.to) throw new FieldValidationError([{ field: 'to', message: DATE_ORDER_MESSAGE }]);
  return {
    text: query.q === undefined || query.q === '' ? null : query.q,
    engineerId: query.engineer ?? null,
    customerId: query.customer ?? null,
    deadlineFrom: query.from === undefined ? null : startOfIstDay(query.from),
    deadlineBefore: query.to === undefined ? null : startOfNextIstDay(query.to),
  };
}

/** What the bell counts (FR-037, STORY-04.03 AC-2): an Engineer's own overdue tasks, the overdue tasks a Lead assigned, and every overdue task for an Admin. */
function bellScopeOf(viewer: QueueViewer): QueueScope {
  switch (viewer.role) {
    case 'ENGINEER':
      return { engineerId: viewer.id, assignedById: null };
    case 'LEAD':
      return { engineerId: null, assignedById: viewer.id };
    case 'ADMIN':
      return { engineerId: null, assignedById: null };
  }
}

/** What a row of the queue and the task route share: everything but the status and the remarks, which the two word differently (a row shows the display status, the task page the status and the layer). */
function sharedFieldsOf(row: QueueRow) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    engineer: row.engineer,
    customerName: row.customer?.name ?? null,
    folderPath: row.folderPath,
    folderUrl: folderUrlOf(row.folderPath),
    deadlineAt: row.deadlineAt,
    assignedByName: row.assignedByName,
  };
}

function toQueueTask(row: QueueRow): QueueTask {
  return { ...sharedFieldsOf(row), status: displayStatusOf(row), ignoredRemarks: row.ignoredAt === null ? null : row.ignoreRemarks };
}

function problemsOf(errors: Readonly<Record<string, string | undefined>>): ReadonlyArray<FieldProblem> {
  return Object.entries(errors).flatMap(([field, message]) => (message === undefined ? [] : [{ field, message }]));
}

export function createTaskService({ tasks, transactions, clock, audit, mail }: TaskDependencies): TaskService {
  /**
   * Writes the assignment e-mail's row in `tx`: the person who assigned or changed the task is read in the same transaction (their name for the message, and whether they are active now for
   * the Cc, decision D-5). Always a Lead or an Admin: an ID that is neither is a mistake in the code, and refusing it rolls the whole change back.
   */
  async function enqueueAssigned(tx: Transaction, task: TaskMailTask, assignerId: string): Promise<void> {
    if (mail === undefined) return;
    const assigner = await tasks.findAssigner(assignerId, tx);
    if (assigner === null) throw new Error('The person who assigned the task could not be read.');
    await mail.enqueueTaskAssigned(tx, task, assigner);
  }

  return {
    getAssignContext: async () => {
      const [engineers, customers, alertsEnabled] = await Promise.all([
        tasks.listActiveEngineers(),
        tasks.listActiveCustomers(),
        mail === undefined ? Promise.resolve(false) : mail.alertsEnabled(),
      ]);
      return { engineers, customers, alertsEnabled };
    },

    async assignTask(assignedById, input) {
      const now = clock.now();
      const checked = checkAssign(input, now);
      if (!checked.ok) throw new FieldValidationError(problemsOf(checked.errors));
      const { values } = checked;
      const folderUrl = folderUrlOf(values.folderPath);
      if (folderUrl === null) throw new Error('A checked folder path has no link.');
      // Read before the transaction opens: the row is written, or not, by the switches as they are now (the alerts setting, and `FEATURE_EMAIL`, DEF-055); a setting turned off before the worker
      // claims the row skips it (STORY-09.01 AC-5).
      const queueing = mail !== undefined && (await mail.queueingEnabled());

      return transactions.run(async (tx) => {
        const engineer = await tasks.findActiveEngineer(values.engineerId, tx);
        const customer = await tasks.findActiveCustomer(values.customerId, tx);
        // Every problem at once (AC-5): an Engineer and a customer that are both wrong are both named.
        const notFound: FieldProblem[] = [
          ...(engineer === null ? [{ field: 'engineerId', message: ENGINEER_MESSAGE }] : []),
          ...(customer === null ? [{ field: 'customerId', message: CUSTOMER_MESSAGE }] : []),
        ];
        if (engineer === null || customer === null) throw new FieldValidationError(notFound);
        const year = istYearOf(now);
        const code = formatTaskCode(year, await tasks.takeNextNumber(year, tx));
        const task = await tasks.createTask(
          { code, engineerId: engineer.id, assignedById, folderPath: values.folderPath, deadlineAt: values.deadlineAt, title: values.title, subject: values.subject, notes: values.notes },
          tx,
        );
        const estimate = await tasks.createEstimate(task.id, customer.id, tx);
        if (queueing) {
          await enqueueAssigned(
            tx,
            { id: task.id, code: task.code, title: task.title, notes: task.notes, folderPath: task.folderPath, deadlineAt: task.deadlineAt, assignmentRevision: task.assignmentRevision, engineer },
            assignedById,
          );
        }
        return {
          id: task.id,
          code: task.code,
          engineer,
          folderPath: task.folderPath,
          folderUrl,
          deadlineAt: task.deadlineAt,
          title: task.title,
          subject: task.subject,
          customer,
          notes: task.notes,
          estimate: { id: estimate.id, status: estimate.status, customerId: estimate.customerId },
        };
      });
    },

    async listQueue(viewer, query) {
      const now = clock.now();
      const filter = filterOf(viewer, query);
      const scope = scopeOf(viewer, query.assignedBy);
      const limit = query.limit ?? QUEUE_DEFAULT_LIMIT;
      // One more than the page, to know whether another page follows without a count of its own.
      // An Engineer's Ignored tab follows the one predicate (A-CR01-2): were it to say no, the tab and its count would be empty and an ignored task would open as not found.
      const hidden = viewer.role === 'ENGINEER' && !engineerSeesIgnored();
      const [rows, allCounts] = await Promise.all([
        hidden && query.tab === 'ignored' ? Promise.resolve([]) : tasks.listQueue({ tab: query.tab, scope, now, limit: limit + 1, after: query.cursor ?? null, filter }),
        tasks.countQueue(scope, now, filter),
      ]);
      const counts = hidden ? { ...allCounts, ignored: 0 } : allCounts;
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        tab: query.tab,
        tasks: page.map(toQueueTask),
        counts,
        nextCursor: rows.length > limit && last !== undefined ? encodeTaskQueueCursor({ deadlineAt: last.deadlineAt, code: last.code }) : null,
        asOf: now,
      };
    },

    async getTask(viewer, id) {
      const row = await tasks.findTask(id, scopeOf(viewer));
      if (row === null) return null;
      // The same predicate as the queue's (A-CR01-2): an Engineer who may not see ignored tasks finds an ignored one as "not found", as any task that is not theirs.
      if (row.ignoredAt !== null && viewer.role === 'ENGINEER' && !engineerSeesIgnored()) return null;
      const ignored = row.ignoredAt === null || row.ignoreRemarks === null || row.ignoredByName === null ? null : { at: row.ignoredAt, byName: row.ignoredByName, remarks: row.ignoreRemarks };
      return { ...sharedFieldsOf(row), status: row.status, notes: row.notes, subject: row.subject, customer: row.customer, ignored };
    },

    async reassignTask(context, id, input) {
      if (audit === undefined) throw new Error('This task service was built without the audit service, so it cannot reassign.');
      const now = clock.now();
      const outcome = await transactions.run(async (tx) => {
        const locked = await tasks.findTaskForUpdate(id, tx);
        if (locked === null) throw new NotFoundError();
        // Read under the lock: an approval that was committing has finished, and is seen here (AC-6).
        // An ignored task is read-only until it is restored, so its Engineer and deadline cannot be changed either (FR-040, DL-304 (1), A-CR01-8): refused by this route's own check, with the state machine's code and words.
        if (locked.ignoredAt !== null) throw new ConflictError(TRANSITION_REFUSALS.IGNORED.message, { code: TRANSITION_REFUSALS.IGNORED.code });
        if (isTaskClosed(locked.status, false)) throw new ConflictError(TASK_CLOSED_MESSAGE, { code: TASK_CLOSED_CODE });
        const checked = checkReassign(input, { engineerId: locked.engineer.id, deadlineAt: locked.deadlineAt }, now);
        if (!checked.ok) throw new FieldValidationError(problemsOf(checked.errors));
        const { changes } = checked;
        const engineer = changes.engineerId === null ? locked.engineer : await tasks.findActiveEngineer(changes.engineerId, tx);
        if (engineer === null) throw new FieldValidationError([{ field: 'engineerId', message: ENGINEER_MESSAGE }]);
        const engineerChanged = changes.engineerId !== null;
        const deadlineChanged = changes.deadlineAt !== null;
        if (!engineerChanged && !deadlineChanged) return { engineerChanged, deadlineChanged, assignmentRevision: locked.assignmentRevision };

        const deadlineAt = changes.deadlineAt ?? locked.deadlineAt;
        const assignmentRevision = locked.assignmentRevision + (engineerChanged ? 1 : 0);
        await tasks.setAssignment(locked.id, { engineerId: engineer.id, deadlineAt, assignmentRevision }, tx);
        // One entry for one save, whichever of the two changed (D-g). A change that cannot be recorded does not happen: the refusal rolls the transaction back.
        await audit.record(tx, {
          event: 'task.reassigned',
          ...context,
          object: { id: locked.id, label: locked.code },
          before: { engineer: locked.engineer, deadlineAt: locked.deadlineAt.toISOString() },
          after: { engineer, deadlineAt: deadlineAt.toISOString() },
        });
        // A new Engineer is told as a first assignment is, with the new revision in the key and the person who made the change copied (STORY-09.03 AC-7). A deadline-only change is not
        // an assignment: the overdue e-mail follows the deadline (STORY-09.04). The old Engineer's unsent assignment e-mail is withdrawn first, whatever the switches say now (it may have been
        // written while they were on), in this transaction, so a reassign that rolls back leaves it as it was (DEF-055).
        if (engineerChanged && mail !== undefined) {
          await mail.withdrawUnsent(tx, locked.id);
          if (await mail.queueingEnabled()) {
            await enqueueAssigned(
              tx,
              { id: locked.id, code: locked.code, title: locked.title, notes: locked.notes, folderPath: locked.folderPath, deadlineAt, assignmentRevision, engineer },
              context.actorId,
            );
          }
        }
        return { engineerChanged, deadlineChanged, assignmentRevision };
      });
      // The answer is the row as the queue shows it, read once the change is committed.
      const row = await tasks.findTask(id, EVERY_TASK);
      if (row === null) throw new Error('A task that was just changed could not be read back.');
      return { task: toQueueTask(row), ...outcome };
    },

    countOverdue: (viewer) => tasks.countOverdue(bellScopeOf(viewer), clock.now()),
  };
}
