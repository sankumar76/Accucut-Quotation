import { createTransactionRunner, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';
import type { MastersService } from '../../src/server/services/masters-service';

import type { AuditDatabase } from './audit-database';

/**
 * A masters service whose outermost transaction finishes its work (locks taken, change and audit entry written) and then WAITS, uncommitted, until the test
 * releases it (QLT-03 of the G6 of AQP-130). A second change started meanwhile either waits for the locks the first one holds, or it does not: that is what a
 * test of serialisation needs to see, and a test that only runs two calls with `Promise.all` cannot, because the first often commits before the second reads.
 *
 * This is not a late-failure runner: the transaction commits normally once released, and a transaction opened inside it is a real, separate one. It lives here
 * and not in `tests/integration/masters` because that folder may not define a runner of its own (`tests/unit/late-failure-runner-use.test.ts`).
 *
 * @param hold resolved by the test to let the first transaction commit.
 * @param onHolding called once the first transaction's work is done and it is waiting.
 */
export function createServiceHoldingBeforeCommit(db: AuditDatabase, hold: Promise<void>, onHolding: () => void): MastersService {
  const real = createTransactionRunner(db.prisma);
  const runner: TransactionRunner = {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      return real.run(async (tx) => {
        const result = await work(tx);
        onHolding();
        await hold;
        return result;
      });
    },
  };
  return db.buildMastersService({ transactions: runner });
}
