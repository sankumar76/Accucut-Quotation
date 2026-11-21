import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, MasterInUseError, NotFoundError } from '@/lib/errors';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { UNLOCK_CUSTOMER_DELETED_MESSAGE, UNLOCK_MATERIAL_DELETED_MESSAGE, UNLOCK_REASON_REQUIRED_MESSAGE, UNLOCK_REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/unlock-words';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import { createConfigRepository } from '@/server/repositories/config-repository';
import type { ApprovalUnlocking } from '@/server/repositories/approval-repository';
import type { TransactionRunner } from '@/server/repositories/transaction';
import type { AuditService } from '@/server/services/audit-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';
import { createUnlockService, type UnlockService } from '@/server/services/unlock-service';

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
  revisionOf,
  statusOf,
  storedOf,
  untilALockWaits,
} from '../../support/approval-helpers';
import { contextOf } from '../../support/audit-database';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { createHoldingRunner, createServiceHoldingBeforeCommit } from '../../support/hold-before-commit';
import { EXCHANGE, MATERIAL } from '../../support/row-oracle';

/**
 * STORY-06.08 (AC-1, AC-2, AC-4 to AC-8, AC-10, AC-12; FR-063, FR-064, FR-038; BR-011; NFR-001, NFR-007; architecture sections 4.4, 4.8 "Unlock and the earlier price", 4.10 and 6 "Unlock preview" and "Unlock") against
 * real PostgreSQL in a throwaway database, as the **runtime role**: an unlock is written in one transaction under the estimate's real row lock, so the status, the unlock stored on the approval and the audit
 * entry exist together or not at all; the approved price is never touched; a second unlock and two at once leave exactly one; the preview counts what changed since the approval, by kind and nothing else;
 * the unlock and a delete of the estimate's customer or material serialise in both orders, so an unlock never produces a Draft that names a deleted customer or material; and BO stays the price approved
 * earlier, read from the approvals row, when an input is changed after the unlock. The lock-wait tests hold the lock until `pg_locks` shows the call waiting, so they fail if it does not take the lock.
 * Every promise is read before anything is asserted, and a held transaction is always let go in a `finally` (#443). Every name, ID and number is invented.
 */

const REASON = 'The customer asked for a new fixture. Rates have moved since.';
const INVENTED_FAILURE = 'Invented failure.';

let db: CalculationDatabase;
let review: EstimateReviewService;
let ownCount = 0;
const lead = () => leadOf(db);
const request = (reason: string = REASON) => ({ reason, audit: auditOf(db) });

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

/** The unlock service over the real repositories, with the pieces a test of a failure part-way (or of a held transaction) replaces. */
function unlockOver(replace: { transactions?: TransactionRunner; audit?: AuditService; approvals?: ApprovalUnlocking } = {}): UnlockService {
  const configurations = createConfigRepository(db.prisma);
  return createUnlockService({
    estimates: db.estimates,
    approvals: replace.approvals ?? db.approvals,
    calculations: db.calculations,
    masters: db.masterRepository,
    // The latest version is read each time (its cache only holds versions by ID), so a version added by a test is the current one at once.
    configuration: { current: () => getCurrentVersion(configurations, createConfigVersionCache()), byId: (id) => getVersionById(configurations, id, createConfigVersionCache()) },
    transactions: replace.transactions ?? db.transactions,
    workflow: { transition: db.estimateService.transition, audit: replace.audit ?? db.audit },
  });
}
const unlocking = (): UnlockService => unlockOver();

/** A calculated estimate that is then approved at `price`; the figures were current, so nothing is refused. */
async function approvedEstimate(price = '1000.00'): Promise<{ readonly estimateId: string; readonly top: string; readonly calculationId: string }> {
  const calculated = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, calculated.estimateId);
  await db.approvalService.approve(lead(), calculated.estimateId, requestFor(db, calculationId, price));
  return { ...calculated, calculationId };
}

/** A customer of its own, with the rates of the shared one, so it can be deleted without touching the other tests' estimates. */
async function ownCustomer(): Promise<string> {
  ownCount += 1;
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name) VALUES ($1) RETURNING id::text', [`Invented unlock customer ${String(ownCount)}`]);
  const id = defined(rows[0]).id;
  await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT $1::uuid, process_item_id, value FROM customer_rates WHERE customer_id = $2::uuid', [id, db.customerId]);
  return id;
}

/** A material of its own, with the numbers of the shared one. */
async function ownMaterial(): Promise<string> {
  ownCount += 1;
  const { rows } = await db.owner.query<{ id: string }>(
    'INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id::text',
    [`Invented unlock plate ${String(ownCount)}`, 'Invented steel', MATERIAL.pricePerKg, MATERIAL.specificGravity, MATERIAL.scrapRate],
  );
  return defined(rows[0]).id;
}

/** An estimate of the Engineer's on a customer and a material of its own, calculated and approved. */
async function approvedOnOwnMasters(): Promise<{ readonly estimateId: string; readonly customerId: string; readonly materialId: string; readonly calculationId: string }> {
  const customerId = await ownCustomer();
  const materialId = await ownMaterial();
  const estimateId = await db.addEstimate({ engineer: true, customerId });
  await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: materialId } });
  await db.service.calculate(engineerOf(db), estimateId);
  const calculationId = await currentCalculationOf(db, estimateId);
  await db.approvalService.approve(lead(), estimateId, requestFor(db, calculationId, '2500.00'));
  return { estimateId, customerId, materialId, calculationId };
}

interface StoredUnlock {
  readonly unlocked_by: string | null;
  readonly unlocked_at: Date | null;
  readonly unlock_reason: string | null;
  readonly approved_price: string;
  readonly cancelled_at: Date | null;
  readonly removed_at: Date | null;
}

/** Every approval row of the estimate, oldest first, with its unlock columns and price, read as the owner. */
async function approvalRows(estimateId: string): Promise<ReadonlyArray<StoredUnlock>> {
  const { rows } = await db.owner.query<StoredUnlock>(
    'SELECT unlocked_by::text, unlocked_at, unlock_reason, approved_price::text, cancelled_at, removed_at FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at, id',
    [estimateId],
  );
  return rows;
}

const noUnlockOn = (rows: ReadonlyArray<StoredUnlock>): void => {
  expect(rows.every((row) => row.unlocked_by === null && row.unlocked_at === null && row.unlock_reason === null)).toBe(true);
};

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

describe('AC-2: the unlock is written in one piece', () => {
  it('moves the estimate to DRAFT, stores who, when and why on the approval without touching the price, and records one audit entry with the price before and the reason', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    const approved = await approvalRows(estimateId);
    expect(approved).toHaveLength(1);

    const answer = await unlocking().unlock(lead(), estimateId, request(`  ${REASON}  `));
    expect(answer.status).toBe('DRAFT');
    expect(Math.abs(Date.now() - Date.parse(answer.unlockedAt))).toBeLessThan(60_000);

    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const [row] = await approvalRows(estimateId);
    // The price and the approve columns are as they were (the runtime role has no grant on them and the trigger refuses a change); the unlock is stored whole, with the reason trimmed.
    expect(row).toMatchObject({ approved_price: '1000.00', unlocked_by: db.personId, unlock_reason: REASON, cancelled_at: null, removed_at: null });
    expect(defined(row).unlocked_at?.toISOString()).toBe(answer.unlockedAt);
    expect(await approvalCount(db, estimateId)).toBe(1);

    const entries = await approvalEntries(db, estimateId, 'approval.unlocked');
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({
      event: 'approval.unlocked',
      actor_id: db.personId,
      actor_label: 'Calculation Lead',
      object_type: 'estimate',
      before: { approvedPrice: '1000.00' },
      after: { reason: REASON },
      request_id: auditOf(db).requestId,
    });
    // The approval's own entry is still the only one of its kind.
    expect(await approvalEntries(db, estimateId)).toHaveLength(1);
  });

  it('an Admin unlocks too, and a reason of exactly 500 characters is kept whole', async () => {
    const { estimateId } = await approvedEstimate();
    const reason = 'x'.repeat(500);
    await unlocking().unlock(adminOf(db), estimateId, request(reason));
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    expect(defined((await approvalRows(estimateId))[0]).unlock_reason).toBe(reason);
  });

  it('an audit entry that cannot be written takes the status and the unlock with it', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const failing = unlockOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: db.audit.list } });
    await expect(failing.unlock(lead(), estimateId, request())).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toEqual([]);
  });

  it('a store of the unlock that fails after the status moved takes the status back: nothing is half written', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const failing = unlockOver({ approvals: { findLiveApproval: db.approvals.findLiveApproval, markUnlocked: () => Promise.reject(new Error(INVENTED_FAILURE)) } });
    await expect(failing.unlock(lead(), estimateId, request())).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
  });

  it('waits for the estimate\'s row lock: nothing is unlocked while another transaction holds it, and the unlock goes through once it lets go', async () => {
    const { estimateId } = await approvedEstimate();
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(unlocking().unlock(lead(), estimateId, request()));
      // The lock is held until the unlock is seen waiting for it: a holder that returned at once could commit before the unlock asked, and the test would pass with or without the lock.
      await untilALockWaits(db);
      expect(await statusOf(db, estimateId)).toBe('APPROVED');
      expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toEqual([]);
    });
    expect(await waiting.current).toBeUndefined();
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toHaveLength(1);
  });
});

describe('AC-4: an empty, white-space or over-long reason is a 422 under `reason`, and nothing changes', () => {
  it.each([
    ['empty', '', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['white space and line breaks only', '  \n \t ', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['501 characters', 'x'.repeat(501), UNLOCK_REASON_TOO_LONG_MESSAGE],
    ['a zero-width joiner (DL-219)', 'Round\u200Ded', TEXT_CHARACTERS_MESSAGE],
  ])('%s', async (_name, reason, message) => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(unlocking().unlock(lead(), estimateId, request(reason)));
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect(refusal instanceof FieldValidationError && refusal.fields).toEqual([{ field: 'reason', message }]);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
  });
});

describe('AC-5: a status that is not APPROVED, a second unlock, and two unlocks at once', () => {
  it('an estimate that is not approved (a Draft and a Submitted one) is the machine\'s 409, and writes nothing', async () => {
    const submitted = await calculatedEstimate(db);
    const draft = await db.addEstimate({ engineer: true });
    for (const estimateId of [submitted.estimateId, draft]) {
      const before = await storedOf(db, estimateId);
      await expect(unlocking().unlock(lead(), estimateId, request())).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code });
      expect(await storedOf(db, estimateId)).toEqual(before);
    }
  });

  it('an estimate that does not exist is a 404', async () => {
    await expect(unlocking().unlock(lead(), '00000000-0000-4000-8000-00000000dead', request())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a second unlock of the same estimate is that same 409, and stores and records nothing more', async () => {
    const { estimateId } = await approvedEstimate();
    await unlocking().unlock(lead(), estimateId, request());
    const before = await storedOf(db, estimateId);
    await expect(unlocking().unlock(lead(), estimateId, request('A second reason.'))).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(defined((await approvalRows(estimateId))[0]).unlock_reason).toBe(REASON);
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toHaveLength(1);
  });

  it('two unlocks at once: one wins and the other is the 409; exactly one unlock and one audit entry exist, and they are the winner\'s', async () => {
    const { estimateId } = await approvedEstimate();
    // Both answers are collected before anything is asserted, so a failing call cannot leave a rejection unhandled (#443).
    const reasons = ['First reason.', 'Second reason.'] as const;
    const refusals = await Promise.all(reasons.map((reason) => refusalOf(unlocking().unlock(lead(), estimateId, request(reason)))));
    const winners = reasons.filter((_reason, index) => refusals[index] === undefined);
    const losers = refusals.filter((refusal) => refusal !== undefined);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(defined((await approvalRows(estimateId))[0]).unlock_reason).toBe(winners[0]);
    const entries = await approvalEntries(db, estimateId, 'approval.unlocked');
    expect(entries).toHaveLength(1);
    expect(defined(entries[0]).after).toEqual({ reason: winners[0] });
  });
});

describe('AC-6 (NFR-001): an Engineer cannot unlock or preview', () => {
  it('is refused 403 before the estimate is looked at, and nothing is written', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    await expect(unlocking().unlock(engineerOf(db), estimateId, request())).rejects.toMatchObject({ httpStatus: 403 });
    await expect(unlocking().preview(engineerOf(db), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
  });
});

describe('AC-1, AC-8: the preview counts what changed since the approval, by kind, and nothing else', () => {
  it('nothing changed: three counts of 0, the two version numbers, and the Engineer whose queue the task returns to', async () => {
    const { estimateId } = await approvedEstimate();
    const before = await storedOf(db, estimateId);
    const preview = await unlocking().preview(lead(), estimateId);
    expect(preview).toEqual({ engineerName: 'Invented Calculation Engineer', configuration: { approved: 1, current: 1 }, changed: { processRates: 0, materialPrices: 0, exchangeRates: 0 } });
    // A read: it changes and records nothing.
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it('a process rate, a material price and an exchange rate changed: one of each, and the answer holds no value', async () => {
    const { estimateId, customerId, materialId, calculationId } = await approvedOnOwnMasters();
    const used = await db.owner.query<{ id: string }>("SELECT master_snapshot->'rates'->0->>'id' AS id FROM calculations WHERE id = $1::uuid", [calculationId]);
    const rateId = defined(defined(used.rows[0]).id);
    const exchange = await db.owner.query<{ currency: string; inr_value: string }>('SELECT currency, inr_value::text FROM exchange_rates ORDER BY currency');
    try {
      await db.owner.query('UPDATE customer_rates SET value = value + 1 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [customerId, rateId]);
      await db.owner.query('UPDATE materials SET price_per_kg = price_per_kg + 1 WHERE id = $1::uuid', [materialId]);
      await db.owner.query("UPDATE exchange_rates SET inr_value = inr_value + 1 WHERE currency = 'USD'");
      const preview = await unlocking().preview(lead(), estimateId);
      expect(preview.changed).toEqual({ processRates: 1, materialPrices: 1, exchangeRates: 1 });
      expect(Object.keys(preview).sort()).toEqual(['changed', 'configuration', 'engineerName']);
      expect(JSON.stringify(preview)).not.toContain(EXCHANGE.usd);
    } finally {
      // The exchange rates are shared by every estimate of this file: put them back, so a later preview that expects no change still sees none.
      for (const rate of exchange.rows) await db.owner.query('UPDATE exchange_rates SET inr_value = $2::numeric WHERE currency = $1', [rate.currency, rate.inr_value]);
    }
  });

  it('a configuration version added since is told (1 at approval, 2 now), and the unlock still goes ahead', async () => {
    const { estimateId } = await approvedEstimate();
    const document = await db.owner.query<{ snapshot: unknown }>('SELECT snapshot FROM config_versions WHERE number = 1');
    await db.owner.query("INSERT INTO config_versions (number, snapshot, reason) VALUES (2, $1::jsonb, 'Invented change')", [JSON.stringify(defined(document.rows[0]).snapshot)]);
    expect((await unlocking().preview(lead(), estimateId)).configuration).toEqual({ approved: 1, current: 2 });
    await unlocking().unlock(lead(), estimateId, request());
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
  });

  it('an estimate that is not approved is the machine\'s 409, and one that does not exist is a 404', async () => {
    const { estimateId } = await calculatedEstimate(db);
    await expect(unlocking().preview(lead(), estimateId)).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    await expect(unlocking().preview(lead(), '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('AC-10: a customer or a material deleted after the approval refuses the unlock, and nothing is written', () => {
  it('a customer deleted earlier: 409 CUSTOMER_DELETED in the unlock\'s words, the status stays APPROVED, no unlock is stored and no audit entry is written', async () => {
    const { estimateId, customerId } = await approvedOnOwnMasters();
    // A customer used only by Approved estimates may be deleted (STORY-02.07 AC-4).
    await db.mastersService.deleteCustomer(contextOf(db.personId), customerId);
    const before = await storedOf(db, estimateId);
    await expect(unlocking().unlock(lead(), estimateId, request())).rejects.toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE, message: UNLOCK_CUSTOMER_DELETED_MESSAGE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toEqual([]);
    // The preview says the same before the reason is typed.
    await expect(unlocking().preview(lead(), estimateId)).rejects.toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE, message: UNLOCK_CUSTOMER_DELETED_MESSAGE });
  });

  it('a material deleted earlier: 409 MATERIAL_DELETED in the unlock\'s words, and nothing is written', async () => {
    const { estimateId, materialId } = await approvedOnOwnMasters();
    await db.owner.query('UPDATE materials SET deleted_at = now() WHERE id = $1::uuid', [materialId]);
    const before = await storedOf(db, estimateId);
    await expect(unlocking().unlock(lead(), estimateId, request())).rejects.toMatchObject({ httpStatus: 409, code: MATERIAL_DELETED_CODE, message: UNLOCK_MATERIAL_DELETED_MESSAGE });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
  });

  it('an unlock that holds the customer first: the delete waits, then sees the Draft and is refused; the customer stays and the estimate keeps it', async () => {
    const { estimateId, customerId } = await approvedOnOwnMasters();
    const holding = gate();
    const unlock = refusalOf(unlockOver({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).unlock(lead(), estimateId, request()));
    try {
      await expectHolding(holding, unlock);
      let deleteDone = false;
      const deletion = refusalOf(db.mastersService.deleteCustomer(contextOf(db.personId), customerId)).finally(() => {
        deleteDone = true;
      });
      await untilALockWaits(db);
      expect(deleteDone, 'the delete did not wait for the unlock').toBe(false);
      holding.release();
      expect(await unlock).toBeUndefined();
      expect(await deletion).toBeInstanceOf(MasterInUseError);
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const { rows } = await db.owner.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM customers WHERE id = $1::uuid', [customerId]);
    expect(rows).toEqual([{ deleted_at: null }]);
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toHaveLength(1);
  });

  it('a delete that holds the customer first: the unlock waits, then finds no customer and is refused 409; the estimate stays APPROVED with nothing written', async () => {
    const { estimateId, customerId } = await approvedOnOwnMasters();
    const holding = gate();
    const deletion = refusalOf(createServiceHoldingBeforeCommit(db, holding.hold, holding.reachedHolding).deleteCustomer(contextOf(db.personId), customerId));
    try {
      await expectHolding(holding, deletion);
      let unlockDone = false;
      const unlock = refusalOf(unlocking().unlock(lead(), estimateId, request())).finally(() => {
        unlockDone = true;
      });
      await untilALockWaits(db);
      expect(unlockDone, 'the unlock did not wait for the delete').toBe(false);
      holding.release();
      expect(await deletion).toBeUndefined();
      expect(await unlock).toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE });
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toEqual([]);
    const { rows } = await db.owner.query<{ deleted: boolean }>('SELECT deleted_at IS NOT NULL AS deleted FROM customers WHERE id = $1::uuid', [customerId]);
    expect(rows).toEqual([{ deleted: true }]);
  });

  it('an unlock that holds the material first: the delete waits, then sees the Draft and is refused; the material stays', async () => {
    const { estimateId, materialId } = await approvedOnOwnMasters();
    const holding = gate();
    const unlock = refusalOf(unlockOver({ transactions: createHoldingRunner(db, holding.hold, holding.reachedHolding) }).unlock(lead(), estimateId, request()));
    try {
      await expectHolding(holding, unlock);
      let deleteDone = false;
      const deletion = refusalOf(db.mastersService.deleteMaterial(contextOf(db.personId), materialId)).finally(() => {
        deleteDone = true;
      });
      await untilALockWaits(db);
      expect(deleteDone, 'the delete did not wait for the unlock').toBe(false);
      holding.release();
      expect(await unlock).toBeUndefined();
      expect(await deletion).toBeInstanceOf(MasterInUseError);
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const { rows } = await db.owner.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM materials WHERE id = $1::uuid', [materialId]);
    expect(rows).toEqual([{ deleted_at: null }]);
  });

  it('a delete that holds the material first: the unlock waits, then finds it deleted and is refused 409 MATERIAL_DELETED; nothing is written', async () => {
    const { estimateId, materialId } = await approvedOnOwnMasters();
    const holding = gate();
    const deletion = refusalOf(createServiceHoldingBeforeCommit(db, holding.hold, holding.reachedHolding).deleteMaterial(contextOf(db.personId), materialId));
    try {
      await expectHolding(holding, deletion);
      let unlockDone = false;
      const unlock = refusalOf(unlocking().unlock(lead(), estimateId, request())).finally(() => {
        unlockDone = true;
      });
      await untilALockWaits(db);
      expect(unlockDone, 'the unlock did not wait for the delete').toBe(false);
      holding.release();
      expect(await deletion).toBeUndefined();
      expect(await unlock).toMatchObject({ httpStatus: 409, code: MATERIAL_DELETED_CODE });
    } finally {
      holding.release();
    }
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    noUnlockOn(await approvalRows(estimateId));
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toEqual([]);
  });
});

describe('AC-7, AC-12 (AQP-321 AC-4): after the unlock the inputs are editable again, and BO stays the price approved earlier', () => {
  it('the Engineer can save an input again, and the Lead\'s costs say: BO unchanged and labelled by its unlock, BL and every figure cleared', async () => {
    const { estimateId, top } = await approvedEstimate('1234.50');
    const approved = await review.getCosts(lead(), estimateId);
    expect(approved.state).toBe('current');
    expect(approved.approval).toMatchObject({ price: '1234.50', unlock: null });

    await unlocking().unlock(lead(), estimateId, request());
    // Right after the unlock the figures are still the ones from the approval, and BO is the price approved earlier.
    const unlocked = await review.getCosts(lead(), estimateId);
    expect(unlocked.state).toBe('current');
    expect(unlocked.approval).toMatchObject({ price: '1234.50', unlock: { byName: 'Invented Calculation Lead', reason: REASON, engineerName: 'Invented Calculation Engineer' } });

    // AC-7: the status is DRAFT and the Engineer's save is accepted (an approved estimate refuses it with 409).
    await db.estimateService.saveInputs(engineerOf(db), estimateId, { nodeId: top, revision: await revisionOf(db, top), values: { [idOf('J')]: '95' } });
    const changed = await review.getCosts(lead(), estimateId);
    expect(changed.state).toBe('out-of-date');
    expect(changed.totals).toBeNull();
    expect(changed.nodes.every((node) => node.figures === null)).toBe(true);
    expect(changed.calculationId).toBeNull();
    // AC-12: BO is read from the approvals row, so clearing the figures does not change it.
    expect(changed.approval).toEqual(unlocked.approval);
    // The Engineer is refused every price (NFR-002).
    await expect(review.getCosts(engineerOf(db), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('AC-11: a Draft with current figures can be recalculated and approved again without an input change; the earlier price stays on record until the new approval replaces it', async () => {
    const { estimateId } = await approvedEstimate('1000.00');
    await unlocking().unlock(lead(), estimateId, request());
    expect(await statusOf(db, estimateId)).toBe('DRAFT');

    await db.service.recalculate(lead(), estimateId);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    // Still the price approved earlier while the estimate is Submitted again.
    expect((await review.getCosts(lead(), estimateId)).approval).toMatchObject({ price: '1000.00', unlock: { reason: REASON } });

    const calculationId = await currentCalculationOf(db, estimateId);
    await db.approvalService.approve(lead(), estimateId, requestFor(db, calculationId, '2000.00'));
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    // The new approval replaces BO; the earlier approval stays on record, unlocked, with its price.
    expect((await review.getCosts(lead(), estimateId)).approval).toMatchObject({ price: '2000.00', unlock: null });
    const rows = await approvalRows(estimateId);
    expect(rows.map((row) => row.approved_price)).toEqual(['1000.00', '2000.00']);
    expect(defined(rows[0]).unlocked_at).not.toBeNull();
    expect(defined(rows[1]).unlocked_at).toBeNull();
    // The new approval can be unlocked in its turn, and each unlock has its own entry.
    await unlocking().unlock(lead(), estimateId, request('Second round.'));
    expect(await approvalEntries(db, estimateId, 'approval.unlocked')).toHaveLength(2);
  });
});
