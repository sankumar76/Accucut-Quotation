import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createFixedClock, MILLISECONDS_PER_HOUR } from '@/lib/time';

import { createFakeUserRepository, type FakeUserRepository } from '../support/fake-auth-repositories';
import { defined } from '../support/defined';

/**
 * STORY-01.01 AC-5: the role and the active flag come from `users` on every request, a session whose version no
 * longer matches is ended, and a session is 12 hours from sign-in. `getServerSession` and the composition root are
 * replaced, so this tests only the rules in `session.ts`; the same rules run against PostgreSQL in
 * `tests/integration/auth/session-resolution.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  users: { current: undefined as unknown },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', () => ({
  getAuthOptions: () => ({}),
  getUserRepository: () => mocks.users.current,
}));

const { getCurrentUser, requireRole, requireUser, requireUserOrRedirect } = await import('@/server/auth/session');
const { resolveSessionUser } = await import('@/server/auth/resolve-session-user');

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
    await users.raiseSessionVersion(id);
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

describe('the current user of a request', () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.redirect.mockClear();
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
