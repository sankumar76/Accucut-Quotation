import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CALCULATION_CHANGED_CODE, TOTALS_OUT_OF_DATE_CODE } from '@/lib/estimate/approval-words';
import { prefillPrice } from '@/lib/estimate/approve-price';
import { toTwoPlaces } from '@/lib/money';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { createApprovalService } from '@/server/services/approval-service';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { ESTIMATE_NOT_EDITABLE_CODE } from '@/server/services/estimate-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';

import {
  approvalCount,
  approvalEntries,
  auditOf,
  calculatedEstimate,
  currentCalculationOf,
  engineerOf,
  leadOf,
  PRICE,
  refusalOf,
  requestFor,
  revisionOf,
  statusOf,
  storedOf,
  untilALockWaits,
} from '../../support/approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { smallPng } from '../../support/pictures';
import { changeContext } from '../../support/customer-change';

/**
 * STORY-06.06 AC-2, AC-4, AC-6, AC-7 and AC-9 (FR-062, FR-064, NFR-007; architecture sections 4.4, 4.8, 4.10 and 5.1) against real PostgreSQL in a throwaway database, as the **runtime role**: an approval is
 * written in one transaction under the estimate's real row lock, so the status, the `approvals` row and the audit entry exist together or not at all; a save or a Recalculate that races it is refused cleanly;
 * once approved, every writer of an input is refused and nothing changes; and BO is read from the approvals row, never through the figure state. The lock-wait tests hold the lock until `pg_locks` shows the
 * approval waiting, so they fail if the approval does not take the lock. Every promise is awaited or asserted with `rejects` (#443). Every name, ID and number is invented.
 */

let db: CalculationDatabase;
let review: EstimateReviewService;
const lead = () => leadOf(db);
const request = (calculationId: string, price: string = PRICE) => requestFor(db, calculationId, price);

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  review = createEstimateReviewService({
    calculations: db.calculations,
    approvals: db.approvals,
    nodes: db.nodes,
    estimates: db.estimates,
    masters: db.masterRepository,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** A calculated estimate that is then approved at `price`: the figures were current, so nothing is refused. */
async function approvedEstimate(price: string = PRICE): Promise<{ readonly estimateId: string; readonly top: string; readonly calculationId: string }> {
  const calculated = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, calculated.estimateId);
  await db.approvalService.approve(lead(), calculated.estimateId, request(calculationId, price));
  return { ...calculated, calculationId };
}

describe('AC-2: the approval is written in one piece', () => {
  it('moves the estimate to APPROVED, stores the approvals row (price, calculated total, calculation, approver, time) and records one audit entry', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const calculationId = await currentCalculationOf(db, estimateId);
    const stored = defined((await db.owner.query<{ bl: string }>("SELECT product_values->>'totalPrice' AS bl FROM calculations WHERE id = $1::uuid", [calculationId])).rows[0]).bl;
    // The total is kept as rupees and paise by the rule the dialog pre-fills its price with (SQR-03 of the review): the screen's own rounding of the calculation's full-precision BL.
    const total = defined(toTwoPlaces(stored));
    expect(total).toBe(prefillPrice(stored));

    const answer = await db.approvalService.approve(lead(), estimateId, request(calculationId, '1000'));
    expect(answer).toMatchObject({ status: 'APPROVED', approvedPrice: '1000.00' });
    expect(Number.isNaN(Date.parse(answer.approvedAt))).toBe(false);

    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    const { rows } = await db.owner.query<Record<string, unknown>>(
      `SELECT estimate_id::text, calculation_id::text, approved_price::text, calculated_bl::text, is_override, override_reason, approved_by::text, approved_at,
              unlocked_by, unlocked_at, unlock_reason, cancelled_by, cancelled_at, cancel_reason, removed_by, removed_at
       FROM approvals WHERE estimate_id = $1::uuid`,
      [estimateId],
    );
    expect(rows).toHaveLength(1);
    const row = defined(rows[0]);
    expect(row).toMatchObject({
      estimate_id: estimateId,
      calculation_id: calculationId,
      approved_price: '1000.00',
      // 1000.00 is not the calculation's total, so it is an override with no reason given (STORY-06.07; its own tests are `override.test.ts`).
      is_override: true,
      override_reason: null,
      approved_by: db.personId,
      unlocked_by: null,
      unlocked_at: null,
      unlock_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      cancel_reason: null,
      removed_by: null,
      removed_at: null,
    });
    // The total the price was set against is the calculation's own BL in rupees and paise, exactly what the dialog pre-fills.
    expect(row['calculated_bl']).toBe(total);
    expect(Math.abs(Date.now() - (row['approved_at'] as Date).getTime())).toBeLessThan(60_000);

    const entries = await approvalEntries(db, estimateId);
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({
      event: 'approval.approved',
      actor_id: db.personId,
      actor_label: 'Calculation Lead',
      object_type: 'estimate',
      before: null,
      request_id: auditOf(db).requestId,
    });
    expect(defined(entries[0]).after).toEqual({ approvedPrice: '1000.00', calculatedTotal: total, approver: 'Calculation Lead', isOverride: true });
  });

  it('an Admin approves too, and the price is stored as it was typed', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const calculationId = await currentCalculationOf(db, estimateId);
    await db.approvalService.approve({ id: db.personId, role: 'ADMIN' }, estimateId, request(calculationId, '1.50'));
    const { rows } = await db.owner.query<{ approved_price: string; is_override: boolean }>('SELECT approved_price::text, is_override FROM approvals WHERE estimate_id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ approved_price: '1.50', is_override: true }]);
  });

  it('an audit entry that cannot be written takes the status and the approval with it', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const calculationId = await currentCalculationOf(db, estimateId);
    const failing = createApprovalService({
      estimates: db.estimates,
      calculations: db.calculations,
      approvals: db.approvals,
      transactions: db.transactions,
      workflow: { transition: db.estimateService.transition, audit: { record: () => Promise.reject(new Error('Invented audit failure.')), recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: db.audit.list } },
    });
    const before = await storedOf(db, estimateId);
    await expect(failing.approve(lead(), estimateId, request(calculationId))).rejects.toThrow('Invented audit failure.');
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    expect(await approvalCount(db, estimateId)).toBe(0);
  });

  it('an insert that fails after the status moved takes the status back: nothing is half written', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const calculationId = await currentCalculationOf(db, estimateId);
    const failing = createApprovalService({
      estimates: db.estimates,
      calculations: db.calculations,
      approvals: { insertApproval: () => Promise.reject(new Error('Invented insert failure.')) },
      transactions: db.transactions,
      workflow: { transition: db.estimateService.transition, audit: db.audit },
    });
    const before = await storedOf(db, estimateId);
    await expect(failing.approve(lead(), estimateId, request(calculationId))).rejects.toThrow('Invented insert failure.');
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
  });
});

describe('the approval takes the estimate\'s row lock, and waits for it (06.05 SQR-02 and SQR-05)', () => {
  it('approve while a save holds the lock: the approval is refused after the save commits, and no approvals row and no audit entry are written', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const before = await storedOf(db, estimateId);
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      await db.estimates.bumpInputsRevision(estimateId, tx);
      waiting.current = refusalOf(db.approvalService.approve(lead(), estimateId, request(seen)));
      // The lock is held until the approval is seen waiting for it: a holder that returned at once could commit before the approval asked, and the test would pass with or without the lock.
      await untilALockWaits(db);
    });
    expect(await waiting.current).toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE });
    expect(await approvalCount(db, estimateId)).toBe(0);
    expect(await approvalEntries(db, estimateId)).toEqual([]);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    // Only the save's own change is different from before: the revision went up by one, and nothing else of the estimate.
    const after = (await storedOf(db, estimateId)) as { estimate: Array<{ revision: number }> };
    expect(defined(after.estimate[0]).revision).toBe(defined((before as typeof after).estimate[0]).revision + 1);
  });

  it('a holder that changes nothing: the approval waits for it and then goes through (the wait is real and the approval is not lost)', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(db.approvalService.approve(lead(), estimateId, request(seen)));
      await untilALockWaits(db);
      // Nothing has been approved while the lock is held.
      expect(await approvalCount(db, estimateId)).toBe(0);
    });
    expect(await waiting.current).toBeUndefined();
    expect(await approvalCount(db, estimateId)).toBe(1);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
  });

  it('an approval and a Recalculate at once: one wins and the other is refused cleanly; the records agree', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const [approvalRefusal, recalculateRefusal] = await Promise.all([
      refusalOf(db.approvalService.approve(lead(), estimateId, request(seen))),
      refusalOf(db.service.recalculate(lead(), estimateId)),
    ]);
    if (approvalRefusal === undefined) {
      // The approval took the lock first: the Recalculate found the estimate approved and locked.
      expect(recalculateRefusal).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.APPROVED_IS_LOCKED.code });
      expect(await approvalCount(db, estimateId)).toBe(1);
      expect(await currentCalculationOf(db, estimateId)).toBe(seen);
      expect(await statusOf(db, estimateId)).toBe('APPROVED');
    } else {
      // The Recalculate took the lock first: a newer calculation is the current one, and the approval of the one the Lead saw is refused.
      expect(recalculateRefusal).toBeUndefined();
      expect(approvalRefusal).toMatchObject({ httpStatus: 409, code: CALCULATION_CHANGED_CODE });
      expect(await approvalCount(db, estimateId)).toBe(0);
      expect(await currentCalculationOf(db, estimateId)).not.toBe(seen);
      expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    }
  });
});

describe('AC-6: two approvals at once leave exactly one row', () => {
  it('one wins and the other is the machine\'s 409; exactly one approvals row and one audit entry exist, and they are the winner\'s', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    // Both answers are collected before anything is asserted, so a failing call cannot leave a rejection unhandled (#443).
    const prices = ['1000.00', '2000.00'] as const;
    const refusals = await Promise.all(prices.map((price) => refusalOf(db.approvalService.approve(lead(), estimateId, request(seen, price)))));
    const winners = prices.filter((_price, index) => refusals[index] === undefined);
    const losers = refusals.filter((refusal) => refusal !== undefined);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.ALREADY_APPROVED.code });
    expect(await approvalCount(db, estimateId)).toBe(1);
    const { rows } = await db.owner.query<{ approved_price: string }>('SELECT approved_price::text FROM approvals WHERE estimate_id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ approved_price: winners[0] }]);
    expect(await approvalEntries(db, estimateId)).toHaveLength(1);
  });
});

describe('AC-4: once approved, every writer of an input is refused and nothing changes', () => {
  it('a save, a part added, moved or deleted, the customer, a picture added or removed, an Engineer\'s Calculate and a Lead\'s Recalculate: each is a 409 and the stored rows are as they were', async () => {
    const { estimateId, top } = await approvedEstimate();
    const topRevision = await revisionOf(db, top);
    const before = await storedOf(db, estimateId);
    const customerId = db.customerId;
    const engineer = engineerOf(db);
    const writers: ReadonlyArray<readonly [string, () => Promise<unknown>, string]> = [
      ['a save by a Lead', () => db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: topRevision, values: { [idOf('J')]: '95' } }), ESTIMATE_NOT_EDITABLE_CODE],
      ['a save by the Engineer', () => db.estimateService.saveInputs(engineer, estimateId, { nodeId: top, revision: topRevision, values: { [idOf('J')]: '95' } }), ESTIMATE_NOT_EDITABLE_CODE],
      ['a part added', () => db.estimateService.addPart(lead(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' }), ESTIMATE_NOT_EDITABLE_CODE],
      ['a part moved', () => db.estimateService.moveNode(lead(), estimateId, { nodeId: top, revision: topRevision, parentId: null, index: 0 }), ESTIMATE_NOT_EDITABLE_CODE],
      ['a part deleted', () => db.estimateService.deleteNode(lead(), estimateId, { nodeId: top, revision: topRevision, parts: 1, subtree: 'unused' }), ESTIMATE_NOT_EDITABLE_CODE],
      ['the customer changed', () => db.estimateService.setCustomer(lead(), changeContext(lead()), estimateId, customerId), ESTIMATE_NOT_EDITABLE_CODE],
      ['a picture added', () => db.estimateService.putPicture(lead(), estimateId, top, { name: 'a.png', bytes: smallPng() }), ESTIMATE_NOT_EDITABLE_CODE],
      ['a picture removed', () => db.estimateService.removePicture(lead(), estimateId, top), ESTIMATE_NOT_EDITABLE_CODE],
      ['the Engineer\'s Calculate', () => db.service.calculate(engineer, estimateId), TRANSITION_REFUSALS.APPROVED_IS_LOCKED.code],
      ['a Lead\'s Recalculate', () => db.service.recalculate(lead(), estimateId), TRANSITION_REFUSALS.APPROVED_IS_LOCKED.code],
    ];
    for (const [name, write, code] of writers) {
      // Each call is read with `rejects`, so a call that did not refuse fails the test by name.
      await expect(write(), name).rejects.toMatchObject({ httpStatus: 409, code });
    }
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it('a second approval of the approved estimate is the machine\'s 409, and adds no row and no entry', async () => {
    const { estimateId, calculationId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(lead(), estimateId, request(calculationId, '2000.00'))).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.ALREADY_APPROVED.code });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });
});

describe('AC-7 (NFR-001): an Engineer cannot approve', () => {
  it('is refused 403 and nothing is written, before the estimate is looked at', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(engineerOf(db), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 403 });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });
});

describe('AC-9 (AQP-321 AC-4): BO is the approvals row, so clearing the calculated figures cannot change it', () => {
  it('AQP-321 AC-4: approve, then force the figure state to out-of-date: BO is unchanged and BL is cleared', async () => {
    const { estimateId } = await approvedEstimate('1234.50');
    const current = await review.getCosts(lead(), estimateId);
    expect(current.state).toBe('current');
    expect(current.totals?.totalPrice).not.toBeNull();
    expect(current.approval).toMatchObject({ price: '1234.50', approverName: 'Invented Calculation Lead' });

    // The figure state is forced out of date directly, as an input change after an unlock would leave it: the estimate is still approved and the approval row is untouched.
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const cleared = await review.getCosts(lead(), estimateId);
    expect(cleared.state).toBe('out-of-date');
    expect(cleared.totals).toBeNull();
    expect(cleared.nodes.every((node) => node.figures === null)).toBe(true);
    expect(cleared.calculationId).toBeNull();
    expect(cleared.approval).toEqual(current.approval);
  });

  it('before any approval BO is null in every state, and an estimate approved earlier shows its own row only', async () => {
    const { estimateId } = await calculatedEstimate(db);
    expect((await review.getCosts(lead(), estimateId)).approval).toBeNull();
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    expect((await review.getCosts(lead(), estimateId)).approval).toBeNull();
    const other = await approvedEstimate('77.00');
    expect((await review.getCosts(lead(), other.estimateId)).approval?.price).toBe('77.00');
    expect((await review.getCosts(lead(), estimateId)).approval).toBeNull();
  });

  // STORY-06.13 AC-3 changed this rule: BO is the LATEST approval, and when its price was removed BO is "Not set yet". Before, the latest row that had not been removed was BO, so removing the latest price would have
  // brought an earlier, replaced price back on every screen.
  it('BO is the latest approval: an earlier one stays on record, and when the latest one is removed BO is "Not set yet" and the earlier one does not come back', async () => {
    const { estimateId, calculationId } = await approvedEstimate('500.00');
    // A later cycle, as a new approval after an unlock would make (06.08 sets the unlock columns of the first; here the owner stands in for it).
    await db.owner.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Invented reason' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    await db.owner.query('INSERT INTO approvals (estimate_id, calculation_id, approved_price, calculated_bl, approved_by, approved_at) VALUES ($1::uuid, $2::uuid, 600, 600, $3::uuid, now() + interval \'1 minute\')', [
      estimateId,
      calculationId,
      db.personId,
    ]);
    expect((await review.getCosts(lead(), estimateId)).approval?.price).toBe('600.00');
    await db.owner.query("UPDATE approvals SET removed_by = $2::uuid, removed_at = now() WHERE estimate_id = $1::uuid AND approved_price = 600", [estimateId, db.personId]);
    const view = await review.getCosts(lead(), estimateId);
    expect(view.approval).toBeNull();
    expect(view.priceRemoved).toMatchObject({ byName: expect.any(String) });
    expect(JSON.stringify(view.priceRemoved)).not.toContain('600');
    expect(await approvalCount(db, estimateId)).toBe(2);
  });
});
