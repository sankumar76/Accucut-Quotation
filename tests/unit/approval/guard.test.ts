import { describe, expect, it } from 'vitest';

import { ConflictError, ForbiddenError } from '@/lib/errors';
import {
  CALCULATION_CHANGED_CODE,
  NOT_CALCULATED_CODE,
  NOT_CALCULATED_MESSAGE,
  TOTALS_OUT_OF_DATE_CODE,
  TOTALS_OUT_OF_DATE_MESSAGE,
} from '@/lib/estimate/approval-words';
import { TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import type { FigureBasis } from '@/server/repositories/calculation-repository';
import { assertApprovable, assertMayApprove } from '@/server/services/approval-service';

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
    expect(refusalOf(() => assertApprovable(lead, submitted, CURRENT, { calculationId: OTHER_ID }))).toMatchObject({ httpStatus: 409, code: CALCULATION_CHANGED_CODE });
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
