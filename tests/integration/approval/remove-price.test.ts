import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { STEP_UP_FAILED_MESSAGE } from '@/lib/auth/step-up';
import { ForbiddenError, NotFoundError, StepUpFailed } from '@/lib/errors';
import { APPROVAL_CHANGED_CODE } from '@/lib/estimate/cancel-words';
import {
  APPROVAL_NOT_CANCELLED_CODE,
  NO_PRICE_TO_REMOVE_CODE,
  PRICE_ALREADY_REMOVED_CODE,
} from '@/lib/estimate/remove-price-words';
import { NO_APPROVAL_TO_CANCEL_CODE } from '@/lib/estimate/cancel-words';
import type { ApprovalRemoving } from '@/server/repositories/approval-repository';
import type { Transaction, TransactionRunner } from '@/server/repositories/transaction';
import type { AuditService } from '@/server/services/audit-service';
import { createCancelApprovalService } from '@/server/services/cancel-approval-service';
import { createRemovePriceService, type RemovePriceService } from '@/server/services/remove-price-service';
import type { StepUpService } from '@/server/services/step-up-service';

import {
  adminOf,
  approvalCount,
  approvalEntries,
  auditOf,
  calculatedEstimate,
  currentCalculationOf,
  engineerOf,
  leadOf,
  refusalOf,
  requestFor,
  statusOf,
  storedOf,
  untilALockWaits,
} from '../../support/approval-helpers';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { createHoldingRunner } from '../../support/hold-before-commit';

/**
 * STORY-06.13 (AC-3 to AC-7; FR-108, D-29; NFR-001, NFR-004, NFR-007; architecture sections 4.10 and 6 "Remove price") against real PostgreSQL in a throwaway database, as the **runtime role**: the removal of a cancelled
 * approval's price is written in one transaction under the estimate's real row lock, so the removal stored on the approval and the audit entry that keeps the price exist together or not at all; **the approved price
 * stays in its row and in the entry** while no read that serves a screen returns it; BO reads "Not set yet" and an earlier approval does not come back in its place; and the password is in no audit row and no error.
 * Two removals at once leave exactly one: the proof holds the first transaction until `pg_locks` shows the second waiting (SQR-05 of the AQP-329 review). The password check (STORY-06.14) is tested against PostgreSQL in
 * `tests/integration/auth/step-up.test.ts`; here it is a stand-in that knows one password and counts what it was asked. Every promise is read before anything is asserted, and a held transaction is always let go in a
 * `finally` (#443, DL-233). Every name, ID, number and password is invented.
 */

const RIGHT_PASSWORD = 'Invented-Right-Password-7!';
const WRONG_PASSWORD = 'Invented-Wrong-Password-3!';
const INVENTED_FAILURE = 'Invented failure.';
const UNKNOWN_APPROVAL_ID = '00000000-0000-4000-8000-00000000a9a9';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';

let db: CalculationDatabase;
const asked: Array<{ readonly userId: string; readonly requestId: string; readonly matched: boolean }> = [];
const lead = () => leadOf(db);
const admin = () => adminOf(db);

const stepUp: Pick<StepUpService, 'verifyStepUp'> = {
  verifyStepUp(caller, password) {
    const matched = password === RIGHT_PASSWORD;
    asked.push({ userId: caller.user.id, requestId: caller.requestId, matched });
    return matched ? Promise.resolve() : Promise.reject(new StepUpFailed(STEP_UP_FAILED_MESSAGE));
  },
};

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** The remove price service over the real repositories, with the pieces a test of a failure part-way (or of a held transaction) replaces. */
function removeOver(replace: { transactions?: TransactionRunner; audit?: AuditService; approvals?: ApprovalRemoving } = {}): RemovePriceService {
  return createRemovePriceService({
    estimates: db.estimates,
    approvals: replace.approvals ?? db.approvals,
    transactions: replace.transactions ?? db.transactions,
    stepUp,
    audit: replace.audit ?? db.audit,
  });
}
const removing = (): RemovePriceService => removeOver();

/** The cancel service over the same pieces: a price is removed only after a cancel, which is the real thing here. */
const cancelling = () =>
  createCancelApprovalService({
    estimates: db.estimates,
    approvals: db.approvals,
    transactions: db.transactions,
    stepUp,
    workflow: { transition: db.estimateService.transition, audit: db.audit },
  });

/** The ID of the estimate's latest approval of any kind, which is what the page names when the Admin presses the button. */
async function latestApprovalOf(estimateId: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at DESC, id DESC LIMIT 1', [estimateId]);
  return defined(rows[0]).id;
}

async function requestOf(estimateId: string, over: { password?: string; approvalId?: string } = {}) {
  return { approvalId: over.approvalId ?? (await latestApprovalOf(estimateId)), password: over.password ?? RIGHT_PASSWORD, audit: auditOf(db) };
}

/** A calculated estimate approved at `price`. */
async function approvedEstimate(price = '1000.00'): Promise<{ readonly estimateId: string; readonly calculationId: string }> {
  const calculated = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, calculated.estimateId);
  await db.approvalService.approve(lead(), calculated.estimateId, requestFor(db, calculationId, price));
  return { estimateId: calculated.estimateId, calculationId };
}

/** An estimate approved and then cancelled by the Admin (step 1, the real service): the price still stands, marked cancelled. */
async function cancelledEstimate(price = '1000.00'): Promise<{ readonly estimateId: string; readonly calculationId: string }> {
  const approved = await approvedEstimate(price);
  await cancelling().cancel(admin(), approved.estimateId, { approvalId: await latestApprovalOf(approved.estimateId), reason: 'The wrong customer was priced.', password: RIGHT_PASSWORD, audit: auditOf(db) });
  return approved;
}

interface StoredApproval {
  readonly approved_price: string;
  readonly calculation_id: string;
  readonly cancelled_at: Date | null;
  readonly removed_by: string | null;
  readonly removed_at: Date | null;
}

/** Every approval row of the estimate, oldest first, with its price, its calculation and its removal, read as the owner. */
async function approvalRows(estimateId: string): Promise<ReadonlyArray<StoredApproval>> {
  const { rows } = await db.owner.query<StoredApproval>(
    'SELECT approved_price::text, calculation_id::text, cancelled_at, removed_by::text, removed_at FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at, id',
    [estimateId],
  );
  return rows;
}

const noRemovalOn = (rows: ReadonlyArray<StoredApproval>): void => {
  expect(rows.every((row) => row.removed_by === null && row.removed_at === null)).toBe(true);
};

async function auditRowsNaming(text: string): Promise<number> {
  const { rows } = await db.owner.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE (coalesce(before::text, '') || coalesce(after::text, '') || actor_label || object_label || request_id) LIKE '%' || $1 || '%'", [text]);
  return defined(rows[0]).n;
}

/** A held transaction: `hold` is what the transaction waits for, `isHolding` resolves once its work is done and it waits. */
function gate() {
  let release: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reachedHolding: () => void = () => undefined;
  const isHolding = new Promise<void>((resolve) => {
    reachedHolding = resolve;
  });
  return { hold, release, isHolding, reachedHolding };
}

describe('AC-3, AC-6: the removal of a cancelled approval is written in one piece and keeps the price', () => {
  it('stores who and when on the approval, leaves the price, the calculation and the status as they were, and records one audit entry that keeps the price', async () => {
    const { estimateId, calculationId } = await cancelledEstimate('1000.00');
    const statusBefore = await statusOf(db, estimateId);
    const answer = await removing().removePrice(admin(), estimateId, await requestOf(estimateId));
    expect(Math.abs(Date.now() - Date.parse(answer.removedAt))).toBeLessThan(60_000);
    // The answer holds a time and nothing else: no price (AC-6).
    expect(Object.keys(answer)).toEqual(['removedAt']);

    const [row] = await approvalRows(estimateId);
    // The price, the calculation and the cancel are as they were (the runtime role has no grant on them and the trigger refuses a change); the removal is stored whole.
    expect(row).toMatchObject({ approved_price: '1000.00', calculation_id: calculationId, removed_by: db.personId });
    expect(defined(row).cancelled_at).not.toBeNull();
    expect(defined(row).removed_at?.toISOString()).toBe(answer.removedAt);
    expect(await approvalCount(db, estimateId)).toBe(1);
    // The removal moves nothing else: the estimate was taken to Draft by the cancel and stays there.
    expect(await statusOf(db, estimateId)).toBe(statusBefore);

    const entries = await approvalEntries(db, estimateId, 'approval.price_removed');
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({
      event: 'approval.price_removed',
      actor_id: db.personId,
      actor_label: 'Calculation Lead',
      object_type: 'estimate',
      // The one place the removed price can still be read (AC-6).
      before: { approvedPrice: '1000.00' },
      after: null,
      request_id: auditOf(db).requestId,
    });
    expect(asked.at(-1)).toEqual({ userId: db.personId, requestId: auditOf(db).requestId, matched: true });
  });

  it('no read that serves a screen returns the removed price: BO is "Not set yet" and only who and when are read', async () => {
    const { estimateId } = await cancelledEstimate('1234.50');
    expect((await db.approvals.findLatestApproval(estimateId))?.approvedPrice).toBe('1234.50');
    await removing().removePrice(admin(), estimateId, await requestOf(estimateId));
    expect(await db.approvals.findLatestApproval(estimateId)).toBeNull();
    const removal = await db.approvals.findLatestRemoval(estimateId);
    expect(removal).toEqual({ removedAt: expect.any(Date), byName: 'Invented Calculation Lead' });
    expect(JSON.stringify(removal)).not.toContain('1234');
    // The cancel and the removal find no approval to act on any more.
    await expect(cancelling().cancel(admin(), estimateId, { approvalId: await latestApprovalOf(estimateId), reason: 'Again.', password: RIGHT_PASSWORD, audit: auditOf(db) })).rejects.toMatchObject({
      httpStatus: 409,
      code: NO_APPROVAL_TO_CANCEL_CODE,
    });
  });

  it('an earlier approval does not come back in the place of the removed one', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    // The first approval is unlocked (06.08 stores the unlock; here the owner stands in) and a second one is made at another price.
    await db.estimateService.transition(lead(), estimateId, 'UNLOCK');
    await db.owner.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Invented unlock' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    await db.service.recalculate(lead(), estimateId);
    await db.approvalService.approve(lead(), estimateId, requestFor(db, await currentCalculationOf(db, estimateId), '2000.00'));
    await cancelling().cancel(admin(), estimateId, { approvalId: await latestApprovalOf(estimateId), reason: 'The price was wrong.', password: RIGHT_PASSWORD, audit: auditOf(db) });
    expect((await db.approvals.findLatestApproval(estimateId))?.approvedPrice).toBe('2000.00');

    await removing().removePrice(admin(), estimateId, await requestOf(estimateId));
    // The first approval's 1000.00 is not BO now: the latest approval is the removed one.
    expect(await db.approvals.findLatestApproval(estimateId)).toBeNull();
    expect((await approvalRows(estimateId)).map((row) => row.approved_price)).toEqual(['1000.00', '2000.00']);
    expect((await approvalRows(estimateId)).map((row) => row.removed_at !== null)).toEqual([false, true]);
  });

  it('a new approval after a Recalculate sets a price again, and the removed row stays on record', async () => {
    const { estimateId } = await cancelledEstimate('1000.00');
    await removing().removePrice(admin(), estimateId, await requestOf(estimateId));
    await db.service.recalculate(lead(), estimateId);
    await db.approvalService.approve(lead(), estimateId, requestFor(db, await currentCalculationOf(db, estimateId), '3000.00'));
    expect((await db.approvals.findLatestApproval(estimateId))?.approvedPrice).toBe('3000.00');
    expect(await db.approvals.findLatestRemoval(estimateId)).toBeNull();
    expect((await approvalRows(estimateId)).map((row) => row.approved_price)).toEqual(['1000.00', '3000.00']);
  });

  it('an audit entry that cannot be written takes the removal with it', async () => {
    const { estimateId } = await cancelledEstimate();
    const before = await storedOf(db, estimateId);
    const failing = removeOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: db.audit.list } });
    await expect(failing.removePrice(admin(), estimateId, await requestOf(estimateId))).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    noRemovalOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.price_removed')).toEqual([]);
  });

  it('a store of the removal that fails takes nothing with it: nothing is half written', async () => {
    const { estimateId } = await cancelledEstimate();
    const before = await storedOf(db, estimateId);
    const failing = removeOver({ approvals: { findLatestForRemoval: db.approvals.findLatestForRemoval, markRemoved: () => Promise.reject(new Error(INVENTED_FAILURE)) } });
    await expect(failing.removePrice(admin(), estimateId, await requestOf(estimateId))).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    noRemovalOn(await approvalRows(estimateId));
  });

  it("waits for the estimate's row lock: nothing is removed while another transaction holds it, and the removal goes through once it lets go", async () => {
    const { estimateId } = await cancelledEstimate();
    const request = await requestOf(estimateId);
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(removing().removePrice(admin(), estimateId, request));
      // The lock is held until the removal is seen waiting for it: a holder that returned at once could commit before the removal asked, and the test would pass with or without the lock.
      await untilALockWaits(db);
      noRemovalOn(await approvalRows(estimateId));
      expect(await approvalEntries(db, estimateId, 'approval.price_removed')).toEqual([]);
    });
    expect(await waiting.current).toBeUndefined();
    expect(defined((await approvalRows(estimateId))[0]).removed_at).not.toBeNull();
    expect(await approvalEntries(db, estimateId, 'approval.price_removed')).toHaveLength(1);
  });
});

describe('AC-4: a wrong password is refused before anything is read or locked, and nothing changes', () => {
  it('422 STEP_UP_FAILED: no transaction is opened, nothing is stored or recorded, and the right password then works', async () => {
    const { estimateId } = await cancelledEstimate();
    const before = await storedOf(db, estimateId);
    let transactionsOpened = 0;
    const counting: TransactionRunner = {
      run: <T>(work: (tx: Transaction) => Promise<T>) => {
        transactionsOpened += 1;
        return db.transactions.run(work);
      },
    };
    const refusal = await refusalOf(removeOver({ transactions: counting }).removePrice(admin(), estimateId, await requestOf(estimateId, { password: WRONG_PASSWORD })));
    expect(refusal).toBeInstanceOf(StepUpFailed);
    expect(transactionsOpened).toBe(0);
    expect(await storedOf(db, estimateId)).toEqual(before);
    noRemovalOn(await approvalRows(estimateId));
    await removing().removePrice(admin(), estimateId, await requestOf(estimateId));
    expect(defined((await approvalRows(estimateId))[0]).removed_at).not.toBeNull();
  });
});

describe('AC-5: an approval that is not cancelled, not the latest, or removed already; a missing estimate; two removals at once', () => {
  it('an approval that was not cancelled is 409 APPROVAL_NOT_CANCELLED, and nothing is stored or recorded', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    await expect(removing().removePrice(admin(), estimateId, await requestOf(estimateId))).rejects.toMatchObject({ httpStatus: 409, code: APPROVAL_NOT_CANCELLED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    noRemovalOn(await approvalRows(estimateId));
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
  });

  it('an estimate with no approval is 409 NO_PRICE_TO_REMOVE', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const before = await storedOf(db, estimateId);
    await expect(removing().removePrice(admin(), estimateId, await requestOf(estimateId, { approvalId: UNKNOWN_APPROVAL_ID }))).rejects.toMatchObject({ httpStatus: 409, code: NO_PRICE_TO_REMOVE_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it('an estimate that does not exist is a 404', async () => {
    await expect(removing().removePrice(admin(), UNKNOWN_ESTIMATE_ID, { approvalId: UNKNOWN_APPROVAL_ID, password: RIGHT_PASSWORD, audit: auditOf(db) })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('an approval that is not the latest is 409 APPROVAL_CHANGED: the cancelled older one is not removed, and the page that shows the newer one can remove it only after a cancel', async () => {
    const { estimateId } = await cancelledEstimate('1000.00');
    const first = await latestApprovalOf(estimateId);
    await db.service.recalculate(lead(), estimateId);
    await db.approvalService.approve(lead(), estimateId, requestFor(db, await currentCalculationOf(db, estimateId), '2000.00'));
    expect(await approvalCount(db, estimateId)).toBe(2);
    const before = await storedOf(db, estimateId);
    await expect(removing().removePrice(admin(), estimateId, await requestOf(estimateId, { approvalId: first }))).rejects.toMatchObject({ httpStatus: 409, code: APPROVAL_CHANGED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    noRemovalOn(await approvalRows(estimateId));
    // The newer one is the latest, and it was not cancelled.
    await expect(removing().removePrice(admin(), estimateId, await requestOf(estimateId))).rejects.toMatchObject({ httpStatus: 409, code: APPROVAL_NOT_CANCELLED_CODE });
  });

  it('a second removal of the same approval is 409 PRICE_ALREADY_REMOVED, and stores and records nothing more', async () => {
    const { estimateId } = await cancelledEstimate();
    const request = await requestOf(estimateId);
    await removing().removePrice(admin(), estimateId, request);
    const before = await storedOf(db, estimateId);
    const stamp = defined((await approvalRows(estimateId))[0]).removed_at;
    await expect(removing().removePrice(admin(), estimateId, request)).rejects.toMatchObject({ httpStatus: 409, code: PRICE_ALREADY_REMOVED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(defined((await approvalRows(estimateId))[0]).removed_at).toEqual(stamp);
    expect(await approvalEntries(db, estimateId, 'approval.price_removed')).toHaveLength(1);
  });

  it('two removals at once that overlap: the second waits for the first, then is the 409; exactly one removal and one audit entry exist (SQR-05 of AQP-329)', async () => {
    const { estimateId } = await cancelledEstimate();
    const request = await requestOf(estimateId);
    const holding = gate();
    // The first removal finishes its work and waits, uncommitted, holding the estimate's row lock.
    const first = refusalOf(removeOver({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).removePrice(admin(), estimateId, request));
    let second: Promise<unknown> | undefined;
    let secondDone = false;
    try {
      await Promise.race([holding.isHolding, first]);
      second = refusalOf(removing().removePrice(admin(), estimateId, request)).finally(() => {
        secondDone = true;
      });
      // The second is seen waiting for the lock, so the two did overlap; it has not answered.
      await untilALockWaits(db);
      expect(secondDone, 'the second removal did not wait for the first').toBe(false);
      holding.release();
    } finally {
      holding.release();
    }
    expect(await first).toBeUndefined();
    expect(await second).toMatchObject({ httpStatus: 409, code: PRICE_ALREADY_REMOVED_CODE });
    expect((await approvalRows(estimateId)).filter((row) => row.removed_at !== null)).toHaveLength(1);
    expect(await approvalEntries(db, estimateId, 'approval.price_removed')).toHaveLength(1);
  });
});

describe('AC-5 (NFR-001): only the Admin removes a price', () => {
  it.each([
    ['a Lead', () => lead()],
    ['an Engineer', () => engineerOf(db)],
  ])('%s is refused 403 before the estimate or the password is looked at, and nothing is written', async (_name, who) => {
    const { estimateId } = await cancelledEstimate();
    const before = await storedOf(db, estimateId);
    const checks = asked.length;
    await expect(removing().removePrice(who(), estimateId, await requestOf(estimateId))).rejects.toBeInstanceOf(ForbiddenError);
    expect(asked).toHaveLength(checks);
    expect(await storedOf(db, estimateId)).toEqual(before);
    noRemovalOn(await approvalRows(estimateId));
  });
});

describe('AC-7: the password is in no audit row and no error', () => {
  it('after a good removal, a wrong password and a failed one, no audit row of the database names either password', async () => {
    const { estimateId } = await cancelledEstimate();
    await refusalOf(removing().removePrice(admin(), estimateId, await requestOf(estimateId, { password: WRONG_PASSWORD })));
    const failing = removeOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: db.audit.list } });
    const refusal = await refusalOf(failing.removePrice(admin(), estimateId, await requestOf(estimateId)));
    expect(String((refusal as Error).message)).not.toContain(RIGHT_PASSWORD);
    await removing().removePrice(admin(), estimateId, await requestOf(estimateId));
    expect(await auditRowsNaming(RIGHT_PASSWORD)).toBe(0);
    expect(await auditRowsNaming(WRONG_PASSWORD)).toBe(0);
    const entry = defined((await approvalEntries(db, estimateId, 'approval.price_removed'))[0]);
    expect(Object.keys(entry.before as Record<string, unknown>)).toEqual(['approvedPrice']);
    expect(entry.after).toBeNull();
  });
});
