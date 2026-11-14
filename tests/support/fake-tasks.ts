import type {
  EngineerRecord,
  EstimateRecord,
  NewTask,
  TaskRecord,
  TaskRepository,
} from '../../src/server/repositories/task-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * An in-memory task repository and transaction runner, for unit tests of the rules (no database): the people come from a list the test owns, a number is
 * taken from a per-year counter, and a transaction that throws puts the tasks, the estimates and the counters back as they were, as PostgreSQL does. The
 * real queries, the lock and the constraints are tested against PostgreSQL in `tests/integration/tasks`. Every name here is invented.
 */

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
  let failure: Error | null = null;

  const repository: TaskRepository = {
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
    failNextEstimateWith(error) {
      failure = error;
    },
  };
}
