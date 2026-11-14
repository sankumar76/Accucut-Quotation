import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.01 AC-4 and AC-5 at the page: `/config/fields` checks the role first, tells the screen to be "View only" for every role but the Admin, and reads nothing itself (a formula
 * is Restricted, so the screen asks the route after it has opened). An Engineer gets SCR-26 and a signed-out visitor is sent to sign-in, with no read of the configuration at all.
 * Every name is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getConfigReadService: () => shared.configReadService };
});

const { default: FieldsPage, metadata } = await import('@/app/(portal)/config/fields/page');
const { FieldsScreen } = await import('@/components/features/config/fields-screen');

const getFields = vi.spyOn(harness.configReadService, 'getFields');
const getCurrent = vi.spyOn(harness.configReadService, 'getCurrent');

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  getFields.mockClear();
  getCurrent.mockClear();
});

describe('the page of SCR-17', () => {
  it('has the title and the description of the screen', () => {
    expect(metadata.title).toBe('Fields and formulas');
    expect(typeof metadata.description).toBe('string');
  });

  it.each([
    ['ADMIN', false],
    ['LEAD', true],
  ] as const)('opens for a %s with viewOnly %s, and reads nothing itself', async (role, viewOnly) => {
    harness.signInAs(role);
    const element = await FieldsPage();
    expect(element.type).toBe(FieldsScreen);
    expect(element.props).toEqual({ viewOnly });
    expect(getFields).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('refuses an Engineer with "no access" and a signed-out visitor with a redirect to sign-in', async () => {
    harness.signInAs('ENGINEER');
    await expect(FieldsPage()).rejects.toThrow(FORBIDDEN_SIGNAL);
    harness.signInAs(null);
    await expect(FieldsPage()).rejects.toThrow(new RegExp(`^${REDIRECT_PREFIX}/sign-in`));
    expect(getFields).not.toHaveBeenCalled();
  });
});
