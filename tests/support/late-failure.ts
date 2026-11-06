import type { Transaction, TransactionRunner } from '../../src/server/repositories/transaction';
import { AuditEntryRefusedError } from '../../src/server/services/audit-secrets';
import { createUserService, type UserService } from '../../src/server/services/user-service';

import { KEY_SECRET, type AuditDatabase } from './audit-database';
import { createTestHasher } from './builders/user';

/**
 * DEF-017 (STORY-01.07 AC-2): a user service over the real database whose unit of work fails **after** the audit entry was
 * written, so a test can prove the entry and the change are one transaction and not two that happen to agree.
 *
 * Why the failure cannot be inside `audit.record`: a bypass (the entry written in a transaction of its own) would then fail inside
 * that inner transaction, which rolls back too, and the test would pass with the bypass in place. The failure has to come from
 * outside the entry's write, in the transaction the entry is supposed to share.
 *
 * - `'after-the-last-step'`: the outermost transaction throws `LATE_FAILURE` once its work has finished, just before the commit.
 *   Every audit write has returned by then. An entry written in the same transaction goes with the change; an entry written in
 *   a transaction of its own (nested here, so not the outermost) has already committed and is still there.
 * - `'refuse-entry'`: the audit write is the real one, except that the `number`th entry of the unit of work is refused. The
 *   entries before it were written first, so one that was written in a transaction of its own survives the rollback. Used for
 *   a save that raises two entries (the first must go with the second's refusal).
 *
 * Nothing here retries, and no time limit is raised (DL-057).
 */

export type LateFailure =
  | { readonly kind: 'after-the-last-step' }
  | { readonly kind: 'refuse-entry'; readonly number: number };

/** The error `'after-the-last-step'` throws. A test asserts on this very object. */
export const LATE_FAILURE = new Error('the unit of work failed after its last step');

export function createUserServiceThatFails(db: AuditDatabase, failure: LateFailure): UserService {
  let depth = 0;
  const transactions: TransactionRunner =
    failure.kind === 'after-the-last-step'
      ? {
          async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
            const outermost = depth === 0;
            depth += 1;
            try {
              return await db.transactions.run(async (tx) => {
                const result = await work(tx);
                if (outermost) throw LATE_FAILURE;
                return result;
              });
            } finally {
              depth -= 1;
            }
          },
        }
      : db.transactions;

  let entries = 0;
  const audit: AuditDatabase['audit'] = {
    record(tx, entry) {
      entries += 1;
      if (failure.kind === 'refuse-entry' && entries === failure.number) {
        return Promise.reject(new AuditEntryRefusedError('shape', 'after'));
      }
      return db.audit.record(tx, entry);
    },
    list: db.audit.list,
  };

  return createUserService({ users: db.users, throttles: db.throttles, hasher: createTestHasher(), transactions, audit, keySecret: KEY_SECRET });
}
