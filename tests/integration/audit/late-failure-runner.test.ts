import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_NAME, AUDIT_REQUEST_ID, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { createLateFailingRunner } from '../../support/late-failure-runner';
import type { Transaction } from '@/server/repositories/transaction';

/**
 * Tech-debt #130 (OBS-1 of the AQP-122 G7 report) against real PostgreSQL in a throwaway database: the shared late-failure runner over
 * the real transaction runner. The depth rule itself is proved without a database in `tests/unit/late-failure-runner.test.ts`; what only
 * a database can show is that a transaction opened inside the failing one really does commit on its own connection, that the outermost
 * one really is rolled back with its rows, and that the wrapped runner's own limits are untouched. Names are invented.
 */

const LATE = new RangeError('a failure after the last step');

let db: AuditDatabase;
let adminId: string;

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
});

afterAll(async () => {
  await db.close();
});

/** Writes one audit entry labelled `label` in `tx`. */
function record(tx: Transaction, label: string) {
  return db.audit.record(tx, {
    event: 'user.created',
    actorId: adminId,
    actorLabel: ADMIN_NAME,
    requestId: AUDIT_REQUEST_ID,
    object: { id: adminId, label },
    before: null,
    after: { role: 'LEAD', isActive: true },
  });
}

async function count(label: string): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log WHERE object_label = $1', [label]);
  return Number(rows[0]?.count);
}

describe('over the real runner', () => {
  it('rolls back the outermost transaction and rejects with the same error object', async () => {
    const runner = createLateFailingRunner(db.transactions, LATE);
    const error: unknown = await runner.run((tx) => record(tx, 'Late-outer-only')).catch((caught: unknown) => caught);
    expect(error).toBe(LATE);
    expect(await count('Late-outer-only')).toBe(0);
  });

  it('commits a transaction opened inside it once, on its own, while the outer one is rolled back', async () => {
    const runner = createLateFailingRunner(db.transactions, LATE);
    await expect(
      runner.run(async (outer) => {
        await record(outer, 'Late-nested-outer');
        await runner.run((inner) => record(inner, 'Late-nested-inner'));
      }),
    ).rejects.toBe(LATE);
    expect(await count('Late-nested-outer')).toBe(0);
    expect(await count('Late-nested-inner')).toBe(1);
  });

  it('rolls back the whole outer unit when the nested transaction fails, and keeps the nested error', async () => {
    const runner = createLateFailingRunner(db.transactions, LATE);
    const refusal = new TypeError('the second transaction failed');
    const error: unknown = await runner
      .run(async (outer) => {
        await record(outer, 'Failing-nested-outer');
        await runner.run(async (inner) => {
          await record(inner, 'Failing-nested-inner');
          throw refusal;
        });
      })
      .catch((caught: unknown) => caught);
    expect(error).toBe(refusal);
    expect(await count('Failing-nested-outer')).toBe(0);
    expect(await count('Failing-nested-inner')).toBe(0);
  });

  it('rethrows an error of the work (a refused entry) as it was, not the late failure', async () => {
    const runner = createLateFailingRunner(db.transactions, LATE);
    const error: unknown = await runner
      .run((tx) =>
        // An empty actor label is refused by the audit service itself, inside the transaction.
        db.audit.record(tx, { event: 'user.created', actorId: adminId, actorLabel: '', requestId: AUDIT_REQUEST_ID, object: { id: adminId, label: 'Refused-entry' }, before: null, after: { role: 'LEAD', isActive: true } }),
      )
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ reason: 'shape' });
    expect(error).not.toBe(LATE);
    expect(await count('Refused-entry')).toBe(0);
  });
});
