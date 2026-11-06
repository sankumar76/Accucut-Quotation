import type { Prisma } from '../../generated/prisma/client';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * One database transaction that several repositories share (STORY-01.07; architecture section 4.1: the audit entry is
 * "appended in the caller's transaction"). A service that changes something and must record it opens a transaction with
 * `TransactionRunner.run`, hands the `Transaction` it is given to each repository call, and the whole is committed when the
 * callback returns and rolled back when it throws. Nothing in between is visible to another connection.
 *
 * `Transaction` is deliberately opaque. Only a repository may turn it back into a database client (`clientFor`), because
 * only `src/server/repositories` may import Prisma (architecture section 10); a service carries the handle from one repository
 * to the next without knowing what is inside. A repository method that takes `tx?` runs in that transaction when one is given
 * and on its own otherwise; a method that must never run alone (the audit append) takes `tx` as required, so the compiler
 * refuses a call without one.
 */

/**
 * An open transaction. Created by `TransactionRunner.run` and valid only until its callback returns. A handle that did not come
 * from a runner has no client behind it, and `clientFor` refuses it, so forging one cannot reach the database.
 */
export interface Transaction {
  readonly kind: 'database-transaction';
}

/** The handle of a runner that has no database behind it (the in-memory runner of the unit tests). */
export function createTransactionHandle(): Transaction {
  return Object.freeze({ kind: 'database-transaction' });
}

export interface TransactionRunner {
  /**
   * Runs `work` in one transaction: committed if it resolves, rolled back (and the error rethrown unchanged) if it rejects.
   * A timeout of the database is turned into `DatabaseBusyError`, as for any other repository call.
   */
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}

/** Longest wait for a free connection, and longest a transaction may take (the app's statement limit is 10 s; architecture ruling R4). */
const TRANSACTION_MAX_WAIT_MILLISECONDS = 5_000;
const TRANSACTION_TIMEOUT_MILLISECONDS = 10_000;

/** Which client belongs to which open transaction. A `WeakMap`, so a finished transaction is not kept alive. */
const clients = new WeakMap<object, Prisma.TransactionClient>();

/** The client to use: the transaction's when one is given, the plain client otherwise. For repositories only. */
export function clientFor(db: PrismaClient, tx?: Transaction): Prisma.TransactionClient {
  if (tx === undefined) return db;
  const client = clients.get(tx);
  if (client === undefined) throw new Error('This transaction was not opened by a TransactionRunner, or has finished.');
  return client;
}

export function createTransactionRunner(db: PrismaClient): TransactionRunner {
  return {
    run(work) {
      return withDatabaseErrors(() =>
        db.$transaction(
          async (client) => {
            const tx = createTransactionHandle();
            clients.set(tx, client);
            try {
              return await work(tx);
            } finally {
              // The client is dead once the callback returns; a handle kept by mistake must not reach it.
              clients.delete(tx);
            }
          },
          { maxWait: TRANSACTION_MAX_WAIT_MILLISECONDS, timeout: TRANSACTION_TIMEOUT_MILLISECONDS },
        ),
      );
    },
  };
}
