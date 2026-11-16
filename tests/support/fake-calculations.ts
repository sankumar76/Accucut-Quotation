import type { CalculationRecord, CalculationRepository, NewCalculation, NewCalculationRow } from '../../src/server/repositories/calculation-repository';
import type { EstimateRepository } from '../../src/server/repositories/estimate-repository';
import type { Transaction, TransactionRunner } from '../../src/server/repositories/transaction';

import type { FakeEstimateWorld } from './fake-estimates';

/**
 * An in-memory calculation repository for unit tests of the rules (no database), built over the estimate fake (`fake-estimates.ts`): a record is kept with its
 * rows, and the shared transaction runner puts the records AND the estimates back as they were when a transaction throws, as PostgreSQL does. The real queries,
 * the lock, the constraints, the triggers and the grants are tested against PostgreSQL in `tests/integration/calc/calculation-record.test.ts` and
 * `immutability.test.ts`. Every name and number is invented.
 */

export interface FakeCalculationWorld {
  readonly repository: CalculationRepository;
  /** The estimate repository of the world, with `linkCalculation` able to fail on demand. */
  readonly estimates: EstimateRepository;
  readonly transactions: TransactionRunner;
  /** The records of committed transactions, oldest first. */
  readonly calculations: CalculationRecord[];
  /** Makes the next `linkCalculation` fail once with this error, after the record and its rows were written (a late failure). */
  failNextLinkWith(error: Error): void;
  /** How many times an estimate was locked, so a test can see that the lock is taken. */
  lockCount(): number;
}

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `00000000-0000-4000-8000-0ca1${String(counter).padStart(8, '0')}`;
};

export function createFakeCalculationWorld(estimateWorld: FakeEstimateWorld): FakeCalculationWorld {
  const calculations: CalculationRecord[] = [];
  let failure: Error | null = null;
  let locks = 0;

  const repository: CalculationRepository = {
    insertCalculation(calculation: NewCalculation, rows: ReadonlyArray<NewCalculationRow>) {
      const id = nextId();
      const createdAt = new Date('2026-11-14T05:00:00.000Z');
      calculations.push({ ...calculation, id, warnings: (calculation.warnings ?? []).map((warning) => ({ ...warning })), createdAt, rows: rows.map((row) => ({ ...row, id: nextId() })) });
      return Promise.resolve({ id, createdAt });
    },
    findCalculation: (id: string) => Promise.resolve(calculations.find((calculation) => calculation.id === id) ?? null),
    findFigureBasis: (estimateId: string) => {
      const estimate = estimateWorld.estimates.find((candidate) => candidate.id === estimateId);
      if (estimate === undefined) return Promise.resolve(null);
      const linked = calculations.find((calculation) => calculation.id === estimate.currentCalculationId);
      return Promise.resolve({
        inputsRevision: estimate.inputsRevision,
        calculation: linked === undefined ? null : { id: linked.id, inputsRevision: linked.inputsRevision, configVersionId: linked.configVersionId, createdAt: linked.createdAt },
      });
    },
    findReviewFigures: (calculationId: string) => {
      const found = calculations.find((calculation) => calculation.id === calculationId);
      return Promise.resolve(found === undefined ? null : { productValues: found.productValues, rows: found.rows.map((row) => ({ nodeId: row.nodeId, outputs: row.outputs })) });
    },
    findRowWorking: (calculationId: string, nodeId: string) => {
      const found = calculations.find((calculation) => calculation.id === calculationId);
      const row = found?.rows.find((candidate) => candidate.nodeId === nodeId);
      return Promise.resolve(found === undefined || row === undefined ? null : { masterSnapshot: found.masterSnapshot, inputs: row.inputs, outputs: row.outputs });
    },
  };

  const estimates: EstimateRepository = {
    ...estimateWorld.repository,
    lockEstimate: (id, tx) => {
      locks += 1;
      return estimateWorld.repository.lockEstimate(id, tx);
    },
    linkCalculation: (estimateId, calculationId, status, tx) => {
      if (failure !== null) {
        const error = failure;
        failure = null;
        return Promise.reject(error);
      }
      return estimateWorld.repository.linkCalculation(estimateId, calculationId, status, tx);
    },
  };

  const transactions: TransactionRunner = {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const kept = calculations.length;
      return estimateWorld.transactions.run(async (tx) => {
        try {
          return await work(tx);
        } catch (error) {
          calculations.length = kept;
          throw error;
        }
      });
    },
  };

  return {
    repository,
    estimates,
    transactions,
    calculations,
    failNextLinkWith(error) {
      failure = error;
    },
    lockCount: () => locks,
  };
}
