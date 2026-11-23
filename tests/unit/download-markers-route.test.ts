import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { DownloadMarkerFacts } from '@/lib/export/download-marker';
import type { DownloadRepository } from '@/server/repositories/download-repository';
import { createDownloadMarkerService } from '@/server/services/download-marker-service';

import { fixedForbiddenProblem } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-CR01.7E AC-5, AC-6 (NFR-002; architecture section 4.12 d), through the real `withRoute`, the real session and the real marker service over a fake download repository: `GET /api/v1/download-markers?ids=` answers a Lead
 * and an Admin with the marker of each task's estimate, and an Engineer with the fixed 403 **before the query is read**, with nothing looked up. Nobody signed in gets 401, and an ID that is not a task ID is a 422. Who may
 * call on every route is `tests/security/role-matrix.test.ts`. Every name and ID is invented.
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

const TASK_A = '00000000-0000-4000-8000-0000000d0e0a';
const TASK_B = '00000000-0000-4000-8000-0000000d0e0b';
const APPROVAL = '00000000-0000-4000-8000-0000000ab001';
const LAST = { approvalId: APPROVAL, byName: 'Invented Lead', at: new Date('2026-11-23T04:30:00.000Z') };

const findMarkerFacts = vi.fn<DownloadRepository['findMarkerFacts']>();
const findMarkerFactsOfTasks = vi.fn<DownloadRepository['findMarkerFactsOfTasks']>();
const FACTS: Record<string, DownloadMarkerFacts> = {
  [TASK_A]: { count: 2, last: LAST, latestApprovalId: APPROVAL },
  [TASK_B]: { count: 1, last: LAST, latestApprovalId: '00000000-0000-4000-8000-0000000ab002' },
};

vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getDownloadMarkerService: () => createDownloadMarkerService({ downloads: { findMarkerFacts, findMarkerFactsOfTasks } }),
  };
});

const route = await import('@/app/api/v1/download-markers/route');
const ORIGIN = 'https://portal.example.test';
const get = (query: string) => route.GET(new Request(`${ORIGIN}/api/v1/download-markers${query}`), { params: Promise.resolve({}) });
const record = z.record(z.string(), z.unknown());

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  findMarkerFacts.mockReset();
  findMarkerFactsOfTasks.mockReset();
  findMarkerFactsOfTasks.mockImplementation((ids) => Promise.resolve(ids.flatMap((taskId) => (FACTS[taskId] === undefined ? [] : [{ taskId, facts: FACTS[taskId] }]))));
  harness.signInAs('LEAD');
});

describe('AC-5: the markers of a page of the Closed tab', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s: 200, one marker for each task that exists, with the count and the last person and time, and no ID of an estimate', async (role) => {
    harness.signInAs(role);
    const response = await get(`?ids=${TASK_A},${TASK_B},00000000-0000-4000-8000-0000000d0e0c`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      markers: [
        { taskId: TASK_A, marker: { kind: 'downloaded', count: 2, last: { byName: 'Invented Lead', at: '2026-11-23T04:30:00.000Z' } } },
        { taskId: TASK_B, marker: { kind: 'changed', count: 1, last: { byName: 'Invented Lead', at: '2026-11-23T04:30:00.000Z' } } },
      ],
    });
  });

  it('answers "none" for an estimate nobody downloaded', async () => {
    findMarkerFactsOfTasks.mockResolvedValue([{ taskId: TASK_A, facts: { count: 0, last: null, latestApprovalId: null } }]);
    expect(await (await get(`?ids=${TASK_A}`)).json()).toEqual({ markers: [{ taskId: TASK_A, marker: { kind: 'none' } }] });
  });

  it.each([['no ids', ''], ['an empty list', '?ids='], ['an ID that is not a UUID', '?ids=invented-id'], ['a key that is not named', `?ids=${TASK_A}&estimateId=x`]])('%s is a 422 and nothing is read', async (_title, query) => {
    const response = await get(query);
    expect(response.status).toBe(422);
    expect(findMarkerFactsOfTasks).not.toHaveBeenCalled();
  });

  it('refuses more than a page of the queue (200 IDs)', async () => {
    const ids = Array.from({ length: 201 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    expect((await get(`?ids=${ids.join(',')}`)).status).toBe(422);
    expect(findMarkerFactsOfTasks).not.toHaveBeenCalled();
  });

  it('is a read: the route exports GET and no other method', () => {
    expect(Object.keys(route).filter((name) => /^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(name))).toEqual(['GET']);
  });
});

describe('AC-6 (NFR-002): an Engineer and nobody get nothing', () => {
  it('an Engineer gets the fixed 403 before the query is read, even for a query that is wrong, and the log is never read', async () => {
    harness.signInAs('ENGINEER');
    for (const query of [`?ids=${TASK_A}`, '', '?ids=invented-id']) {
      const response = await get(query);
      expect(response.status, query).toBe(403);
      expect(fixedForbiddenProblem({ label: query, url: `${ORIGIN}/api/v1/download-markers${query}`, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() }), query).toBeNull();
    }
    expect(findMarkerFactsOfTasks).not.toHaveBeenCalled();
    expect(findMarkerFacts).not.toHaveBeenCalled();
  });

  it('nobody signed in gets 401 and nothing is read', async () => {
    harness.signInAs(null);
    const response = await get(`?ids=${TASK_A}`);
    expect(response.status).toBe(401);
    expect(record.parse(await response.json())).toMatchObject({ status: 401 });
    expect(findMarkerFactsOfTasks).not.toHaveBeenCalled();
  });
});
