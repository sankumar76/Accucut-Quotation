import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, ForbiddenError } from '@/lib/errors';
import {
  CALCULATION_CHANGED_CODE,
  NOT_CALCULATED_CODE,
  NOT_CALCULATED_MESSAGE,
  TOTALS_OUT_OF_DATE_CODE,
  TOTALS_OUT_OF_DATE_MESSAGE,
} from '@/lib/estimate/approval-words';
import { prefillPrice, REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/approve-price';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import { TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import type { FigureBasis } from '@/server/repositories/calculation-repository';
import { assertApprovable, assertMayApprove, createApprovalService } from '@/server/services/approval-service';

/**
 * STORY-06.05 AC-1 to AC-5 (FR-101, D-20; architecture sections 4.8 and 6 "Approve"): the guard of an approval, pure and with no storage. It runs in the order the story fixes: the role, the status (the state
 * machine's), the state of the figures (`figure-state.ts`), and last whether `calculationId` is still the estimate's current calculation. Every ID is invented.
 */

const CURRENT_ID = '00000000-0000-4000-8000-0ca100000001';
const OTHER_ID = '00000000-0000-4000-8000-0ca100000002';
const lead = { id: 'lead-1', role: 'LEAD' } as const;
const admin = { id: 'admin-1', role: 'ADMIN' } as const;
const engineer = { id: 'engineer-1', role: 'ENGINEER' } as const;

const basisAt = (inputsRevision: number, calculationRevision: number | null): FigureBasis => ({
  inputsRevision,
  calculation: calculationRevision === null ? null : { id: CURRENT_ID, inputsRevision: calculationRevision, configVersionId: 'config-1', createdAt: new Date('2026-11-14T05:00:00.000Z') },
});
const CURRENT = basisAt(4, 4);
const OUT_OF_DATE = basisAt(5, 4);
const NEVER = basisAt(0, null);

function refusalOf(call: () => void): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  return undefined;
}

const submitted = { status: 'SUBMITTED' as EstimateStatus };

describe('AC-1: a never-calculated estimate is the 409 NOT_CALCULATED, naming the step', () => {
  it('state `none`', () => {
    const error = refusalOf(() => assertApprovable(lead, submitted, NEVER, { calculationId: CURRENT_ID }));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: NOT_CALCULATED_CODE, message: NOT_CALCULATED_MESSAGE });
    expect(NOT_CALCULATED_MESSAGE).toBe('Press Calculate (or Recalculate) first.');
  });
});

describe('AC-2: an estimate changed since its last calculation is the 409 TOTALS_OUT_OF_DATE', () => {
  it('state `out-of-date`', () => {
    const error = refusalOf(() => assertApprovable(lead, submitted, OUT_OF_DATE, { calculationId: CURRENT_ID }));
    expect(error).toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE, message: TOTALS_OUT_OF_DATE_MESSAGE });
    expect(TOTALS_OUT_OF_DATE_MESSAGE).toBe('An input changed since the last calculation. Press Recalculate first.');
  });

  it('a calculation that is somehow ahead of its estimate counts as out of date, never as current', () => {
    expect(refusalOf(() => assertApprovable(lead, submitted, basisAt(3, 4), { calculationId: CURRENT_ID }))).toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
  });
});

describe('AC-3: a calculationId that is not the current calculation is a 409', () => {
  it('another ID, with the figures current', () => {
    expect(refusalOf(() => assertApprovable(lead, submitted, CURRENT, { calculationId: OTHER_ID }))).toMatchObject({
      httpStatus: 409,
      code: CALCULATION_CHANGED_CODE,
      // The words settled by the ux-expert (ux-spec v0.30, AQP-322 comment 12055), pinned as written.
      message: 'The figures were calculated again after this page was loaded, so nothing was approved. Show the new figures and check the total before you approve.',
    });
  });

  it('the same ID in capitals is the same ID', () => {
    expect(refusalOf(() => assertApprovable(lead, submitted, CURRENT, { calculationId: CURRENT_ID.toUpperCase() }))).toBeUndefined();
  });
});

describe('AC-4: a status that is not SUBMITTED is the state machine\'s 409', () => {
  it.each<[EstimateStatus, keyof typeof TRANSITION_REFUSALS]>([
    ['DRAFT', 'NOT_SUBMITTED'],
    ['APPROVED', 'ALREADY_APPROVED'],
  ])('%s: the code and sentence of %s, whatever the figures are', (status, reason) => {
    for (const basis of [CURRENT, OUT_OF_DATE, NEVER]) {
      expect(refusalOf(() => assertApprovable(lead, { status }, basis, { calculationId: CURRENT_ID }))).toMatchObject({
        httpStatus: 409,
        code: TRANSITION_REFUSALS[reason].code,
        message: TRANSITION_REFUSALS[reason].message,
      });
    }
  });
});

describe('AC-5: the order of the checks is role, status, state, calculationId', () => {
  it('an Engineer is refused 403 by the role check whatever else is wrong', () => {
    expect(() => assertMayApprove(engineer)).toThrow(ForbiddenError);
    expect(refusalOf(() => assertApprovable(engineer, { status: 'APPROVED' }, NEVER, { calculationId: OTHER_ID }))).toBeInstanceOf(ForbiddenError);
  });

  it('a Lead and an Admin pass the role check', () => {
    expect(() => assertMayApprove(lead)).not.toThrow();
    expect(() => assertMayApprove(admin)).not.toThrow();
  });

  it('the status before the state: a Draft that was never calculated is "not submitted", not "not calculated"', () => {
    expect(refusalOf(() => assertApprovable(lead, { status: 'DRAFT' }, NEVER, { calculationId: OTHER_ID }))).toMatchObject({ code: TRANSITION_REFUSALS.NOT_SUBMITTED.code });
  });

  it('the state before the calculationId: out-of-date with a wrong ID is TOTALS_OUT_OF_DATE', () => {
    expect(refusalOf(() => assertApprovable(lead, submitted, OUT_OF_DATE, { calculationId: OTHER_ID }))).toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
    expect(refusalOf(() => assertApprovable(lead, submitted, NEVER, { calculationId: OTHER_ID }))).toMatchObject({ code: NOT_CALCULATED_CODE });
  });
});

describe('AC-7: a Submitted estimate with current figures and the current calculation passes', () => {
  it.each([lead, admin])('$role passes', (viewer) => {
    expect(refusalOf(() => assertApprovable(viewer, submitted, CURRENT, { calculationId: CURRENT_ID }))).toBeUndefined();
  });
});

describe('NFR-002: no refusal holds an ID, a figure or a revision', () => {
  it.each([
    ['none', NEVER],
    ['out-of-date', OUT_OF_DATE],
    ['changed', CURRENT],
  ])('the %s refusal says only the step', (_name, basis) => {
    const error = refusalOf(() => assertApprovable(lead, submitted, basis, { calculationId: OTHER_ID }));
    const text = JSON.stringify({ message: (error as Error).message, code: (error as { code: string }).code });
    expect(text).not.toContain(CURRENT_ID);
    expect(text).not.toContain(OTHER_ID);
    expect(text).not.toMatch(/\d/);
  });
});

describe('AC-5: the service refuses an Engineer as a rejected promise, before it reads or locks anything', () => {
  it('rejects with the 403 (it does not throw before returning a promise), and the stores are not touched', async () => {
    let touched = 0;
    const touch = (): never => {
      touched += 1;
      throw new Error('The store was touched.');
    };
    const service = createApprovalService({
      estimates: { lockEstimate: touch },
      calculations: { findFigureBasis: touch, findCalculatedTotal: touch },
      approvals: { insertApproval: touch },
      transactions: { run: touch },
      workflow: { transition: touch, audit: { record: touch, recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')), list: touch } },
    });
    const audit = { actorId: engineer.id, actorLabel: 'Invented Engineer', requestId: 'request-1' };
    await expect(service.approve(engineer, 'estimate-1', { calculationId: CURRENT_ID, price: '1.00', audit })).rejects.toBeInstanceOf(ForbiddenError);
    expect(touched).toBe(0);
  });
});

describe('STORY-06.06: the write refuses what the guard cannot, and writes nothing', () => {
  const audit = { actorId: lead.id, actorLabel: 'Invented Lead', requestId: 'request-2' };
  /** A service whose storage holds a submitted estimate with current figures, and counts every write. */
  function serviceWith(total: string | null) {
    const writes: string[] = [];
    const inserted: Array<{ readonly calculatedTotal: string; readonly approvedPrice: string; readonly isOverride: boolean; readonly overrideReason: string | null }> = [];
    const audited: unknown[] = [];
    const tx = { kind: 'database-transaction' } as const;
    const service = createApprovalService({
      estimates: { lockEstimate: () => Promise.resolve({ id: 'estimate-1', engineerId: 'engineer-1', status: 'SUBMITTED', customerId: 'customer-1', inputsRevision: 4, taskCode: 'Q-2026-0001' }) },
      calculations: { findFigureBasis: () => Promise.resolve(CURRENT), findCalculatedTotal: () => Promise.resolve(total) },
      approvals: {
        insertApproval: (approval) => {
          writes.push('insert');
          inserted.push({ calculatedTotal: approval.calculatedTotal, approvedPrice: approval.approvedPrice, isOverride: approval.isOverride, overrideReason: approval.overrideReason });
          return Promise.resolve({ id: 'approval-1', approvedAt: new Date('2026-11-16T06:00:00.000Z') });
        },
      },
      transactions: { run: (work) => work(tx) },
      workflow: {
        transition: () => {
          writes.push('transition');
          return Promise.resolve({ id: 'estimate-1', from: 'SUBMITTED', to: 'APPROVED' });
        },
        audit: {
          record: (_tx, entry) => {
            writes.push('audit');
            audited.push(entry.after);
            return Promise.resolve();
          },
          recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')),
          list: () => Promise.reject(new Error('Not used.')),
        },
      },
    });
    return { service, writes, inserted, audited };
  }

  it('writes the status, the approval and the audit entry, in that order, in the one transaction, and answers the price in rupees and paise (a price that is the calculated total is no override: no second entry)', async () => {
    const { service, writes } = serviceWith('12629.9876');
    await expect(service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '12629.99', audit })).resolves.toEqual({
      status: 'APPROVED',
      approvedPrice: '12629.99',
      approvedAt: '2026-11-16T06:00:00.000Z',
    });
    expect(writes).toEqual(['transition', 'insert', 'audit']);
  });

  it('an override writes the status, the approval and then the two audit entries, in that order, in the one transaction', async () => {
    const { service, writes } = serviceWith('12629.9876');
    await expect(service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '12600', audit })).resolves.toMatchObject({ status: 'APPROVED', approvedPrice: '12600.00' });
    expect(writes).toEqual(['transition', 'insert', 'audit', 'audit']);
  });

  it.each([
    // The values where rounding the full total once and rounding it twice (to 4 places, then to 2) disagree (SQR-03 of the review): 12.34495 is 12.34 at the third digit, and 12.3450 would give 12.35.
    ['12.34495', '12.34'],
    ['12.344999', '12.34'],
    ['12.345', '12.35'],
    ['0.00495', '0.00'],
    ['12629.9876', '12629.99'],
    ['30', '30.00'],
  ])('the total kept for %s is %s: the one rule the dialog pre-fills its price with, so the two always agree', async (total, expected) => {
    const { service, inserted, audited } = serviceWith(total);
    await service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '1.00', audit });
    expect(inserted).toEqual([{ calculatedTotal: expected, approvedPrice: '1.00', isOverride: true, overrideReason: null }]);
    expect(prefillPrice(total)).toBe(expected);
    expect(audited).toEqual([
      { approvedPrice: '1.00', calculatedTotal: expected, approver: 'Invented Lead', isOverride: true },
      { approvedPrice: '1.00', reason: null },
    ]);
  });

  it.each([
    // SQR-03 of the review of AQP-323, for 06.07: the pre-filled price is never an override, wherever rounding the full total once and rounding it twice would disagree.
    ['100.00495', '100.00'],
    ['12.34495', '12.34'],
    ['12.344999', '12.34'],
    ['12.345', '12.35'],
    ['0.00495', '0.00'],
    ['12629.9876', '12629.99'],
    ['30', '30.00'],
    ['12629.9900', '12629.99'],
  ])('the price pre-filled for a total of %s (%s) is not an override: the flag is false, no reason is kept, and there is one entry', async (total, prefilled) => {
    const { service, inserted, audited, writes } = serviceWith(total);
    expect(prefillPrice(total)).toBe(prefilled);
    await service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: prefilled, reason: 'Sent but not kept.', audit });
    expect(inserted).toEqual([{ calculatedTotal: prefilled, approvedPrice: prefilled, isOverride: false, overrideReason: null }]);
    expect(audited).toEqual([{ approvedPrice: prefilled, calculatedTotal: prefilled, approver: 'Invented Lead', isOverride: false }]);
    expect(writes).toEqual(['transition', 'insert', 'audit']);
  });

  it.each([
    ['100.00495', '100.01'],
    ['12.34495', '12.35'],
    ['12629.9876', '12630.00'],
    ['12629.9876', '12629.98'],
  ])('one paisa from the rounded total of %s, at %s, is an override', async (total, price) => {
    const { service, inserted } = serviceWith(total);
    await service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price, audit });
    expect(inserted[0]).toMatchObject({ approvedPrice: price, isOverride: true });
  });

  it('the reason is trimmed, kept with an override and copied to the override entry, and an empty one is kept as nothing', async () => {
    const withReason = serviceWith('12629.99');
    await withReason.service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '12600', reason: '  Rounded for the quote.  ', audit });
    expect(withReason.inserted[0]).toMatchObject({ isOverride: true, overrideReason: 'Rounded for the quote.' });
    expect(withReason.audited[1]).toEqual({ approvedPrice: '12600.00', reason: 'Rounded for the quote.' });
    const withoutReason = serviceWith('12629.99');
    await withoutReason.service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '12600', reason: '   ', audit });
    expect(withoutReason.inserted[0]).toMatchObject({ isOverride: true, overrideReason: null });
  });

  it.each([
    ['over 500 characters', 'x'.repeat(501), REASON_TOO_LONG_MESSAGE],
    ['holding a zero-width joiner', 'a‍b', TEXT_CHARACTERS_MESSAGE],
    ['holding a control character', 'a\u0007b', TEXT_CHARACTERS_MESSAGE],
  ])('a reason %s is refused before anything is read or written, even when called without the route (the second guard)', async (_name, reason, message) => {
    const { service, writes } = serviceWith('12629.99');
    const refusal = await service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '12600', reason, audit }).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect((refusal as FieldValidationError).fields).toEqual([{ field: 'reason', message }]);
    expect(writes).toEqual([]);
  });

  it('a current calculation with no total is a fault in the data (a plain error, a 500), and nothing is written', async () => {
    const { service, writes } = serviceWith(null);
    await expect(service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: '1.00', audit })).rejects.toThrow('no total to approve against');
    expect(writes).toEqual([]);
  });

  it('a price that is no decimal is refused before anything is read (the route has already judged its shape; this is the second guard)', async () => {
    const { service, writes } = serviceWith('1.00');
    await expect(service.approve(lead, 'estimate-1', { calculationId: CURRENT_ID, price: 'twelve', audit })).rejects.toThrow('not a decimal number');
    expect(writes).toEqual([]);
  });
});
