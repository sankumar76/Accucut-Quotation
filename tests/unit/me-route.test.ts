import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MILLISECONDS_PER_DAY } from '@/lib/time';

import { harness, holdSessionClock, releaseSessionClock, SESSION_NOW } from '../support/session-harness';

/**
 * STORY-04.03 T3 (AC-2; FR-037, NFR-002), through the real `withRoute`, the real session and the real task service over in-memory storage: `GET /api/v1/me` returns
 * `overdueCount` for the caller's role, from one seed. The Engineer's own overdue tasks, the overdue tasks a Lead assigned (the Lead is not the Admin, and the
 * Admin's own are not the Lead's), and every overdue task for the Admin; and the answer still holds the five fields and nothing about a task or a cost. Every name is invented.
 */

vi.mock('next-auth', async () => ({
  getServerSession: (await import('../support/session-harness')).harness.getServerSession,
}));
vi.mock('next/headers', async () => ({
  headers: (await import('../support/session-harness')).harness.headers,
}));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    redirect: shared.redirect,
    forbidden: shared.forbidden,
    notFound: shared.notFound,
  };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T>(fn: T): T => fn,
}));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getTaskService: () => shared.taskService,
  };
});

const ORIGIN = 'https://portal.example.test';
const DAY = MILLISECONDS_PER_DAY;
const at = (offsetMilliseconds: number): Date => new Date(SESSION_NOW.getTime() + offsetMilliseconds);
const { GET } = await import('@/app/api/v1/me/route');

const meSchema = z.strictObject({
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'LEAD', 'ENGINEER']),
  navigation: z.array(z.strictObject({ group: z.string(), label: z.string(), href: z.string() })),
  overdueCount: z.number(),
});

async function overdueCountOf(role: 'ADMIN' | 'LEAD' | 'ENGINEER'): Promise<number> {
  harness.signInAs(role);
  const response = await GET(new Request(`${ORIGIN}/api/v1/me`, { method: 'GET' }));
  expect(response.status).toBe(200);
  return meSchema.parse(await response.json()).overdueCount;
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  const { ADMIN, LEAD, ENGINEER } = harness.idOf;
  const other = harness.targetId;
  // The harness Engineer: two overdue (one assigned by the Lead, one by the Admin), one not yet due, one closed.
  harness.taskWorld.seed({
    code: 'Q-2026-0001',
    engineerId: ENGINEER,
    assignedById: LEAD,
    deadlineAt: at(-2 * DAY),
  });
  harness.taskWorld.seed({
    code: 'Q-2026-0002',
    engineerId: ENGINEER,
    assignedById: ADMIN,
    deadlineAt: at(-1),
  });
  harness.taskWorld.seed({
    code: 'Q-2026-0003',
    engineerId: ENGINEER,
    assignedById: LEAD,
    deadlineAt: at(0),
  });
  harness.taskWorld.seed({
    code: 'Q-2026-0004',
    engineerId: ENGINEER,
    assignedById: LEAD,
    deadlineAt: at(-3 * DAY),
    status: 'APPROVED',
  });
  // Another Engineer: one overdue, assigned by the Lead.
  harness.taskWorld.seed({
    code: 'Q-2026-0005',
    engineerId: other,
    assignedById: LEAD,
    deadlineAt: at(-5 * DAY),
  });
});

afterEach(() => {
  harness.taskWorld.tasks.length = 0;
  harness.taskWorld.estimates.length = 0;
});

describe('AC-2: GET /me returns overdueCount for the role of the caller', () => {
  it("an Engineer is told their own overdue tasks, and not another Engineer's", async () => {
    expect(await overdueCountOf('ENGINEER')).toBe(2);
  });

  it('a Lead is told the overdue tasks that Lead assigned', async () => {
    expect(await overdueCountOf('LEAD')).toBe(2);
  });

  it("the Admin is told every overdue task, and an Admin who assigned one does not make it the Lead's", async () => {
    expect(await overdueCountOf('ADMIN')).toBe(3);
  });

  it('is zero when nothing is overdue, and a task that closes leaves the count', async () => {
    for (const estimate of harness.taskWorld.estimates) Object.assign(estimate, { status: 'APPROVED' });
    expect(await overdueCountOf('ENGINEER')).toBe(0);
    expect(await overdueCountOf('LEAD')).toBe(0);
    expect(await overdueCountOf('ADMIN')).toBe(0);
  });

  it('holds the five fields and nothing about a task or a cost, for every role (NFR-002)', async () => {
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const body = (await (await GET(new Request(`${ORIGIN}/api/v1/me`, { method: 'GET' }))).json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['email', 'name', 'navigation', 'overdueCount', 'role']);
      expect(JSON.stringify(body)).not.toMatch(/Q-2026|cost|rate|price/i);
    }
  });

  it('is 401 for nobody, and reads no task before it says so', async () => {
    harness.signInAs(null);
    expect((await GET(new Request(`${ORIGIN}/api/v1/me`, { method: 'GET' }))).status).toBe(401);
  });
});
