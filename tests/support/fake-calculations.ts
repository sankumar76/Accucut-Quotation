import type { EstimateStatus } from '../../src/server/repositories/task-repository';
import type {
  CalculationRecord,
  CalculationRepository,
  LockedEstimate,
  NewCalculation,
  NewCalculationRow,
} from '../../src/server/repositories/calculation-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * An in-memory calculation repository and transaction runner, for unit tests of the rules (no database): the estimates are a list the test owns, a record
 * is kept with its rows, and a transaction that throws puts the records and the estimates back as they were, as PostgreSQL does. The real queries, the lock,
 * the constraints, the triggers and the grants are tested against PostgreSQL in `tests/integration/calc/calculation-record.test.ts` and `immutability.test.ts`.
 * Every name and number is invented.
 */

/** An estimate the test may change in place, as the repository reads it plus the link to its newest calculation. */
export interface FakeEstimate {
  id: string;
  customerId: string | null;
  status: EstimateStatus;
  inputsRevision: number;
  currentCalculationId: string | null;
}

export interface FakeCalculationWorld {
  readonly repository: CalculationRepository;
  readonly transactions: TransactionRunner;
  readonly estimates: FakeEstimate[];
  /** The records of committed transactions, oldest first. */
  readonly calculations: CalculationRecord[];
  /** How many times an estimate was locked, so a test can see that the lock is the first thing a store does. */
  lockCount(): number;
  /** Makes the next `linkCurrentCalculation` fail once with this error, after the record and its rows were written (a late failure). */
  failNextLinkWith(error: Error): void;
}

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `00000000-0000-4000-8000-0ca1${String(counter).padStart(8, '0')}`;
};

export function createFakeCalculationWorld(estimates: FakeEstimate[]): FakeCalculationWorld {
  const calculations: CalculationRecord[] = [];
  let locks = 0;
  let failure: Error | null = null;

  const repository: CalculationRepository = {
    lockEstimate(estimateId: string): Promise<LockedEstimate | null> {
      locks += 1;
      const found = estimates.find((estimate) => estimate.id === estimateId);
      return Promise.resolve(found === undefined ? null : { id: found.id, customerId: found.customerId, status: found.status, inputsRevision: found.inputsRevision });
    },
    insertCalculation(calculation: NewCalculation, rows: ReadonlyArray<NewCalculationRow>) {
      const id = nextId();
      const createdAt = new Date('2026-11-14T05:00:00.000Z');
      calculations.push({
        ...calculation,
        id,
        warnings: [],
        createdAt,
        rows: rows.map((row) => ({ ...row, id: nextId() })),
      });
      return Promise.resolve({ id, createdAt });
    },
    linkCurrentCalculation(estimateId: string, calculationId: string, status: EstimateStatus) {
      if (failure !== null) {
        const error = failure;
        failure = null;
        return Promise.reject(error);
      }
      const found = estimates.find((estimate) => estimate.id === estimateId);
      if (found === undefined) return Promise.reject(new Error('No such estimate.'));
      found.currentCalculationId = calculationId;
      found.status = status;
      return Promise.resolve();
    },
    findCalculation: (id: string) => Promise.resolve(calculations.find((calculation) => calculation.id === id) ?? null),
  };

  const transactions: TransactionRunner = {
    async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const before = { calculations: calculations.length, estimates: estimates.map((estimate) => ({ ...estimate })) };
      try {
        return await work(createTransactionHandle());
      } catch (error) {
        calculations.length = before.calculations;
        estimates.forEach((estimate, index) => Object.assign(estimate, before.estimates[index]));
        throw error;
      }
    },
  };

  return {
    repository,
    transactions,
    estimates,
    calculations,
    lockCount: () => locks,
    failNextLinkWith(error) {
      failure = error;
    },
  };
}
