import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '@/lib/auth/step-up';
import { APPROVAL_CHANGED_CODE, APPROVAL_CHANGED_MESSAGE } from '@/lib/estimate/cancel-words';
import {
  APPROVAL_NOT_CANCELLED_CODE,
  APPROVAL_NOT_CANCELLED_MESSAGE,
  NO_PRICE_TO_REMOVE_CODE,
  NO_PRICE_TO_REMOVE_MESSAGE,
  PRICE_ALREADY_REMOVED_CODE,
  PRICE_ALREADY_REMOVED_MESSAGE,
} from '@/lib/estimate/remove-price-words';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/users/validation';
import { removePriceAnswerSchema } from '@/server/views/schemas/remove-price';

import { forbiddenStrings } from '../support/canary-masters';
import { completePartInputs, fieldIdOf } from '../support/complete-part';
import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { HARNESS_PASSWORD } from '../support/harness-password';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-06.13 AC-3 to AC-7 (FR-108; NFR-001, NFR-002, NFR-004, NFR-007; architecture sections 4.10 and 6 "Remove price"), through the real `withRoute`, the real session, the real step-up check (STORY-06.14), and the real
 * approval, cancel, remove price, calculation and estimate services over in-memory storage: the Admin removes the price of a cancelled approval with their password; the removal is stored with who and when, **the price is
 * untouched in its row and kept by the audit entry**, and the answer holds a time and no price; a wrong password, a blocked step-up, an approval that is not the latest, not cancelled or removed already, and an estimate
 * that is not there are each their own refusal and write nothing, not even an audit entry; two removals at once leave exactly one; a Lead and an Engineer are the fixed 403 before anything is read; **the password is in no
 * log line, audit row, response or error body** (AC-7). Who may call the route is also `tests/security/role-matrix.test.ts`; the PostgreSQL side (the row lock held until the second is seen waiting, the grants) is
 * `tests/integration/approval/remove-price.test.ts`. Every name, ID, number and password is invented.
 */

const logged = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: logged.debug, info: logged.info, warn: logged.warn, error: logged.error } }));
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
    getCancelApprovalService: () => shared.cancelApprovalService,
    getRemovePriceService: () => shared.removePriceService,
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';
const UNKNOWN_APPROVAL_ID = '00000000-0000-4000-8000-00000000a9a9';
const PRICE = '12600.00';
const WRONG_PASSWORD = 'Wrong-Planted-Secret-91!';
const { POST: APPROVE } = await import('@/app/api/v1/estimates/[id]/approve/route');
const { POST: CANCEL } = await import('@/app/api/v1/estimates/[id]/approval/cancel/route');
const { POST } = await import('@/app/api/v1/estimates/[id]/approval/remove-price/route');

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
const errorsOf = (body: Record<string, unknown>): unknown => body['errors'];
const removals = () => harness.calculationAudit.rows.filter((row) => row.event === 'approval.price_removed');

/** The id of the latest approval, which is what the page names when the Admin presses the button. */
const latestApprovalId = (): string => harness.calculationWorld.approvals.at(-1)?.id ?? UNKNOWN_APPROVAL_ID;
const remove = (over: Record<string, unknown> = {}, id: string = owned()): Promise<Response> =>
  POST(post('approval/remove-price', { approvalId: latestApprovalId(), password: HARNESS_PASSWORD, ...over }), withId(id));

/** The estimate is complete, calculated by the Engineer and approved by the Lead at `PRICE`. The Admin is signed in again. */
async function approved(): Promise<void> {
  estimate().customerId = CUSTOMER_RECIPE_ID;
  part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
  await harness.calculationService.calculate(engineer(), owned());
  const calculationId = defined(estimate().currentCalculationId);
  harness.signInAs('LEAD');
  expect((await APPROVE(post('approve', { calculationId, price: PRICE }), withId(owned()))).status).toBe(200);
  harness.signInAs('ADMIN');
}

/** Step 1, through its own route: the Admin cancels the approval. Then the price stands, marked cancelled, and the removal may be asked for. */
async function cancelled(): Promise<void> {
  await approved();
  const response = await CANCEL(post('approval/cancel', { approvalId: latestApprovalId(), reason: 'The wrong customer was priced.', password: HARNESS_PASSWORD }), withId(owned()));
  expect(response.status).toBe(200);
  // The step-up checks of the set-up are not the test's: a test that says "no password was checked" counts from here.
  harness.hasher.verified.length = 0;
}

/** What a refusal must have left alone: the status, the records, the approvals (and their unlock, cancel and removal) and the audit entries. */
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

/** Everything the portal wrote down while a test ran, as text: every log line, every audit row. The password must be in none of it. */
const writtenDown = (): string => JSON.stringify([logged.debug.mock.calls, logged.info.mock.calls, logged.warn.mock.calls, logged.error.mock.calls, harness.calculationAudit.rows]);

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  vi.clearAllMocks();
  harness.signInAs('ADMIN');
});

/** Puts the harness estimate, its part and the step-up counts back as the recipe made them, whatever a test did. */
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
  harness.throttles.rows.clear();
  harness.hasher.verified.length = 0;
  vi.restoreAllMocks();
});

describe('AC-3: a good removal writes the removal and the audit entry together and keeps the price', () => {
  it('the Admin: 200 with the time and nothing else; the removal is stored with who and when, the price is untouched, and one entry keeps the price', async () => {
    await cancelled();
    const entries = harness.calculationAudit.rows.length;
    const statusBefore = estimate().status;
    const response = await remove();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const answer = await bodyOf(response);
    expect(Object.keys(answer)).toEqual(['removedAt']);
    expect(removePriceAnswerSchema.parse(answer)).toEqual(answer);
    const [row] = harness.calculationWorld.approvals;
    // AC-6: the approval row and its price stay; only the removal is added.
    expect(row).toMatchObject({ approvedPrice: PRICE, cancel: { reason: 'The wrong customer was priced.' }, removal: { byName: expect.any(String) } });
    // The removal moves nothing else.
    expect(estimate().status).toBe(statusBefore);
    expect(harness.calculationAudit.rows).toHaveLength(entries + 1);
    expect(removals()).toHaveLength(1);
    expect(defined(removals()[0])).toMatchObject({ actorId: harness.idOf.ADMIN, actorLabel: 'Invented Admin', objectId: owned(), before: { approvedPrice: PRICE }, after: null });
  });

  it('the password was checked in the same request: one check, which matched', async () => {
    await cancelled();
    harness.hasher.verified.length = 0;
    expect((await remove()).status).toBe(200);
    expect(harness.hasher.verified).toEqual([{ passwordHash: `hash:${HARNESS_PASSWORD}`, matched: true }]);
  });

  it('the estimate is locked for the removal (the lock the writers of an input share)', async () => {
    await cancelled();
    const locks = harness.calculationWorld.lockCount();
    await remove();
    expect(harness.calculationWorld.lockCount()).toBeGreaterThan(locks);
  });

  it('an audit entry that cannot be written takes the removal with it', async () => {
    await cancelled();
    const before = snapshot();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    const response = await remove();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(HARNESS_PASSWORD);
    expect(snapshot()).toEqual(before);
  });

  it('after the removal the estimate can be calculated and approved again at a new price', async () => {
    await cancelled();
    expect((await remove()).status).toBe(200);
    await harness.calculationService.recalculate({ id: harness.idOf.ADMIN, role: 'ADMIN' }, owned());
    harness.signInAs('LEAD');
    const calculationId = defined(estimate().currentCalculationId);
    expect((await APPROVE(post('approve', { calculationId, price: '13000.00' }), withId(owned()))).status).toBe(200);
    expect(harness.calculationWorld.approvals).toHaveLength(2);
  });
});

describe('AC-5: an approval that is not cancelled, not the latest, or removed already; an estimate that is not there; two removals at once', () => {
  it('an approval that was not cancelled is 409 APPROVAL_NOT_CANCELLED, and nothing is written', async () => {
    await approved();
    const before = snapshot();
    const response = await remove();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: APPROVAL_NOT_CANCELLED_CODE, title: APPROVAL_NOT_CANCELLED_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('an estimate with no approval is a 409 in plain words, and nothing is written', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const before = snapshot();
    const response = await remove();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: NO_PRICE_TO_REMOVE_CODE, title: NO_PRICE_TO_REMOVE_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('an approval that is not the latest is 409 APPROVAL_CHANGED (the cancel\'s own code and words), and the newer one is not touched', async () => {
    await cancelled();
    const first = latestApprovalId();
    await harness.calculationService.recalculate({ id: harness.idOf.ADMIN, role: 'ADMIN' }, owned());
    const calculationId = defined(estimate().currentCalculationId);
    harness.signInAs('LEAD');
    expect((await APPROVE(post('approve', { calculationId, price: '13000.00' }), withId(owned()))).status).toBe(200);
    harness.signInAs('ADMIN');
    expect(harness.calculationWorld.approvals).toHaveLength(2);
    const before = snapshot();
    const response = await remove({ approvalId: first });
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: APPROVAL_CHANGED_CODE, title: APPROVAL_CHANGED_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('a price removed already is a 409, and a second removal stores and records nothing more', async () => {
    await cancelled();
    const approvalId = latestApprovalId();
    expect((await remove()).status).toBe(200);
    const before = snapshot();
    const again = await remove({ approvalId });
    expect(again.status).toBe(409);
    expect(await bodyOf(again)).toMatchObject({ code: PRICE_ALREADY_REMOVED_CODE, title: PRICE_ALREADY_REMOVED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(removals()).toHaveLength(1);
  });

  it('an estimate that does not exist and an ID that is none are the same 404, after the password passed', async () => {
    await cancelled();
    const missing = await remove({}, UNKNOWN_ESTIMATE_ID);
    const malformed = await remove({}, 'not-an-id');
    expect([missing.status, malformed.status]).toEqual([404, 404]);
  });

  it('two removals at once: one wins with 200 and the other is the 409; one removal is stored and one entry is written', async () => {
    await cancelled();
    const approvalId = latestApprovalId();
    // Both answers are collected first, so a failing call cannot leave a rejection unhandled (#443).
    const answers = await Promise.all([remove({ approvalId }), remove({ approvalId })]);
    const outcomes = await Promise.all(answers.map(async (answer) => ({ status: answer.status, code: (await bodyOf(answer))['code'] })));
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([200, 409]);
    expect(outcomes.find((outcome) => outcome.status === 409)?.code).toBe(PRICE_ALREADY_REMOVED_CODE);
    expect(removals()).toHaveLength(1);
    expect(harness.calculationWorld.approvals.filter((row) => row.removal !== undefined)).toHaveLength(1);
  });

  it.each([
    ['a key that is not named', { reason: 'Because.' }],
    ['an approval ID that is not an ID', { approvalId: 'not-an-id' }],
    ['no password', { password: undefined }],
    ['an empty password', { password: '' }],
  ])('the body is strict: %s is a 422 and writes nothing', async (_name, over) => {
    await cancelled();
    const before = snapshot();
    const response = await remove(over);
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(snapshot()).toEqual(before);
    expect(harness.hasher.verified).toEqual([]);
  });

  it("an empty password names the field with the step-up's own words", async () => {
    await cancelled();
    const response = await remove({ password: '' });
    expect(errorsOf(await bodyOf(response))).toEqual([{ field: 'password', message: PASSWORD_REQUIRED_MESSAGE }]);
  });

  it('an empty body is 400, and a request from another origin is refused before anything else', async () => {
    await cancelled();
    expect((await POST(post('approval/remove-price'), withId(owned()))).status).toBe(400);
    const elsewhere = await POST(post('approval/remove-price', { approvalId: latestApprovalId(), password: HARNESS_PASSWORD }, 'https://elsewhere.example.test'), withId(owned()));
    expect(elsewhere.status).toBe(403);
    expect(await bodyOf(elsewhere)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(harness.calculationWorld.approvals.every((row) => row.removal === undefined)).toBe(true);
  });
});

describe('AC-4: a wrong password is a 422, a blocked step-up is a 429, the session stays valid, and nothing changes', () => {
  it("a wrong password: 422 STEP_UP_FAILED in the step-up's words, nothing is stored or recorded, and the same session can remove with the right one", async () => {
    await cancelled();
    const before = snapshot();
    const response = await remove({ password: WRONG_PASSWORD });
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'STEP_UP_FAILED', title: STEP_UP_FAILED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect((await remove()).status).toBe(200);
  });

  it('five wrong passwords block the step-up: the sixth try, even with the right password, is 429 STEP_UP_LOCKED, and nothing changes', async () => {
    await cancelled();
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await remove({ password: WRONG_PASSWORD })).status).toBe(422);
    const before = snapshot();
    const blocked = await remove();
    expect(blocked.status).toBe(429);
    expect(await bodyOf(blocked)).toMatchObject({ code: 'STEP_UP_LOCKED', title: STEP_UP_LOCKED_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('a wrong password is checked before anything is locked or read: the estimate is not looked at', async () => {
    await cancelled();
    const locks = harness.calculationWorld.lockCount();
    expect((await remove({ password: WRONG_PASSWORD }, UNKNOWN_ESTIMATE_ID)).status).toBe(422);
    expect(harness.calculationWorld.lockCount()).toBe(locks);
  });
});

describe('AC-5 (NFR-001): nobody but the Admin removes a price', () => {
  it.each(['LEAD', 'ENGINEER'] as const)('%s is the fixed 403 before the ID is looked at: nothing is locked, read or checked, and an invented ID gets the same 403', async (role) => {
    await cancelled();
    harness.signInAs(role);
    const locks = harness.calculationWorld.lockCount();
    const before = snapshot();
    const response = await remove();
    expect(response.status).toBe(403);
    const recorded = { label: `POST remove-price (API, ${role})`, url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect((await remove({}, UNKNOWN_ESTIMATE_ID)).status).toBe(403);
    expect(harness.calculationWorld.lockCount()).toBe(locks);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it('nobody signed in is 401', async () => {
    await cancelled();
    harness.signInAs(null);
    expect((await remove()).status).toBe(401);
    expect(harness.calculationWorld.approvals.every((row) => row.removal === undefined)).toBe(true);
  });
});

describe('AC-7: the password is in no log line, audit row, response or error body, on any path', () => {
  const PATHS: ReadonlyArray<readonly [string, () => Promise<Response>, number]> = [
    ['a good removal', () => remove(), 200],
    ['a wrong password (the password sent is the wrong one)', () => remove({ password: WRONG_PASSWORD }), 422],
    ['a body that is not the shape', () => remove({ approvalId: 'x' }), 422],
    ['an approval that is not the latest', () => remove({ approvalId: UNKNOWN_APPROVAL_ID }), 409],
    ['an estimate that is none', () => remove({}, UNKNOWN_ESTIMATE_ID), 404],
  ];

  it.each(PATHS)('%s', async (_name, send, status) => {
    await cancelled();
    const response = await send();
    expect(response.status).toBe(status);
    const text = await response.text();
    for (const password of [HARNESS_PASSWORD, WRONG_PASSWORD]) {
      expect(text).not.toContain(password);
      expect(writtenDown()).not.toContain(password);
    }
  });

  it('a blocked step-up, a refused role and a failed audit write', async () => {
    await cancelled();
    for (let attempt = 0; attempt < 5; attempt += 1) await remove({ password: WRONG_PASSWORD });
    const blocked = await remove();
    expect(blocked.status).toBe(429);
    harness.throttles.rows.clear();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    const faulty = await remove();
    expect(faulty.status).toBe(500);
    harness.signInAs('LEAD');
    const refused = await remove({ password: WRONG_PASSWORD });
    expect(refused.status).toBe(403);
    for (const response of [blocked, faulty, refused]) {
      const text = await response.text();
      for (const password of [HARNESS_PASSWORD, WRONG_PASSWORD]) expect(text).not.toContain(password);
    }
    for (const password of [HARNESS_PASSWORD, WRONG_PASSWORD]) expect(writtenDown()).not.toContain(password);
  });

  it('the audit entry of a good removal holds the price and nothing else, and no password key or value', async () => {
    await cancelled();
    expect((await remove()).status).toBe(200);
    const entry = defined(removals()[0]);
    expect(Object.keys(entry.before as Record<string, unknown>)).toEqual(['approvedPrice']);
    expect(entry.after).toBeNull();
    expect(JSON.stringify(entry)).not.toMatch(/password|hash/i);
  });
});

describe('AC-6, NFR-002: no answer of the route holds the removed price, a master value, rate name, formula, figure or ID', () => {
  it('every refusal and the good answer pass the scan of the canary values, and none names the estimate, the approval, a calculation or the price', async () => {
    await cancelled();
    const calculationId = defined(estimate().currentCalculationId);
    const approvalId = latestApprovalId();
    const answers: Response[] = [];
    answers.push(await remove({ approvalId: 'x' }));
    answers.push(await remove({}, UNKNOWN_ESTIMATE_ID));
    answers.push(await remove({ approvalId: UNKNOWN_APPROVAL_ID }));
    answers.push(await remove());
    answers.push(await remove({ approvalId }));
    expect(answers.map((answer) => answer.status)).toEqual([422, 404, 409, 200, 409]);
    const texts = await Promise.all(answers.map((answer) => answer.text()));
    for (const [index, answer] of answers.entries()) {
      const text = defined(texts[index]);
      const recorded = { label: 'POST remove-price (API, Admin)', url: ORIGIN, status: answer.status, headers: Object.fromEntries(answer.headers), body: text };
      expect(scanResponse(recorded, forbiddenStrings())).toEqual([]);
      expect(text).not.toContain(calculationId);
      expect(text).not.toContain(owned());
      expect(text).not.toContain(approvalId);
      expect(text).not.toContain(PRICE);
      expect(text).not.toContain('12,600');
    }
    expect(Object.keys(record.parse(JSON.parse(defined(texts[3]))))).toEqual(['removedAt']);
  });

  it('an answer that carries a key the schema does not name is refused as a server fault, and the value never reaches the client (the schema is strict)', async () => {
    await cancelled();
    const leaky = { removedAt: '2026-11-18T06:30:00.000Z', price: 'PLANTED-12600.00' };
    vi.spyOn(harness.removePriceService, 'removePrice').mockResolvedValue(leaky);
    const response = await remove();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('PLANTED-12600.00');
  });
});
