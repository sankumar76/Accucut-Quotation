import type { RoleName } from '../../lib/auth/roles';
import { FieldValidationError, type FieldProblem } from '../../lib/errors';
import { checkAssign, ENGINEER_MESSAGE, type AssignErrors, type AssignInput } from '../../lib/tasks/assign';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import { QUEUE_DEFAULT_LIMIT, type QueueCounts, type QueueTab, type TaskEstimateStatus } from '../../lib/tasks/queue';
import { formatTaskCode } from '../../lib/tasks/task-code';
import { istYearOf, type Clock } from '../../lib/time';
import type { EngineerRecord, EstimateRecord, QueueRow, QueueScope, TaskRepository } from '../repositories/task-repository';
import type { TransactionRunner } from '../repositories/transaction';

import { encodeTaskQueueCursor, type TaskQueueCursor } from './task-queue-cursor';

/**
 * Tasks (STORY-04.01; FR-032, FR-033, FR-041; architecture sections 4.1, 5.1, 6 and 8). A Lead or an Admin assigns a task to an Engineer. Who may call is
 * decided before this is reached (`withRoute`, the manifest, BR-004); this file holds the rules that stay true whoever asks:
 *
 *   - **The input is checked again here, against the server's clock** (AC-3): the same rules as the form (`lib/tasks/assign.ts`), so the words are the
 *     same, and every problem is named at once. A deadline that is not later than now is refused whatever the browser said.
 *   - **The Engineer is looked up in the same transaction** (AC-3): an inactive person, a Lead, an Admin and an unknown ID are all "Choose an Engineer.",
 *     a 422 under that field, and nothing is stored.
 *   - **A task, its empty estimate and its number are one transaction** (AC-1, AC-2): if any insert fails none exists, and the number goes back. The
 *     code is `Q-<year>-<number>`, the year read in IST (FR-041, NFR-015), the number from the locked sequence.
 *   - **The `file:` link is built here**, from the validated UNC path (AC-4); the browser is never asked to build one.
 *
 * There is no audit entry: the audit log of architecture section 8 lists a task change (STORY-04.07), not the assignment.
 *
 * The queue (STORY-04.02; FR-034, architecture sections 4.4 and 6): the Open, Closed and Overdue tabs, each sorted by deadline and then by code.
 *
 *   - **Who sees what is decided here, from the session's role** (AC-2): an Engineer is scoped to their own tasks by their own ID, a Lead and an Admin see every
 *     task. No part of a request can widen the scope, because the request has no field for it (the filters of STORY-04.06 arrive with their own rules).
 *   - **Open, Closed and Overdue are derived at read time** from the status of the estimate and the deadline against the server's clock (AC-1): a task whose
 *     deadline is exactly now is not overdue yet, one a millisecond past it is; an overdue task is also in Open.
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
  readonly title: string | null;
  readonly notes: string | null;
  readonly estimate: Pick<EstimateRecord, 'id' | 'status' | 'customerId'>;
}

/** What SCR-04 chooses from. */
export interface AssignContext {
  readonly engineers: ReadonlyArray<EngineerRecord>;
}

/** A task as a row of the queue shows it. The deadline is an instant in UTC; the screen shows it in IST. */
export interface QueueTask {
  readonly id: string;
  readonly code: string;
  readonly title: string | null;
  readonly engineer: EngineerRecord;
  /** Null until the Engineer chooses the customer ("Not chosen yet"). */
  readonly customerName: string | null;
  readonly folderPath: string;
  /** Built here from the path; null only for a path the portal would not have accepted, so the row then shows the path as text. */
  readonly folderUrl: string | null;
  readonly deadlineAt: Date;
  readonly status: TaskEstimateStatus;
  readonly assignedByName: string;
}

/** One page of one tab, and how many tasks each tab holds for this person. */
export interface TaskQueue {
  readonly tab: QueueTab;
  readonly tasks: ReadonlyArray<QueueTask>;
  readonly counts: QueueCounts;
  /** Where the next page begins, or null on the last page. */
  readonly nextCursor: string | null;
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
}

export interface TaskService {
  /** The active Engineers, for the Engineer field (`GET /api/v1/options/assign-context`). */
  getAssignContext(): Promise<AssignContext>;
  /**
   * Assigns a task to an Engineer and makes its empty estimate. `assignedById` is the caller, taken from the session by the route and never from the body.
   * Refused with a 422 naming each field that is wrong; nothing is stored then.
   */
  assignTask(assignedById: string, input: AssignInput): Promise<AssignedTask>;
  /** A page of a tab for this person, with the count of every tab (STORY-04.02 AC-1, AC-2). */
  listQueue(viewer: QueueViewer, query: QueueQuery): Promise<TaskQueue>;
}

export interface TaskDependencies {
  readonly tasks: TaskRepository;
  readonly transactions: TransactionRunner;
  readonly clock: Clock;
}

/** An Engineer sees their own tasks; a Lead and an Admin see all (AC-2). A switch, so a fourth role cannot compile without a decision. */
function scopeOf(viewer: QueueViewer): QueueScope {
  switch (viewer.role) {
    case 'ENGINEER':
      return { engineerId: viewer.id };
    case 'LEAD':
    case 'ADMIN':
      return { engineerId: null };
  }
}

function toQueueTask(row: QueueRow): QueueTask {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    engineer: row.engineer,
    customerName: row.customerName,
    folderPath: row.folderPath,
    folderUrl: folderUrlOf(row.folderPath),
    deadlineAt: row.deadlineAt,
    status: row.status,
    assignedByName: row.assignedByName,
  };
}

function problemsOf(errors: AssignErrors): ReadonlyArray<FieldProblem> {
  return Object.entries(errors).map(([field, message]) => ({ field, message }));
}

export function createTaskService({ tasks, transactions, clock }: TaskDependencies): TaskService {
  return {
    getAssignContext: async () => ({ engineers: await tasks.listActiveEngineers() }),

    async assignTask(assignedById, input) {
      const now = clock.now();
      const checked = checkAssign(input, now);
      if (!checked.ok) throw new FieldValidationError(problemsOf(checked.errors));
      const { values } = checked;
      const folderUrl = folderUrlOf(values.folderPath);
      if (folderUrl === null) throw new Error('A checked folder path has no link.');

      return transactions.run(async (tx) => {
        const engineer = await tasks.findActiveEngineer(values.engineerId, tx);
        if (engineer === null) throw new FieldValidationError([{ field: 'engineerId', message: ENGINEER_MESSAGE }]);
        const year = istYearOf(now);
        const code = formatTaskCode(year, await tasks.takeNextNumber(year, tx));
        const task = await tasks.createTask(
          { code, engineerId: engineer.id, assignedById, folderPath: values.folderPath, deadlineAt: values.deadlineAt, title: values.title, notes: values.notes },
          tx,
        );
        const estimate = await tasks.createEstimate(task.id, tx);
        return {
          id: task.id,
          code: task.code,
          engineer,
          folderPath: task.folderPath,
          folderUrl,
          deadlineAt: task.deadlineAt,
          title: task.title,
          notes: task.notes,
          estimate: { id: estimate.id, status: estimate.status, customerId: estimate.customerId },
        };
      });
    },

    async listQueue(viewer, query) {
      const now = clock.now();
      const scope = scopeOf(viewer);
      const limit = query.limit ?? QUEUE_DEFAULT_LIMIT;
      // One more than the page, to know whether another page follows without a count of its own.
      const [rows, counts] = await Promise.all([
        tasks.listQueue({ tab: query.tab, scope, now, limit: limit + 1, after: query.cursor ?? null }),
        tasks.countQueue(scope, now),
      ]);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        tab: query.tab,
        tasks: page.map(toQueueTask),
        counts,
        nextCursor: rows.length > limit && last !== undefined ? encodeTaskQueueCursor({ deadlineAt: last.deadlineAt, code: last.code }) : null,
      };
    },
  };
}
