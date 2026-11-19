import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '@/lib/auth/step-up';
import {
  APPROVAL_ALREADY_CANCELLED_CODE,
  APPROVAL_ALREADY_CANCELLED_MESSAGE,
  APPROVAL_CHANGED_CODE,
  APPROVAL_CHANGED_MESSAGE,
  CANCEL_CUSTOMER_DELETED_MESSAGE,
  CANCEL_MATERIAL_DELETED_MESSAGE,
  CANCEL_REASON_REQUIRED_MESSAGE,
  CANCEL_REASON_TOO_LONG_MESSAGE,
  NO_APPROVAL_TO_CANCEL_CODE,
  NO_APPROVAL_TO_CANCEL_MESSAGE,
} from '@/lib/estimate/cancel-words';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/users/validation';
import { cancelApprovalAnswerSchema } from '@/server/views/schemas/cancel-approval';

import { forbiddenStrings } from '../support/canary-masters';
import { completePartInputs, fieldIdOf } from '../support/complete-part';
import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { HARNESS_PASSWORD } from '../support/harness-password';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-06.12 AC-1, AC-3 to AC-5, AC-7, AC-9 and AC-10 (FR-107; NFR-001, NFR-002, NFR-004, NFR-007; architecture sections 4.10 and 6 "Cancel approval"), through the real `withRoute`, the real session, the real step-up check
 * (STORY-06.14), the real cancel, approval, unlock, calculation and estimate services over in-memory storage: the Admin cancels an approval with a reason and their password; an approved estimate goes back to Draft,
 * and an approval kept through an unlock is cancelled with the status and the task unchanged (AC-10); a missing reason, a wrong password, a newer approval, a second cancel and a deleted customer or material are each
 * their own refusal and write nothing, not even an audit entry; two cancels at once leave exactly one; a Lead and an Engineer are the fixed 403 before anything is read; **the password is in no log line, audit row,
 * response or error body** (AC-7). Who may call the route is also `tests/security/role-matrix.test.ts`; the PostgreSQL side (the row lock, the customer delete in both orders, the grants) is
 * `tests/integration/approval/cancel.test.ts`. Every name, ID, number and password is invented.
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
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';
const UNKNOWN_APPROVAL_ID = '00000000-0000-4000-8000-00000000a9a9';
const REASON = 'The wrong customer was priced.';
const PRICE = '12600.00';
const WRONG_PASSWORD = 'Wrong-Planted-Secret-91!';
const { POST: APPROVE } = await import('@/app/api/v1/estimates/[id]/approve/route');
const { POST } = await import('@/app/api/v1/estimates/[id]/approval/cancel/route');

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
const lead = () => ({ id: harness.idOf.LEAD, role: 'LEAD' as const });
const admin = () => ({ id: harness.idOf.ADMIN, role: 'ADMIN' as const });
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
const errorsOf = (body: Record<string, unknown>): unknown => body['errors'];
const cancels = () => harness.calculationAudit.rows.filter((row) => row.event === 'approval.cancelled');
const customerOfEstimate = () => defined(harness.masters.customers.find((customer) => customer.id === CUSTOMER_RECIPE_ID));

/** The id of the latest approval, which is what the page names when the Admin presses the button. */
const latestApprovalId = (): string => harness.calculationWorld.approvals.at(-1)?.id ?? UNKNOWN_APPROVAL_ID;
const cancel = (over: Record<string, unknown> = {}, id: string = owned()): Promise<Response> =>
  POST(post('approval/cancel', { approvalId: latestApprovalId(), reason: REASON, password: HARNESS_PASSWORD, ...over }), withId(id));

/** The estimate is complete, calculated by the Engineer and approved by the Lead at `PRICE`: APPROVED, one approvals row. Whoever was signed in is signed in again as the Admin. */
async function approved(): Promise<void> {
  estimate().customerId = CUSTOMER_RECIPE_ID;
  part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
  await harness.calculationService.calculate(engineer(), owned());
  const calculationId = defined(estimate().currentCalculationId);
  harness.signInAs('LEAD');
  expect((await APPROVE(post('approve', { calculationId, price: PRICE }), withId(owned()))).status).toBe(200);
  harness.signInAs('ADMIN');
}

/** The Lead unlocks the approved estimate: DRAFT again, with the approval kept (its price "approved earlier"). The Admin is signed in again. */
async function unlocked(): Promise<void> {
  await harness.unlockService.unlock(lead(), owned(), { reason: 'The customer asked for a new fixture.', audit: { actorId: harness.idOf.LEAD, actorLabel: 'Invented Lead', requestId: 'req-unlock' } });
  harness.signInAs('ADMIN');
}

/** What a refusal must have left alone: the status, the records, the approvals (and their unlock and cancel) and the audit entries. */
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

/** Puts the harness estimate, its part, the masters and the step-up counts back as the recipe made them, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.customerId = null;
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  held.currentCalculationId = null;
  part().inputs = {};
  customerOfEstimate().deleted = false;
  harness.estimateWorld.materialsInUse.length = 0;
  harness.calculationWorld.calculations.length = 0;
  harness.calculationWorld.approvals.length = 0;
  harness.calculationAudit.rows.length = 0;
  harness.throttles.rows.clear();
  harness.hasher.verified.length = 0;
  vi.restoreAllMocks();
});

describe('AC-3: a good cancel of an approved estimate writes the status, the cancel and the audit entry together', () => {
  it('the Admin: 200 with the new status and the time and nothing else; the estimate is DRAFT, the cancel is stored with the trimmed reason, the price is untouched, and one entry holds the price before, the reason and the two statuses', async () => {
    await approved();
    const entries = harness.calculationAudit.rows.length;
    const response = await cancel({ reason: `  ${REASON}  ` });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const answer = await bodyOf(response);
    expect(Object.keys(answer).sort()).toEqual(['cancelledAt', 'status']);
    expect(cancelApprovalAnswerSchema.parse(answer)).toMatchObject({ status: 'DRAFT' });
    expect(estimate().status).toBe('DRAFT');
    const [row] = harness.calculationWorld.approvals;
    expect(row).toMatchObject({ approvedPrice: PRICE, cancel: { reason: REASON } });
    expect(row?.unlock).toBeUndefined();
    expect(harness.calculationAudit.rows).toHaveLength(entries + 1);
    expect(cancels()).toHaveLength(1);
    expect(defined(cancels()[0])).toMatchObject({
      actorId: harness.idOf.ADMIN,
      actorLabel: 'Invented Admin',
      objectId: owned(),
      before: { approvedPrice: PRICE, status: 'APPROVED' },
      after: { reason: REASON, status: 'DRAFT' },
    });
  });

  it('the password was checked in the same request: one check, which matched, and the approval of the price was not touched by it', async () => {
    await approved();
    harness.hasher.verified.length = 0;
    expect((await cancel()).status).toBe(200);
    expect(harness.hasher.verified).toEqual([{ passwordHash: `hash:${HARNESS_PASSWORD}`, matched: true }]);
  });

  it('after the cancel the estimate can be calculated again (a Recalculate on the Draft moves it to Submitted)', async () => {
    await approved();
    expect((await cancel()).status).toBe(200);
    await harness.calculationService.recalculate(admin(), owned());
    expect(estimate().status).toBe('SUBMITTED');
  });

  it('an audit entry that cannot be written takes the cancel and the status with it', async () => {
    await approved();
    const before = snapshot();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    const response = await cancel();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(HARNESS_PASSWORD);
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('APPROVED');
  });
});

describe('AC-10: an approval kept through an unlock is cancelled with the status and the task unchanged', () => {
  it('a Draft stays a Draft: no status is written, the cancel is stored, and the entry shows the same status before and after', async () => {
    await approved();
    await unlocked();
    const writes = harness.estimateWorld.statusWrites();
    const response = await cancel();
    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({ status: 'DRAFT' });
    expect(estimate().status).toBe('DRAFT');
    expect(harness.estimateWorld.statusWrites()).toBe(writes);
    expect(harness.calculationWorld.approvals[0]).toMatchObject({ approvedPrice: PRICE, unlock: { reason: 'The customer asked for a new fixture.' }, cancel: { reason: REASON } });
    expect(defined(cancels()[0])).toMatchObject({ before: { approvedPrice: PRICE, status: 'DRAFT' }, after: { reason: REASON, status: 'DRAFT' } });
  });

  it('a Submitted estimate stays Submitted', async () => {
    await approved();
    await unlocked();
    await harness.calculationService.recalculate(admin(), owned());
    expect(estimate().status).toBe('SUBMITTED');
    const writes = harness.estimateWorld.statusWrites();
    const response = await cancel();
    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({ status: 'SUBMITTED' });
    expect(estimate().status).toBe('SUBMITTED');
    expect(harness.estimateWorld.statusWrites()).toBe(writes);
    expect(defined(cancels()[0])).toMatchObject({ before: { status: 'SUBMITTED' }, after: { status: 'SUBMITTED' } });
  });

  it('an estimate with no approval is a 409 in plain words, and nothing is written', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const before = snapshot();
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: NO_APPROVAL_TO_CANCEL_CODE, title: NO_APPROVAL_TO_CANCEL_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('an approval that was cancelled already is a 409, on a Draft as on an approved estimate, and a second cancel stores and records nothing more', async () => {
    await approved();
    const approvalId = latestApprovalId();
    expect((await cancel()).status).toBe(200);
    const before = snapshot();
    const again = await cancel({ approvalId, reason: 'A second reason.' });
    expect(again.status).toBe(409);
    expect(await bodyOf(again)).toMatchObject({ code: APPROVAL_ALREADY_CANCELLED_CODE, title: APPROVAL_ALREADY_CANCELLED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(cancels()).toHaveLength(1);
  });
});

describe('AC-5: the reason, a newer approval, an estimate that is not there, and two cancels at once', () => {
  it.each([
    ['no reason at all', undefined, CANCEL_REASON_REQUIRED_MESSAGE],
    ['an empty reason', '', CANCEL_REASON_REQUIRED_MESSAGE],
    ['spaces and line breaks only', '  \n \t ', CANCEL_REASON_REQUIRED_MESSAGE],
    ['501 characters', 'x'.repeat(501), CANCEL_REASON_TOO_LONG_MESSAGE],
    ['501 emoji (characters, not UTF-16 units)', '😀'.repeat(501), CANCEL_REASON_TOO_LONG_MESSAGE],
    ['an invisible character', 'Round​ed', TEXT_CHARACTERS_MESSAGE],
  ])('%s is a 422 under `reason`, the password is not even checked, and nothing changes', async (_name, reason, message) => {
    await approved();
    const before = snapshot();
    const body = { approvalId: latestApprovalId(), password: HARNESS_PASSWORD, ...(reason === undefined ? {} : { reason }) };
    const response = await POST(post('approval/cancel', body), withId(owned()));
    expect(response.status).toBe(422);
    expect(errorsOf(await bodyOf(response))).toEqual([{ field: 'reason', message }]);
    expect(snapshot()).toEqual(before);
    expect(harness.hasher.verified).toEqual([]);
  });

  it('exactly 500 characters are accepted', async () => {
    await approved();
    expect((await cancel({ reason: 'x'.repeat(500) })).status).toBe(200);
    expect(defined(harness.calculationWorld.approvals[0]).cancel?.reason).toBe('x'.repeat(500));
  });

  it.each([
    ['a key that is not named', { status: 'DRAFT' }],
    ['an approval ID that is not an ID', { approvalId: 'not-an-id' }],
    ['no password', { password: undefined }],
    ['an empty password', { password: '' }],
  ])('the body is strict: %s is a 422 and writes nothing', async (_name, over) => {
    await approved();
    const before = snapshot();
    const response = await cancel(over);
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(snapshot()).toEqual(before);
    expect(harness.hasher.verified).toEqual([]);
  });

  it('an empty password names the field with the step-up\'s own words', async () => {
    await approved();
    const response = await cancel({ password: '' });
    expect(errorsOf(await bodyOf(response))).toEqual([{ field: 'password', message: PASSWORD_REQUIRED_MESSAGE }]);
  });

  it('an empty body is 400, and a request from another origin is refused before anything else', async () => {
    await approved();
    expect((await POST(post('approval/cancel'), withId(owned()))).status).toBe(400);
    const elsewhere = await POST(post('approval/cancel', { approvalId: latestApprovalId(), reason: REASON, password: HARNESS_PASSWORD }, 'https://elsewhere.example.test'), withId(owned()));
    expect(elsewhere.status).toBe(403);
    expect(await bodyOf(elsewhere)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(estimate().status).toBe('APPROVED');
    expect(harness.hasher.verified).toEqual([]);
  });

  it('an approval that is not the latest is 409 APPROVAL_CHANGED, and the newer one is not cancelled unseen', async () => {
    await approved();
    const first = latestApprovalId();
    await unlocked();
    await harness.calculationService.recalculate(admin(), owned());
    const calculationId = defined(estimate().currentCalculationId);
    harness.signInAs('LEAD');
    expect((await APPROVE(post('approve', { calculationId, price: '13000.00' }), withId(owned()))).status).toBe(200);
    harness.signInAs('ADMIN');
    expect(harness.calculationWorld.approvals).toHaveLength(2);
    const before = snapshot();
    const response = await cancel({ approvalId: first });
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: APPROVAL_CHANGED_CODE, title: APPROVAL_CHANGED_MESSAGE });
    expect(snapshot()).toEqual(before);
    // Naming the approval the page shows now is the cancel that works.
    expect((await cancel()).status).toBe(200);
    expect(harness.calculationWorld.approvals.map((row) => row.cancel !== undefined)).toEqual([false, true]);
  });

  it('an estimate that does not exist and an ID that is none are the same 404, after the password passed', async () => {
    await approved();
    const missing = await cancel({}, UNKNOWN_ESTIMATE_ID);
    const malformed = await cancel({}, 'not-an-id');
    expect([missing.status, malformed.status]).toEqual([404, 404]);
  });

  it('two cancels at once: one wins with 200 and the other is the 409; one cancel is stored and one entry is written', async () => {
    await approved();
    const approvalId = latestApprovalId();
    // Both answers are collected first, so a failing call cannot leave a rejection unhandled (#443).
    const answers = await Promise.all([cancel({ approvalId, reason: 'First reason.' }), cancel({ approvalId, reason: 'Second reason.' })]);
    const outcomes = await Promise.all(answers.map(async (answer) => ({ status: answer.status, code: (await bodyOf(answer))['code'] })));
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([200, 409]);
    expect(outcomes.find((outcome) => outcome.status === 409)?.code).toBe(APPROVAL_ALREADY_CANCELLED_CODE);
    expect(cancels()).toHaveLength(1);
    expect(harness.calculationWorld.approvals.filter((row) => row.cancel !== undefined)).toHaveLength(1);
    expect(estimate().status).toBe('DRAFT');
  });
});

describe('AC-4: a wrong password is a 422, a blocked step-up is a 429, the session stays valid, and nothing changes', () => {
  it('a wrong password: 422 STEP_UP_FAILED in the step-up\'s words, nothing is stored or recorded, and the same session can cancel with the right one', async () => {
    await approved();
    const before = snapshot();
    const response = await cancel({ password: WRONG_PASSWORD });
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'STEP_UP_FAILED', title: STEP_UP_FAILED_MESSAGE });
    expect(snapshot()).toEqual(before);
    // The session is the same one: it was not ended, and the next request with the right password goes through.
    expect((await cancel()).status).toBe(200);
  });

  it('five wrong passwords block the step-up: the sixth try, even with the right password, is 429 STEP_UP_LOCKED, and nothing changes', async () => {
    await approved();
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await cancel({ password: WRONG_PASSWORD })).status).toBe(422);
    const before = snapshot();
    const blocked = await cancel();
    expect(blocked.status).toBe(429);
    expect(await bodyOf(blocked)).toMatchObject({ code: 'STEP_UP_LOCKED', title: STEP_UP_LOCKED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('APPROVED');
  });

  it('a wrong password is checked before anything is locked or read: the estimate is not looked at', async () => {
    await approved();
    const locks = harness.calculationWorld.lockCount();
    expect((await cancel({ password: WRONG_PASSWORD }, UNKNOWN_ESTIMATE_ID)).status).toBe(422);
    expect(harness.calculationWorld.lockCount()).toBe(locks);
  });
});

describe('AC-1 (NFR-001): nobody but the Admin cancels an approval', () => {
  it.each(['LEAD', 'ENGINEER'] as const)('%s is the fixed 403 before the ID is looked at: nothing is locked, read or checked, and an invented ID gets the same 403', async (role) => {
    await approved();
    harness.signInAs(role);
    const locks = harness.calculationWorld.lockCount();
    const before = snapshot();
    const response = await cancel();
    expect(response.status).toBe(403);
    const recorded = { label: `POST cancel (API, ${role})`, url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect((await cancel({}, UNKNOWN_ESTIMATE_ID)).status).toBe(403);
    expect(harness.calculationWorld.lockCount()).toBe(locks);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it('nobody signed in is 401', async () => {
    await approved();
    harness.signInAs(null);
    expect((await cancel()).status).toBe(401);
    expect(estimate().status).toBe('APPROVED');
  });

  it('the estimate is locked for the cancel (the lock the writers of an input share)', async () => {
    await approved();
    const locks = harness.calculationWorld.lockCount();
    await cancel();
    expect(harness.calculationWorld.lockCount()).toBeGreaterThan(locks);
  });
});

describe('AC-9: a customer or a material deleted after the approval is the cancel\'s own 409, and nothing is written', () => {
  it('CUSTOMER_DELETED in the cancel\'s words: the status stays APPROVED, no cancel is stored and no audit entry is written (the password was checked and is still not logged)', async () => {
    await approved();
    customerOfEstimate().deleted = true;
    const before = snapshot();
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: CUSTOMER_DELETED_CODE, title: CANCEL_CUSTOMER_DELETED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('APPROVED');
    expect(cancels()).toEqual([]);
    expect(harness.hasher.verified.some((check) => check.matched)).toBe(true);
    expect(writtenDown()).not.toContain(HARNESS_PASSWORD);
  });

  it('MATERIAL_DELETED in the cancel\'s words', async () => {
    await approved();
    harness.estimateWorld.materialsInUse.push({ id: FIRST_MATERIAL.id, deleted: true });
    const before = snapshot();
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: MATERIAL_DELETED_CODE, title: CANCEL_MATERIAL_DELETED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect(cancels()).toEqual([]);
  });

  it('the same refusal applies to a Draft whose approval was kept through an unlock (AC-10: AC-9 applies unchanged)', async () => {
    await approved();
    await unlocked();
    customerOfEstimate().deleted = true;
    const before = snapshot();
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: CUSTOMER_DELETED_CODE, title: CANCEL_CUSTOMER_DELETED_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('an estimate with no customer is not affected, and a material that is still there does not stop the cancel', async () => {
    await approved();
    estimate().customerId = null;
    harness.estimateWorld.materialsInUse.push({ id: FIRST_MATERIAL.id, deleted: false });
    expect((await cancel()).status).toBe(200);
  });
});

describe('AC-7: the password is in no log line, audit row, response or error body, on any path', () => {
  const PATHS: ReadonlyArray<readonly [string, () => Promise<Response>, number]> = [
    ['a good cancel', () => cancel(), 200],
    ['a wrong password (the password sent is the wrong one)', () => cancel({ password: WRONG_PASSWORD }), 422],
    ['a missing reason', () => cancel({ reason: '' }), 422],
    ['a body that is not the shape', () => cancel({ approvalId: 'x' }), 422],
    ['an approval that is not the latest', () => cancel({ approvalId: UNKNOWN_APPROVAL_ID }), 409],
    ['an estimate that is none', () => cancel({}, UNKNOWN_ESTIMATE_ID), 404],
  ];

  it.each(PATHS)('%s', async (_name, send, status) => {
    await approved();
    const response = await send();
    expect(response.status).toBe(status);
    const text = await response.text();
    for (const password of [HARNESS_PASSWORD, WRONG_PASSWORD]) {
      expect(text).not.toContain(password);
      expect(writtenDown()).not.toContain(password);
    }
  });

  it('a blocked step-up, a refused role and a failed audit write', async () => {
    await approved();
    for (let attempt = 0; attempt < 5; attempt += 1) await cancel({ password: WRONG_PASSWORD });
    const blocked = await cancel();
    expect(blocked.status).toBe(429);
    harness.throttles.rows.clear();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    const faulty = await cancel();
    expect(faulty.status).toBe(500);
    harness.signInAs('LEAD');
    const refused = await cancel({ password: WRONG_PASSWORD });
    expect(refused.status).toBe(403);
    for (const response of [blocked, faulty, refused]) {
      const text = await response.text();
      for (const password of [HARNESS_PASSWORD, WRONG_PASSWORD]) expect(text).not.toContain(password);
    }
    for (const password of [HARNESS_PASSWORD, WRONG_PASSWORD]) expect(writtenDown()).not.toContain(password);
  });

  it('the audit entry of a good cancel holds the reason, the price and the two statuses, and no password key or value', async () => {
    await approved();
    expect((await cancel()).status).toBe(200);
    const entry = defined(cancels()[0]);
    expect(Object.keys(entry.before as Record<string, unknown>).sort()).toEqual(['approvedPrice', 'status']);
    expect(Object.keys(entry.after as Record<string, unknown>).sort()).toEqual(['reason', 'status']);
    expect(JSON.stringify(entry)).not.toMatch(/password|hash/i);
  });
});

describe('NFR-002: no answer of the route holds a master value, rate name, formula, figure or ID', () => {
  it('every refusal and the good answer pass the scan of the canary values, and none names the estimate, the approval or a calculation', async () => {
    await approved();
    const calculationId = defined(estimate().currentCalculationId);
    const approvalId = latestApprovalId();
    const answers: Response[] = [];
    answers.push(await cancel({ reason: '' }));
    answers.push(await cancel({}, UNKNOWN_ESTIMATE_ID));
    customerOfEstimate().deleted = true;
    answers.push(await cancel());
    customerOfEstimate().deleted = false;
    answers.push(await cancel());
    answers.push(await cancel({ approvalId }));
    expect(answers.map((answer) => answer.status)).toEqual([422, 404, 409, 200, 409]);
    const texts = await Promise.all(answers.map((answer) => answer.text()));
    for (const [index, answer] of answers.entries()) {
      const text = defined(texts[index]);
      const recorded = { label: 'POST cancel (API, Admin)', url: ORIGIN, status: answer.status, headers: Object.fromEntries(answer.headers), body: text };
      expect(scanResponse(recorded, forbiddenStrings())).toEqual([]);
      expect(text).not.toContain(calculationId);
      expect(text).not.toContain(owned());
      expect(text).not.toContain(approvalId);
      expect(text).not.toContain(PRICE);
    }
    // The good answer is the status and the time, and nothing else.
    expect(Object.keys(record.parse(JSON.parse(defined(texts[3])))).sort()).toEqual(['cancelledAt', 'status']);
  });

  it('an answer that carries a key the schema does not name is refused as a server fault, and the value never reaches the client (the schema is strict)', async () => {
    await approved();
    const leaky = { status: 'DRAFT' as const, cancelledAt: '2026-11-17T06:30:00.000Z', price: 'PLANTED-12600.00' };
    vi.spyOn(harness.cancelApprovalService, 'cancel').mockResolvedValue(leaky);
    const response = await cancel();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('PLANTED-12600.00');
  });
});
