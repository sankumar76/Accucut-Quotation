import type { ApprovalRepository, CancelRecord, NewApproval, RemovalRecord, UnlockRecord } from '../../src/server/repositories/approval-repository';
import type { CalculationRecord, CalculationRepository, NewCalculation, NewCalculationRow, StoredWarning } from '../../src/server/repositories/calculation-repository';
import type { EstimateRepository } from '../../src/server/repositories/estimate-repository';
import type { Transaction, TransactionRunner } from '../../src/server/repositories/transaction';

import type { FakeEstimateWorld } from './fake-estimates';

/**
 * An in-memory calculation repository for unit tests of the rules (no database), built over the estimate fake (`fake-estimates.ts`): a record is kept with its
 * rows, and the shared transaction runner puts the records AND the estimates back as they were when a transaction throws, as PostgreSQL does. The real queries,
 * the lock, the constraints, the triggers and the grants are tested against PostgreSQL in `tests/integration/calc/calculation-record.test.ts` and
 * `immutability.test.ts`. Every name and number is invented.
 */

/** An approval as the fake keeps it: what was inserted, with the time it was made and whether it was cancelled or its price removed. */
export interface FakeApproval extends NewApproval {
  readonly id: string;
  readonly approvedAt: Date;
  /** Set by `markUnlocked` (STORY-06.08); a row with one is no longer live. */
  unlock?: UnlockRecord;
  /** Set by `markCancelled` (STORY-06.12); a row with one is no longer live. */
  cancel?: CancelRecord;
  /** Set by `markRemoved` (STORY-06.13); a row with one is no BO. */
  removal?: RemovalRecord;
}

export interface FakeCalculationWorld {
  readonly repository: CalculationRepository;
  /** The approvals of committed transactions, oldest first (STORY-06.06); a transaction that throws takes its approval back, as PostgreSQL does. */
  readonly approvals: FakeApproval[];
  readonly approvalRepository: ApprovalRepository;
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

/** The name the fake gives to whoever made a calculation: the real repository joins the person's name now, and this world knows no people. */
export const FAKE_MADE_BY_NAME = 'Invented Person';

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
      return Promise.resolve(
        found === undefined
          ? null
          : {
              productValues: found.productValues,
              rows: found.rows.map((row) => ({ nodeId: row.nodeId, outputs: row.outputs })),
              warnings: found.warnings.map((warning) => warning as StoredWarning),
              madeByName: FAKE_MADE_BY_NAME,
            },
      );
    },
    findCalculatedTotal: (calculationId: string) => Promise.resolve(calculations.find((calculation) => calculation.id === calculationId)?.productValues.totalPrice ?? null),
    findMasterSnapshot: (calculationId: string) => {
      const found = calculations.find((calculation) => calculation.id === calculationId);
      return Promise.resolve(found === undefined ? null : { configVersionId: found.configVersionId, masterSnapshot: found.masterSnapshot });
    },
    findExportFigures: (calculationId: string) => {
      const found = calculations.find((calculation) => calculation.id === calculationId);
      return Promise.resolve(
        found === undefined
          ? null
          : { productValues: found.productValues, rows: found.rows, materials: found.masterSnapshot.materials.map(({ materialInDrawing, pricePerKg }) => ({ materialInDrawing, pricePerKg })) },
      );
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

  const approvals: FakeApproval[] = [];
  const approvalRepository: ApprovalRepository = {
    insertApproval(approval) {
      const id = nextId();
      const approvedAt = new Date('2026-11-16T05:30:00.000Z');
      approvals.push({ ...approval, id, approvedAt });
      return Promise.resolve({ id, approvedAt });
    },
    findLatestApproval(estimateId) {
      const found = [...approvals].reverse().find((approval) => approval.estimateId === estimateId);
      return Promise.resolve(
        found === undefined || found.removal !== undefined
          ? null
          : {
              id: found.id,
              calculationId: found.calculationId,
              approvedPrice: found.approvedPrice,
              approvedAt: found.approvedAt,
              approverName: 'Invented Approver',
              engineerName: 'Invented Engineer',
              calculatedTotal: found.calculatedTotal,
              isOverride: found.isOverride,
              overrideReason: found.overrideReason,
              unlock: found.unlock ?? null,
              cancel: found.cancel ?? null,
            },
      );
    },
    findLatestRemoval(estimateId) {
      const found = [...approvals].reverse().find((approval) => approval.estimateId === estimateId);
      return Promise.resolve(found?.removal ?? null);
    },
    findLiveApproval(estimateId) {
      const found = [...approvals].reverse().find((approval) => approval.estimateId === estimateId && approval.unlock === undefined && approval.cancel === undefined && approval.removal === undefined);
      return Promise.resolve(found === undefined ? null : { id: found.id, calculationId: found.calculationId, approvedPrice: found.approvedPrice, engineerName: 'Invented Engineer' });
    },
    markUnlocked(unlock) {
      const found = approvals.find((approval) => approval.id === unlock.approvalId && approval.unlock === undefined && approval.cancel === undefined);
      if (found === undefined) return Promise.resolve(null);
      const unlockedAt = new Date('2026-11-16T06:30:00.000Z');
      found.unlock = { unlockedAt, byName: 'Invented Unlocker', reason: unlock.reason, engineerName: 'Invented Engineer' };
      return Promise.resolve(unlockedAt);
    },
    findLatestForCancel(estimateId) {
      const found = [...approvals].reverse().find((approval) => approval.estimateId === estimateId);
      // The latest row of any kind: one whose price was removed leaves nothing to cancel (STORY-06.13).
      return Promise.resolve(found === undefined || found.removal !== undefined ? null : { id: found.id, approvedPrice: found.approvedPrice, cancelledAt: found.cancel?.cancelledAt ?? null });
    },
    markCancelled(cancel) {
      const found = approvals.find((approval) => approval.id === cancel.approvalId && approval.cancel === undefined && approval.removal === undefined);
      if (found === undefined) return Promise.resolve(null);
      const cancelledAt = new Date('2026-11-17T06:30:00.000Z');
      found.cancel = { cancelledAt, byName: 'Invented Canceller', reason: cancel.reason, engineerName: 'Invented Engineer' };
      return Promise.resolve(cancelledAt);
    },
    findLatestForRemoval(estimateId) {
      const found = [...approvals].reverse().find((approval) => approval.estimateId === estimateId);
      return Promise.resolve(found === undefined ? null : { id: found.id, approvedPrice: found.approvedPrice, cancelledAt: found.cancel?.cancelledAt ?? null, removedAt: found.removal?.removedAt ?? null });
    },
    markRemoved(removal) {
      const found = approvals.find((approval) => approval.id === removal.approvalId && approval.cancel !== undefined && approval.removal === undefined);
      if (found === undefined) return Promise.resolve(null);
      const removedAt = new Date('2026-11-18T06:30:00.000Z');
      found.removal = { removedAt, byName: 'Invented Remover' };
      return Promise.resolve(removedAt);
    },
  };

  const transactions: TransactionRunner = {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      return estimateWorld.transactions.run(async (tx) => {
        // Counted when this transaction starts running, not when it was asked for: transactions queue on the estimate's lock, and a loser that was asked for before the winner finished must not
        // roll back the winner's records (STORY-06.06 AC-6).
        const kept = calculations.length;
        const keptApprovals = approvals.length;
        // An unlock is stored on a row that was already there, so a failed transaction puts the rows back as they were (STORY-06.08).
        const keptUnlocks = approvals.map((approval) => approval.unlock);
        // A cancel is stored on a row that was already there too (STORY-06.12).
        const keptCancels = approvals.map((approval) => approval.cancel);
        // A removal too (STORY-06.13).
        const keptRemovals = approvals.map((approval) => approval.removal);
        try {
          return await work(tx);
        } catch (error) {
          calculations.length = kept;
          approvals.length = keptApprovals;
          approvals.forEach((approval, index) => {
            const before = keptUnlocks[index];
            if (before === undefined) delete approval.unlock;
            else approval.unlock = before;
            const cancelBefore = keptCancels[index];
            if (cancelBefore === undefined) delete approval.cancel;
            else approval.cancel = cancelBefore;
            const removalBefore = keptRemovals[index];
            if (removalBefore === undefined) delete approval.removal;
            else approval.removal = removalBefore;
          });
          throw error;
        }
      });
    },
  };

  return {
    repository,
    approvals,
    approvalRepository,
    estimates,
    transactions,
    calculations,
    failNextLinkWith(error) {
      failure = error;
    },
    lockCount: () => locks,
  };
}
