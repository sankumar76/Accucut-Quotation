import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-04.04 T5 (AC-1, AC-2, AC-3, AC-4, AC-5), through the real `withRoute`, the real session and the real task service over in-memory storage: `GET /api/v1/tasks/{id}`
 * answers one strict shape for an Engineer, a Lead and an Admin, in every state of the estimate; another Engineer's task, a task that does not exist and text that is no
 * ID are the same 404 with the same body; and no key of the answer can hold a figure. Who may call is `tests/security`. Every name and ID is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getTaskService: () => shared.taskService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { GET } = await import('@/app/api/v1/tasks/[id]/route');

const record = z.record(z.string(), z.unknown());

const request = (): Request => new Request(`${ORIGIN}/api/v1/tasks/x`, { method: 'GET' });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
/** The harness Engineer's own task (`session-harness.ts`: its ID is `targetId`, as the scan's recipe names it). */
const owned = (): string => harness.targetId;
const task = () => defined(harness.taskWorld.tasks.find((candidate) => candidate.id === owned()));

const ANSWER_KEYS = ['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'notes', 'status', 'title'];

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
  harness.taskWorld.setStatus(owned(), 'DRAFT');
});

describe('AC-1: the Engineer is told the status of their own task, in every state', () => {
  it.each(['DRAFT', 'SUBMITTED', 'APPROVED'] as const)('a %s estimate answers 200 with that status and the task\'s own fields', async (status) => {
    harness.taskWorld.setStatus(owned(), status);
    const response = await GET(request(), withId(owned()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = record.parse(await response.json());
    expect(body).toMatchObject({ id: owned(), code: task().code, status, title: 'Invented task', notes: 'Invented notes.', customerName: null });
    expect(body['deadlineAt']).toBe('2099-01-01T04:30:00.000Z');
  });

  it('an unlocked task (APPROVED, then DRAFT again) is told as DRAFT at once', async () => {
    harness.taskWorld.setStatus(owned(), 'APPROVED');
    expect(record.parse(await (await GET(request(), withId(owned()))).json())['status']).toBe('APPROVED');
    harness.taskWorld.setStatus(owned(), 'DRAFT');
    expect(record.parse(await (await GET(request(), withId(owned()))).json())['status']).toBe('DRAFT');
  });
});

describe('AC-2, AC-3: one strict answer, with nothing about cost, an approver or a reason', () => {
  it('has exactly the named keys for an approved task, and no key or value that names a figure', async () => {
    harness.taskWorld.setStatus(owned(), 'APPROVED');
    const body = record.parse(await (await GET(request(), withId(owned()))).json());
    expect(Object.keys(body).sort()).toEqual(ANSWER_KEYS);
    expect(JSON.stringify(body)).not.toMatch(/price|cost|rate|approver|approvedBy|approvedAt|override|reason|formula|total|amount|₹/i);
  });

  it.each(['ENGINEER', 'LEAD', 'ADMIN'] as const)('%s is answered with the same keys', async (role) => {
    harness.signInAs(role);
    harness.taskWorld.setStatus(owned(), 'SUBMITTED');
    const response = await GET(request(), withId(owned()));
    expect(response.status).toBe(200);
    expect(Object.keys(record.parse(await response.json())).sort()).toEqual(ANSWER_KEYS);
  });
});

describe('AC-5: a Lead and an Admin are told the same status words as the Engineer', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s reads the Engineer\'s answer, status included, for every state', async (role) => {
    for (const status of ['DRAFT', 'SUBMITTED', 'APPROVED'] as const) {
      harness.taskWorld.setStatus(owned(), status);
      harness.signInAs('ENGINEER');
      const own = record.parse(await (await GET(request(), withId(owned()))).json());
      harness.signInAs(role);
      expect(record.parse(await (await GET(request(), withId(owned()))).json())).toEqual(own);
    }
  });
});

describe('AC-4: another Engineer\'s task is the same 404 as one that does not exist', () => {
  it('answers 404 with the same body, apart from the request ID, for another Engineer\'s task, an unknown ID and text that is no ID', async () => {
    const other = harness.taskWorld.seed({
      code: 'Q-9999-7777',
      engineerId: harness.targetId,
      assignedById: harness.idOf.LEAD,
      deadlineAt: new Date('2099-01-01T04:30:00.000Z'),
      status: 'SUBMITTED',
    });
    const notOwn = await GET(request(), withId(other.id));
    const missing = await GET(request(), withId(UNKNOWN_ID));
    const malformed = await GET(request(), withId('not-an-id'));
    expect([notOwn.status, missing.status, malformed.status]).toEqual([404, 404, 404]);
    const strip = async (response: Response) => {
      const { requestId, ...rest } = record.parse(await response.json());
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      return rest;
    };
    const [a, b, c] = [await strip(notOwn), await strip(missing), await strip(malformed)];
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(JSON.stringify(a)).not.toContain(other.code);
  });

  it('a Lead opens that same task, so it exists: the 404 above is the cut to the Engineer\'s own, not a missing row', async () => {
    const other = harness.taskWorld.seed({
      code: 'Q-9999-7778',
      engineerId: harness.targetId,
      assignedById: harness.idOf.LEAD,
      deadlineAt: new Date('2099-01-01T04:30:00.000Z'),
    });
    harness.signInAs('LEAD');
    expect((await GET(request(), withId(other.id))).status).toBe(200);
  });

  it('a signed-out caller gets 401 and no data', async () => {
    harness.signInAs(null);
    const response = await GET(request(), withId(owned()));
    expect(response.status).toBe(401);
    expect(JSON.stringify(record.parse(await response.json()))).not.toContain(task().code);
  });
});
