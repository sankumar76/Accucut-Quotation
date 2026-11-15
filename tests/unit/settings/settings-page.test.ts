import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, JOB_RUN_CANARY_PATH, JOB_RUN_CANARY_VOLUME, REDIRECT_PREFIX, releaseSessionClock } from '../../support/session-harness';

/**
 * STORY-02.09 AC-1, AC-5 and AC-6 at the page and the route: `/settings` and `GET /api/v1/settings` check the role first and read `job_runs` only for the Admin. A Lead and an Engineer
 * get SCR-26 and the fixed 403, a signed-out visitor a redirect and a 401, and none of them causes a read. What the Admin is sent holds the date, the free percentage and the age, and
 * never the path or the volume name the invented rows carry in `result`. Every name is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getSettingsService: () => shared.settingsService };
});

const { default: SettingsPage, metadata } = await import('@/app/(portal)/settings/page');
const { GET } = await import('@/app/api/v1/settings/route');

const goodBackup = vi.spyOn(harness.jobRuns, 'latestGoodBackupAt');
const diskReading = vi.spyOn(harness.jobRuns, 'latestDiskReading');

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  goodBackup.mockClear();
  diskReading.mockClear();
});

const ORIGIN = 'https://portal.example.test';
const request = (): Request => new Request(`${ORIGIN}/api/v1/settings`, { method: 'GET', headers: { origin: ORIGIN } });
const noRead = (): void => {
  expect(goodBackup).not.toHaveBeenCalled();
  expect(diskReading).not.toHaveBeenCalled();
};

describe('the page of SCR-15', () => {
  it('has the title and a description of the screen', () => {
    expect(metadata.title).toBe('Settings');
    expect(typeof metadata.description).toBe('string');
  });

  it('opens for the Admin with the last good backup two days old (not late) and a reading of 62 % free an hour ago, and shows no path or volume name', async () => {
    harness.signInAs('ADMIN');
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain('Last good backup');
    // The harness clock is 2026-11-05 09:00 UTC and the good backup finished two days before: Tuesday 03 Nov 2026, 14:30 IST.
    expect(html).toContain('Tuesday 03 Nov 2026, 14:30 IST. Finished without errors.');
    expect(html).toContain('62 % free. Read 1 hour ago.');
    expect(html).not.toContain('Backup late');
    expect(html).not.toContain('Disk nearly full');
    expect(html).toContain('Backups are kept on the same server.');
    expect(html).not.toContain(JOB_RUN_CANARY_PATH);
    expect(html).not.toContain(JOB_RUN_CANARY_VOLUME);
    expect(html).not.toContain('InventedBackupFolder');
  });

  it('refuses a Lead and an Engineer with "no access", and a signed-out visitor with a redirect to sign-in, and reads nothing', async () => {
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      await expect(SettingsPage()).rejects.toThrow(FORBIDDEN_SIGNAL);
    }
    harness.signInAs(null);
    await expect(SettingsPage()).rejects.toThrow(new RegExp(`^${REDIRECT_PREFIX}/sign-in`));
    noRead();
  });
});

describe('GET /api/v1/settings (AC-1, AC-4, AC-5, AC-6)', () => {
  it('answers the Admin with the strict shape, and none of the extra keys of the rows', async () => {
    harness.signInAs('ADMIN');
    const response = await GET(request());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      lastGoodBackupAt: '2026-11-03T09:00:00.000Z',
      backupLate: false,
      diskReading: { freePercent: 62, readAt: '2026-11-05T08:00:00.000Z', ageSeconds: 3600, stale: false },
      diskNearlyFull: false,
    });
    expect(text).not.toContain(JOB_RUN_CANARY_PATH.replaceAll('\\', '\\\\'));
    expect(text).not.toContain(JOB_RUN_CANARY_VOLUME);
  });

  it.each([
    ['LEAD', 403],
    ['ENGINEER', 403],
    [null, 401],
  ] as const)('answers %s with %s and reads nothing', async (role, status) => {
    harness.signInAs(role);
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    noRead();
  });
});
