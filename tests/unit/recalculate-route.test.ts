import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { costsSchema } from '@/server/views/schemas/costs';

import { completePartInputs, fieldIdOf } from '../support/complete-part';
import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { forbiddenStrings } from '../support/canary-masters';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-06.04 AC-1 to AC-4 and AC-7 (FR-061, FR-100, FR-101; NFR-002; architecture sections 4.2, 4.4, 4.8 and 6 "Recalculate"), through the real `withRoute`, the real session, the real calculation service and the real
 * review service over in-memory storage: a Lead's and an Admin's Recalculate is the Engineer's Calculate on the same service, stores a new record in the person's name, keeps or moves the status as the state machine
 * says, brings a cleared estimate back to `current` and answers the costs view; every change of an input clears the figures; an Engineer is refused 403 before anything is looked at. Who may call every route is
 * `tests/security/role-matrix.test.ts`. The database-level matrix over every writer is `tests/integration/estimates/cleared.test.ts`. Every name, ID and number is invented.
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
    getEstimateReviewService: () => shared.estimateReviewService,
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { POST } = await import('@/app/api/v1/estimates/[id]/recalculate/route');
const costsRoute = await import('@/app/api/v1/estimates/[id]/costs/route');

const record = z.record(z.string(), z.unknown());
const FIRST_MATERIAL = defined(MATERIAL_CANARIES[0]);
const QTY = fieldIdOf('qty-per-assy');

const request = (body?: unknown): Request =>
  body === undefined
    ? new Request(`${ORIGIN}/api/v1/estimates/x/recalculate`, { method: 'POST', headers: { origin: ORIGIN } })
    : new Request(`${ORIGIN}/api/v1/estimates/x/recalculate`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const owned = (): string => estimate().id;
const engineer = () => ({ id: harness.idOf.ENGINEER, role: 'ENGINEER' as const });
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
const readCosts = async (): Promise<Record<string, unknown>> => bodyOf(await costsRoute.GET(new Request(`${ORIGIN}/api/v1/estimates/x/costs`), withId(owned())));

/** A complete estimate: the customer chosen, and the one part holding every input, with a canary material. */
function makeComplete(): void {
  estimate().customerId = CUSTOMER_RECIPE_ID;
  part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
}

/** The Engineer's Calculate, then an input change by the Lead (a real change: the revision goes up), so the figures are cleared. */
async function calculatedThenChanged(): Promise<void> {
  makeComplete();
  await harness.calculationService.calculate(engineer(), owned());
  estimate().inputsRevision += 1;
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
  harness.calculationAudit.rows.length = 0;
});

describe('AC-3: a Lead\'s Recalculate stores a new calculation and answers the costs view', () => {
  it('on a cleared Prepared estimate: 200, a second record in the Lead\'s name, the status still PREPARED, the state `current`, and an answer that passes the strict costs schema', async () => {
    await calculatedThenChanged();
    expect(await readCosts()).toMatchObject({ state: 'out-of-date', totals: null });
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = costsSchema.parse(await response.json());
    expect(body.state).toBe('current');
    expect(body.totals?.totalPrice).not.toBeNull();
    expect(body.nodes.map((node) => node.figures !== null)).toEqual([true]);
    expect(harness.calculationWorld.calculations).toHaveLength(2);
    const stored = defined(harness.calculationWorld.calculations[1]);
    expect(stored.createdById).toBe(harness.idOf.LEAD);
    expect(stored.inputsRevision).toBe(estimate().inputsRevision);
    expect(estimate()).toMatchObject({ status: 'PREPARED', currentCalculationId: stored.id });
  });

  it('an Admin may press it too, and the answer is the same view `GET /costs` gives afterwards', async () => {
    await calculatedThenChanged();
    harness.signInAs('ADMIN');
    const answer = await bodyOf(await POST(request(), withId(owned())));
    expect(defined(harness.calculationWorld.calculations[1]).createdById).toBe(harness.idOf.ADMIN);
    expect(answer).toEqual(await readCosts());
  });

  it('on a Draft (an unlocked estimate that has a record): the status becomes PREPARED', async () => {
    await calculatedThenChanged();
    estimate().status = 'DRAFT';
    expect((await POST(request(), withId(owned()))).status).toBe(200);
    expect(estimate().status).toBe('PREPARED');
  });

  it('on a Draft that was never calculated: the first calculation, the status becomes PREPARED, in the Lead\'s name (a Lead may calculate, A-08)', async () => {
    makeComplete();
    expect((await readCosts())['state']).toBe('none');
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({ state: 'current' });
    expect(estimate().status).toBe('PREPARED');
    expect(defined(harness.calculationWorld.calculations[0]).createdById).toBe(harness.idOf.LEAD);
  });

  it('a press on figures that are already current makes a new record again (history is kept) and changes no input', async () => {
    makeComplete();
    await POST(request(), withId(owned()));
    const revision = estimate().inputsRevision;
    expect((await POST(request(), withId(owned()))).status).toBe(200);
    expect(harness.calculationWorld.calculations).toHaveLength(2);
    expect(estimate().inputsRevision).toBe(revision);
  });

  it('an Approved estimate is the 409 ESTIMATE_APPROVED_IS_LOCKED and nothing is written', async () => {
    await calculatedThenChanged();
    estimate().status = 'APPROVED';
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ status: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED' });
    expect(harness.calculationWorld.calculations).toHaveLength(1);
    expect(estimate().status).toBe('APPROVED');
  });
});

describe('AC-3: the same checks as Calculate', () => {
  it('a part with a missing input is the 422 CALCULATE_BLOCKED, lists the part and field, and writes nothing (a Draft stays a Draft)', async () => {
    makeComplete();
    delete part().inputs[fieldIdOf('cutting-time')];
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({
      code: 'CALCULATE_BLOCKED',
      parts: [{ nodeId: part().id, slNo: '1', fields: [{ fieldId: fieldIdOf('cutting-time'), label: 'Cutting Time' }] }],
    });
    expect(harness.calculationWorld.calculations).toHaveLength(0);
    expect(estimate().status).toBe('DRAFT');
  });

  it('no customer chosen is the 409 CUSTOMER_NOT_CHOSEN and writes nothing', async () => {
    makeComplete();
    estimate().customerId = null;
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: 'CUSTOMER_NOT_CHOSEN' });
    expect(harness.calculationWorld.calculations).toHaveLength(0);
  });

  it('a 0 in QTY per Assy earns the 409 CALCULATE_ACK_REQUIRED on every press, even after an acknowledged Engineer\'s Calculate (UX-44), and writes nothing', async () => {
    await calculatedThenChanged();
    part().inputs = { ...part().inputs, [QTY]: '0' };
    estimate().inputsRevision = 7;
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: 'CALCULATE_ACK_REQUIRED', inputsRevision: 7 });
    expect(harness.calculationWorld.calculations).toHaveLength(1);
  });

  it('the acknowledged press stores the record and one audit entry that names the Lead who pressed', async () => {
    makeComplete();
    part().inputs = { ...part().inputs, [QTY]: '0' };
    const response = await POST(request({ acknowledge: { inputsRevision: 0 } }), withId(owned()));
    expect(response.status).toBe(200);
    expect(harness.calculationAudit.rows).toHaveLength(1);
    expect(harness.calculationAudit.rows[0]).toMatchObject({ actorId: harness.idOf.LEAD });
    expect(defined(harness.calculationWorld.calculations[0]).warnings).toHaveLength(1);
  });

  it('a body that is not {acknowledge: {inputsRevision}} is 400 and writes nothing', async () => {
    makeComplete();
    const response = await POST(request({ acknowledge: true }), withId(owned()));
    expect(response.status).toBe(400);
    expect(harness.calculationWorld.calculations).toHaveLength(0);
  });

  it('an estimate that does not exist and an ID that is none are the same 404', async () => {
    makeComplete();
    const missing = await POST(request(), withId(UNKNOWN_ID));
    const malformed = await POST(request(), withId('not-an-id'));
    expect([missing.status, malformed.status]).toEqual([404, 404]);
  });
});

describe('AC-7 (NFR-002): an Engineer gets no figure and no state, and the answer holds no master value', () => {
  it('an Engineer is refused 403 with the fixed body before the estimate is looked at, and nothing is written', async () => {
    await calculatedThenChanged();
    harness.signInAs('ENGINEER');
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(403);
    const recorded = { label: 'POST recalculate (API, Engineer)', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect(scanResponse(recorded, forbiddenStrings())).toEqual([]);
    expect(harness.calculationWorld.calculations).toHaveLength(1);
    // The ID is not looked at: an ID that does not exist gets the same 403, not a 404.
    expect((await POST(request(), withId(UNKNOWN_ID))).status).toBe(403);
  });

  it('nobody signed in is 401', async () => {
    harness.signInAs(null);
    expect((await POST(request(), withId(owned()))).status).toBe(401);
  });

  it('the Lead\'s answer holds no master value, rate name or formula (the scan of the canary values finds none in it)', async () => {
    makeComplete();
    const response = await POST(request(), withId(owned()));
    const recorded = { label: 'POST recalculate (API, Lead)', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(recorded.status).toBe(200);
    expect(scanResponse(recorded, forbiddenStrings())).toEqual([]);
  });
});

describe('AC-1: the figures are cleared by a change and come back only after Recalculate', () => {
  it('cleared: state `out-of-date`, no figure on any row, no total, the count stays; Recalculate: `current` again', async () => {
    await calculatedThenChanged();
    const cleared = costsSchema.parse(await readCosts());
    expect(cleared.state).toBe('out-of-date');
    expect(cleared.totals).toBeNull();
    expect(cleared.nodes.every((node) => node.figures === null)).toBe(true);
    expect(cleared.nodes.map((node) => node.count)).not.toContain(null);
    await POST(request(), withId(owned()));
    expect(costsSchema.parse(await readCosts()).state).toBe('current');
  });

  it('a value changed and changed back is two changes: the figures stay cleared until Recalculate (AC-2)', async () => {
    makeComplete();
    await harness.calculationService.calculate(engineer(), owned());
    estimate().inputsRevision += 2;
    expect((await readCosts())['state']).toBe('out-of-date');
  });
});

describe('AC-6: an unlock alone changes no input', () => {
  it('moving an approved estimate to Draft leaves the revision and the state as they were: the figures stay current', async () => {
    makeComplete();
    await harness.calculationService.calculate(engineer(), owned());
    estimate().status = 'APPROVED';
    await harness.estimateService.transition({ id: harness.idOf.LEAD, role: 'LEAD' }, owned(), 'UNLOCK');
    expect(estimate().status).toBe('DRAFT');
    expect(costsSchema.parse(await readCosts()).state).toBe('current');
  });
});
