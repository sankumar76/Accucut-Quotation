import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '@/server/auth/session';

/**
 * STORY-01.02 AC-4 (STD-09): a page checks the person and the role itself. Signed out goes to sign-in, a role the row does
 * not list gets `forbidden()` before the page reads anything, and a path that is not a page of the manifest is a mistake.
 */

const mocks = vi.hoisted(() => ({
  requireUserOrRedirect: vi.fn(),
  forbidden: vi.fn((): never => {
    throw new Error('NEXT_FORBIDDEN');
  }),
}));

vi.mock('@/server/auth/session', () => ({ requireUserOrRedirect: mocks.requireUserOrRedirect }));
vi.mock('next/navigation', () => ({ forbidden: mocks.forbidden }));

const { authorizePage } = await import('@/server/http/page-access');

function person(role: AuthenticatedUser['role']): AuthenticatedUser {
  return { id: `u-${role}`, name: 'Invented Person', email: 'person@example.test', role, mustChangePassword: false };
}

beforeEach(() => {
  mocks.requireUserOrRedirect.mockReset();
  mocks.forbidden.mockClear();
});

describe('authorizePage', () => {
  it('returns the person when their role is listed', async () => {
    mocks.requireUserOrRedirect.mockResolvedValue(person('ENGINEER'));
    expect((await authorizePage('/queue')).role).toBe('ENGINEER');
    expect(mocks.forbidden).not.toHaveBeenCalled();
  });

  it('lets the sign-in redirect through for a signed-out visitor, and never reaches the role check', async () => {
    mocks.requireUserOrRedirect.mockRejectedValue(new Error('NEXT_REDIRECT:/sign-in'));
    await expect(authorizePage('/queue')).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(mocks.forbidden).not.toHaveBeenCalled();
  });

  it('refuses a role the row does not list with forbidden(), also for a planned page', async () => {
    // `/users` is planned and Admin only: the check reads the row, not the file, so the page that arrives cannot forget it.
    mocks.requireUserOrRedirect.mockResolvedValue(person('LEAD'));
    await expect(authorizePage('/users')).rejects.toThrow('NEXT_FORBIDDEN');
    mocks.requireUserOrRedirect.mockResolvedValue(person('ENGINEER'));
    await expect(authorizePage('/assign')).rejects.toThrow('NEXT_FORBIDDEN');
    expect(mocks.forbidden).toHaveBeenCalledTimes(2);
  });

  it('lets an Admin open an Admin page', async () => {
    mocks.requireUserOrRedirect.mockResolvedValue(person('ADMIN'));
    expect((await authorizePage('/users')).role).toBe('ADMIN');
  });

  it('is a mistake to ask for a path that is not a page of the manifest', async () => {
    await expect(authorizePage('/not-a-page')).rejects.toThrow('not a page in the route manifest');
    await expect(authorizePage('/api/v1/me')).rejects.toThrow('not a page in the route manifest');
    expect(mocks.requireUserOrRedirect).not.toHaveBeenCalled();
  });

  it('is a mistake to ask for a public page, which needs no session', async () => {
    await expect(authorizePage('/sign-in')).rejects.toThrow('public page');
  });
});
