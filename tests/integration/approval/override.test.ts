import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prefillPrice, REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/approve-price';
import { FieldValidationError } from '@/lib/errors';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createApprovalService } from '@/server/services/approval-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';

import { approvalCount, approvalEntries, calculatedEstimate, currentCalculationOf, leadOf, refusalOf, requestFor, statusOf, storedOf } from '../../support/approval-helpers';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-06.07 AC-2 to AC-6 and AC-8 (FR-103, FR-011, D-18; architecture section 5.1 and assumption A-12) against real PostgreSQL in a throwaway database, as the **runtime role**: a price that differs from the calculated
 * total (BL) is an override, decided by the server from the BL it read, at rupees and paise by the one rounding rule; the flag, the price and the reason are written **at insert**, in the approval's transaction (the
 * approvals trigger refuses a change afterwards, so there is no second write path); the reason is trimmed, kept only with an override, and copied to the override's own audit entry; a price equal to BL is not an
 * override and keeps no reason. Every promise is awaited or asserted with `rejects` (#443). Every name, ID and number is invented.
 */

const OVERRIDE_EVENT = 'approval.price_overridden';
const REASON = 'Rounded down to a whole hundred for the customer quote.';
const PRICE_LOWER = '1000.00';
const EMOJI = '😀';
const MAX_CHARACTERS = 500;
const ONE_MORE = MAX_CHARACTERS + 1;
const PAISE_DIGITS = 2;

let db: CalculationDatabase;
let review: EstimateReviewService;
const lead = () => leadOf(db);

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

interface Calculated {
  readonly estimateId: string;
  readonly calculationId: string;
  /** BL as the approval keeps it: rupees and paise, rounded by the rule the dialog pre-fills with. */
  readonly total: string;
}

/** A calculated estimate, with the calculation's own BL read back as the owner. */
async function calculated(): Promise<Calculated> {
  const { estimateId } = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, estimateId);
  const stored = defined((await db.owner.query<{ bl: string }>("SELECT product_values->>'totalPrice' AS bl FROM calculations WHERE id = $1::uuid", [calculationId])).rows[0]).bl;
  return { estimateId, calculationId, total: prefillPrice(stored) };
}

interface ApprovalRow {
  readonly approved_price: string;
  readonly calculated_bl: string;
  readonly is_override: boolean;
  readonly override_reason: string | null;
}

async function approvalRow(estimateId: string): Promise<ApprovalRow> {
  const { rows } = await db.owner.query<ApprovalRow>('SELECT approved_price::text, calculated_bl::text, is_override, override_reason FROM approvals WHERE estimate_id = $1::uuid', [estimateId]);
  expect(rows).toHaveLength(1);
  return defined(rows[0]);
}

/** Approves at `price` with `reason`, as the Lead. */
async function approveAt(estimate: Calculated, price: string, reason?: string): Promise<void> {
  await db.approvalService.approve(lead(), estimate.estimateId, { ...requestFor(db, estimate.calculationId, price), reason });
}

describe('AC-2 (D-18): a different price is an override, with or without a reason', () => {
  it('no reason: `is_override` true, `override_reason` null; the approval entry carries the flag, BL and the price; the override entry holds BL, the price and no reason', async () => {
    const estimate = await calculated();
    await approveAt(estimate, PRICE_LOWER);
    expect(await approvalRow(estimate.estimateId)).toEqual({ approved_price: PRICE_LOWER, calculated_bl: estimate.total, is_override: true, override_reason: null });

    const [approved] = await approvalEntries(db, estimate.estimateId);
    expect(defined(approved).after).toEqual({ approvedPrice: PRICE_LOWER, calculatedTotal: estimate.total, approver: 'Calculation Lead', isOverride: true });
    const overrides = await approvalEntries(db, estimate.estimateId, OVERRIDE_EVENT);
    expect(overrides).toHaveLength(1);
    expect(defined(overrides[0])).toMatchObject({
      event: OVERRIDE_EVENT,
      actor_id: db.personId,
      actor_label: 'Calculation Lead',
      object_type: 'estimate',
      object_id: estimate.estimateId,
      before: { calculatedTotal: estimate.total },
      after: { approvedPrice: PRICE_LOWER, reason: null },
    });
  });

  it('a price of 0 (AC-8) and a price above BL are overrides, and 0 is stored as 0.00', async () => {
    const zero = await calculated();
    await approveAt(zero, '0');
    expect(await approvalRow(zero.estimateId)).toMatchObject({ approved_price: '0.00', is_override: true, override_reason: null });
    const above = await calculated();
    await approveAt(above, '999999999999.99');
    expect(await approvalRow(above.estimateId)).toMatchObject({ approved_price: '999999999999.99', is_override: true });
  });

  it('the flag and the reason are written with the row and the database refuses to change them afterwards (one write path)', async () => {
    const estimate = await calculated();
    await approveAt(estimate, PRICE_LOWER, REASON);
    const update = await refusalOf(db.owner.query('UPDATE approvals SET override_reason = $2 WHERE estimate_id = $1::uuid', [estimate.estimateId, 'Another reason.']));
    expect(update).toMatchObject({ message: 'The approved values of an approval cannot be changed.' });
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ override_reason: REASON });
  });
});

describe('AC-3: the reason is kept, trimmed, with the approval and in the override\'s audit entry; BO reads it back', () => {
  it('stored trimmed, copied to the audit entry, and read back by the review (Lead) with the calculated total and the flag', async () => {
    const estimate = await calculated();
    await approveAt(estimate, PRICE_LOWER, `  ${REASON}  `);
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ is_override: true, override_reason: REASON });
    const overrides = await approvalEntries(db, estimate.estimateId, OVERRIDE_EVENT);
    expect(defined(overrides[0]).after).toEqual({ approvedPrice: PRICE_LOWER, reason: REASON });
    // The approval's own entry has no key for the reason.
    expect(JSON.stringify(defined((await approvalEntries(db, estimate.estimateId))[0]))).not.toContain(REASON);

    const costs = await review.getCosts(lead(), estimate.estimateId);
    expect(costs.approval).toMatchObject({ price: PRICE_LOWER, calculatedTotal: estimate.total, isOverride: true, reason: REASON });
  });

  it('keeps line feeds of a reason over several lines', async () => {
    const estimate = await calculated();
    await approveAt(estimate, PRICE_LOWER, 'First line.\r\nSecond line.');
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ override_reason: 'First line.\nSecond line.' });
  });

  it('a reason of spaces and line breaks is no reason: the override is kept with `override_reason` null', async () => {
    const estimate = await calculated();
    await approveAt(estimate, PRICE_LOWER, ' \n\t ');
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ is_override: true, override_reason: null });
    expect(defined((await approvalEntries(db, estimate.estimateId, OVERRIDE_EVENT))[0]).after).toEqual({ approvedPrice: PRICE_LOWER, reason: null });
  });
});

describe('AC-4: a reason of 501 characters is refused, and 500 is kept whatever its characters', () => {
  it('501 characters: a 422 under `reason` with the spec\'s sentence, and nothing is written', async () => {
    const estimate = await calculated();
    const before = await storedOf(db, estimate.estimateId);
    const refusal = await refusalOf(approveAt(estimate, PRICE_LOWER, 'x'.repeat(ONE_MORE)));
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect((refusal as FieldValidationError).fields).toEqual([{ field: 'reason', message: REASON_TOO_LONG_MESSAGE }]);
    expect(await storedOf(db, estimate.estimateId)).toEqual(before);
    expect(await statusOf(db, estimate.estimateId)).toBe('SUBMITTED');
  });

  it('500 characters is kept, and so are 500 emoji (1,000 UTF-16 units): the column\'s CHECK and the audit entry count characters, as the rule does', async () => {
    const plain = await calculated();
    await approveAt(plain, PRICE_LOWER, 'x'.repeat(MAX_CHARACTERS));
    expect(defined((await approvalRow(plain.estimateId)).override_reason)).toHaveLength(MAX_CHARACTERS);
    const emoji = await calculated();
    await approveAt(emoji, PRICE_LOWER, EMOJI.repeat(MAX_CHARACTERS));
    expect(Array.from(defined((await approvalRow(emoji.estimateId)).override_reason))).toHaveLength(MAX_CHARACTERS);
    expect(defined((await approvalEntries(db, emoji.estimateId, OVERRIDE_EVENT))[0]).after).toEqual({ approvedPrice: PRICE_LOWER, reason: EMOJI.repeat(MAX_CHARACTERS) });
  });

  it('501 emoji are refused before the database is reached', async () => {
    const estimate = await calculated();
    expect(await refusalOf(approveAt(estimate, PRICE_LOWER, EMOJI.repeat(ONE_MORE)))).toBeInstanceOf(FieldValidationError);
    expect(await approvalCount(db, estimate.estimateId)).toBe(0);
  });
});

describe('DL-219: a reason with an invisible character is a 422 with the shared sentence, never a database error', () => {
  it.each([
    ['a NUL (PostgreSQL text cannot hold it)', 'Round\u0000ed'],
    ['a zero-width joiner', 'Round‍ed'],
    ['a right-to-left override', 'Round‮ed'],
    ['a lone surrogate (jsonb cannot hold it)', 'Round\uD800ed'],
  ])('%s', async (_name, reason) => {
    const estimate = await calculated();
    const before = await storedOf(db, estimate.estimateId);
    const refusal = await refusalOf(approveAt(estimate, PRICE_LOWER, reason));
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect((refusal as FieldValidationError).fields).toEqual([{ field: 'reason', message: TEXT_CHARACTERS_MESSAGE }]);
    expect(await storedOf(db, estimate.estimateId)).toEqual(before);
  });
});

describe('AC-5 (UX-31): a price equal to BL is not an override, and a reason sent with it is ignored and not stored', () => {
  it('the pre-filled price: `is_override` false, no reason on the row, one approval entry and no override entry, and the words are nowhere in the audit log', async () => {
    const estimate = await calculated();
    await approveAt(estimate, estimate.total, REASON);
    expect(await approvalRow(estimate.estimateId)).toEqual({ approved_price: estimate.total, calculated_bl: estimate.total, is_override: false, override_reason: null });
    const [approved] = await approvalEntries(db, estimate.estimateId);
    expect(defined(approved).after).toEqual({ approvedPrice: estimate.total, calculatedTotal: estimate.total, approver: 'Calculation Lead', isOverride: false });
    expect(await approvalEntries(db, estimate.estimateId, OVERRIDE_EVENT)).toEqual([]);
    const { rows } = await db.owner.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE object_id = $1::uuid AND (before::text LIKE $2 OR after::text LIKE $2)", [estimate.estimateId, `%${REASON}%`]);
    expect(defined(rows[0]).n).toBe(0);
  });

  it('compared at stored precision: the same price written with more zeros (12629.99 and 12629.9900) is the same price', async () => {
    const estimate = await calculated();
    await approveAt(estimate, `${estimate.total}00`);
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ approved_price: estimate.total, is_override: false, override_reason: null });
  });

  it.each([1n, -1n])('a price %s paisa from BL is an override', async (delta) => {
    const estimate = await calculated();
    const digits = (BigInt(estimate.total.replace('.', '')) + delta).toString().padStart(PAISE_DIGITS + 1, '0');
    const price = `${digits.slice(0, -PAISE_DIGITS)}.${digits.slice(-PAISE_DIGITS)}`;
    await approveAt(estimate, price);
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ approved_price: price, is_override: true });
  });
});

describe('AC-2 (NFR-007): the approval and its entries are one commit or none', () => {
  it('an override entry that cannot be written takes the approval, the status and the first entry back', async () => {
    const estimate = await calculated();
    const failing = createApprovalService({
      estimates: db.estimates,
      calculations: db.calculations,
      approvals: db.approvals,
      transactions: db.transactions,
      workflow: {
        transition: db.estimateService.transition,
        audit: { record: (tx, entry) => (entry.event === OVERRIDE_EVENT ? Promise.reject(new Error('Invented audit failure.')) : db.audit.record(tx, entry)), list: db.audit.list },
      },
    });
    const before = await storedOf(db, estimate.estimateId);
    await expect(failing.approve(lead(), estimate.estimateId, { ...requestFor(db, estimate.calculationId, PRICE_LOWER), reason: REASON })).rejects.toThrow('Invented audit failure.');
    expect(await storedOf(db, estimate.estimateId)).toEqual(before);
    expect(await statusOf(db, estimate.estimateId)).toBe('SUBMITTED');
    expect(await approvalEntries(db, estimate.estimateId)).toEqual([]);
  });

  it('two approvals at once, both overrides: one row, one approval entry and one override entry, all the winner\'s', async () => {
    const estimate = await calculated();
    const prices = ['1000.00', '2000.00'] as const;
    // Both answers are collected before anything is asserted, so a failing call cannot leave a rejection unhandled (#443).
    const refusals = await Promise.all(prices.map((price) => refusalOf(approveAt(estimate, price, `Reason for ${price}.`))));
    const winners = prices.filter((_price, index) => refusals[index] === undefined);
    expect(winners).toHaveLength(1);
    expect(await approvalRow(estimate.estimateId)).toMatchObject({ approved_price: winners[0], override_reason: `Reason for ${defined(winners[0])}.` });
    expect(await approvalEntries(db, estimate.estimateId)).toHaveLength(1);
    const overrides = await approvalEntries(db, estimate.estimateId, OVERRIDE_EVENT);
    expect(overrides).toHaveLength(1);
    expect(defined(overrides[0]).after).toEqual({ approvedPrice: winners[0], reason: `Reason for ${defined(winners[0])}.` });
  });
});
