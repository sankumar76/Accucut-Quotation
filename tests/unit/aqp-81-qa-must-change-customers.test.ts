import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { HARNESS_NEXT_PASSWORD, HARNESS_PASSWORD } from '../support/harness-password';
import { FORBIDDEN_SIGNAL, harness, holdSessionClock, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * QA control for AQP-81 (STORY-01.05), G7 on PR 341 head ceb6787, DL-204 (5) (e) and (f). Not for merge: a throwaway branch run in CI only.
 *
 * (f) An Admin who must set a new password (the first Admin from `bootstrap-admin`, or after a reset) meets the three customer routes AQP-142
 * brought in, through the real routes, the real `withRoute`, the real session and the real masters service over in-memory storage: the pages
 * send them to /account, the APIs answer 403 PASSWORD_CHANGE_REQUIRED, the masters service is never read, and once the password is changed
 * through the real change route the same calls open. An Admin is the one case the end-to-end control cannot make (one active Admin, shared by
 * the whole suite), which is why it is here.
 *
 * (e) A new password equal to the current one is refused (422 under `newPassword`) in the ordinary state and in "Set a new password", and a
 * refusal writes no `logger.info` line; one successful own change writes exactly one. Counted over one run of seven calls, so a line that
 * leaked from a refusal would show in the total. Every name and password is invented.
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
vi.mock('@/components/features/masters/customer-screen', () => ({ CustomerScreen: () => null }));
vi.mock('@/components/features/masters/customer-edit-screen', () => ({ CustomerEditScreen: () => null }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAccountService: () => shared.accountService,
    getSessionCookieIssuer: () => shared.sessionCookieIssuer,
    getMastersService: () => shared.mastersService,
  };
});

const ORIGIN = 'https://portal.example.test';
const NEW_PASSWORD = HARNESS_NEXT_PASSWORD;
const CASE_ONLY_PASSWORD = 'Invented-e2e-password-for-aqp-38';
const SAME = 'Choose a new password that is different from your current one.';
const LOG_MESSAGE = 'A person changed their own password.';

const { GET: LIST, POST: ADD } = await import('@/app/api/v1/customers/route');
const { GET: OPTIONS } = await import('@/app/api/v1/options/customers/route');
const { POST: CHANGE } = await import('@/app/api/v1/account/password/route');
const { default: CustomersPage } = await import('@/app/(portal)/masters/customers/page');
const { default: CustomerPage } = await import('@/app/(portal)/masters/customers/[id]/page');

const record = z.record(z.string(), z.unknown());
const SOME_ID = '00000000-0000-4000-8000-00000000dead';

function call(method: string, path: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const change = (currentPassword: string, newPassword: string) => CHANGE(call('POST', '/api/v1/account/password', { currentPassword, newPassword }));
const person = (role: 'ADMIN' | 'LEAD' | 'ENGINEER') => defined(harness.users.records.find((entry) => entry.id === harness.idOf[role]));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
    Object.assign(person(role), { passwordHash: `hash:${HARNESS_PASSWORD}`, mustChangePassword: false, sessionVersion: 0 });
  }
  harness.throttles.rows.clear();
  for (const method of Object.values(logged)) method.mockClear();
});

describe('(f) an Admin who must set a new password, on the routes AQP-142 brought in', () => {
  it('is sent to /account from SCR-12, and the customer list and its edit page are never read', async () => {
    harness.signInAs('ADMIN');
    harness.setMustChangePassword('ADMIN', true);
    const read = vi.spyOn(harness.mastersService, 'listCustomers');
    const readOne = vi.spyOn(harness.mastersService, 'getCustomer');
    await expect(CustomersPage()).rejects.toThrow(`${REDIRECT_PREFIX}/account`);
    await expect(CustomerPage({ params: Promise.resolve({ id: SOME_ID }) })).rejects.toThrow(`${REDIRECT_PREFIX}/account`);
    expect(read).not.toHaveBeenCalled();
    expect(readOne).not.toHaveBeenCalled();
    read.mockRestore();
    readOne.mockRestore();
  });

  it('is refused GET /api/v1/options/customers and GET /api/v1/customers with 403 PASSWORD_CHANGE_REQUIRED, and the service is never read', async () => {
    harness.signInAs('ADMIN');
    harness.setMustChangePassword('ADMIN', true);
    const options = vi.spyOn(harness.mastersService, 'listCustomerOptions');
    const read = vi.spyOn(harness.mastersService, 'listCustomers');
    for (const response of [await OPTIONS(call('GET', '/api/v1/options/customers')), await LIST(call('GET', '/api/v1/customers'))]) {
      expect(response.status).toBe(403);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');
      expect(record.parse(await response.json())).toMatchObject({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED', title: 'Set a new password to continue.' });
    }
    expect(options).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    options.mockRestore();
    read.mockRestore();
  });

  it('is refused POST /api/v1/customers too, and nothing is added', async () => {
    harness.signInAs('ADMIN');
    harness.setMustChangePassword('ADMIN', true);
    const before = harness.masters.customers.length;
    const response = await ADD(call('POST', '/api/v1/customers', { name: 'Invented Customer' }));
    expect(response.status).toBe(403);
    expect(record.parse(await response.json())['code']).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(harness.masters.customers).toHaveLength(before);
  });

  it('is refused /api/v1/options/customers whatever the role: the duty is checked before the role, as for the other routes', async () => {
    for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      harness.setMustChangePassword(role, true);
      const response = await OPTIONS(call('GET', '/api/v1/options/customers'));
      expect(response.status, role).toBe(403);
      expect(record.parse(await response.json())['code'], role).toBe('PASSWORD_CHANGE_REQUIRED');
      harness.setMustChangePassword(role, false);
      expect((await OPTIONS(call('GET', '/api/v1/options/customers'))).status, `${role} once settled`).toBe(200);
    }
  });

  it('after the change through the real route, SCR-12, its edit page and both APIs open normally for the same Admin', async () => {
    harness.signInAs('ADMIN');
    harness.setMustChangePassword('ADMIN', true);
    expect((await LIST(call('GET', '/api/v1/customers'))).status).toBe(403);
    await expect(CustomersPage()).rejects.toThrow(`${REDIRECT_PREFIX}/account`);

    const changed = await change(HARNESS_PASSWORD, NEW_PASSWORD);
    expect(changed.status).toBe(204);
    expect(person('ADMIN').mustChangePassword).toBe(false);

    expect((await LIST(call('GET', '/api/v1/customers'))).status).toBe(200);
    expect((await OPTIONS(call('GET', '/api/v1/options/customers'))).status).toBe(200);
    const element = await CustomersPage();
    expect(element).toBeTruthy();
    // The edit page is opened too: a customer that does not exist is "not found" (SCR-26), not a redirect to /account and not "no access".
    const outcome = await CustomerPage({ params: Promise.resolve({ id: SOME_ID }) }).then(
      () => 'opened',
      (error: unknown) => (error instanceof Error ? error.message : 'unknown'),
    );
    expect(outcome).not.toContain(`${REDIRECT_PREFIX}/account`);
    expect(outcome).not.toContain(FORBIDDEN_SIGNAL);
  });

  it('a Lead who has set their password is still refused SCR-12 for their role (403, not a redirect), so the refusal above was the duty', async () => {
    harness.signInAs('LEAD');
    await expect(CustomersPage()).rejects.toThrow(FORBIDDEN_SIGNAL);
    expect((await LIST(call('GET', '/api/v1/customers'))).status).toBe(403);
    expect(record.parse(await (await LIST(call('GET', '/api/v1/customers'))).json())['code']).not.toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('(e) a new password equal to the current one, and the one log line of a change', () => {
  it('is 422 under newPassword in both states with nothing written; a change writes exactly one info line, a refusal none (seven calls, two lines)', async () => {
    // 1. Ordinary state, the same password: 422, no line.
    harness.signInAs('ENGINEER');
    const first = await change(HARNESS_PASSWORD, HARNESS_PASSWORD);
    expect(first.status).toBe(422);
    expect(first.headers.get('Set-Cookie')).toBeNull();
    const firstBody = record.parse(await first.json());
    expect(firstBody['code']).toBe('PASSWORD_RULE');
    expect(firstBody['errors']).toEqual([{ field: 'newPassword', message: SAME }]);
    expect(person('ENGINEER')).toMatchObject({ passwordHash: `hash:${HARNESS_PASSWORD}`, sessionVersion: 0 });
    expect(logged.info).toHaveBeenCalledTimes(0);

    // 2. "Set a new password", the same (temporary) password: 422, no line, the duty stays.
    harness.setMustChangePassword('ENGINEER', true);
    const second = await change(HARNESS_PASSWORD, HARNESS_PASSWORD);
    expect(second.status).toBe(422);
    expect(second.headers.get('Set-Cookie')).toBeNull();
    expect(record.parse(await second.json())['errors']).toEqual([{ field: 'newPassword', message: SAME }]);
    expect(person('ENGINEER')).toMatchObject({ passwordHash: `hash:${HARNESS_PASSWORD}`, sessionVersion: 0, mustChangePassword: true });
    expect(logged.info).toHaveBeenCalledTimes(0);

    // 3. A wrong current password and 4. a weak new one: 422, no line.
    expect((await change('Not-the-current-1!', NEW_PASSWORD)).status).toBe(422);
    expect((await change(HARNESS_PASSWORD, 'Short1!x')).status).toBe(422);
    expect(logged.info).toHaveBeenCalledTimes(0);

    // 5. The change in "Set a new password": 204, one line, with the request ID and the user ID, and nothing typed.
    const third = await change(HARNESS_PASSWORD, NEW_PASSWORD);
    expect(third.status).toBe(204);
    expect(logged.info).toHaveBeenCalledTimes(1);
    expect(logged.info).toHaveBeenLastCalledWith({ requestId: third.headers.get('X-Request-Id'), userId: harness.idOf.ENGINEER }, LOG_MESSAGE);
    expect(person('ENGINEER')).toMatchObject({ passwordHash: `hash:${NEW_PASSWORD}`, sessionVersion: 1, mustChangePassword: false });

    // 6. The ordinary state again, with the password now in force: the same value is refused and writes no line.
    expect((await change(NEW_PASSWORD, NEW_PASSWORD)).status).toBe(422);
    expect(logged.info).toHaveBeenCalledTimes(1);

    // 7. Another letter case is a different password: 204, and the second line.
    const last = await change(NEW_PASSWORD, NEW_PASSWORD.toUpperCase());
    expect(last.status).toBe(204);
    expect(logged.info).toHaveBeenCalledTimes(2);

    const everything = JSON.stringify(Object.values(logged).flatMap((method) => method.mock.calls));
    for (const secret of [HARNESS_PASSWORD, NEW_PASSWORD, NEW_PASSWORD.toUpperCase(), 'invented.engineer@example.test', 'hash:']) expect(everything).not.toContain(secret);
    // Every info call is the fixed message and the two IDs, and no other key.
    for (const [fields, message] of logged.info.mock.calls) {
      expect(message).toBe(LOG_MESSAGE);
      expect(Object.keys(z.record(z.string(), z.unknown()).parse(fields)).sort()).toEqual(['requestId', 'userId']);
    }
  });

  it('case counts: the current password with only its first letter in another case is a different password and is accepted', async () => {
    harness.signInAs('ENGINEER');
    expect(CASE_ONLY_PASSWORD).not.toBe(HARNESS_PASSWORD);
    expect(CASE_ONLY_PASSWORD.toLowerCase()).toBe(HARNESS_PASSWORD);
    expect((await change(HARNESS_PASSWORD, CASE_ONLY_PASSWORD)).status).toBe(204);
    expect(logged.info).toHaveBeenCalledTimes(1);
  });
});
