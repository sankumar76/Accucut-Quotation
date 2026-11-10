import { AsyncLocalStorage } from 'node:async_hooks';

import type { Transaction, TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * The late-failure runner (tech-debt #130, from OBS-1 of the AQP-122 G7 report; DEF-017 class, DL-107): a transaction runner that
 * makes the **outermost** transaction fail after its work has finished, just before the commit, and leaves every transaction opened
 * inside it alone. Any service can be wired to it, so each audited master and the user service share one rule.
 *
 * Why only the outermost. A change and its audit entry must commit together. If a change writes its entry in a second transaction
 * opened inside the first (a bypass), that second transaction commits on its own, and a late failure of the outer one leaves the entry
 * behind with no change: the test then fails, which is the point. A runner that failed every `run`, nested ones included, would roll
 * that second transaction back as well, and the test would pass over the bypass it exists to expose.
 *
 * Nested calls therefore do **not** join the outer transaction: each opens a real transaction of its own on the wrapped runner.
 *
 * Known limit (DEF-017, master's ruling in Jira 11117): a bypass that commits its entry in a transaction of its own **before** the
 * change is not nested; that transaction is the first one opened, so it counts as the outermost and is rolled back with the change. No
 * late failure can catch that form; the static check of #104 and the review rule do.
 *
 * Nothing here retries, and no time limit is raised (DL-057): the wrapped runner keeps its own wait and timeout, and its errors are
 * rethrown unchanged.
 */

/** Set while the work of a `run` is executing, so a `run` called from inside it (even after an `await`) knows it is nested. */
const insideRun = new AsyncLocalStorage<true>();

/**
 * @param real the runner whose transactions are made (the real one over the test database, or an in-memory one).
 * @param failure thrown, as this very object, by the outermost `run` after its work completed. A test asserts on it.
 */
export function createLateFailingRunner(real: TransactionRunner, failure: Error): TransactionRunner {
  return {
    run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      // Read here, in the caller's context: a `run` inside the work of another `run` is nested; a concurrent one is not.
      const outermost = insideRun.getStore() === undefined;
      return real.run(async (tx) => {
        // The marker is set around the work only, so it reaches nested calls however the wrapped runner schedules the callback.
        const result = await insideRun.run(true, () => work(tx));
        if (outermost) throw failure;
        return result;
      });
    },
  };
}
