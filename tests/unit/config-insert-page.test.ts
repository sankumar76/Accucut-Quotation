import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.03 AC-1 at the page: `/config/fields/new` checks the role first, with its own address, and reads nothing itself (a formula and a rate name are Restricted, so the screen asks the Admin-only routes
 * after it has opened). A Lead and an Engineer get SCR-26 and a signed-out visitor is sent to sign-in, before the address `?after=` is looked at. `?after=` reaches the screen only as a UUID. Every name is invented.
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
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getConfigReadService: () => shared.configReadService,
    getConfigStructureService: () => shared.configStructureService,
  };
});

const { default: InsertFieldPage, metadata } = await import('@/app/(portal)/config/fields/new/page');
const { InsertFieldScreen } = await import('@/components/features/config/insert-field-screen');

const getOptions = vi.spyOn(harness.configStructureService, 'getInsertOptions');
const getFields = vi.spyOn(harness.configReadService, 'getFields');

const COLUMN_ID = '00000000-0000-4000-8000-0000000000f1';
const search = (after?: string | string[]) => Promise.resolve(after === undefined ? {} : { after });

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  getOptions.mockClear();
  getFields.mockClear();
});

describe('the page of SCR-19', () => {
  it('has the title and the description of the screen, and no field name or column in the tab', () => {
    expect(metadata.title).toBe('Insert field');
    expect(typeof metadata.description).toBe('string');
  });

  it('opens for the Admin with no column chosen when the address has none, and reads nothing itself', async () => {
    harness.signInAs('ADMIN');
    const element = await InsertFieldPage({ searchParams: search() });
    expect(element.type).toBe(InsertFieldScreen);
    expect(element.props).toEqual({ afterId: null });
    expect(getOptions).not.toHaveBeenCalled();
    expect(getFields).not.toHaveBeenCalled();
  });

  it('passes ?after= to the screen when it is a UUID (AC-1: "with that column pre-chosen")', async () => {
    harness.signInAs('ADMIN');
    expect((await InsertFieldPage({ searchParams: search(COLUMN_ID) })).props).toEqual({ afterId: COLUMN_ID });
  });

  it.each([['not-a-uuid'], [''], ['00000000-0000-4000-8000-0000000000f1; DROP TABLE x'], [['a', 'b']]])('ignores %j, which names no column', async (value) => {
    harness.signInAs('ADMIN');
    expect((await InsertFieldPage({ searchParams: search(value) })).props).toEqual({ afterId: null });
  });

  it('refuses a Lead and an Engineer with "no access" before the address is looked at, and a signed-out visitor with a redirect to sign-in', async () => {
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      await expect(InsertFieldPage({ searchParams: search(COLUMN_ID) })).rejects.toThrow(FORBIDDEN_SIGNAL);
    }
    harness.signInAs(null);
    await expect(InsertFieldPage({ searchParams: search(COLUMN_ID) })).rejects.toThrow(new RegExp(`^${REDIRECT_PREFIX}/sign-in`));
    expect(getOptions).not.toHaveBeenCalled();
  });
});
