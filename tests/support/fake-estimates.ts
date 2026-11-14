import type { CustomerChoice, EstimateLock, EstimateRepository, WorkspaceRecord } from '../../src/server/repositories/estimate-repository';
import type { EstimateStatus } from '../../src/server/repositories/task-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * An in-memory estimate repository and transaction runner, for unit tests of the rules (no database): the estimates are a list the test owns, the customers
 * come from a list it also owns (so a deleted one is simply marked), a transaction that throws puts the estimates back as they were, as PostgreSQL does, and
 * transactions run one after another, as the estimate's row lock makes them (STORY-06.01 AC-4: the second waits and then sees what the first did).
 * The real queries and the row lock are tested against PostgreSQL in `tests/integration/estimates`. Every name here is invented.
 */

/** An estimate with its task, as a test sets it up and reads it back. `inputsRevision` is what the real table keeps. */
export interface FakeEstimate {
  id: string;
  code: string;
  engineerId: string;
  assignedByName: string;
  folderPath: string;
  deadlineAt: Date;
  title: string | null;
  notes: string | null;
  status: EstimateStatus;
  customerId: string | null;
  inputsRevision: number;
}

export interface FakeCustomerEntry {
  readonly id: string;
  readonly name: string;
  readonly deleted: boolean;
}

export interface FakeEstimateWorld {
  readonly repository: EstimateRepository;
  readonly transactions: TransactionRunner;
  /** The estimates, which a test may change in place (a status, a customer). */
  readonly estimates: FakeEstimate[];
  /** How many times `setCustomer` wrote, so "no write" is something a test can see. */
  writes(): number;
  /** How many times `setStatus` changed a status. */
  statusWrites(): number;
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function createFakeEstimateWorld(customers: () => ReadonlyArray<FakeCustomerEntry>, initial: ReadonlyArray<FakeEstimate> = []): FakeEstimateWorld {
  const estimates: FakeEstimate[] = initial.map((estimate) => ({ ...estimate }));
  let writes = 0;
  let statusWrites = 0;
  const customerOf = (id: string | null): CustomerChoice | null => {
    const found = id === null ? undefined : customers().find((customer) => same(customer.id, id));
    return found === undefined ? null : { id: found.id, name: found.name };
  };

  const repository: EstimateRepository = {
    findWorkspaceByCode: (code) => {
      const estimate = estimates.find((candidate) => candidate.code === code);
      if (estimate === undefined) return Promise.resolve(null);
      const record: WorkspaceRecord = {
        estimateId: estimate.id,
        status: estimate.status,
        customer: customerOf(estimate.customerId),
        code: estimate.code,
        engineerId: estimate.engineerId,
        folderPath: estimate.folderPath,
        deadlineAt: estimate.deadlineAt,
        title: estimate.title,
        notes: estimate.notes,
        assignedByName: estimate.assignedByName,
      };
      return Promise.resolve(record);
    },
    lockEstimate: (id) => {
      const estimate = estimates.find((candidate) => same(candidate.id, id));
      const lock: EstimateLock | null = estimate === undefined ? null : { id: estimate.id, engineerId: estimate.engineerId, status: estimate.status, customerId: estimate.customerId };
      return Promise.resolve(lock);
    },
    findActiveCustomer: (id) => {
      const found = customers().find((customer) => same(customer.id, id) && !customer.deleted);
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name });
    },
    setCustomer: (estimateId, customerId) => {
      const estimate = estimates.find((candidate) => same(candidate.id, estimateId));
      if (estimate === undefined) return Promise.reject(new Error('The estimate to change does not exist.'));
      estimate.customerId = customerId;
      estimate.inputsRevision += 1;
      writes += 1;
      return Promise.resolve();
    },
    setStatus: (estimateId, from, to) => {
      const estimate = estimates.find((candidate) => same(candidate.id, estimateId));
      if (estimate === undefined || estimate.status !== from) return Promise.resolve(false);
      estimate.status = to;
      statusWrites += 1;
      return Promise.resolve(true);
    },
  };

  // The row lock: one transaction at a time, in the order they were opened. A failed one releases it, as a rollback does.
  let lock: Promise<unknown> = Promise.resolve();
  const transactions: TransactionRunner = {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const turn = lock.then(async () => {
        const before = estimates.map((estimate) => ({ ...estimate }));
        try {
          return await work(createTransactionHandle());
        } catch (error) {
          estimates.splice(0, estimates.length, ...before);
          throw error;
        }
      });
      lock = turn.catch(() => undefined);
      return turn;
    },
  };

  return { repository, transactions, estimates, writes: () => writes, statusWrites: () => statusWrites };
}
