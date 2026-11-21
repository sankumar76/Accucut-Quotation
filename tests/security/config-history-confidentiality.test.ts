import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.07 AC-6 (NFR-002) and AC-7: a configuration entry holds a formula, which is Restricted data, and the audit log is the Admin's alone. This writes
 * one configuration entry with a sentinel in its formula through the real audit service and then asks for the log the way each caller can: `GET /api/v1/audit`
 * (the Admin gets the entry, a Lead and an Engineer are 403 and a signed-out caller 401) and the page `/audit` (403 for a Lead and an Engineer, the sign-in page
 * for a signed-out visitor). In no byte of a refused answer is the sentinel. The log has no route that writes (`GET` is its one method).
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
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
  };
});

const ORIGIN = 'https://portal.example.test';
const SENTINEL = 'INVENTED-SENTINEL-FORMULA-4F1C9';
const routeModule = await import('@/app/api/v1/audit/route');
const { default: AuditPage } = await import('@/app/(portal)/audit/page');

function get(): Promise<Response> {
  return routeModule.GET(new Request(`${ORIGIN}/api/v1/audit?category=config_change`, { method: 'GET', headers: { origin: ORIGIN } }));
}

/** The page as the server renders it: the props of the screen, as JSON, which is what reaches the browser. */
async function pageBytes(): Promise<string> {
  return JSON.stringify(await AuditPage());
}

beforeAll(async () => {
  holdSessionClock();
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await harness.auditWorld.transactions.run((tx) =>
    harness.auditService.record(tx, {
      event: 'config.formula_changed',
      actorId: harness.idOf.ADMIN,
      actorLabel: 'Invented Admin',
      requestId: 'req-0a0b0c0d',
      object: { id: harness.targetId, label: 'AL Cutting Cost' },
      before: { formula: `P * ${SENTINEL}` },
      after: { formula: `P * ${SENTINEL} * 2`, version: 3 },
    }),
  );
});
afterAll(releaseSessionClock);

describe('AC-6: GET /api/v1/audit with a configuration entry present', () => {
  it('gives the Admin the entry, with the formula, its kind and the words of old to new', async () => {
    harness.signInAs('ADMIN');
    const response = await get();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain(SENTINEL);
    expect(text).toContain('Formula edit');
  });

  it.each([
    ['LEAD', 403],
    ['ENGINEER', 403],
  ] as const)('refuses a %s with %i, and the sentinel is in no byte of the answer or its headers', async (role, status) => {
    harness.signInAs(role);
    const response = await get();
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain(SENTINEL);
    expect([...response.headers.values()].join('\n')).not.toContain(SENTINEL);
  });

  it('refuses a signed-out caller with 401, and the sentinel is in no byte of the answer', async () => {
    harness.signInAs(null);
    const response = await get();
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(SENTINEL);
  });
});

describe('AC-6: the page /audit with a configuration entry present', () => {
  it('gives the Admin the page, with the entry in the first page of the log', async () => {
    harness.signInAs('ADMIN');
    expect(await pageBytes()).toContain(SENTINEL);
  });

  it.each(['LEAD', 'ENGINEER'] as const)('refuses a %s with the no-access page (403), and nothing of the entry is read', async (role) => {
    harness.signInAs(role);
    await expect(AuditPage()).rejects.toThrow(FORBIDDEN_SIGNAL);
  });

  it('sends a signed-out visitor to sign-in', async () => {
    harness.signInAs(null);
    await expect(AuditPage()).rejects.toThrow(new RegExp(`^${REDIRECT_PREFIX}/sign-in`));
  });
});

describe('AC-7: a record, not a control', () => {
  it('exports GET and nothing else from the audit route, so no request can edit or delete an entry', () => {
    expect(
      Object.keys(routeModule)
        .filter((name) => /^[A-Z]+$/.test(name))
        .sort(),
    ).toEqual(['GET']);
  });

  it('has no method of the audit service that changes or removes an entry', () => {
    expect(Object.keys(harness.auditService).sort()).toEqual(['list', 'record']);
  });
});
