import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAME_REFUSED_CODE, NAME_TAKEN_CODE } from '@/lib/errors';
import { entriesFor } from '../support/audit-database';
import { ORIGIN, call, create, idOf, db, adminId, rowOf, openWorld, closeWorld, entryEvents, setUserId, loadProcessMasterRoutes } from '../support/process-master-api';

/**
 * QA acceptance, AQP-113 (STORY-02.01): two requests at once through the API. A delete and an update of one rate, two deletes, four adds of
 * one name in different letter case, and the two parts of a compound name with the compound. No ordering is asked of the database and
 * nothing waits on a clock.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadProcessMasterRoutes();
});

describe('two requests at once, through the API', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });

  const ROUNDS = 12;

  it.each(Array.from({ length: ROUNDS }, (_, round) => [round]))(
    '[AQP-113 AC-3 AC-4 AC-5] round %i: a PATCH and a DELETE of one rate at once: no 500; the DELETE is 204; the PATCH is 200 or 404; one master.deleted entry, and master.edited exactly when the PATCH succeeded',
    async (round) => {
      const id = idOf(await create(`Qa7-Race-Rate-${round}`));
      const [patch, remove] = await Promise.all([call('PATCH', id, { defaultValue: '2.37' }), call('DELETE', id)]);
      expect(remove.status).toBe(204);
      expect([200, 404]).toContain(patch.status);
      expect(await rowOf(id)).toBeUndefined();
      const events = entryEvents(await entriesFor(db, id)).sort();
      expect(events).toEqual(patch.status === 200 ? ['master.created', 'master.deleted', 'master.edited'] : ['master.created', 'master.deleted']);
    },
  );

  it.each(Array.from({ length: 6 }, (_, round) => [round]))('[AQP-113 AC-4] round %i: two DELETEs of one rate at once: one 204, one 404, one master.deleted entry, no 500', async (round) => {
    const id = idOf(await create(`Qa7-Double-Delete-${round}`));
    const answers = await Promise.all([call('DELETE', id), call('DELETE', id)]);
    expect(answers.map((answer) => answer.status).sort()).toEqual([204, 404]);
    expect(entryEvents(await entriesFor(db, id)).filter((event) => event === 'master.deleted')).toHaveLength(1);
  });

  it.each(Array.from({ length: 6 }, (_, round) => [round]))('[AQP-113 AC-2] round %i: four POSTs of one name in different letter case at once: exactly one 201, the others 422 NAME_TAKEN', async (round) => {
    const variants = [`Qa7-Same-${round}`, `QA7-SAME-${round}`, `qa7-same-${round}`, `Qa7-same-${round}`];
    const answers = await Promise.all(variants.map((name) => create(name)));
    expect(answers.filter((answer) => answer.status === 201)).toHaveLength(1);
    for (const loser of answers.filter((answer) => answer.status !== 201)) {
      expect(loser.status).toBe(422);
      expect(loser.body?.['code']).toBe(NAME_TAKEN_CODE);
    }
  });

  it.each(Array.from({ length: 6 }, (_, round) => [round]))(
    '[AQP-113 DEF-006] round %i: the two parts and their compound added at once: exactly two succeed, one is refused RATE_NAME_REFUSED, whichever it is',
    async (round) => {
      const parts = [`Qa7-P${round}-Cost`, `Qa7-P${round}-Waste`];
      const answers = await Promise.all([...parts, `${parts[0]}-${parts[1]}`].map((name) => create(name)));
      expect(answers.filter((answer) => answer.status === 201)).toHaveLength(2);
      const refused = answers.filter((answer) => answer.status !== 201);
      expect(refused).toHaveLength(1);
      expect(refused[0]?.status).toBe(422);
      expect(refused[0]?.body?.['code']).toBe(NAME_REFUSED_CODE);
    },
  );
});
