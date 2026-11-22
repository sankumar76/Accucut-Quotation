import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, ForbiddenError, MasterInUseError, NotFoundError, StepUpFailed } from '@/lib/errors';
import { STEP_UP_FAILED_MESSAGE } from '@/lib/auth/step-up';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import {
  APPROVAL_ALREADY_CANCELLED_CODE,
  APPROVAL_CHANGED_CODE,
  CANCEL_CUSTOMER_DELETED_MESSAGE,
  CANCEL_MATERIAL_DELETED_MESSAGE,
  CANCEL_REASON_REQUIRED_MESSAGE,
  CANCEL_REASON_TOO_LONG_MESSAGE,
  NO_APPROVAL_TO_CANCEL_CODE,
} from '@/lib/estimate/cancel-words';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import type { ApprovalCancelling } from '@/server/repositories/approval-repository';
import type { Transaction, TransactionRunner } from '@/server/repositories/transaction';
import type { AuditService } from '@/server/services/audit-service';
import { createCancelApprovalService, type CancelApprovalService } from '@/server/services/cancel-approval-service';
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
import { contextOf } from '../../support/audit-database';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { createHoldingRunner, createServiceHoldingBeforeCommit } from '../../support/hold-before-commit';
import { MATERIAL } from '../../support/row-oracle';

/**
 * STORY-06.12 (AC-3 to AC-5, AC-7, AC-9, AC-10; FR-107, FR-038; D-29; NFR-001, NFR-004, NFR-007; architecture sections 4.4, 4.10 and 6 "Cancel approval") against real PostgreSQL in a throwaway database, as the
 * **runtime role**: a cancel is written in one transaction under the estimate's real row lock, so the status (when it moves), the cancel stored on the approval and the audit entry exist together or not at all; the
 * approved price is never touched; a second cancel and two at once leave exactly one; an approval kept through an unlock is cancelled with the status unchanged; the cancel and a delete of the estimate's customer or
 * material serialise in both orders, so a cancel never produces a Draft that names a deleted customer or material; and **the password is in no audit row and no error**. The password check (STORY-06.14) is
 * tested against PostgreSQL in `tests/integration/auth/step-up.test.ts`; here it is a stand-in that knows one password and counts what it was asked. The lock-wait tests hold the lock until `pg_locks` shows the
 * call waiting, so they fail if it does not take the lock. Every promise is read before anything is asserted, and a held transaction is always let go in a `finally` (#443, DL-233). Every name, ID, number and password
 * is invented.
 */

const REASON = 'The wrong customer was priced. Cancel it and start again.';
const RIGHT_PASSWORD = 'Invented-Right-Password-7!';
const WRONG_PASSWORD = 'Invented-Wrong-Password-3!';
const INVENTED_FAILURE = 'Invented failure.';
const UNKNOWN_APPROVAL_ID = '00000000-0000-4000-8000-00000000a9a9';

let db: CalculationDatabase;
let ownCount = 0;
/** Every password the stand-in was asked to check, and whether it was the right one. */
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

/** The cancel service over the real repositories, with the pieces a test of a failure part-way (or of a held transaction) replaces. */
function cancelOver(replace: { transactions?: TransactionRunner; audit?: AuditService; approvals?: ApprovalCancelling } = {}): CancelApprovalService {
  return createCancelApprovalService({
    estimates: db.estimates,
    approvals: replace.approvals ?? db.approvals,
    transactions: replace.transactions ?? db.transactions,
    stepUp,
    workflow: { transition: db.estimateService.transition, audit: replace.audit ?? db.audit },
  });
}
const cancelling = (): CancelApprovalService => cancelOver();

/** The ID of the estimate's latest approval, which is what the page names when the Admin presses the button. */
async function latestApprovalOf(estimateId: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid AND removed_at IS NULL ORDER BY approved_at DESC, id DESC LIMIT 1', [estimateId]);
  return defined(rows[0]).id;
}

async function requestOf(estimateId: string, over: { reason?: string; password?: string; approvalId?: string } = {}) {
  return { approvalId: over.approvalId ?? (await latestApprovalOf(estimateId)), reason: over.reason ?? REASON, password: over.password ?? RIGHT_PASSWORD, audit: auditOf(db) };
}

/** A calculated estimate that is then approved at `price`; the figures were current, so nothing is refused. */
async function approvedEstimate(price = '1000.00'): Promise<{ readonly estimateId: string; readonly top: string; readonly calculationId: string }> {
  const calculated = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, calculated.estimateId);
  await db.approvalService.approve(lead(), calculated.estimateId, requestFor(db, calculationId, price));
  return { ...calculated, calculationId };
}

/**
 * What an unlock stores (STORY-06.08), written the way it writes it: the estimate to DRAFT through the machine and the unlock on the approval. The approval is kept (its price is "approved earlier"); the estimate
 * is a Draft with current figures.
 */
async function unlock(estimateId: string): Promise<void> {
  await db.estimateService.transition(lead(), estimateId, 'UNLOCK');
  await db.owner.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Invented unlock' WHERE estimate_id = $1::uuid AND unlocked_at IS NULL", [estimateId, db.personId]);
}

/** A customer of its own, with the rates of the shared one, so it can be deleted without touching the other tests' estimates. */
async function ownCustomer(): Promise<string> {
  ownCount += 1;
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name) VALUES ($1) RETURNING id::text', [`Invented cancel customer ${String(ownCount)}`]);
  const id = defined(rows[0]).id;
  await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT $1::uuid, process_item_id, value FROM customer_rates WHERE customer_id = $2::uuid', [id, db.customerId]);
  return id;
}

/** A material of its own, with the numbers of the shared one. */
async function ownMaterial(): Promise<string> {
  ownCount += 1;
  const { rows } = await db.owner.query<{ id: string }>(
    'INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id::text',
    [`Invented cancel plate ${String(ownCount)}`, 'Invented steel', MATERIAL.pricePerKg, MATERIAL.specificGravity, MATERIAL.scrapRate],
  );
  return defined(rows[0]).id;
}

/** An estimate of the Engineer's on a customer and a material of its own, calculated and approved. */
async function approvedOnOwnMasters(): Promise<{ readonly estimateId: string; readonly customerId: string; readonly materialId: string }> {
  const customerId = await ownCustomer();
  const materialId = await ownMaterial();
  const estimateId = await db.addEstimate({ engineer: true, customerId });
  await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: materialId } });
  await db.service.calculate(engineerOf(db), estimateId);
  const calculationId = await currentCalculationOf(db, estimateId);
  await db.approvalService.approve(lead(), estimateId, requestFor(db, calculationId, '2500.00'));
  return { estimateId, customerId, materialId };
}

interface StoredCancel {
  readonly cancelled_by: string | null;
  readonly cancelled_at: Date | null;
  readonly cancel_reason: string | null;
  readonly unlocked_at: Date | null;
  readonly approved_price: string;
  readonly removed_at: Date | null;
}

/** Every approval row of the estimate, oldest first, with its cancel columns and price, read as the owner. */
async function approvalRows(estimateId: string): Promise<ReadonlyArray<StoredCancel>> {
  const { rows } = await db.owner.query<StoredCancel>(
    'SELECT cancelled_by::text, cancelled_at, cancel_reason, unlocked_at, approved_price::text, removed_at FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at, id',
    [estimateId],
  );
  return rows;
}

const noCancelOn = (rows: ReadonlyArray<StoredCancel>): void => {
  expect(rows.every((row) => row.cancelled_by === null && row.cancelled_at === null && row.cancel_reason === null)).toBe(true);
};

/** How many audit rows of the whole database name the password, in a before, an after, a label or a request ID. Always 0. */
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
type Gate = ReturnType<typeof gate>;

/** Waits until the call holds its uncommitted work, or fails with the reason it did not (the call is already read, so nothing is left unhandled). */
async function expectHolding(held: Gate, call: Promise<unknown>): Promise<void> {
  let holding = false;
  void held.isHolding.then(() => {
    holding = true;
  });
  await Promise.race([held.isHolding, call]);
  // A call that ended first shows how it ended, which says why it never held.
  if (!holding) expect(await call, 'how the call ended').toBeUndefined();
  expect(holding, 'the call ended before it held its transaction').toBe(true);
}

describe('AC-3: the cancel of an approved estimate is written in one piece', () => {
  it('moves the estimate to DRAFT, stores who, when and why on the approval without touching the price, and records one audit entry with the price before, the reason and the two statuses', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    const answer = await cancelling().cancel(admin(), estimateId, await requestOf(estimateId, { reason: `  ${REASON}  ` }));
    expect(answer.status).toBe('DRAFT');
    expect(Math.abs(Date.now() - Date.parse(answer.cancelledAt))).toBeLessThan(60_000);

    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const [row] = await approvalRows(estimateId);
    // The price and the approve columns are as they were (the runtime role has no grant on them and the trigger refuses a change); the cancel is stored whole, with the reason trimmed, and the approval was never unlocked.
    expect(row).toMatchObject({ approved_price: '1000.00', cancelled_by: db.personId, cancel_reason: REASON, unlocked_at: null, removed_at: null });
    expect(defined(row).cancelled_at?.toISOString()).toBe(answer.cancelledAt);
    expect(await approvalCount(db, estimateId)).toBe(1);

    const entries = await approvalEntries(db, estimateId, 'approval.cancelled');
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({
      event: 'approval.cancelled',
      actor_id: db.personId,
      actor_label: 'Calculation Lead',
      object_type: 'estimate',
      before: { approvedPrice: '1000.00', status: 'APPROVED' },
      after: { reason: REASON, status: 'DRAFT' },
      request_id: auditOf(db).requestId,
    });
    // The approval's own entry is still the only one of its kind.
    expect(await approvalEntries(db, estimateId)).toHaveLength(1);
    // The password was checked once, for the signed-in person, in the same request.
    expect(asked.at(-1)).toEqual({ userId: db.personId, requestId: auditOf(db).requestId, matched: true });
  });

  it('a reason of exactly 500 characters is kept whole', async () => {
    const { estimateId } = await approvedEstimate();
    const reason = 'x'.repeat(500);
    await cancelling().cancel(admin(), estimateId, await requestOf(estimateId, { reason }));
    expect(defined((await approvalRows(estimateId))[0]).cancel_reason).toBe(reason);
  });

  it('an audit entry that cannot be written takes the status and the cancel with it', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const failing = cancelOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: db.audit.list } });
    await expect(failing.cancel(admin(), estimateId, await requestOf(estimateId))).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toEqual([]);
  });

  it('a store of the cancel that fails after the status moved takes the status back: nothing is half written', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const failing = cancelOver({ approvals: { findLatestForCancel: db.approvals.findLatestForCancel, markCancelled: () => Promise.reject(new Error(INVENTED_FAILURE)) } });
    await expect(failing.cancel(admin(), estimateId, await requestOf(estimateId))).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
  });

  it('waits for the estimate\'s row lock: nothing is cancelled while another transaction holds it, and the cancel goes through once it lets go', async () => {
    const { estimateId } = await approvedEstimate();
    const request = await requestOf(estimateId);
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(cancelling().cancel(admin(), estimateId, request));
      // The lock is held until the cancel is seen waiting for it: a holder that returned at once could commit before the cancel asked, and the test would pass with or without the lock.
      await untilALockWaits(db);
      expect(await statusOf(db, estimateId)).toBe('APPROVED');
      expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toEqual([]);
    });
    expect(await waiting.current).toBeUndefined();
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toHaveLength(1);
  });
});

describe('AC-4: a wrong password is refused before anything is read or locked, and nothing changes', () => {
  it('422 STEP_UP_FAILED: no transaction is opened, nothing is stored or recorded, and the right password then works', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    let transactionsOpened = 0;
    const counting: TransactionRunner = {
      run: <T>(work: (tx: Transaction) => Promise<T>) => {
        transactionsOpened += 1;
        return db.transactions.run(work);
      },
    };
    const refusal = await refusalOf(cancelOver({ transactions: counting }).cancel(admin(), estimateId, await requestOf(estimateId, { password: WRONG_PASSWORD })));
    expect(refusal).toBeInstanceOf(StepUpFailed);
    expect(transactionsOpened).toBe(0);
    expect(await storedOf(db, estimateId)).toEqual(before);
    noCancelOn(await approvalRows(estimateId));
    await cancelling().cancel(admin(), estimateId, await requestOf(estimateId));
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
  });
});

describe('AC-5: the reason, an approval that is not the latest, a second cancel, and two cancels at once', () => {
  it.each([
    ['empty', '', CANCEL_REASON_REQUIRED_MESSAGE],
    ['white space and line breaks only', '  \n \t ', CANCEL_REASON_REQUIRED_MESSAGE],
    ['501 characters', 'x'.repeat(501), CANCEL_REASON_TOO_LONG_MESSAGE],
    ['a zero-width joiner (DL-219)', 'Round‍ed', TEXT_CHARACTERS_MESSAGE],
  ])('a reason that is %s is a 422 under `reason`, the password is not asked for, and nothing changes', async (_name, reason, message) => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const checks = asked.length;
    const refusal = await refusalOf(cancelling().cancel(admin(), estimateId, await requestOf(estimateId, { reason })));
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect(refusal instanceof FieldValidationError && refusal.fields).toEqual([{ field: 'reason', message }]);
    expect(asked).toHaveLength(checks);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
  });

  it('an estimate that does not exist is a 404', async () => {
    await expect(cancelling().cancel(admin(), '00000000-0000-4000-8000-00000000dead', { approvalId: UNKNOWN_APPROVAL_ID, reason: REASON, password: RIGHT_PASSWORD, audit: auditOf(db) })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('an approval that is not the latest is 409 APPROVAL_CHANGED: a newer approval is not cancelled unseen, and the one the page shows now is', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    const first = await latestApprovalOf(estimateId);
    await unlock(estimateId);
    await db.service.recalculate(lead(), estimateId);
    await db.approvalService.approve(lead(), estimateId, requestFor(db, await currentCalculationOf(db, estimateId), '2000.00'));
    expect(await approvalCount(db, estimateId)).toBe(2);
    const before = await storedOf(db, estimateId);
    await expect(cancelling().cancel(admin(), estimateId, await requestOf(estimateId, { approvalId: first }))).rejects.toMatchObject({ httpStatus: 409, code: APPROVAL_CHANGED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    await cancelling().cancel(admin(), estimateId, await requestOf(estimateId));
    const rows = await approvalRows(estimateId);
    expect(rows.map((row) => row.cancelled_at !== null)).toEqual([false, true]);
    expect(rows.map((row) => row.approved_price)).toEqual(['1000.00', '2000.00']);
  });

  it('a second cancel of the same approval is 409 APPROVAL_ALREADY_CANCELLED, and stores and records nothing more', async () => {
    const { estimateId } = await approvedEstimate();
    const request = await requestOf(estimateId);
    await cancelling().cancel(admin(), estimateId, request);
    const before = await storedOf(db, estimateId);
    await expect(cancelling().cancel(admin(), estimateId, { ...request, reason: 'A second reason.' })).rejects.toMatchObject({ httpStatus: 409, code: APPROVAL_ALREADY_CANCELLED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(defined((await approvalRows(estimateId))[0]).cancel_reason).toBe(REASON);
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toHaveLength(1);
  });

  it('two cancels at once: one wins and the other is the 409; exactly one cancel and one audit entry exist, and they are the winner\'s', async () => {
    const { estimateId } = await approvedEstimate();
    const approvalId = await latestApprovalOf(estimateId);
    // Both answers are collected before anything is asserted, so a failing call cannot leave a rejection unhandled (#443).
    const reasons = ['First reason.', 'Second reason.'] as const;
    const refusals = await Promise.all(reasons.map((reason) => refusalOf(cancelling().cancel(admin(), estimateId, { approvalId, reason, password: RIGHT_PASSWORD, audit: auditOf(db) }))));
    const winners = reasons.filter((_reason, index) => refusals[index] === undefined);
    const losers = refusals.filter((refusal) => refusal !== undefined);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatchObject({ httpStatus: 409, code: APPROVAL_ALREADY_CANCELLED_CODE });
    expect(defined((await approvalRows(estimateId))[0]).cancel_reason).toBe(winners[0]);
    const entries = await approvalEntries(db, estimateId, 'approval.cancelled');
    expect(entries).toHaveLength(1);
    expect(defined(entries[0]).after).toEqual({ reason: winners[0], status: 'DRAFT' });
  });
});

describe('AC-1 (NFR-001): only the Admin cancels an approval', () => {
  it.each([
    ['a Lead', () => lead()],
    ['an Engineer', () => engineerOf(db)],
  ])('%s is refused 403 before the estimate or the password is looked at, and nothing is written', async (_name, who) => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const checks = asked.length;
    await expect(cancelling().cancel(who(), estimateId, await requestOf(estimateId))).rejects.toBeInstanceOf(ForbiddenError);
    expect(asked).toHaveLength(checks);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
  });
});

describe('AC-10: an approval kept through an unlock is cancelled with the status and the task unchanged', () => {
  it('a Draft stays a Draft: the cancel is stored, no status is written, and the entry shows the same status before and after', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    await unlock(estimateId);
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const { rows: stamp } = await db.owner.query<{ at: string }>('SELECT updated_at::text AS at FROM estimates WHERE id = $1::uuid', [estimateId]);

    const answer = await cancelling().cancel(admin(), estimateId, await requestOf(estimateId));
    expect(answer.status).toBe('DRAFT');
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    // No status was written: the estimate's own row is as it was.
    expect((await db.owner.query<{ at: string }>('SELECT updated_at::text AS at FROM estimates WHERE id = $1::uuid', [estimateId])).rows).toEqual(stamp);
    const [row] = await approvalRows(estimateId);
    expect(row).toMatchObject({ approved_price: '1000.00', cancel_reason: REASON, cancelled_by: db.personId });
    expect(defined(row).unlocked_at).not.toBeNull();
    const entries = await approvalEntries(db, estimateId, 'approval.cancelled');
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({ before: { approvedPrice: '1000.00', status: 'DRAFT' }, after: { reason: REASON, status: 'DRAFT' } });
  });

  it('a Submitted estimate stays Submitted', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    await unlock(estimateId);
    await db.service.recalculate(lead(), estimateId);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    const answer = await cancelling().cancel(admin(), estimateId, await requestOf(estimateId));
    expect(answer.status).toBe('SUBMITTED');
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    const entries = await approvalEntries(db, estimateId, 'approval.cancelled');
    expect(defined(entries[0])).toMatchObject({ before: { status: 'SUBMITTED' }, after: { status: 'SUBMITTED' } });
  });

  it('an estimate with no approval is a 409 NO_APPROVAL_TO_CANCEL, and nothing is written', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const before = await storedOf(db, estimateId);
    await expect(cancelling().cancel(admin(), estimateId, await requestOf(estimateId, { approvalId: UNKNOWN_APPROVAL_ID }))).rejects.toMatchObject({ httpStatus: 409, code: NO_APPROVAL_TO_CANCEL_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
  });

  it('after the cancel a Recalculate and a new approval bring a price back; the cancelled approval stays on record with its price and its cancel', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    await cancelling().cancel(admin(), estimateId, await requestOf(estimateId));
    await db.service.recalculate(lead(), estimateId);
    await db.approvalService.approve(lead(), estimateId, requestFor(db, await currentCalculationOf(db, estimateId), '3000.00'));
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    const rows = await approvalRows(estimateId);
    expect(rows.map((row) => row.approved_price)).toEqual(['1000.00', '3000.00']);
    expect(rows.map((row) => row.cancelled_at !== null)).toEqual([true, false]);
  });
});

describe('AC-9: a customer or a material deleted after the approval refuses the cancel, and nothing is written', () => {
  it('a customer deleted earlier: 409 CUSTOMER_DELETED in the cancel\'s words, the status stays APPROVED, no cancel is stored and no audit entry is written; the password is checked and still not recorded', async () => {
    const { estimateId, customerId } = await approvedOnOwnMasters();
    // A customer used only by Approved estimates may be deleted (STORY-02.07 AC-4).
    await db.mastersService.deleteCustomer(contextOf(db.personId), customerId);
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(cancelling().cancel(admin(), estimateId, await requestOf(estimateId)));
    expect(refusal).toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE, message: CANCEL_CUSTOMER_DELETED_MESSAGE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toEqual([]);
    expect(await auditRowsNaming(RIGHT_PASSWORD)).toBe(0);
    expect(String((refusal as Error).message)).not.toContain(RIGHT_PASSWORD);
  });

  it('a material deleted earlier: 409 MATERIAL_DELETED in the cancel\'s words, and nothing is written', async () => {
    const { estimateId, materialId } = await approvedOnOwnMasters();
    await db.owner.query('UPDATE materials SET deleted_at = now() WHERE id = $1::uuid', [materialId]);
    const before = await storedOf(db, estimateId);
    await expect(cancelling().cancel(admin(), estimateId, await requestOf(estimateId))).rejects.toMatchObject({ httpStatus: 409, code: MATERIAL_DELETED_CODE, message: CANCEL_MATERIAL_DELETED_MESSAGE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
  });

  it('a cancel that holds the customer first: the delete waits, then sees the Draft and is refused; the customer stays and the estimate keeps it', async () => {
    const { estimateId, customerId } = await approvedOnOwnMasters();
    const request = await requestOf(estimateId);
    const holding = gate();
    const cancel = refusalOf(cancelOver({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).cancel(admin(), estimateId, request));
    try {
      await expectHolding(holding, cancel);
      let deleteDone = false;
      const deletion = refusalOf(db.mastersService.deleteCustomer(contextOf(db.personId), customerId)).finally(() => {
        deleteDone = true;
      });
      await untilALockWaits(db);
      expect(deleteDone, 'the delete did not wait for the cancel').toBe(false);
      holding.release();
      expect(await cancel).toBeUndefined();
      expect(await deletion).toBeInstanceOf(MasterInUseError);
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const { rows } = await db.owner.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM customers WHERE id = $1::uuid', [customerId]);
    expect(rows).toEqual([{ deleted_at: null }]);
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toHaveLength(1);
  });

  it('a delete that holds the customer first: the cancel waits, then finds no customer and is refused 409; the estimate stays APPROVED with nothing written', async () => {
    const { estimateId, customerId } = await approvedOnOwnMasters();
    const request = await requestOf(estimateId);
    const holding = gate();
    const deletion = refusalOf(createServiceHoldingBeforeCommit(db, holding.hold, holding.reachedHolding).deleteCustomer(contextOf(db.personId), customerId));
    try {
      await expectHolding(holding, deletion);
      let cancelDone = false;
      const cancel = refusalOf(cancelling().cancel(admin(), estimateId, request)).finally(() => {
        cancelDone = true;
      });
      await untilALockWaits(db);
      expect(cancelDone, 'the cancel did not wait for the delete').toBe(false);
      holding.release();
      expect(await deletion).toBeUndefined();
      expect(await cancel).toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE });
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toEqual([]);
    const { rows } = await db.owner.query<{ deleted: boolean }>('SELECT deleted_at IS NOT NULL AS deleted FROM customers WHERE id = $1::uuid', [customerId]);
    expect(rows).toEqual([{ deleted: true }]);
  });

  it('a cancel that holds the material first: the delete waits, then sees the Draft and is refused; the material stays', async () => {
    const { estimateId, materialId } = await approvedOnOwnMasters();
    const request = await requestOf(estimateId);
    const holding = gate();
    const cancel = refusalOf(cancelOver({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).cancel(admin(), estimateId, request));
    try {
      await expectHolding(holding, cancel);
      let deleteDone = false;
      const deletion = refusalOf(db.mastersService.deleteMaterial(contextOf(db.personId), materialId)).finally(() => {
        deleteDone = true;
      });
      await untilALockWaits(db);
      expect(deleteDone, 'the delete did not wait for the cancel').toBe(false);
      holding.release();
      expect(await cancel).toBeUndefined();
      expect(await deletion).toBeInstanceOf(MasterInUseError);
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const { rows } = await db.owner.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM materials WHERE id = $1::uuid', [materialId]);
    expect(rows).toEqual([{ deleted_at: null }]);
  });

  it('a delete that holds the material first: the cancel waits, then finds it deleted and is refused 409 MATERIAL_DELETED; nothing is written', async () => {
    const { estimateId, materialId } = await approvedOnOwnMasters();
    const request = await requestOf(estimateId);
    const holding = gate();
    const deletion = refusalOf(createServiceHoldingBeforeCommit(db, holding.hold, holding.reachedHolding).deleteMaterial(contextOf(db.personId), materialId));
    try {
      await expectHolding(holding, deletion);
      let cancelDone = false;
      const cancel = refusalOf(cancelling().cancel(admin(), estimateId, request)).finally(() => {
        cancelDone = true;
      });
      await untilALockWaits(db);
      expect(cancelDone, 'the cancel did not wait for the delete').toBe(false);
      holding.release();
      expect(await deletion).toBeUndefined();
      expect(await cancel).toMatchObject({ httpStatus: 409, code: MATERIAL_DELETED_CODE });
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noCancelOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.cancelled')).toEqual([]);
  });

});

describe('AC-7: the password is in no audit row and no error', () => {
  it('after a good cancel, a wrong password and every refusal above, no audit row of the database names either password', async () => {
    const { estimateId } = await approvedEstimate();
    await refusalOf(cancelling().cancel(admin(), estimateId, await requestOf(estimateId, { password: WRONG_PASSWORD })));
    const failing = cancelOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: db.audit.list } });
    const refusal = await refusalOf(failing.cancel(admin(), estimateId, await requestOf(estimateId)));
    expect(String((refusal as Error).message)).not.toContain(RIGHT_PASSWORD);
    await cancelling().cancel(admin(), estimateId, await requestOf(estimateId));
    expect(await auditRowsNaming(RIGHT_PASSWORD)).toBe(0);
    expect(await auditRowsNaming(WRONG_PASSWORD)).toBe(0);
    const entry = defined((await approvalEntries(db, estimateId, 'approval.cancelled'))[0]);
    expect(Object.keys(entry.before as Record<string, unknown>).sort()).toEqual(['approvedPrice', 'status']);
    expect(Object.keys(entry.after as Record<string, unknown>).sort()).toEqual(['reason', 'status']);
  });
});
