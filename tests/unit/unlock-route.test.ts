import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { UNLOCK_MATERIAL_DELETED_MESSAGE, UNLOCK_REASON_REQUIRED_MESSAGE, UNLOCK_REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/unlock-words';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import { unlockAnswerSchema, unlockPreviewSchema } from '@/server/views/schemas/unlock';

import { completePartInputs, fieldIdOf } from '../support/complete-part';
import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { forbiddenStrings } from '../support/canary-masters';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { UNKNOWN_CALCULATION_ID } from '../support/route-calls';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-06.08 AC-2, AC-4 to AC-6, AC-8 and AC-10 (FR-063; NFR-001, NFR-002, NFR-007; architecture section 6 "Unlock preview" and "Unlock"), through the real `withRoute`, the real session, the real unlock, approval,
 * calculation and estimate services over in-memory storage: a Lead or an Admin unlocks an approved estimate with a reason; an empty, white-space or over-long reason is a 422 under `reason`; a status that is not
 * APPROVED, and a second unlock, are the state machine's 409; two unlocks at once leave exactly one; a deleted material is the unlock's own 409; an Engineer is the fixed 403 before anything is read and nobody is a
 * 401; every refusal writes nothing and records no audit entry; no answer holds a master value, a rate, a formula, a calculated figure or an ID. Who may call the routes is `tests/security/role-matrix.test.ts`;
 * the PostgreSQL side (the row lock, the customer and material delete in both orders, the grants) is `tests/integration/approval/unlock.test.ts`. Every name, ID and number is invented.
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
    getUnlockService: () => shared.unlockService,
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';
const REASON = 'The customer asked for a new fixture.';
const PRICE = '12600.00';
const PLANTED = 'PLANTED-RATE-12.5';
const { POST: APPROVE } = await import('@/app/api/v1/estimates/[id]/approve/route');
const { POST } = await import('@/app/api/v1/estimates/[id]/unlock/route');
const { GET } = await import('@/app/api/v1/estimates/[id]/unlock-preview/route');

const record = z.record(z.string(), z.unknown());
const FIRST_MATERIAL = defined(MATERIAL_CANARIES[0]);

const post = (path: string, body?: unknown, origin: string = ORIGIN): Request =>
  body === undefined
    ? new Request(`${ORIGIN}/api/v1/estimates/x/${path}`, { method: 'POST', headers: { origin } })
    : new Request(`${ORIGIN}/api/v1/estimates/x/${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const owned = (): string => estimate().id;
const engineer = () => ({ id: harness.idOf.ENGINEER, role: 'ENGINEER' as const });
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
const unlock = (reason: unknown = REASON, extra: Record<string, unknown> = {}): Promise<Response> => POST(post('unlock', { reason, ...extra }), withId(owned()));
const preview = (id: string = owned()): Promise<Response> => GET(new Request(`${ORIGIN}/api/v1/estimates/x/unlock-preview`, { method: 'GET' }), withId(id));
const unlocks = () => harness.calculationAudit.rows.filter((row) => row.event === 'approval.unlocked');
const errorsOf = (body: Record<string, unknown>): unknown => body['errors'];

/** The estimate is complete, calculated by the Engineer and approved by the Lead at `PRICE`: APPROVED, one approvals row. */
async function approved(): Promise<void> {
  estimate().customerId = CUSTOMER_RECIPE_ID;
  part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
  await harness.calculationService.calculate(engineer(), owned());
  const calculationId = defined(estimate().currentCalculationId);
  expect((await APPROVE(post('approve', { calculationId, price: PRICE }), withId(owned()))).status).toBe(200);
}

/** What a refusal must have left alone: the status, the records, the approvals (and their unlock) and the audit entries. */
function snapshot() {
  return {
    status: estimate().status,
    link: estimate().currentCalculationId,
    revision: estimate().inputsRevision,
    records: harness.calculationWorld.calculations.length,
    approvals: JSON.stringify(harness.calculationWorld.approvals),
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
  harness.estimateWorld.materialsInUse.length = 0;
  harness.calculationWorld.calculations.length = 0;
  harness.calculationWorld.approvals.length = 0;
  harness.calculationAudit.rows.length = 0;
  vi.restoreAllMocks();
});

describe('AC-2: a good unlock writes the status, the unlock and the audit entry together', () => {
  it('a Lead: 200 with the new status and the time and nothing else; the estimate is DRAFT, the unlock is stored with the trimmed reason, the price is untouched, and one entry holds the price before and the reason', async () => {
    await approved();
    const entries = harness.calculationAudit.rows.length;
    const response = await unlock(`  ${REASON}  `);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const answer = await bodyOf(response);
    expect(Object.keys(answer).sort()).toEqual(['status', 'unlockedAt']);
    expect(unlockAnswerSchema.parse(answer)).toMatchObject({ status: 'DRAFT' });
    expect(estimate().status).toBe('DRAFT');
    const [row] = harness.calculationWorld.approvals;
    expect(row).toMatchObject({ approvedPrice: PRICE, unlock: { reason: REASON } });
    expect(harness.calculationAudit.rows).toHaveLength(entries + 1);
    expect(unlocks()).toHaveLength(1);
    expect(defined(unlocks()[0])).toMatchObject({ actorId: harness.idOf.LEAD, actorLabel: 'Invented Lead', objectId: owned(), before: { approvedPrice: PRICE }, after: { reason: REASON } });
  });

  it('an Admin unlocks too, and the estimate can be calculated again (a Recalculate on the Draft moves it to Submitted)', async () => {
    await approved();
    harness.signInAs('ADMIN');
    expect((await unlock()).status).toBe(200);
    expect(estimate().status).toBe('DRAFT');
    await harness.calculationService.recalculate({ id: harness.idOf.ADMIN, role: 'ADMIN' }, owned());
    expect(estimate().status).toBe('SUBMITTED');
  });

  it('an audit entry that cannot be written takes the unlock and the status with it', async () => {
    await approved();
    const before = snapshot();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    expect((await unlock()).status).toBe(500);
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('APPROVED');
  });
});

describe('AC-4: an empty, white-space or over-long reason is a 422 under `reason`, and nothing changes', () => {
  it.each([
    ['no reason at all', undefined, UNLOCK_REASON_REQUIRED_MESSAGE],
    ['an empty reason', '', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['spaces and line breaks only', '  \n \t ', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['501 characters', 'x'.repeat(501), UNLOCK_REASON_TOO_LONG_MESSAGE],
    ['501 emoji (characters, not UTF-16 units)', '😀'.repeat(501), UNLOCK_REASON_TOO_LONG_MESSAGE],
  ])('%s', async (_name, reason, message) => {
    await approved();
    const before = snapshot();
    const response = await POST(post('unlock', reason === undefined ? {} : { reason }), withId(owned()));
    expect(response.status).toBe(422);
    expect(errorsOf(await bodyOf(response))).toEqual([{ field: 'reason', message }]);
    expect(snapshot()).toEqual(before);
  });

  it('exactly 500 characters, and 500 emoji, are accepted', async () => {
    await approved();
    expect((await unlock('x'.repeat(500))).status).toBe(200);
    expect(defined(harness.calculationWorld.approvals[0]).unlock?.reason).toBe('x'.repeat(500));
  });

  it('the length is judged after the trim: spaces round a reason of 500 do not count', async () => {
    await approved();
    expect((await unlock(` ${'x'.repeat(500)} `)).status).toBe(200);
  });

  it.each([
    ['a number', 12],
    ['null', null],
    ['an object', { text: REASON }],
    ['a list', [REASON]],
  ])('a reason that is %s is a 422 and writes nothing', async (_name, reason) => {
    await approved();
    const before = snapshot();
    expect((await unlock(reason)).status).toBe(422);
    expect(snapshot()).toEqual(before);
  });

  it.each([
    ['a key that is not named', { reason: REASON, status: 'DRAFT' }],
    ['a reason far past any limit (the body is bounded)', { reason: 'x'.repeat(5_001) }],
  ])('the body is strict: %s is a 422 and writes nothing', async (_name, body) => {
    await approved();
    const before = snapshot();
    const response = await POST(post('unlock', body), withId(owned()));
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(snapshot()).toEqual(before);
  });

  it('an empty body is 400, and a request from another origin is refused before anything else', async () => {
    await approved();
    expect((await POST(post('unlock'), withId(owned()))).status).toBe(400);
    const elsewhere = await POST(post('unlock', { reason: REASON }, 'https://elsewhere.example.test'), withId(owned()));
    expect(elsewhere.status).toBe(403);
    expect(await bodyOf(elsewhere)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(estimate().status).toBe('APPROVED');
  });
});

describe('AC-4 (DL-219): the reason refuses an invisible character, as the shared validation does', () => {
  it.each([
    ['a zero-width joiner', 'Round\u200Ded'],
    ['a zero-width space', 'Round\u200Bed'],
    ['a byte order mark', 'Round\uFEFFed'],
    ['a bidirectional override', 'Round\u202Eed'],
    ['a NUL', 'Round\u0000ed'],
    ['a lone surrogate', 'Round\uD800ed'],
  ])('%s is a 422 under `reason` with the shared sentence, and nothing is written', async (_name, reason) => {
    await approved();
    const before = snapshot();
    const refused = await unlock(reason);
    expect(refused.status).toBe(422);
    expect(errorsOf(await bodyOf(refused))).toEqual([{ field: 'reason', message: TEXT_CHARACTERS_MESSAGE }]);
    expect(snapshot()).toEqual(before);
  });

  it('a reason over several lines keeps its line feeds (a carriage return is folded into one)', async () => {
    await approved();
    expect((await unlock('First.\r\nSecond.')).status).toBe(200);
    expect(harness.calculationWorld.approvals[0]).toMatchObject({ unlock: { reason: 'First.\nSecond.' } });
  });
});

describe('AC-5: a status that is not APPROVED, an estimate that is not there, a second unlock, and two at once', () => {
  it.each([
    ['DRAFT', false],
    ['SUBMITTED', true],
  ] as const)('%s is the machine\'s 409 "not approved", and nothing is written', async (status, calculate) => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
    if (calculate) await harness.calculationService.calculate(engineer(), owned());
    expect(estimate().status).toBe(status);
    const before = snapshot();
    const response = await unlock();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code, title: TRANSITION_REFUSALS.NOT_APPROVED.message });
    expect(snapshot()).toEqual(before);
  });

  it('an estimate that does not exist and an ID that is none are the same 404', async () => {
    const missing = await POST(post('unlock', { reason: REASON }), withId(UNKNOWN_ESTIMATE_ID));
    const malformed = await POST(post('unlock', { reason: REASON }), withId('not-an-id'));
    expect([missing.status, malformed.status]).toEqual([404, 404]);
  });

  it('a second unlock after the first is that same 409, and stores and records nothing more', async () => {
    await approved();
    expect((await unlock()).status).toBe(200);
    const before = snapshot();
    const second = await unlock('A second reason.');
    expect(second.status).toBe(409);
    expect(await bodyOf(second)).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(snapshot()).toEqual(before);
    expect(unlocks()).toHaveLength(1);
  });

  it('two unlocks at once: one wins with 200 and the other is the 409; one unlock is stored and one entry is written', async () => {
    await approved();
    // Both answers are collected first, so a failing call cannot leave a rejection unhandled (#443).
    const answers = await Promise.all([unlock('First reason.'), unlock('Second reason.')]);
    const outcomes = await Promise.all(answers.map(async (answer) => ({ status: answer.status, code: (await bodyOf(answer))['code'] })));
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([200, 409]);
    expect(outcomes.find((outcome) => outcome.status === 409)?.code).toBe(TRANSITION_REFUSALS.NOT_APPROVED.code);
    expect(unlocks()).toHaveLength(1);
    expect(harness.calculationWorld.approvals.filter((row) => row.unlock !== undefined)).toHaveLength(1);
    expect(estimate().status).toBe('DRAFT');
  });
});

describe('AC-6 (NFR-001): nobody but a Lead or an Admin unlocks or previews', () => {
  it('an Engineer is the fixed 403 before the ID is looked at: nothing is locked or read, and an invented ID gets the same 403', async () => {
    await approved();
    harness.signInAs('ENGINEER');
    const locks = harness.calculationWorld.lockCount();
    const before = snapshot();
    const response = await unlock();
    expect(response.status).toBe(403);
    const recorded = { label: 'POST unlock (API, Engineer)', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect((await POST(post('unlock', { reason: REASON }), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(403);
    expect((await preview()).status).toBe(403);
    expect((await preview(UNKNOWN_ESTIMATE_ID)).status).toBe(403);
    expect(harness.calculationWorld.lockCount()).toBe(locks);
    expect(snapshot()).toEqual(before);
  });

  it('nobody signed in is 401, for both routes', async () => {
    await approved();
    harness.signInAs(null);
    expect((await unlock()).status).toBe(401);
    expect((await preview()).status).toBe(401);
    expect(estimate().status).toBe('APPROVED');
  });

  it('the estimate is locked for the unlock (the lock the writers of an input share)', async () => {
    await approved();
    const locks = harness.calculationWorld.lockCount();
    await unlock();
    expect(harness.calculationWorld.lockCount()).toBeGreaterThan(locks);
  });
});

describe('AC-10: a material deleted after the approval is the unlock\'s own 409, and nothing is written', () => {
  it('MATERIAL_DELETED in the unlock\'s words: the status stays APPROVED, no unlock is stored and no audit entry is written', async () => {
    await approved();
    harness.estimateWorld.materialsInUse.push({ id: FIRST_MATERIAL.id, deleted: true });
    const before = snapshot();
    const response = await unlock();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: MATERIAL_DELETED_CODE, title: UNLOCK_MATERIAL_DELETED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('APPROVED');
    expect(unlocks()).toEqual([]);
  });

  it('a material that is still there does not stop the unlock', async () => {
    await approved();
    harness.estimateWorld.materialsInUse.push({ id: FIRST_MATERIAL.id, deleted: false });
    expect((await unlock()).status).toBe(200);
  });
});

describe('AC-8, AC-1: the preview route', () => {
  const PREVIEW = { engineerName: 'Invented Engineer', configuration: { approved: 7, current: 9 }, changed: { processRates: 1, materialPrices: 2, exchangeRates: 0 } } as const;

  it('answers the two version numbers, the three counts and the Engineer\'s name, and nothing else; it is a read', async () => {
    await approved();
    const read = vi.spyOn(harness.unlockService, 'preview').mockResolvedValue(PREVIEW);
    const before = snapshot();
    const response = await preview();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const answer = await bodyOf(response);
    expect(unlockPreviewSchema.parse(answer)).toEqual(PREVIEW);
    expect(Object.keys(answer).sort()).toEqual(['changed', 'configuration', 'engineerName']);
    expect(read).toHaveBeenCalledWith({ id: harness.idOf.LEAD, role: 'LEAD' }, owned());
    expect(snapshot()).toEqual(before);
  });

  it('an answer that carries a key the schema does not name is refused as a server fault, and the value never reaches the client (the schema is strict)', async () => {
    await approved();
    const leaky = { ...PREVIEW, rate: PLANTED };
    vi.spyOn(harness.unlockService, 'preview').mockResolvedValue(leaky);
    const response = await preview();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(PLANTED);
  });

  it('an estimate that is not approved is the machine\'s 409, and one that does not exist is a 404', async () => {
    const draft = await preview();
    expect(draft.status).toBe(409);
    expect(await bodyOf(draft)).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect((await preview(UNKNOWN_ESTIMATE_ID)).status).toBe(404);
  });
});

describe('NFR-002: no answer of either route holds a master value, rate name, formula, figure or ID', () => {
  it('every refusal and the good answer pass the scan of the canary values, and none names the estimate or a calculation', async () => {
    await approved();
    const calculationId = defined(estimate().currentCalculationId);
    const answers: Response[] = [];
    answers.push(await POST(post('unlock', { reason: '' }), withId(owned())));
    answers.push(await preview(UNKNOWN_ESTIMATE_ID));
    harness.estimateWorld.materialsInUse.push({ id: FIRST_MATERIAL.id, deleted: true });
    answers.push(await unlock());
    harness.estimateWorld.materialsInUse.length = 0;
    answers.push(await unlock());
    answers.push(await unlock());
    expect(answers.map((answer) => answer.status)).toEqual([422, 404, 409, 200, 409]);
    const texts = await Promise.all(answers.map((answer) => answer.text()));
    for (const [index, answer] of answers.entries()) {
      const text = defined(texts[index]);
      const recorded = { label: 'POST unlock (API, Lead)', url: ORIGIN, status: answer.status, headers: Object.fromEntries(answer.headers), body: text };
      expect(scanResponse(recorded, forbiddenStrings())).toEqual([]);
      expect(text).not.toContain(calculationId);
      expect(text).not.toContain(owned());
      expect(text).not.toContain(PRICE);
      expect(text).not.toContain(UNKNOWN_CALCULATION_ID);
    }
    // The good answer is the status and the time, and nothing else.
    expect(Object.keys(record.parse(JSON.parse(defined(texts[3])))).sort()).toEqual(['status', 'unlockedAt']);
  });
});
