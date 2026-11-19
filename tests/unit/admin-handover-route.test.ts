import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '@/lib/auth/step-up';
import {
  CANNOT_HAND_OVER_TO_SELF_CODE,
  CANNOT_HAND_OVER_TO_SELF_MESSAGE,
  HAND_OVER_TARGET_INACTIVE_CODE,
  HAND_OVER_TARGET_INACTIVE_MESSAGE,
} from '@/lib/users/hand-over';
import { PASSWORD_REQUIRED_MESSAGE } from '@/lib/users/validation';

import { defined } from '../support/defined';
import { HARNESS_PASSWORD } from '../support/harness-password';
import { fixedForbiddenProblem } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.09 AC-2 to AC-6 and AC-9 (FR-006; NFR-001, NFR-004, NFR-007; architecture section 6 "Hand over Admin"), through the real `withRoute`, the real session, the real step-up check (STORY-06.14) and the real
 * hand-over service over in-memory people and an in-memory audit log: the Admin hands the role to another active person with their password; the answer is 204 with no body; a wrong password, a blocked step-up, a
 * target that is the caller, deactivated or unknown, and a body that is not `{password}` are each their own refusal and change and record nothing; a Lead and an Engineer are the fixed 403 before anything is read, and
 * a signed-out caller is 401; **the password is in no log line, audit row, response or error body** (AC-9). Who may call the route is also `tests/security/role-matrix.test.ts`; the PostgreSQL side (the one-Admin
 * index, the row locks held until the second request is seen waiting, the rolled-back transaction) is `tests/integration/users/admin-handover.test.ts`. Every name, ID and password is invented.
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
    getAdminHandoverService: () => shared.adminHandoverService,
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_USER_ID = '00000000-0000-4000-8000-0000000000ff';
/** Planted: if it is found in any response, log line or audit row, the password leaked. */
const WRONG_PASSWORD = 'Wrong-Planted-Secret-91!';
const { POST } = await import('@/app/api/v1/users/[id]/admin-handover/route');

const record = z.record(z.string(), z.unknown());
const post = (body?: unknown, origin: string = ORIGIN): Request =>
  body === undefined
    ? new Request(`${ORIGIN}/api/v1/users/x/admin-handover`, { method: 'POST', headers: { origin } })
    : new Request(`${ORIGIN}/api/v1/users/x/admin-handover`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const handOver = (to: string, body: unknown = { password: HARNESS_PASSWORD }): Promise<Response> => POST(post(body), withId(to));
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
const person = (id: string) => defined(harness.users.records.find((candidate) => candidate.id === id));
/** The audit log is shared by the whole file and never emptied, so a test reads only the entries written since it began. */
let committedAtStart = 0;
let appendedAtStart = 0;
const writtenByTest = () => harness.auditWorld.audit.committed.slice(committedAtStart);
const handedOver = () => writtenByTest().filter((row) => row.event === 'user.admin_handed_over');

/** What a refusal must have left alone: every person's role, active flag and session counter, and every audit entry. */
function snapshot() {
  return {
    people: JSON.stringify(harness.users.records.map(({ id, role, isActive, sessionVersion }) => ({ id, role, isActive, sessionVersion }))),
    audit: harness.auditWorld.audit.committed.length,
  };
}

/** Everything the portal wrote down while a test ran, as text: every log line and every audit row. The password must be in none of it. */
const writtenDown = (): string => JSON.stringify([logged.debug.mock.calls, logged.info.mock.calls, logged.warn.mock.calls, logged.error.mock.calls, harness.auditWorld.audit.appended.slice(appendedAtStart)]);

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  vi.clearAllMocks();
  harness.signInAs('ADMIN');
  committedAtStart = harness.auditWorld.audit.committed.length;
  appendedAtStart = harness.auditWorld.audit.appended.length;
});

/** Puts the three people back as the recipe made them: the harness Admin is the Admin for every other test file's calls. */
afterEach(() => {
  for (const [role, id] of Object.entries(harness.idOf)) {
    const held = person(id);
    held.role = role as 'ADMIN' | 'LEAD' | 'ENGINEER';
    held.isActive = true;
    held.sessionVersion = 0;
  }
  harness.throttles.rows.clear();
  harness.hasher.verified.length = 0;
  vi.restoreAllMocks();
});

describe('AC-3: a good hand-over: 204 with no body, the roles swapped, both sessions ended', () => {
  it.each([
    ['a Lead', () => harness.idOf.LEAD],
    ['an Engineer', () => harness.idOf.ENGINEER],
  ])('to %s: the answer is 204 and empty, they are the Admin, the old Admin is a Lead, and exactly one active Admin exists', async (_name, target) => {
    const response = await handOver(target());
    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).toBe('');
    expect(person(target())).toMatchObject({ role: 'ADMIN', isActive: true, sessionVersion: 1 });
    expect(person(harness.idOf.ADMIN)).toMatchObject({ role: 'LEAD', isActive: true, sessionVersion: 1 });
    expect(harness.users.records.filter((candidate) => candidate.role === 'ADMIN' && candidate.isActive)).toHaveLength(1);
  });

  it('the person is the signed-in one: one password check, against the Admin, and nothing in the body can name another', async () => {
    const before = snapshot();
    // A body that names a person is not the shape: refused as a whole, before the password is checked.
    expect((await handOver(harness.idOf.ENGINEER, { password: HARNESS_PASSWORD, userId: harness.idOf.ENGINEER })).status).toBe(422);
    expect(snapshot()).toEqual(before);
    expect(harness.hasher.verified).toEqual([]);
    expect((await handOver(harness.idOf.LEAD)).status).toBe(204);
    expect(harness.hasher.verified).toHaveLength(1);
  });
});

describe('AC-4: one audit entry, no secret', () => {
  it('writes user.admin_handed_over once, by the old Admin, naming both people, and no user.role_changed', async () => {
    expect((await handOver(harness.idOf.LEAD)).status).toBe(204);
    expect(handedOver()).toHaveLength(1);
    expect(defined(handedOver()[0])).toMatchObject({
      actorId: harness.idOf.ADMIN,
      actorLabel: 'Invented Admin',
      objectId: harness.idOf.LEAD,
      before: { adminId: harness.idOf.ADMIN, adminName: 'Invented Admin' },
      after: { adminId: harness.idOf.LEAD, adminName: 'Invented Lead' },
    });
    expect(writtenByTest().filter((row) => row.event === 'user.role_changed')).toEqual([]);
  });
});

describe('AC-2: the step-up: a wrong password is 422, a blocked step-up is 429, and nothing changes', () => {
  it("a wrong password: 422 STEP_UP_FAILED in the step-up's words, nothing changes or is recorded, and the same session hands over with the right one", async () => {
    const before = snapshot();
    const response = await handOver(harness.idOf.LEAD, { password: WRONG_PASSWORD });
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ code: 'STEP_UP_FAILED', title: STEP_UP_FAILED_MESSAGE });
    expect(snapshot()).toEqual(before);
    expect((await handOver(harness.idOf.LEAD)).status).toBe(204);
  });

  it('five wrong passwords block the step-up: the sixth try, even with the right password, is 429 STEP_UP_LOCKED, and nothing changes', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await handOver(harness.idOf.LEAD, { password: WRONG_PASSWORD })).status).toBe(422);
    const before = snapshot();
    const blocked = await handOver(harness.idOf.LEAD);
    expect(blocked.status).toBe(429);
    expect(await bodyOf(blocked)).toMatchObject({ code: 'STEP_UP_LOCKED', title: STEP_UP_LOCKED_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('a wrong password is judged before the target is looked at: an unknown person and a wrong password is 422, not 404', async () => {
    expect((await handOver(UNKNOWN_USER_ID, { password: WRONG_PASSWORD })).status).toBe(422);
    expect((await handOver(harness.idOf.ADMIN, { password: WRONG_PASSWORD })).status).toBe(422);
  });
});

describe('AC-5: refusals, in the order the story fixes', () => {
  it.each([
    ['the caller', () => harness.idOf.ADMIN],
    ['the caller written in capitals', () => harness.idOf.ADMIN.toUpperCase()],
  ])('%s as the target: 409 CANNOT_HAND_OVER_TO_SELF, and nothing changes', async (_name, target) => {
    const before = snapshot();
    const response = await handOver(target());
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: CANNOT_HAND_OVER_TO_SELF_CODE, title: CANNOT_HAND_OVER_TO_SELF_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('a deactivated person: 409 HAND_OVER_TARGET_INACTIVE, and the Admin stays the Admin', async () => {
    person(harness.idOf.ENGINEER).isActive = false;
    const before = snapshot();
    const response = await handOver(harness.idOf.ENGINEER);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: HAND_OVER_TARGET_INACTIVE_CODE, title: HAND_OVER_TARGET_INACTIVE_MESSAGE });
    expect(snapshot()).toEqual(before);
  });

  it('an unknown ID: 404, nothing changes', async () => {
    const before = snapshot();
    expect((await handOver(UNKNOWN_USER_ID)).status).toBe(404);
    expect(snapshot()).toEqual(before);
  });

  it.each([['not-a-uuid'], ['12345'], ['00000000-0000-4000-8000-00000000000']])('a malformed ID (%s): 422 before the password is checked, and nothing is read', async (malformed) => {
    harness.hasher.verified.length = 0;
    const before = snapshot();
    expect((await handOver(malformed)).status).toBe(422);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it.each([
    ['an empty object', {}],
    ['an empty password', { password: '' }],
    ['a password that is not text', { password: 12345 }],
    ['an extra key', { password: HARNESS_PASSWORD, role: 'ADMIN' }],
  ])('%s: 422 before the password is checked, and nothing changes', async (_name, body) => {
    harness.hasher.verified.length = 0;
    const before = snapshot();
    const response = await POST(post(body), withId(harness.idOf.LEAD));
    expect(response.status).toBe(422);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it('no body at all is a bad request (400), before the password is checked, and nothing changes', async () => {
    const before = snapshot();
    expect((await POST(post(), withId(harness.idOf.LEAD))).status).toBe(400);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it('an empty password is said to be missing, under the password field', async () => {
    const response = await handOver(harness.idOf.LEAD, { password: '' });
    expect(JSON.stringify(await bodyOf(response))).toContain(PASSWORD_REQUIRED_MESSAGE);
  });

  it('a request from another origin is refused before anything is read (the CSRF check)', async () => {
    const before = snapshot();
    const response = await POST(post({ password: HARNESS_PASSWORD }, 'https://elsewhere.example.test'), withId(harness.idOf.LEAD));
    expect(response.status).toBe(403);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });
});

describe('AC-6 (NFR-001): nobody but the Admin hands the role over', () => {
  it.each(['LEAD', 'ENGINEER'] as const)('%s is the fixed 403 before the ID is looked at: nothing is read or checked, and an invented ID gets the same 403', async (role) => {
    harness.signInAs(role);
    const before = snapshot();
    const response = await handOver(harness.idOf.LEAD);
    expect(response.status).toBe(403);
    const recorded = { label: `POST admin-handover (API, ${role})`, url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect((await handOver(UNKNOWN_USER_ID)).status).toBe(403);
    expect((await handOver('not-a-uuid')).status).toBe(403);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it('a signed-out caller is 401, and nothing changes', async () => {
    harness.signInAs(null);
    const before = snapshot();
    expect((await handOver(harness.idOf.LEAD)).status).toBe(401);
    expect(harness.hasher.verified).toEqual([]);
    expect(snapshot()).toEqual(before);
  });
});

describe('AC-9: the password is in no log line, audit row, response or error body', () => {
  it('after a good hand-over, a wrong password, a block and every refusal, neither the right nor the wrong password is written down or answered', async () => {
    const answers: string[] = [];
    const send = async (to: string, body?: unknown): Promise<void> => {
      answers.push(await (await handOver(to, body)).text());
    };
    await send(harness.idOf.LEAD, { password: WRONG_PASSWORD });
    await send(harness.idOf.ADMIN);
    await send(UNKNOWN_USER_ID);
    await send(harness.idOf.ENGINEER, { password: HARNESS_PASSWORD, userId: 'x' });
    for (let attempt = 0; attempt < 5; attempt += 1) await send(harness.idOf.LEAD, { password: WRONG_PASSWORD });
    await send(harness.idOf.LEAD);
    harness.throttles.rows.clear();
    await send(harness.idOf.LEAD);
    for (const text of [...answers, writtenDown()]) {
      expect(text).not.toContain(HARNESS_PASSWORD);
      expect(text).not.toContain(WRONG_PASSWORD);
    }
  });

  it('a refusal by the step-up logs the person and the request only', async () => {
    await handOver(harness.idOf.LEAD, { password: WRONG_PASSWORD });
    const lines = logged.warn.mock.calls as ReadonlyArray<ReadonlyArray<unknown>>;
    const stepUp = lines.filter(([, message]) => message === 'step-up failed');
    expect(stepUp).toHaveLength(1);
    expect(Object.keys(record.parse(defined(stepUp[0])[0])).sort()).toEqual(['requestId', 'userId']);
    expect(record.parse(defined(stepUp[0])[0])['userId']).toBe(harness.idOf.ADMIN);
  });
});
