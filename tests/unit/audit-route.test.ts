import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ROUTE_MANIFEST } from '@/server/http/route-manifest';

import { defined } from '../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.07 T4 (AC-6, AC-7): the contract of `GET /api/v1/audit`, through the real `withRoute`, the real session, the real
 * audit service and the real user service over in-memory storage. What the query may say, what each refusal says, that the answer
 * holds the words of an entry and never its stored JSON, and that the log has no write route. Who may call is `tests/security`.
 * Every name and address is invented.
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
const routeModule = await import('@/app/api/v1/audit/route');
const { GET } = routeModule;
const record = z.record(z.string(), z.unknown());

function get(query = ''): Promise<Response> {
  return GET(new Request(`${ORIGIN}/api/v1/audit${query}`, { method: 'GET', headers: { origin: ORIGIN } }));
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return record.parse(await response.json());
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
});

describe('AC-6: the answer', () => {
  it('is empty before anything has happened: 200, no entries, a total of zero, no cursor', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    expect(await bodyOf(response)).toEqual({ entries: [], total: 0, nextCursor: null });
  });

  it('holds what the Admin did, newest first, in words, and never the stored before and after', async () => {
    await harness.userService.update({ actorId: harness.idOf.ADMIN, requestId: 'req-0a0b0c0d' }, harness.targetId, { role: 'LEAD' });
    await harness.userService.update({ actorId: harness.idOf.ADMIN, requestId: 'req-0a0b0c0e' }, harness.targetId, { isActive: false });
    const body = await bodyOf(await get());
    expect(body['total']).toBe(2);
    const entries = z.array(record).parse(body['entries']);
    expect(entries.map((entry) => entry['change'])).toEqual([
      { before: 'Active', after: 'Deactivated' },
      { before: 'Engineer', after: 'Lead' },
    ]);
    expect(defined(entries[0])).toMatchObject({ who: 'Invented Admin', event: 'user.deactivated', category: { id: 'user_change', label: 'User change' }, objectLabel: 'Invented Target' });
    for (const entry of entries) expect(Object.keys(entry).sort()).toEqual(['category', 'change', 'createdAt', 'event', 'id', 'objectLabel', 'who']);
  });

  it('filters by the query and pages by the limit and the cursor', async () => {
    const first = await bodyOf(await get('?limit=1'));
    expect(z.array(record).parse(first['entries'])).toHaveLength(1);
    expect(first['total']).toBeGreaterThanOrEqual(2);
    const cursor = z.string().parse(first['nextCursor']);
    const second = await bodyOf(await get(`?limit=1&cursor=${encodeURIComponent(cursor)}`));
    expect(defined(z.array(record).parse(second['entries'])[0])['event']).toBe('user.role_changed');
    expect((await bodyOf(await get(`?category=approval`)))['total']).toBe(0);
    expect((await bodyOf(await get(`?event=user.deactivated&who=${harness.idOf.ADMIN}`)))['total']).toBe(1);
    expect((await bodyOf(await get(`?who=${harness.idOf.LEAD}`)))['total']).toBe(0);
  });
});

describe('AC-6: the query is checked, and a mistake is 422 with the message under the name that is wrong', () => {
  it.each([
    ['a limit of 0', '?limit=0', 'limit'],
    ['a limit over 200', '?limit=201', 'limit'],
    ['a limit that is not a number', '?limit=many', 'limit'],
    ['a person that is not an ID', '?who=Divya', 'who'],
    ['a category that does not exist', '?category=configuration', 'category'],
    ['an event that does not exist', '?event=user.exploded', 'event'],
    ['a date that is not a date', '?from=2026-02-30', 'from'],
    ['a range that ends before it begins', '?from=2026-11-07&to=2026-11-06', 'to'],
    ['a cursor the service did not make', '?cursor=abc', 'cursor'],
    ['a name that is not a filter', '?sort=asc', ''],
  ])('refuses %s', async (_name, query, field) => {
    const response = await get(query);
    expect(response.status).toBe(422);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    const body = await bodyOf(response);
    expect(body['code']).toBe('VALIDATION_FAILED');
    expect(z.array(record).parse(body['errors']).map((error) => error['field'])).toEqual([field]);
  });

  it('accepts a limit of exactly 200 and the default of 50', async () => {
    expect((await get('?limit=200')).status).toBe(200);
    expect((await get()).status).toBe(200);
  });
});

describe('AC-6: the log has no write route', () => {
  it('exports GET and nothing else, so PATCH, PUT, DELETE and POST are answered 405 by Next.js', () => {
    const exported = Object.keys(routeModule)
      .filter((name) => /^[A-Z]+$/.test(name))
      .sort();
    expect(exported).toEqual(['GET']);
  });

  it('is listed in the manifest with GET only, for the Admin only', () => {
    const rows = ROUTE_MANIFEST.filter((row) => row.path === '/api/v1/audit');
    expect(rows).toEqual([{ path: '/api/v1/audit', kind: 'api', methods: ['GET'], roles: ['ADMIN'], status: 'implemented', stage: 'R1' }]);
  });
});
