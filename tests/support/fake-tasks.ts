import type {
  EngineerRecord,
  EstimateRecord,
  EstimateStatus,
  NewTask,
  QueueRow,
  QueueScope,
  TaskRecord,
  TaskRepository,
} from '../../src/server/repositories/task-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * An in-memory task repository and transaction runner, for unit tests of the rules (no database): the people come from a list the test owns, a number is
 * taken from a per-year counter, and a transaction that throws puts the tasks, the estimates and the counters back as they were, as PostgreSQL does. The
 * real queries, the lock and the constraints are tested against PostgreSQL in `tests/integration/tasks`. Every name here is invented.
 *
 * The queue's reads (STORY-04.02) are written here the way the SQL means them, for the rules of the service: Open is "not APPROVED", Closed is "APPROVED", Overdue is
 * open and a deadline before `now`, sorted by deadline and then code, cut after a position. `seed` puts a task and its estimate in directly, in any state, which the
 * assignment cannot (it refuses a deadline that is not later than now).
 */

/** A task put in directly, for a test of the queue. */
export interface SeededTask {
  readonly code: string;
  readonly engineerId: string;
  readonly assignedById: string;
  readonly deadlineAt: Date;
  readonly title?: string | null;
  readonly folderPath?: string;
  readonly status?: EstimateStatus;
  readonly customerId?: string | null;
}

export interface FakePerson {
  readonly id: string;
  readonly name: string;
  readonly role: 'ADMIN' | 'LEAD' | 'ENGINEER';
  readonly isActive: boolean;
}

export interface FakeTaskWorld {
  readonly repository: TaskRepository;
  readonly transactions: TransactionRunner;
  /** The tasks of committed transactions, oldest first. */
  readonly tasks: TaskRecord[];
  readonly estimates: EstimateRecord[];
  /** The last number issued for each year. */
  readonly sequences: Map<number, number>;
  /** The names of the customers a seeded task may have chosen, by ID. */
  readonly customers: Map<string, string>;
  /** Puts a task and its estimate in directly (any deadline, any status) and returns the task. */
  seed(task: SeededTask): TaskRecord;
  /** Makes the next `createEstimate` fail once with this error, after the task and the number were written (a late failure). */
  failNextEstimateWith(error: Error): void;
}

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

/** `people` is read on every call, so a test can deactivate a person or change a role and the next request sees it. */
export function createFakeTaskWorld(people: () => ReadonlyArray<FakePerson>): FakeTaskWorld {
  const tasks: TaskRecord[] = [];
  const estimates: EstimateRecord[] = [];
  const sequences = new Map<number, number>();
  const customers = new Map<string, string>();
  let failure: Error | null = null;

  const nameOf = (id: string): string => people().find((person) => person.id === id)?.name ?? 'Invented unknown person';

  function queueRows(): QueueRow[] {
    return tasks.flatMap((task): QueueRow[] => {
      const estimate = estimates.find((candidate) => candidate.taskId === task.id);
      if (estimate === undefined) return [];
      return [
        {
          id: task.id,
          code: task.code,
          title: task.title,
          folderPath: task.folderPath,
          deadlineAt: task.deadlineAt,
          engineer: { id: task.engineerId, name: nameOf(task.engineerId) },
          assignedByName: nameOf(task.assignedById),
          customerName: estimate.customerId === null ? null : (customers.get(estimate.customerId) ?? null),
          status: estimate.status,
        },
      ];
    });
  }

  const inTab = (row: QueueRow, tab: 'open' | 'closed' | 'overdue', now: Date): boolean =>
    tab === 'closed' ? row.status === 'APPROVED' : row.status !== 'APPROVED' && (tab === 'open' || row.deadlineAt.getTime() < now.getTime());

  /** The rows of a scope: one Engineer's own, the ones one person assigned, both, or all (the same cut as `scopeFilter` of the real repository). */
  const inScope = (scope: QueueScope): QueueRow[] => {
    const assignedBy = new Map(tasks.map((task) => [task.id, task.assignedById]));
    return queueRows().filter((row) => (scope.engineerId === null || row.engineer.id === scope.engineerId) && (scope.assignedById === null || assignedBy.get(row.id) === scope.assignedById));
  };

  const repository: TaskRepository = {
    listQueue: ({ tab, scope, now, limit, after }) => {
      const earlier = (row: QueueRow): boolean =>
        after === null || row.deadlineAt.getTime() > after.deadlineAt.getTime() || (row.deadlineAt.getTime() === after.deadlineAt.getTime() && row.code > after.code);
      const rows = inScope(scope)
        .filter((row) => inTab(row, tab, now) && earlier(row))
        .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime() || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
      return Promise.resolve(rows.slice(0, limit));
    },
    countQueue: (scope, now) => {
      const mine = inScope(scope);
      const count = (tab: 'open' | 'closed' | 'overdue'): number => mine.filter((row) => inTab(row, tab, now)).length;
      return Promise.resolve({ open: count('open'), closed: count('closed'), overdue: count('overdue') });
    },
    countOverdue: (scope, now) => Promise.resolve(inScope(scope).filter((row) => inTab(row, 'overdue', now)).length),
    listActiveEngineers: () =>
      Promise.resolve(
        people()
          .filter((person) => person.role === 'ENGINEER' && person.isActive)
          .map((person): EngineerRecord => ({ id: person.id, name: person.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    findActiveEngineer: (id) => {
      const found = people().find((person) => person.id.toLowerCase() === id.toLowerCase() && person.role === 'ENGINEER' && person.isActive);
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name });
    },
    takeNextNumber: (year) => {
      const next = (sequences.get(year) ?? 0) + 1;
      sequences.set(year, next);
      return Promise.resolve(next);
    },
    createTask: (task: NewTask) => {
      const created: TaskRecord = { ...task, id: nextId(), assignmentRevision: 1 };
      tasks.push(created);
      return Promise.resolve(created);
    },
    createEstimate: (taskId) => {
      if (failure !== null) {
        const error = failure;
        failure = null;
        return Promise.reject(error);
      }
      const created: EstimateRecord = { id: nextId(), taskId, customerId: null, status: 'DRAFT' };
      estimates.push(created);
      return Promise.resolve(created);
    },
  };

  const transactions: TransactionRunner = {
    async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const before = { tasks: tasks.length, estimates: estimates.length, sequences: new Map(sequences) };
      try {
        return await work(createTransactionHandle());
      } catch (error) {
        tasks.length = before.tasks;
        estimates.length = before.estimates;
        sequences.clear();
        for (const [year, value] of before.sequences) sequences.set(year, value);
        throw error;
      }
    },
  };

  return {
    repository,
    transactions,
    tasks,
    estimates,
    sequences,
    customers,
    seed(seeded) {
      const task: TaskRecord = {
        code: seeded.code,
        engineerId: seeded.engineerId,
        assignedById: seeded.assignedById,
        folderPath: seeded.folderPath ?? '\\\\invented-server\\invented-share\\RFQ-1',
        deadlineAt: seeded.deadlineAt,
        title: seeded.title ?? null,
        notes: null,
        id: nextId(),
        assignmentRevision: 1,
      };
      tasks.push(task);
      estimates.push({ id: nextId(), taskId: task.id, customerId: seeded.customerId ?? null, status: seeded.status ?? 'DRAFT' });
      return task;
    },
    failNextEstimateWith(error) {
      failure = error;
    },
  };
}
