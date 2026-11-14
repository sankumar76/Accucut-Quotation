import { decode } from 'next-auth/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { sessionTokenSchema } from '@/server/auth/session-token';

import { defined } from '../support/defined';
import { HARNESS_NEXT_PASSWORD, HARNESS_PASSWORD } from '../support/harness-password';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.05 AC-2, AC-3, AC-5, AC-6: the contract of `POST /api/v1/account/password`, through the real `withRoute`, the real session and
 * the real account service over in-memory repositories. What the body must look like, what each refusal says and names, that an answer
 * holds no password, that the answer carries a fresh session at the new version, and that a person who must set a new password may call it
 * and nothing else. Every name and password is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
const logged = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: logged }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAccountService: () => shared.accountService,
    getSessionCookieIssuer: () => shared.sessionCookieIssuer,
  };
});

const ORIGIN = 'https://portal.example.test';
const NEW_PASSWORD = 'Pr9$kWd3!Rx-fresh';
const SESSION_SECRET = 'invented-session-secret-for-the-harness';

const { POST } = await import('@/app/api/v1/account/password/route');
const { GET: USERS } = await import('@/app/api/v1/users/route');
const { GET: ME } = await import('@/app/api/v1/me/route');

const record = z.record(z.string(), z.unknown());

function request(body: unknown, headers: Record<string, string> = { origin: ORIGIN }): Request {
  return new Request(`${ORIGIN}/api/v1/account/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const goodBody = { currentPassword: HARNESS_PASSWORD, newPassword: NEW_PASSWORD };

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
  // Every test starts from the person with their original password, no duty to change it and a clean attempt count.
  const person = defined(harness.users.records.find((entry) => entry.id === harness.idOf.ENGINEER));
  Object.assign(person, { passwordHash: `hash:${HARNESS_PASSWORD}`, mustChangePassword: false, sessionVersion: 0 });
  harness.setMustChangePassword('ENGINEER', false);
  harness.throttles.rows.clear();
  for (const method of Object.values(logged)) method.mockClear();
});

describe('AC-3: the change', () => {
  it('answers 204 with no body, and neither password nor hash anywhere in the answer', async () => {
    const response = await POST(request(goodBody));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    const everything = JSON.stringify([...response.headers.entries()]);
    expect(everything).not.toContain(NEW_PASSWORD);
    expect(everything).not.toContain(HARNESS_PASSWORD);
    expect(everything).not.toMatch(/hash:/);
  });

  it('stores the new password, raises session_version and sets a fresh cookie at the new version that stays signed in', async () => {
    const before = defined(harness.users.records.find((entry) => entry.id === harness.idOf.ENGINEER)).sessionVersion;
    const response = await POST(request(goodBody));
    const person = defined(harness.users.records.find((entry) => entry.id === harness.idOf.ENGINEER));
    expect(person).toMatchObject({ passwordHash: `hash:${NEW_PASSWORD}`, sessionVersion: before + 1 });

    const header = defined(response.headers.get('Set-Cookie'));
    expect(header).toMatch(/^next-auth\.session-token=[A-Za-z0-9._-]+; Max-Age=\d+; Path=\/; HttpOnly; SameSite=Lax$/);
    const value = defined(/^next-auth\.session-token=([^;]+)/.exec(header)?.[1]);
    const token = sessionTokenSchema.parse(await decode({ token: value, secret: SESSION_SECRET }));
    expect(token).toMatchObject({ sub: harness.idOf.ENGINEER, sv: before + 1 });
    // The old cookie (the old version) is refused by the session, the new one is what the harness now presents.
    expect(token.sv).toBe(person.sessionVersion);

    // The same browser, with the fresh cookie, is still let in.
    const me = await ME(new Request(`${ORIGIN}/api/v1/me`, { method: 'GET' }));
    expect(me.status).toBe(200);
  });

  it('refuses a request from another origin before anything is read', async () => {
    const response = await POST(request(goodBody, { origin: 'https://evil.example.test' }));
    expect(response.status).toBe(403);
    expect(defined(harness.users.records.find((entry) => entry.id === harness.idOf.ENGINEER)).passwordHash).toBe(`hash:${HARNESS_PASSWORD}`);
  });

  it('is 401 for nobody', async () => {
    harness.signInAs(null);
    expect((await POST(request(goodBody))).status).toBe(401);
  });
});

describe('AC-2 and AC-3: what a refusal says', () => {
  it('names the current password when it is wrong: 422 CURRENT_PASSWORD_WRONG under currentPassword, no cookie', async () => {
    const response = await POST(request({ ...goodBody, currentPassword: 'Not-the-current-1!' }));
    expect(response.status).toBe(422);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    const body = record.parse(await response.json());
    expect(body['code']).toBe('CURRENT_PASSWORD_WRONG');
    expect(body['errors']).toEqual([{ field: 'currentPassword', message: 'Your current password is not correct.' }]);
  });

  it.each([
    ['9 characters', 'Ab7!xyzuv', 'The new password must be at least 10 characters.'],
    ['129 characters', 'x'.repeat(129), 'Use 128 characters or fewer.'],
    ['no number and no symbol', 'abcdefghijkl', 'Add at least one number and one symbol, such as ! # $ or %.'],
    ['common', 'Password1!', 'That password is too common. Choose a different one.'],
    ['the e-mail address', 'INVENTED.ENGINEER@example.test', 'The password cannot be the same as your e-mail address.'],
  ])('a new password of %s is 422 PASSWORD_RULE naming the part under newPassword, and never echoed', async (_name, newPassword, message) => {
    const response = await POST(request({ ...goodBody, newPassword }));
    expect(response.status).toBe(422);
    const text = await response.text();
    const body = record.parse(JSON.parse(text));
    expect(body['code']).toBe('PASSWORD_RULE');
    expect(body['errors']).toEqual([{ field: 'newPassword', message }]);
    expect(text).not.toContain(newPassword);
  });

  it.each([
    ['no current password', { newPassword: NEW_PASSWORD }],
    ['an empty current password', { currentPassword: '', newPassword: NEW_PASSWORD }],
    ['no new password', { currentPassword: HARNESS_PASSWORD }],
    ['a key it does not know', { ...goodBody, role: 'ADMIN' }],
    ['a password over the 1,024 characters the route reads', { ...goodBody, newPassword: 'x'.repeat(1025) }],
  ])('refuses a body with %s as 422 VALIDATION_FAILED', async (_name, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(422);
    expect(record.parse(await response.json())['code']).toBe('VALIDATION_FAILED');
  });

  it('a body that is not JSON is 400', async () => {
    const response = await POST(new Request(`${ORIGIN}/api/v1/account/password`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{nope' }));
    expect(response.status).toBe(400);
  });
});

describe('F11, STD-07: the log line of a successful change', () => {
  const everything = () => JSON.stringify(Object.values(logged).flatMap((method) => method.mock.calls));

  it('is one info line with the request ID and the user ID and a fixed message, and nothing the person typed', async () => {
    const response = await POST(request(goodBody));
    expect(response.status).toBe(204);
    expect(logged.info).toHaveBeenCalledTimes(1);
    expect(logged.info).toHaveBeenCalledWith({ requestId: response.headers.get('X-Request-Id'), userId: harness.idOf.ENGINEER }, 'A person changed their own password.');
    const text = everything();
    for (const secret of [HARNESS_PASSWORD, NEW_PASSWORD, 'invented.engineer@example.test', 'hash:']) expect(text).not.toContain(secret);
  });

  it.each([
    ['a wrong current password', { ...goodBody, currentPassword: 'Not-the-current-1!' }, 422],
    ['a weak new password', { ...goodBody, newPassword: 'Short1!x' }, 422],
    ['a new password equal to the current one', { currentPassword: HARNESS_PASSWORD, newPassword: HARNESS_PASSWORD }, 422],
    ['a body that is not valid', { currentPassword: HARNESS_PASSWORD }, 422],
  ])('writes no info line for %s, and none of the typed values anywhere', async (_name, body, status) => {
    const response = await POST(request(body));
    expect(response.status).toBe(status);
    expect(logged.info).not.toHaveBeenCalled();
    const text = everything();
    for (const typed of Object.values(body)) expect(text).not.toContain(typed);
  });
});

describe('QLT-01: a new password equal to the current one', () => {
  const SAME = 'Choose a new password that is different from your current one.';
  const person = () => defined(harness.users.records.find((entry) => entry.id === harness.idOf.ENGINEER));

  it.each([
    ['in the ordinary state', false],
    ['in "Set a new password"', true],
  ])('is 422 PASSWORD_RULE under newPassword %s, with no cookie, and nothing changes', async (_name, mustChange) => {
    harness.setMustChangePassword('ENGINEER', mustChange);
    const before = { ...person() };
    const response = await POST(request({ currentPassword: HARNESS_PASSWORD, newPassword: HARNESS_PASSWORD }));
    expect(response.status).toBe(422);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    const body = record.parse(await response.json());
    expect(body['code']).toBe('PASSWORD_RULE');
    expect(body['errors']).toEqual([{ field: 'newPassword', message: SAME }]);
    expect(person()).toMatchObject({ passwordHash: before.passwordHash, mustChangePassword: mustChange, sessionVersion: before.sessionVersion });
  });

  it('the recipe of the role matrix sends a different new password, so it is a success', async () => {
    expect((await POST(request({ currentPassword: HARNESS_PASSWORD, newPassword: HARNESS_NEXT_PASSWORD }))).status).toBe(204);
    expect(HARNESS_NEXT_PASSWORD).not.toBe(HARNESS_PASSWORD);
  });

  it('putting the person back on the first password (signInAs) makes the recipe repeatable', async () => {
    for (let round = 0; round < 3; round += 1) {
      harness.signInAs('ENGINEER');
      expect((await POST(request({ currentPassword: HARNESS_PASSWORD, newPassword: HARNESS_NEXT_PASSWORD }))).status).toBe(204);
    }
  });
});

describe('AC-6: the sixth try after five wrong current passwords', () => {
  it('is 429 TOO_MANY_ATTEMPTS with the words of the block, even with the right current password', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(request({ ...goodBody, currentPassword: `Not-the-current-${attempt}!` }))).status).toBe(422);
    }
    const sixth = await POST(request(goodBody));
    expect(sixth.status).toBe(429);
    expect(record.parse(await sixth.json())).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', title: 'Too many attempts. Try again in 15 minutes.' });
    expect(sixth.headers.get('Set-Cookie')).toBeNull();
  });
});

describe('AC-5: a person who must set a new password', () => {
  it('may call this route, and the change clears the duty', async () => {
    harness.setMustChangePassword('ENGINEER', true);
    expect((await POST(request(goodBody))).status).toBe(204);
    expect(defined(harness.users.records.find((entry) => entry.id === harness.idOf.ENGINEER)).mustChangePassword).toBe(false);
  });

  it('is refused every other API route with 403 PASSWORD_CHANGE_REQUIRED, whatever the role would allow', async () => {
    harness.setMustChangePassword('ENGINEER', true);
    const me = await ME(new Request(`${ORIGIN}/api/v1/me`, { method: 'GET' }));
    expect(me.status).toBe(403);
    expect(record.parse(await me.json())).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED', title: 'Set a new password to continue.' });
    harness.signInAs('ADMIN');
    harness.setMustChangePassword('ADMIN', true);
    const users = await USERS(new Request(`${ORIGIN}/api/v1/users`, { method: 'GET' }));
    expect(users.status).toBe(403);
    expect(record.parse(await users.json())['code']).toBe('PASSWORD_CHANGE_REQUIRED');
    harness.setMustChangePassword('ADMIN', false);
  });
});
