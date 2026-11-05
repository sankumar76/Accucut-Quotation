import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * QLT-69 (STORY-01.04 AC-6, CR-33): `/users` checks the role **before** it reads anyone. A page that read the list first and
 * checked afterwards would still answer a Lead with "no access", so every answer-based test would pass, while the read (and
 * its cost, and any leak through timing or logging) happened for a role that may not see it. This test watches the read: for a
 * refused role and for a signed-out visitor the list service is never called. Swapping the two lines of the page fails it.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getUserService: () => shared.userService };
});

const { default: UsersPage } = await import('@/app/(portal)/users/page');

const list = vi.spyOn(harness.userService, 'list');

async function outcomeOf(): Promise<string> {
  try {
    await UsersPage();
    return 'renders';
  } catch (error) {
    return error instanceof Error ? error.message : 'unknown';
  }
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  list.mockClear();
});

describe('QLT-69: the role is checked before the list is read', () => {
  it.each(['LEAD', 'ENGINEER'] as const)('a %s is refused and the list service is not called', async (role) => {
    harness.signInAs(role);
    expect(await outcomeOf()).toBe(FORBIDDEN_SIGNAL);
    expect(list).not.toHaveBeenCalled();
  });

  it('a signed-out visitor is sent to sign-in and the list service is not called', async () => {
    harness.signInAs(null);
    expect(await outcomeOf()).toMatch(new RegExp(`^${REDIRECT_PREFIX}/sign-in`));
    expect(list).not.toHaveBeenCalled();
  });

  it('the Admin gets the page, and the list is read once', async () => {
    harness.signInAs('ADMIN');
    expect(await outcomeOf()).toBe('renders');
    expect(list).toHaveBeenCalledTimes(1);
  });
});
