import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { SESSION_COOKIE_HEADER, SESSION_COOKIE_PRESENT, SESSION_ENDED_CODE } from '@/lib/auth/session-ended';
import { createFixedClock, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@/lib/time';

import { createFakeUserRepository, type FakeUserRepository } from '../support/fake-auth-repositories';
import { defined } from '../support/defined';

/**
 * STORY-01.01 AC-5 and STORY-01.06 AC-1, AC-2, AC-3, AC-4 and AC-5: the role and the active flag come from `users` on every
 * request, a session whose version no longer matches is ended, and a session is 12 hours from sign-in, whatever the activity.
 * A session that ended is told apart from a visit with no session: `requireUser` throws the 401 with the code SESSION_ENDED and
 * `requireUserOrRedirect` shows SCR-26 (`unauthorized()`), and everything else keeps its plain 401 and its redirect. `getServerSession` and the composition root are
 * replaced, so this tests only the rules in `session.ts`; the same rules run against PostgreSQL in
 * `tests/integration/auth/session-resolution.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  unauthorized: vi.fn((): never => {
    throw new Error('NEXT_UNAUTHORIZED');
  }),
  users: { current: undefined as unknown },
  returnPath: { current: null as string | null },
  /** What the proxy tells the page about the browser's cookie: the header's value, or null for no header. */
  sessionCookie: { current: null as string | null },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unauthorized: mocks.unauthorized }));
vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve(
      new Headers({
        ...(mocks.returnPath.current === null ? {} : { 'x-return-path': mocks.returnPath.current }),
        ...(mocks.sessionCookie.current === null ? {} : { 'x-session-cookie': mocks.sessionCookie.current }),
      }),
    ),
}));
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', () => ({
  getAuthOptions: () => ({}),
  getUserRepository: () => mocks.users.current,
}));

const { getCurrentUser, requireRole, requireUser, requireUserOrRedirect } = await import('@/server/auth/session');
const { resolveSession, resolveSessionUser } = await import('@/server/auth/resolve-session-user');

const NOW = new Date('2026-11-04T09:00:00.000Z');
const SIGNED_AT = NOW.getTime() / 1_000;

async function repositoryWithOneUser(): Promise<{ users: FakeUserRepository; id: string }> {
  const users = createFakeUserRepository([
    { name: 'Invented Lead', email: 'lead@example.test', passwordHash: 'h', role: 'LEAD', mustChangePassword: false },
  ]);
  return { users, id: defined(users.records[0]).id };
}

describe('AC-5: the user for a set of claims', () => {
  it('is the account read from the database, with no password hash', async () => {
    const { users, id } = await repositoryWithOneUser();
    const user = await resolveSessionUser({ userId: id, sessionVersion: 0, signedAt: SIGNED_AT }, users, NOW);
    expect(user).toEqual({ id, name: 'Invented Lead', email: 'lead@example.test', role: 'LEAD', mustChangePassword: false });
  });

  it('a role change is effective at the next request', async () => {
    const { users, id } = await repositoryWithOneUser();
    defined(users.records[0]).role = 'ENGINEER';
    const user = await resolveSessionUser({ userId: id, sessionVersion: 0, signedAt: SIGNED_AT }, users, NOW);
    expect(user?.role).toBe('ENGINEER');
  });

  it('a deactivation is effective at the next request', async () => {
    const { users, id } = await repositoryWithOneUser();
    defined(users.records[0]).isActive = false;
    expect(await resolveSessionUser({ userId: id, sessionVersion: 0, signedAt: SIGNED_AT }, users, NOW)).toBeNull();
  });

  it('a session version that no longer matches ends the session (sign-out, password change)', async () => {
    const { users, id } = await repositoryWithOneUser();
    await users.raiseSessionVersion(id, 0);
    expect(await resolveSessionUser({ userId: id, sessionVersion: 0, signedAt: SIGNED_AT }, users, NOW)).toBeNull();
  });

  it('a user who no longer exists, or no claims at all, is nobody', async () => {
    const { users } = await repositoryWithOneUser();
    expect(await resolveSessionUser({ userId: 'missing', sessionVersion: 0, signedAt: SIGNED_AT }, users, NOW)).toBeNull();
    expect(await resolveSessionUser(null, users, NOW)).toBeNull();
  });

  it('a request just before 12 hours after sign-in is accepted and one at 12 hours is refused, however busy the session was', async () => {
    const { users, id } = await repositoryWithOneUser();
    const claims = { userId: id, sessionVersion: 0, signedAt: SIGNED_AT };
    const clock = createFixedClock(NOW);
    for (let hour = 1; hour < 12; hour += 1) {
      clock.advance(MILLISECONDS_PER_HOUR);
      expect(await resolveSessionUser(claims, users, clock.now())).not.toBeNull();
    }
    clock.advance(MILLISECONDS_PER_HOUR - 1_000);
    expect(await resolveSessionUser(claims, users, clock.now())).not.toBeNull();
    clock.advance(1_000);
    expect(await resolveSessionUser(claims, users, clock.now())).toBeNull();
  });
});

describe('STORY-01.06 AC-1 and AC-5: what a session comes to', () => {
  const HOUR = MILLISECONDS_PER_HOUR;

  it('a token 12 hours old or more has ended, and ending it reads nothing from the database', async () => {
    const { users, id } = await repositoryWithOneUser();
    const lookup = vi.spyOn(users, 'findAccountById');
    const claims = { userId: id, sessionVersion: 0, signedAt: SIGNED_AT };
    expect(await resolveSession(claims, users, new Date(NOW.getTime() + 12 * HOUR + 1_000))).toEqual({ status: 'ended' });
    expect(await resolveSession(claims, users, new Date(NOW.getTime() + 12 * HOUR))).toEqual({ status: 'ended' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('a token inside its 12 hours is active, with the account read from the database', async () => {
    const { users, id } = await repositoryWithOneUser();
    const claims = { userId: id, sessionVersion: 0, signedAt: SIGNED_AT };
    const resolution = await resolveSession(claims, users, new Date(NOW.getTime() + 12 * HOUR - 1_000));
    expect(resolution).toMatchObject({ status: 'active', user: { id, role: 'LEAD' } });
  });

  it('AC-5: a deactivated user, a version that no longer matches and a user who is gone are refused, not "ended"', async () => {
    const { users, id } = await repositoryWithOneUser();
    const claims = { userId: id, sessionVersion: 0, signedAt: SIGNED_AT };
    const inside = new Date(NOW.getTime() + HOUR);
    defined(users.records[0]).isActive = false;
    expect(await resolveSession(claims, users, inside)).toEqual({ status: 'refused' });
    defined(users.records[0]).isActive = true;
    await users.raiseSessionVersion(id, 0);
    expect(await resolveSession(claims, users, inside)).toEqual({ status: 'refused' });
    expect(await resolveSession({ ...claims, userId: 'missing' }, users, inside)).toEqual({ status: 'refused' });
  });

  it('a sign-in time in the future is refused, not "ended"', async () => {
    const { users, id } = await repositoryWithOneUser();
    expect(await resolveSession({ userId: id, sessionVersion: 0, signedAt: SIGNED_AT + 60 }, users, NOW)).toEqual({ status: 'refused' });
  });

  it('no claims at all is unreadable', async () => {
    const { users } = await repositoryWithOneUser();
    expect(await resolveSession(null, users, NOW)).toEqual({ status: 'unreadable' });
  });

  it('AC-1: a session used every minute is accepted at 11 h 59 m 59 s and refused at 12 h 00 m 01 s', async () => {
    const { users, id } = await repositoryWithOneUser();
    const claims = { userId: id, sessionVersion: 0, signedAt: SIGNED_AT };
    const clock = createFixedClock(NOW);
    for (let minute = 1; minute < 12 * 60; minute += 1) {
      clock.advance(MILLISECONDS_PER_MINUTE);
      expect((await resolveSession(claims, users, clock.now())).status).toBe('active');
    }
    clock.advance(MILLISECONDS_PER_MINUTE - 1_000);
    expect((await resolveSession(claims, users, clock.now())).status).toBe('active');
    clock.advance(2_000);
    expect((await resolveSession(claims, users, clock.now())).status).toBe('ended');
  });
});

describe('STORY-01.06 AC-3 and AC-4: a session that ended is not a visit with no session', () => {
  const lastSecond = (): void => {
    vi.setSystemTime(new Date(NOW.getTime() + 12 * MILLISECONDS_PER_HOUR - 1_000));
  };

  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.redirect.mockClear();
    mocks.unauthorized.mockClear();
    mocks.returnPath.current = null;
    mocks.sessionCookie.current = null;
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function signedInAt(signedAt: number): Promise<string> {
    const { users, id } = await repositoryWithOneUser();
    mocks.users.current = users;
    mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0, signedAt });
    return id;
  }

  it('names the header and its value the proxy uses', () => {
    expect(SESSION_COOKIE_HEADER).toBe('x-session-cookie');
    expect(SESSION_COOKIE_PRESENT).toBe('1');
  });

  it('AC-4: requireUser throws a 401 with the code SESSION_ENDED for a token 12 hours old, and the person for one just inside', async () => {
    await signedInAt(SIGNED_AT);
    lastSecond();
    await expect(requireUser()).resolves.toMatchObject({ role: 'LEAD' });
    vi.setSystemTime(new Date(NOW.getTime() + 12 * MILLISECONDS_PER_HOUR + 1_000));
    const refusal = await requireUser().catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(UnauthorizedError);
    expect(refusal).toMatchObject({ code: SESSION_ENDED_CODE, httpStatus: 401 });
  });

  it('AC-3: a page request with a token 12 hours old shows SCR-26 (unauthorized), not the sign-in redirect', async () => {
    await signedInAt(SIGNED_AT);
    vi.setSystemTime(new Date(NOW.getTime() + 12 * MILLISECONDS_PER_HOUR + 1_000));
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_UNAUTHORIZED');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('AC-3: a cookie the server can no longer read (its own 12 hours are over) is a session that ended', async () => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(null);
    mocks.sessionCookie.current = SESSION_COOKIE_PRESENT;
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_UNAUTHORIZED');
    expect(await requireUser().catch((error: unknown) => error)).toMatchObject({ code: SESSION_ENDED_CODE });
  });

  it('a cookie whose token has no usable claims is also a session that ended', async () => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue({ expires: 'x' });
    mocks.sessionCookie.current = SESSION_COOKIE_PRESENT;
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_UNAUTHORIZED');
  });

  it('a visit with no cookie is not: it gets the plain 401 and the redirect to sign in', async () => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(null);
    expect(await requireUser().catch((error: unknown) => error)).toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401 });
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(mocks.unauthorized).not.toHaveBeenCalled();
  });

  it.each(['0', '', 'true', 'yes'])('only the proxy\'s one value counts: %j is not a cookie', async (value) => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(null);
    mocks.sessionCookie.current = value;
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
  });

  it('AC-5: a user deactivated inside the 12 hours is refused at once, with the plain 401 and the redirect, not as "ended"', async () => {
    const { users, id } = await repositoryWithOneUser();
    mocks.users.current = users;
    mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0, signedAt: SIGNED_AT });
    mocks.sessionCookie.current = SESSION_COOKIE_PRESENT;
    lastSecond();
    await expect(requireUser()).resolves.toMatchObject({ id });
    defined(users.records[0]).isActive = false;
    expect(await requireUser().catch((error: unknown) => error)).toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(mocks.unauthorized).not.toHaveBeenCalled();
  });

  it('AC-5: a role change inside the 12 hours is effective at the next request', async () => {
    const { users, id } = await repositoryWithOneUser();
    mocks.users.current = users;
    mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0, signedAt: SIGNED_AT });
    lastSecond();
    await expect(requireUser()).resolves.toMatchObject({ role: 'LEAD' });
    defined(users.records[0]).role = 'ENGINEER';
    await expect(requireUser()).resolves.toMatchObject({ role: 'ENGINEER' });
  });

  it('AC-5: a session version that no longer matches inside the 12 hours is refused, not "ended"', async () => {
    const id = await signedInAt(SIGNED_AT);
    mocks.sessionCookie.current = SESSION_COOKIE_PRESENT;
    await (mocks.users.current as FakeUserRepository).raiseSessionVersion(id, 0);
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
  });

  it('the returned person is nobody once the session ended: getCurrentUser answers null', async () => {
    await signedInAt(SIGNED_AT);
    vi.setSystemTime(new Date(NOW.getTime() + 13 * MILLISECONDS_PER_HOUR));
    expect(await getCurrentUser()).toBeNull();
  });
});

describe('the current user of a request', () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.redirect.mockClear();
    mocks.returnPath.current = null;
    mocks.sessionCookie.current = null;
  });

  it('is built from the three values in the session', async () => {
    const { users, id } = await repositoryWithOneUser();
    mocks.users.current = users;
    mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0, signedAt: Date.now() / 1_000 });
    expect(await getCurrentUser()).toMatchObject({ id, role: 'LEAD' });
  });

  it.each([
    ['no session', null],
    ['a session without the values', { expires: 'x' }],
    ['a session with only a user', { expires: 'x', userId: 'u' }],
  ])('is nobody for %s', async (_name, session) => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(session);
    expect(await getCurrentUser()).toBeNull();
  });

  it('requireUser throws a 401 when nobody is signed in', async () => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('requireUser returns the person when signed in', async () => {
    const { users, id } = await repositoryWithOneUser();
    mocks.users.current = users;
    mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0, signedAt: Date.now() / 1_000 });
    expect((await requireUser()).id).toBe(id);
  });

  it('requireUserOrRedirect sends nobody to the sign-in page', async () => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(null);
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
  });

  it('requireUserOrRedirect keeps the address the person asked for, as the proxy recorded it (STORY-01.02 AC-4)', async () => {
    mocks.users.current = createFakeUserRepository();
    mocks.getServerSession.mockResolvedValue(null);
    mocks.returnPath.current = '/queue?tab=overdue';
    await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in?callbackUrl=%2Fqueue%3Ftab%3Doverdue');
  });

  it.each(['https://evil.example/x', '//evil.example/x', '/api/v1/me', '/sign-in', ''])(
    'requireUserOrRedirect ignores a recorded address that is not a page of this portal: %j',
    async (recorded) => {
      mocks.users.current = createFakeUserRepository();
      mocks.getServerSession.mockResolvedValue(null);
      mocks.returnPath.current = recorded;
      await expect(requireUserOrRedirect()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
      expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
    },
  );

  it('requireUserOrRedirect returns the person when signed in', async () => {
    const { users, id } = await repositoryWithOneUser();
    mocks.users.current = users;
    mocks.getServerSession.mockResolvedValue({ expires: 'x', userId: id, sessionVersion: 0, signedAt: Date.now() / 1_000 });
    expect((await requireUserOrRedirect()).id).toBe(id);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe('a refused role gets a 403', () => {
  const lead = { id: 'u', name: 'n', email: 'e@example.test', role: 'LEAD', mustChangePassword: false } as const;

  it('lets a listed role through', () => {
    expect(requireRole(lead, 'ADMIN', 'LEAD')).toBe(lead);
  });

  it('refuses an unlisted role with a ForbiddenError (403)', () => {
    expect(() => requireRole(lead, 'ADMIN')).toThrow(ForbiddenError);
  });
});
