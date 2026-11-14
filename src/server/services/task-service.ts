import { FieldValidationError, type FieldProblem } from '../../lib/errors';
import { checkAssign, ENGINEER_MESSAGE, type AssignErrors, type AssignInput } from '../../lib/tasks/assign';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import { formatTaskCode } from '../../lib/tasks/task-code';
import { istYearOf, type Clock } from '../../lib/time';
import type { EngineerRecord, EstimateRecord, TaskRepository } from '../repositories/task-repository';
import type { TransactionRunner } from '../repositories/transaction';

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

export interface TaskService {
  /** The active Engineers, for the Engineer field (`GET /api/v1/options/assign-context`). */
  getAssignContext(): Promise<AssignContext>;
  /**
   * Assigns a task to an Engineer and makes its empty estimate. `assignedById` is the caller, taken from the session by the route and never from the body.
   * Refused with a 422 naming each field that is wrong; nothing is stored then.
   */
  assignTask(assignedById: string, input: AssignInput): Promise<AssignedTask>;
}

export interface TaskDependencies {
  readonly tasks: TaskRepository;
  readonly transactions: TransactionRunner;
  readonly clock: Clock;
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
  };
}
