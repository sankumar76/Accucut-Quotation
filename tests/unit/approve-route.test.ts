import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CALCULATION_CHANGED_CODE, NOT_CALCULATED_CODE, NOT_CALCULATED_MESSAGE, TOTALS_OUT_OF_DATE_CODE, TOTALS_OUT_OF_DATE_MESSAGE } from '@/lib/estimate/approval-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { toTwoPlaces } from '@/lib/money';
import { approveAnswerSchema } from '@/server/views/schemas/estimates';

import { completePartInputs, fieldIdOf } from '../support/complete-part';
import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { forbiddenStrings } from '../support/canary-masters';
import { UNKNOWN_CALCULATION_ID } from '../support/route-calls';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-06.05 AC-1 to AC-5, AC-7 and AC-8 (FR-101, D-20; NFR-002, NFR-007; architecture sections 4.8 and 6 "Approve") and STORY-06.06 AC-2, AC-6 and AC-7 (FR-062), through the real `withRoute`, the real session, the
 * real approval, calculation and estimate services over in-memory storage: the server refuses an approval unless the estimate is SUBMITTED, its figures are `current` and the request names the current calculation,
 * with a fixed sentence that names the missing step; every refusal writes nothing and records no audit entry; an estimate that passes the guard is approved: the status, the approvals row and the audit entry are
 * written together or not at all, and two approvals at once leave one row. Who may call the route is `tests/security/role-matrix.test.ts`; the PostgreSQL side (every writer of an input, the race with a save, the
 * grants) is `tests/integration/approval/`. Every name, ID and number is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getEstimateService: () => shared.estimateService,
    getCalculationService: () => shared.calculationService,
    getApprovalService: () => shared.approvalService,
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';
const PRICE = '12600.00';
const { POST } = await import('@/app/api/v1/estimates/[id]/approve/route');

const record = z.record(z.string(), z.unknown());
const FIRST_MATERIAL = defined(MATERIAL_CANARIES[0]);

const request = (body?: unknown, origin: string = ORIGIN): Request =>
  body === undefined
    ? new Request(`${ORIGIN}/api/v1/estimates/x/approve`, { method: 'POST', headers: { origin } })
    : new Request(`${ORIGIN}/api/v1/estimates/x/approve`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const owned = (): string => estimate().id;
const engineer = () => ({ id: harness.idOf.ENGINEER, role: 'ENGINEER' as const });
const lead = () => ({ id: harness.idOf.LEAD, role: 'LEAD' as const });
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
/** The ID of the calculation the estimate is linked to, which is what the Lead's page names. */
const currentCalculation = (): string => defined(estimate().currentCalculationId);
const approve = (calculationId: string, extra: Record<string, unknown> = {}): Promise<Response> => POST(request({ calculationId, price: PRICE, ...extra }), withId(owned()));

/** The status and code of an answer. */
const refusalOf = async (answer: Promise<Response>): Promise<{ readonly status: number; readonly code: unknown }> => {
  const response = await answer;
  return { status: response.status, code: (await bodyOf(response))['code'] };
};

/** A complete estimate: the customer chosen, and the one part holding every input, with a canary material. */
function makeComplete(): void {
  estimate().customerId = CUSTOMER_RECIPE_ID;
  part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
}

/** The Engineer's Calculate: the estimate is SUBMITTED and its figures are `current`. */
async function calculated(): Promise<void> {
  makeComplete();
  await harness.calculationService.calculate(engineer(), owned());
}

/** What a refusal must have left alone: the status, the link, the records, the approvals, the revision and the audit entries. */
function snapshot() {
  return {
    status: estimate().status,
    link: estimate().currentCalculationId,
    revision: estimate().inputsRevision,
    records: harness.calculationWorld.calculations.length,
    approvals: harness.calculationWorld.approvals.length,
    audit: harness.calculationAudit.rows.length,
  };
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
});

/** Puts the harness estimate, its part and the stored records back as the recipe made them, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.customerId = null;
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  held.currentCalculationId = null;
  part().inputs = {};
  harness.calculationWorld.calculations.length = 0;
  harness.calculationWorld.approvals.length = 0;
  harness.calculationAudit.rows.length = 0;
  vi.restoreAllMocks();
});

describe('AC-1: a never-calculated estimate is the 409 NOT_CALCULATED, naming the step, and nothing is written', () => {
  it('a Submitted estimate with no calculation', async () => {
    makeComplete();
    estimate().status = 'SUBMITTED';
    const before = snapshot();
    const response = await approve(UNKNOWN_CALCULATION_ID);
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await bodyOf(response)).toMatchObject({ status: 409, code: NOT_CALCULATED_CODE, title: NOT_CALCULATED_MESSAGE });
    expect(snapshot()).toEqual(before);
  });
});

describe('AC-2: an estimate changed since its last calculation is the 409 TOTALS_OUT_OF_DATE, and nothing is written', () => {
  it('an input changed after the Calculate (the revision went up, Remarks included: the revision is all the state reads)', async () => {
    await calculated();
    const calculationId = currentCalculation();
    estimate().inputsRevision += 1;
    const before = snapshot();
    const response = await approve(calculationId);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE, title: TOTALS_OUT_OF_DATE_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('a value changed and changed back is two changes: still refused', async () => {
    await calculated();
    const calculationId = currentCalculation();
    estimate().inputsRevision += 2;
    expect(await bodyOf(await approve(calculationId))).toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
  });
});

describe('AC-3: a calculationId that is not the current calculation is a 409', () => {
  it('an ID the estimate does not have', async () => {
    await calculated();
    const before = snapshot();
    const response = await approve(UNKNOWN_CALCULATION_ID);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({
      code: CALCULATION_CHANGED_CODE,
      title: 'The figures were calculated again after this page was loaded, so nothing was approved. Show the new figures and check the total before you approve.',
    });
    expect(snapshot()).toEqual(before);
  });

  it('the ID the Lead saw, after a Recalculate made a newer one: a figure that changed under the Lead cannot be approved', async () => {
    await calculated();
    const seen = currentCalculation();
    await harness.calculationService.recalculate(lead(), owned());
    expect(currentCalculation()).not.toBe(seen);
    expect(await bodyOf(await approve(seen))).toMatchObject({ status: 409, code: CALCULATION_CHANGED_CODE });
    expect(estimate().status).toBe('SUBMITTED');
  });
});

describe('AC-4: a status that is not SUBMITTED is the state machine\'s 409', () => {
  it.each([
    ['DRAFT', 'NOT_SUBMITTED'],
    ['APPROVED', 'ALREADY_APPROVED'],
  ] as const)('%s: the code and sentence of the machine, with current figures and the right ID', async (status, reason) => {
    await calculated();
    const calculationId = currentCalculation();
    estimate().status = status;
    const response = await approve(calculationId);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TRANSITION_REFUSALS[reason].code, title: TRANSITION_REFUSALS[reason].message });
    expect(estimate().status).toBe(status);
  });
});

describe('AC-5: the order of the checks is role, estimate, status, state, calculationId', () => {
  it('an Engineer is refused 403 with the fixed body before the ID is looked at: nothing is locked or read, and an invented ID gets the same 403', async () => {
    await calculated();
    harness.signInAs('ENGINEER');
    const locks = harness.calculationWorld.lockCount();
    const basis = vi.spyOn(harness.calculationWorld.repository, 'findFigureBasis');
    const response = await approve(currentCalculation());
    expect(response.status).toBe(403);
    const recorded = { label: 'POST approve (API, Engineer)', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect((await POST(request({ calculationId: UNKNOWN_CALCULATION_ID, price: PRICE }), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(403);
    expect(harness.calculationWorld.lockCount()).toBe(locks);
    expect(basis).not.toHaveBeenCalled();
    basis.mockRestore();
  });

  it('nobody signed in is 401', async () => {
    harness.signInAs(null);
    expect((await approve(UNKNOWN_CALCULATION_ID)).status).toBe(401);
  });

  it('an estimate that does not exist and an ID that is none are the same 404, before the status and the figures are looked at', async () => {
    const missing = await POST(request({ calculationId: UNKNOWN_CALCULATION_ID, price: PRICE }), withId(UNKNOWN_ESTIMATE_ID));
    const malformed = await POST(request({ calculationId: UNKNOWN_CALCULATION_ID, price: PRICE }), withId('not-an-id'));
    expect([missing.status, malformed.status]).toEqual([404, 404]);
  });

  it('the estimate is locked for the check (the lock the writers of an input share)', async () => {
    await calculated();
    const locks = harness.calculationWorld.lockCount();
    await approve(currentCalculation());
    expect(harness.calculationWorld.lockCount()).toBeGreaterThan(locks);
  });

  it('the status comes before the state: a Draft that was never calculated is "not submitted"', async () => {
    makeComplete();
    expect(await bodyOf(await approve(UNKNOWN_CALCULATION_ID))).toMatchObject({ code: TRANSITION_REFUSALS.NOT_SUBMITTED.code });
  });

  it('the state comes before the calculationId: cleared figures with a wrong ID is TOTALS_OUT_OF_DATE', async () => {
    await calculated();
    estimate().inputsRevision += 1;
    expect(await bodyOf(await approve(UNKNOWN_CALCULATION_ID))).toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
  });
});

describe('STORY-06.06 AC-2: an approval that passes the guard is written, in one piece', () => {
  it('after a Recalculate and with the new calculation\'s ID: 200, the estimate is APPROVED, one approvals row holds the price and the calculated total, and one audit entry names them and the approver', async () => {
    await calculated();
    estimate().inputsRevision += 1;
    expect((await approve(currentCalculation())).status).toBe(409);
    await harness.calculationService.recalculate(lead(), owned());
    const calculationId = currentCalculation();
    const entries = harness.calculationAudit.rows.length;
    const response = await approve(calculationId);
    expect(response.status).toBe(200);
    expect(approveAnswerSchema.parse(await bodyOf(response))).toMatchObject({ status: 'APPROVED', approvedPrice: PRICE });
    expect(estimate().status).toBe('APPROVED');
    // The row is the one the story names: the estimate, the calculation it was approved on, the price, the total it was set against and who approved it.
    const [row] = harness.calculationWorld.approvals;
    const calculatedTotal = defined(harness.calculationWorld.calculations.find((record) => record.id === calculationId)).productValues.totalPrice;
    const paise = toTwoPlaces(defined(calculatedTotal));
    expect(harness.calculationWorld.approvals).toHaveLength(1);
    expect(row).toMatchObject({ estimateId: owned(), calculationId, approvedPrice: PRICE, calculatedTotal: paise, approvedById: harness.idOf.LEAD });
    // One entry, `approval.approved`, with the price, the calculated total and the approver (the person's name now).
    expect(harness.calculationAudit.rows).toHaveLength(entries + 1);
    expect(harness.calculationAudit.rows.at(-1)).toMatchObject({ event: 'approval.approved', actorId: harness.idOf.LEAD, actorLabel: 'Invented Lead', objectId: owned(), before: null });
    expect(harness.calculationAudit.rows.at(-1)?.after).toEqual({ approvedPrice: PRICE, calculatedTotal: paise, approver: 'Invented Lead' });
  });

  it('an Admin passes it too, and a price in whole rupees is kept as rupees and paise', async () => {
    await calculated();
    harness.signInAs('ADMIN');
    const response = await POST(request({ calculationId: currentCalculation(), price: '12600' }), withId(owned()));
    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({ status: 'APPROVED', approvedPrice: '12600.00' });
    expect(harness.calculationWorld.approvals[0]).toMatchObject({ approvedPrice: '12600.00', approvedById: harness.idOf.ADMIN });
  });

  it('a price that is not the calculated total is still approved (the override flag and its reason are STORY-06.07\'s), and the reason sent is not kept', async () => {
    await calculated();
    expect((await approve(currentCalculation(), { price: '1.00', reason: 'Rounded for the customer.' })).status).toBe(200);
    expect(harness.calculationWorld.approvals[0]).toMatchObject({ approvedPrice: '1.00' });
    expect(JSON.stringify(harness.calculationWorld.approvals)).not.toContain('Rounded for the customer.');
  });

  it('a failed insert takes the status back: nothing is half written (the transition ran first in the same transaction)', async () => {
    await calculated();
    const before = snapshot();
    vi.spyOn(harness.calculationWorld.approvalRepository, 'insertApproval').mockRejectedValueOnce(new Error('Invented insert failure.'));
    expect((await approve(currentCalculation())).status).toBe(500);
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('SUBMITTED');
  });

  it('an audit entry that cannot be written takes the approval and the status with it', async () => {
    await calculated();
    const before = snapshot();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    expect((await approve(currentCalculation())).status).toBe(500);
    expect(snapshot()).toEqual(before);
    expect(harness.calculationWorld.approvals).toHaveLength(0);
  });
});

describe('STORY-06.06 AC-6: two approvals at once leave exactly one row', () => {
  it('one wins with 200 and the other is the machine\'s 409 "already approved"; every answer is read before anything is asserted', async () => {
    await calculated();
    const calculationId = currentCalculation();
    // Both answers are collected first, so a failing call cannot leave a rejection unhandled (#443).
    const answers = await Promise.all([approve(calculationId), approve(calculationId, { price: '13000.00' })]);
    const outcomes = await Promise.all(answers.map(async (answer) => ({ status: answer.status, code: (await bodyOf(answer))['code'] })));
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([200, 409]);
    expect(outcomes.find((outcome) => outcome.status === 409)?.code).toBe(TRANSITION_REFUSALS.ALREADY_APPROVED.code);
    expect(harness.calculationWorld.approvals).toHaveLength(1);
    expect(harness.calculationAudit.rows.filter((row) => row.event === 'approval.approved')).toHaveLength(1);
    expect(estimate().status).toBe('APPROVED');
  });
});

describe('STORY-06.06 AC-7: nobody but a Lead or an Admin approves', () => {
  it('an Engineer is 403 and a signed-out caller is 401, and no approval is written', async () => {
    await calculated();
    const calculationId = currentCalculation();
    harness.signInAs('ENGINEER');
    expect((await approve(calculationId)).status).toBe(403);
    harness.signInAs(null);
    expect((await approve(calculationId)).status).toBe(401);
    expect(harness.calculationWorld.approvals).toHaveLength(0);
    expect(estimate().status).toBe('SUBMITTED');
  });
});

describe('AC-8 (NFR-007): a refusal writes no audit entry', () => {
  it('every refusal of the story leaves the audit entries as they were', async () => {
    await calculated();
    const calculationId = currentCalculation();
    const entries = harness.calculationAudit.rows.length;
    // Each call must really be the refusal it is named for (SQR-03 of the review of AQP-322), so a call that stopped being refused cannot leave the audit check true by accident.
    estimate().status = 'DRAFT';
    expect(await refusalOf(approve(calculationId))).toEqual({ status: 409, code: TRANSITION_REFUSALS.NOT_SUBMITTED.code });
    estimate().status = 'APPROVED';
    expect(await refusalOf(approve(calculationId))).toEqual({ status: 409, code: TRANSITION_REFUSALS.ALREADY_APPROVED.code });
    estimate().status = 'SUBMITTED';
    expect(await refusalOf(approve(UNKNOWN_CALCULATION_ID))).toEqual({ status: 409, code: CALCULATION_CHANGED_CODE });
    estimate().inputsRevision += 1;
    expect(await refusalOf(approve(calculationId))).toEqual({ status: 409, code: TOTALS_OUT_OF_DATE_CODE });
    expect(harness.calculationAudit.rows.length).toBe(entries);
  });
});

describe('the body is strict and is read after the role', () => {
  it.each([
    ['no calculationId', { price: PRICE }],
    ['a calculationId that is not an ID', { calculationId: 'not-an-id', price: PRICE }],
    ['no price', { calculationId: UNKNOWN_CALCULATION_ID }],
    ['a price with 3 decimals', { calculationId: UNKNOWN_CALCULATION_ID, price: '1.234' }],
    ['a negative price', { calculationId: UNKNOWN_CALCULATION_ID, price: '-1' }],
    ['a price as a number', { calculationId: UNKNOWN_CALCULATION_ID, price: 12 }],
    ['a reason over 500 characters', { calculationId: UNKNOWN_CALCULATION_ID, price: PRICE, reason: 'x'.repeat(501) }],
    ['a key that is not named', { calculationId: UNKNOWN_CALCULATION_ID, price: PRICE, status: 'APPROVED' }],
  ])('%s is 422 and writes nothing', async (_name, body) => {
    await calculated();
    const before = snapshot();
    const response = await POST(request(body), withId(owned()));
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(snapshot()).toEqual(before);
  });

  it('an empty body is 400, and a reason of exactly 500 characters is accepted by the shape', async () => {
    await calculated();
    expect((await POST(request(), withId(owned()))).status).toBe(400);
    expect((await approve(currentCalculation(), { reason: 'x'.repeat(500) })).status).toBe(200);
  });

  it('a request from another origin is refused before anything else', async () => {
    await calculated();
    const response = await POST(request({ calculationId: currentCalculation(), price: PRICE }, 'https://elsewhere.example.test'), withId(owned()));
    expect(response.status).toBe(403);
    expect(await bodyOf(response)).toMatchObject({ code: 'ORIGIN_REFUSED' });
  });
});

describe('NFR-002: no answer of the route holds a master value, rate name, formula, figure or ID', () => {
  it('every refusal and the good answer pass the scan of the canary values, and none names the estimate or a calculation', async () => {
    await calculated();
    const calculationId = currentCalculation();
    const answers: Response[] = [];
    answers.push(await approve(UNKNOWN_CALCULATION_ID));
    estimate().inputsRevision += 1;
    answers.push(await approve(calculationId));
    estimate().inputsRevision -= 1;
    estimate().status = 'DRAFT';
    answers.push(await approve(calculationId));
    estimate().status = 'SUBMITTED';
    answers.push(await approve(calculationId));
    expect(answers.map((answer) => answer.status)).toEqual([409, 409, 409, 200]);
    const [good] = answers.slice(-1);
    for (const answer of answers) {
      const text = await answer.text();
      const recorded = { label: 'POST approve (API, Lead)', url: ORIGIN, status: answer.status, headers: Object.fromEntries(answer.headers), body: text };
      expect(scanResponse(recorded, forbiddenStrings())).toEqual([]);
      expect(text).not.toContain(calculationId);
      expect(text).not.toContain(owned());
      // The refusals are the fixed problem body; the good answer is the status, the price the Lead set and the time, and nothing else (no calculated total, no ID).
      const keys = Object.keys(record.parse(JSON.parse(text))).sort();
      expect(keys).toEqual(answer === good ? ['approvedAt', 'approvedPrice', 'status'] : ['code', 'requestId', 'status', 'title', 'type']);
    }
  });
});
