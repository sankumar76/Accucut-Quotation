import type {
  AssignCustomer,
  EngineerRecord,
  EstimateRecord,
  EstimateStatus,
  LockedTask,
  NewTask,
  QueueFilter,
  QueueRow,
  QueueScope,
  TaskDetailRow,
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
  /** A fixed ID, for a recipe that names the task by it (`estimate-recipe.ts`); otherwise the next invented one. */
  readonly id?: string;
  readonly code: string;
  readonly engineerId: string;
  readonly assignedById: string;
  readonly deadlineAt: Date;
  readonly title?: string;
  /** The project name; the next invented one when left out. */
  readonly subject?: string;
  readonly notes?: string | null;
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
  /** The names of the customers a task may have, by ID. A test that sets one gets the short name `SHORT` for it unless `customerShortNames` has another. */
  readonly customers: Map<string, string>;
  /** The short names of those customers, by ID. */
  readonly customerShortNames: Map<string, string>;
  /** The IDs of the customers the Admin has deleted: an assignment cannot choose one, and an estimate that has one still names it. */
  readonly deletedCustomers: Set<string>;
  /** Puts a task and its estimate in directly (any deadline, any status) and returns the task. */
  seed(task: SeededTask): TaskRecord;
  /** Puts the estimate of a task into another status, as an approval, an unlock or a calculation would (a test of the status words). */
  setStatus(taskId: string, status: EstimateStatus): void;
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
  const customerShortNames = new Map<string, string>();
  const deletedCustomers = new Set<string>();
  let failure: Error | null = null;

  const customerOf = (id: string): AssignCustomer | null => {
    const name = customers.get(id);
    return name === undefined ? null : { id, name, shortName: customerShortNames.get(id) ?? 'SHORT' };
  };

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
          subject: task.subject,
          folderPath: task.folderPath,
          deadlineAt: task.deadlineAt,
          engineer: { id: task.engineerId, name: nameOf(task.engineerId) },
          assignedByName: nameOf(task.assignedById),
          customer: estimate.customerId === null ? null : customerOf(estimate.customerId),
          status: estimate.status,
        },
      ];
    });
  }

  const inTab = (row: QueueRow, tab: 'open' | 'closed' | 'overdue', now: Date): boolean =>
    tab === 'closed' ? row.status === 'APPROVED' : row.status !== 'APPROVED' && (tab === 'open' || row.deadlineAt.getTime() < now.getTime());

  /** The filter row of a read, written the way the SQL means it: a literal contains on the code and the title ignoring case, the estimate's customer, and the deadline range. */
  const passes = (row: QueueRow, filter: QueueFilter): boolean => {
    const text = filter.text?.toLowerCase() ?? null;
    const customerId = estimates.find((candidate) => candidate.taskId === row.id)?.customerId ?? null;
    return (
      (text === null || row.code.toLowerCase().includes(text) || row.title.toLowerCase().includes(text)) &&
      (filter.engineerId === null || row.engineer.id === filter.engineerId) &&
      (filter.customerId === null || customerId === filter.customerId) &&
      (filter.deadlineFrom === null || row.deadlineAt.getTime() >= filter.deadlineFrom.getTime()) &&
      (filter.deadlineBefore === null || row.deadlineAt.getTime() < filter.deadlineBefore.getTime())
    );
  };

  /** The rows of a scope: one Engineer's own, the ones one person assigned, both, or all (the same cut as `scopeFilter` of the real repository). */
  const inScope = (scope: QueueScope): QueueRow[] => {
    const assignedBy = new Map(tasks.map((task) => [task.id, task.assignedById]));
    return queueRows().filter((row) => (scope.engineerId === null || row.engineer.id === scope.engineerId) && (scope.assignedById === null || assignedBy.get(row.id) === scope.assignedById));
  };

  const repository: TaskRepository = {
    findTaskForUpdate: (id) => {
      const task = tasks.find((candidate) => candidate.id.toLowerCase() === id.toLowerCase());
      const estimate = task === undefined ? undefined : estimates.find((candidate) => candidate.taskId === task.id);
      if (task === undefined || estimate === undefined) return Promise.resolve(null);
      const locked: LockedTask = {
        id: task.id,
        code: task.code,
        engineer: { id: task.engineerId, name: nameOf(task.engineerId) },
        deadlineAt: task.deadlineAt,
        assignmentRevision: task.assignmentRevision,
        status: estimate.status,
        folderPath: task.folderPath,
        title: task.title,
        notes: task.notes,
      };
      return Promise.resolve(locked);
    },
    setAssignment: (id, state) => {
      const index = tasks.findIndex((candidate) => candidate.id === id);
      const held = tasks[index];
      if (held === undefined) return Promise.reject(new Error('The task to change is not there.'));
      tasks.splice(index, 1, { ...held, ...state });
      return Promise.resolve();
    },
    findTask: (id, scope) => {
      const row = inScope(scope).find((candidate) => candidate.id.toLowerCase() === id.toLowerCase());
      const task = row === undefined ? undefined : tasks.find((candidate) => candidate.id === row.id);
      const detail: TaskDetailRow | null = row === undefined || task === undefined ? null : { ...row, notes: task.notes };
      return Promise.resolve(detail);
    },
    listQueue: ({ tab, scope, now, limit, after, filter }) => {
      const earlier = (row: QueueRow): boolean =>
        after === null || row.deadlineAt.getTime() > after.deadlineAt.getTime() || (row.deadlineAt.getTime() === after.deadlineAt.getTime() && row.code > after.code);
      const rows = inScope(scope)
        .filter((row) => inTab(row, tab, now) && earlier(row) && passes(row, filter))
        .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime() || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
      return Promise.resolve(rows.slice(0, limit));
    },
    countQueue: (scope, now, filter) => {
      const mine = inScope(scope).filter((row) => passes(row, filter));
      const count = (tab: 'open' | 'closed' | 'overdue'): number => mine.filter((row) => inTab(row, tab, now)).length;
      return Promise.resolve({ open: count('open'), closed: count('closed'), overdue: count('overdue') });
    },
    countOverdue: (scope, now) => Promise.resolve(inScope(scope).filter((row) => inTab(row, 'overdue', now)).length),
    listActiveCustomers: () =>
      Promise.resolve(
        [...customers.keys()]
          .filter((id) => !deletedCustomers.has(id))
          .flatMap((id) => {
            const customer = customerOf(id);
            return customer === null ? [] : [customer];
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    findActiveCustomer: (id) => {
      const found = [...customers.keys()].find((candidate) => candidate.toLowerCase() === id.toLowerCase() && !deletedCustomers.has(candidate));
      return Promise.resolve(found === undefined ? null : customerOf(found));
    },
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
    findAssigner: (id) => {
      const found = people().find((person) => person.id.toLowerCase() === id.toLowerCase() && (person.role === 'LEAD' || person.role === 'ADMIN'));
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name, isActive: found.isActive });
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
    createEstimate: (taskId, customerId) => {
      if (failure !== null) {
        const error = failure;
        failure = null;
        return Promise.reject(error);
      }
      const created: EstimateRecord = { id: nextId(), taskId, customerId, status: 'DRAFT' };
      estimates.push(created);
      return Promise.resolve(created);
    },
  };

  const transactions: TransactionRunner = {
    async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const before = { tasks: [...tasks], estimates: estimates.length, sequences: new Map(sequences) };
      try {
        return await work(createTransactionHandle());
      } catch (error) {
        // A task is replaced (never edited) when its assignment changes, so the records kept are the ones as they were.
        tasks.splice(0, tasks.length, ...before.tasks);
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
    customerShortNames,
    deletedCustomers,
    seed(seeded) {
      const task: TaskRecord = {
        code: seeded.code,
        engineerId: seeded.engineerId,
        assignedById: seeded.assignedById,
        folderPath: seeded.folderPath ?? '\\\\invented-server\\invented-share\\RFQ-1',
        deadlineAt: seeded.deadlineAt,
        title: seeded.title ?? 'Invented task',
        subject: seeded.subject ?? 'Invented subject',
        notes: seeded.notes ?? null,
        id: seeded.id ?? nextId(),
        assignmentRevision: 1,
      };
      tasks.push(task);
      estimates.push({ id: nextId(), taskId: task.id, customerId: seeded.customerId ?? null, status: seeded.status ?? 'DRAFT' });
      return task;
    },
    setStatus(taskId, status) {
      const index = estimates.findIndex((estimate) => estimate.taskId === taskId);
      const held = estimates[index];
      if (held === undefined) throw new Error('The task has no estimate to change.');
      estimates.splice(index, 1, { ...held, status });
    },
    failNextEstimateWith(error) {
      failure = error;
    },
  };
}
