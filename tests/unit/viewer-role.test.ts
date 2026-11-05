import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseBusyError } from '@/lib/errors';

/**
 * UX spec v0.12, SCR-26: the role that names the button of the "no access" and "not found" pages. It is read, never
 * decided on; a role that cannot be read gives `null` (the neutral "Go to the task list") and a warning with the kind of
 * failure, not its message (STD-01); Next.js's own control-flow errors are let through.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  warn: vi.fn(),
  unstableRethrow: vi.fn((error: unknown): void => {
    if (error instanceof Error && error.message.startsWith('NEXT_')) throw error;
  }),
}));

vi.mock('@/server/auth/session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn } }));
vi.mock('next/navigation', () => ({ unstable_rethrow: mocks.unstableRethrow }));

const { readViewerRole } = await import('@/server/auth/viewer-role');

beforeEach(() => {
  mocks.getCurrentUser.mockReset();
  mocks.warn.mockClear();
});

describe('readViewerRole', () => {
  it.each(['ADMIN', 'LEAD', 'ENGINEER'] as const)('is the role of the signed-in person: %s', async (role) => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u', name: 'n', email: 'e@example.test', role, mustChangePassword: false });
    expect(await readViewerRole()).toBe(role);
  });

  it('is null when nobody is signed in', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await readViewerRole()).toBeNull();
  });

  it('is null when the role cannot be read, and the warning names the kind of failure and no message', async () => {
    mocks.getCurrentUser.mockRejectedValue(new DatabaseBusyError({ cause: new Error('timeout for ada.lovelace@example.test') }));
    expect(await readViewerRole()).toBeNull();
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    const logged = mocks.warn.mock.calls[0];
    expect(logged?.[0]).toEqual({ errorName: 'DatabaseBusyError', errorCode: 'DATABASE_BUSY' });
    expect(JSON.stringify(logged)).not.toContain('ada.lovelace');
  });

  it('is null for a failure that is not an application error', async () => {
    mocks.getCurrentUser.mockRejectedValue('boom');
    expect(await readViewerRole()).toBeNull();
    expect(mocks.warn.mock.calls[0]?.[0]).toEqual({ errorName: 'NonError', errorCode: undefined });
  });

  it('lets a Next.js control-flow error through, so a dynamic page is not built once for everyone', async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error('NEXT_PRERENDER_INTERRUPTED'));
    await expect(readViewerRole()).rejects.toThrow('NEXT_PRERENDER_INTERRUPTED');
    expect(mocks.warn).not.toHaveBeenCalled();
  });
});
