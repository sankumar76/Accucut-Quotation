import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../../support/session-harness';

/**
 * STORY-04.07 (AC-3, AC-4, AC-6, AC-7), through the real `withRoute`, the real session and the real task service over in-memory storage: `PATCH /api/v1/tasks/{id}`
 * answers the task as the queue shows it with no cost, refuses an Engineer with 403 and a signed-out caller with 401 before the task is read, answers 404 for an ID that is no
 * task, 409 `TASK_CLOSED` for an approved one and 422 under the field, and records who changed it. Who may call is also `tests/security`. Every name and ID is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getTaskService: () => shared.taskService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { PATCH } = await import('@/app/api/v1/tasks/[id]/route');

const record = z.record(z.string(), z.unknown());

function request(body?: unknown): Request {
  return new Request(`${ORIGIN}/api/v1/tasks/x`, {
    method: 'PATCH',
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
/** The harness's spare Engineer, active, who is not the one the new task is given to first. */
const spare = (): string => harness.targetId;
const DEADLINE = new Date('2099-01-01T04:30:00.000Z');
const LATER = '2099-02-01T04:30:00.000Z';

let taskId: string;
const stored = () => defined(harness.taskWorld.tasks.find((task) => task.id === taskId));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
  harness.taskAudit.rows.length = 0;
  taskId = harness.taskWorld.seed({ code: `Q-9999-${String(harness.taskWorld.tasks.length).padStart(4, '0')}`, engineerId: harness.idOf.ENGINEER, assignedById: harness.idOf.LEAD, deadlineAt: DEADLINE }).id;
});

describe('AC-3: a Lead and an Admin change a task and are answered with the task as the queue shows it', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: 200, no-store, the new Engineer, and exactly the keys of a row of the queue', async (role) => {
    harness.signInAs(role);
    const response = await PATCH(request({ engineerId: spare(), deadlineAt: LATER }), withId(taskId));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = record.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'status', 'title']);
    expect(body).toMatchObject({ id: taskId, engineer: { id: spare() }, deadlineAt: LATER, status: 'DRAFT' });
    expect(JSON.stringify(body)).not.toMatch(/price|cost|rate|approver|formula|total|amount|₹/i);
    expect(stored()).toMatchObject({ engineerId: spare(), deadlineAt: new Date(LATER), assignmentRevision: 2 });
  });

  it('an empty body changes nothing and answers 200 with the task', async () => {
    const response = await PATCH(request({}), withId(taskId));
    expect(response.status).toBe(200);
    expect(stored()).toMatchObject({ engineerId: harness.idOf.ENGINEER, deadlineAt: DEADLINE, assignmentRevision: 1 });
    expect(harness.taskAudit.rows).toHaveLength(0);
  });

  it('refuses a key the route does not offer, and stores nothing (a client cannot set the assigner, the revision or the folder)', async () => {
    for (const extra of [{ assignedById: harness.idOf.ADMIN }, { assignmentRevision: 9 }, { folderPath: '\\\\a\\b' }, { deadline: '2099-02-01T10:00' }]) {
      const response = await PATCH(request({ engineerId: spare(), ...extra }), withId(taskId));
      expect(response.status, JSON.stringify(extra)).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    expect(stored()).toMatchObject({ engineerId: harness.idOf.ENGINEER, assignedById: harness.idOf.LEAD, assignmentRevision: 1 });
  });

  it('refuses a body that is missing, and a value that is not text', async () => {
    expect((await PATCH(request(), withId(taskId))).status).toBe(400);
    expect((await PATCH(request({ engineerId: 5 }), withId(taskId))).status).toBe(422);
    expect((await PATCH(request({ deadlineAt: null }), withId(taskId))).status).toBe(422);
    expect(stored().assignmentRevision).toBe(1);
  });

  it('a deadline that is not later than now is 422 "Choose a deadline later than now." under deadlineAt, whatever the browser said', async () => {
    const response = await PATCH(request({ deadlineAt: '2000-01-01T00:00:00.000Z' }), withId(taskId));
    expect(response.status).toBe(422);
    expect(JSON.stringify(record.parse(await response.json()))).toContain('Choose a deadline later than now.');
    expect(stored().deadlineAt).toEqual(DEADLINE);
  });

  it('an Engineer who is not an active Engineer is 422 "Choose an Engineer."', async () => {
    const response = await PATCH(request({ engineerId: harness.idOf.LEAD }), withId(taskId));
    expect(response.status).toBe(422);
    expect(JSON.stringify(record.parse(await response.json()))).toContain('Choose an Engineer.');
    expect(stored().engineerId).toBe(harness.idOf.ENGINEER);
  });
});

describe('AC-4: the entry says who changed it', () => {
  it('records the name of the Admin who saved, on the request, about the task code', async () => {
    harness.signInAs('ADMIN');
    const response = await PATCH(request({ engineerId: spare() }), withId(taskId));
    expect(response.status).toBe(200);
    expect(harness.taskAudit.rows).toHaveLength(1);
    expect(harness.taskAudit.rows[0]).toMatchObject({ event: 'task.reassigned', actorId: harness.idOf.ADMIN, objectId: taskId, objectLabel: stored().code });
    expect(harness.taskAudit.rows[0]?.requestId).toBe(response.headers.get('X-Request-Id'));
  });
});

describe('AC-6: an approved task is 409 TASK_CLOSED', () => {
  it('refuses, with the code the form compares with, and stores nothing', async () => {
    harness.taskWorld.setStatus(taskId, 'APPROVED');
    const response = await PATCH(request({ engineerId: spare() }), withId(taskId));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())).toMatchObject({ code: 'TASK_CLOSED' });
    expect(stored().engineerId).toBe(harness.idOf.ENGINEER);
    expect(harness.taskAudit.rows).toHaveLength(0);
  });
});

describe('AC-7: 403, 401, 404, in that order and before the task is read', () => {
  it('an Engineer is 403, for the task and for an ID that does not exist alike: the task is never looked at', async () => {
    harness.signInAs('ENGINEER');
    expect((await PATCH(request({ engineerId: spare() }), withId(taskId))).status).toBe(403);
    expect((await PATCH(request({ engineerId: spare() }), withId(UNKNOWN_ID))).status).toBe(403);
    expect((await PATCH(request({ engineerId: spare() }), withId('not-an-id'))).status).toBe(403);
    expect(stored().engineerId).toBe(harness.idOf.ENGINEER);
  });

  it('a signed-out caller is 401', async () => {
    harness.signInAs(null);
    expect((await PATCH(request({ engineerId: spare() }), withId(taskId))).status).toBe(401);
    expect(stored().engineerId).toBe(harness.idOf.ENGINEER);
  });

  it.each([UNKNOWN_ID, 'not-an-id'])('a Lead asking for %j is 404', async (id) => {
    expect((await PATCH(request({ engineerId: spare() }), withId(id))).status).toBe(404);
  });

  it('a Lead who did not assign the task may change it, and so may the Admin (D-f)', async () => {
    const other = harness.taskWorld.seed({ code: 'Q-9999-8001', engineerId: harness.idOf.ENGINEER, assignedById: harness.idOf.ADMIN, deadlineAt: DEADLINE });
    expect((await PATCH(request({ engineerId: spare() }), withId(other.id))).status).toBe(200);
    harness.signInAs('ADMIN');
    expect((await PATCH(request({ engineerId: harness.idOf.ENGINEER }), withId(taskId))).status).toBe(200);
  });

  it('a request from another origin is refused before anything else', async () => {
    const foreign = new Request(`${ORIGIN}/api/v1/tasks/x`, {
      method: 'PATCH',
      headers: { origin: 'https://evil.example.test', 'content-type': 'application/json' },
      body: JSON.stringify({ engineerId: spare() }),
    });
    expect((await PATCH(foreign, withId(taskId))).status).toBe(403);
    expect(stored().engineerId).toBe(harness.idOf.ENGINEER);
  });
});
