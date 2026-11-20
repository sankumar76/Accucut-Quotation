import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHeartbeatRepository, type HeartbeatRepository } from '@/server/repositories/job-run-repository';

import { openAuthDatabase, type AuthDatabase } from '../support/auth-database';

/**
 * STORY-10.09a AC-6 (NFR-012): the real `GET /api/health` route over the real `job_runs` table and the real repository (no stub of the read), with the clock controlled. A
 * heartbeat finished 2 min 59 s ago is 200; one 3 min 1 s old, none at all, and a database that has gone are 503. The body is the same two words whichever check failed.
 */

let db: AuthDatabase;
let repository: HeartbeatRepository;
const composition = vi.hoisted(() => ({ repository: undefined as undefined | HeartbeatRepository }));
vi.mock('@/server/composition', () => ({
  getHeartbeatRepository: () => {
    if (composition.repository === undefined) throw new Error('no repository');
    return composition.repository;
  },
}));

const { GET } = await import('@/app/api/health/route');

const NOW = new Date('2026-11-19T10:00:00.000Z');

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createHeartbeatRepository(db.prisma);
  composition.repository = repository;
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.owner.query('DELETE FROM job_runs');
  // Only Date is faked: the database driver keeps its real timers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

async function heartbeatFinished(secondsAgo: number, job = 'heartbeat'): Promise<void> {
  const finished = new Date(NOW.getTime() - secondsAgo * 1000);
  await db.owner.query("INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ($1, $2, $2, '{\"status\":\"ok\"}'::jsonb)", [job, finished]);
}

describe('GET /api/health over the real heartbeat rows (AC-6)', () => {
  it('[AC-6] answers 200 {status:ok} for a heartbeat that finished 2 min 59 s ago', async () => {
    await heartbeatFinished(179);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('[AC-6] answers 503 {status:unavailable} for a heartbeat that finished 3 min 1 s ago', async () => {
    await heartbeatFinished(181);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('[AC-6] answers 503 when there is no heartbeat at all, even with other jobs recent (a backup row is not a heartbeat)', async () => {
    await heartbeatFinished(1, 'backup-watch');
    await heartbeatFinished(1, 'backup');
    expect((await GET()).status).toBe(503);
  });

  it('[AC-6] reads the newest heartbeat: an old row beside a fresh one is 200, and a fresh row of another job beside only an old heartbeat is 503', async () => {
    await heartbeatFinished(3_600);
    await heartbeatFinished(30);
    expect((await GET()).status).toBe(200);
    await db.owner.query('DELETE FROM job_runs');
    await heartbeatFinished(3_600);
    await heartbeatFinished(5, 'outbox-send');
    expect((await GET()).status).toBe(503);
  });

  it('[AC-6] answers 503 and says only unavailable when the database is down, with no error text, connection detail or count in the body', async () => {
    composition.repository = {
      latestHeartbeatAt: () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432 password authentication failed for user "accucut_app"')),
      pruneHeartbeatRuns: () => Promise.reject(new Error('down')),
    };
    try {
      const response = await GET();
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ status: 'unavailable' });
      expect(text).not.toMatch(/ECONNREFUSED|password|127\.0\.0\.1|accucut_app|[0-9]+ row/);
    } finally {
      composition.repository = repository;
    }
  });

  it('[AC-6] the 503 for a dead worker and the 503 for a down database are the same bytes, so the body never says which check failed', async () => {
    await heartbeatFinished(600);
    const stale = await (await GET()).text();
    composition.repository = { latestHeartbeatAt: () => Promise.reject(new Error('down')), pruneHeartbeatRuns: () => Promise.resolve(0) };
    try {
      expect(await (await GET()).text()).toBe(stale);
    } finally {
      composition.repository = repository;
    }
  });
});
