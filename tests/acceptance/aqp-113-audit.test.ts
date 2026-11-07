import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createTransactionRunner, type Transaction, type TransactionRunner } from '@/server/repositories/transaction';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import { getCurrentVersion } from '@/server/services/config-service';
import { createMastersService, type MastersService } from '@/server/services/masters-service';
import { entriesFor, entryCount } from '../support/audit-database';
import { SEED_PROCESS_ITEMS } from '../support/seed-config';
import { ORIGIN, FOREIGN_ORIGIN, world, call, NEW, create, idOf, db, adminId, names, rowOf, serviceOverStoredVersions, openWorld, closeWorld, entryEvents, setUserId, loadProcessMasterRoutes } from '../support/process-master-api';

/**
 * QA acceptance, AQP-113 (STORY-02.01) AC-5 and the audit rule of AQP-74 (DEF-017): exactly one entry per change, in the change's own
 * transaction, and none for a refusal. The atomicity tests fail the unit of work after its last step (the entry would survive a second
 * transaction opened inside the change) and refuse the entry where it is written (the change would survive an entry written after the
 * commit). Planted bypasses, one at a time, for each of master.created, master.edited and master.deleted (QA, G7): an omitted entry,
 * an entry in a second transaction inside the change, and an entry written after the commit; each makes a test of this file fail.
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

describe('the Process master over the API: the audit entry of each change (AC-5)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });
  describe('AC-5: one audit entry per change, in the change\'s own transaction; none for a refusal', () => {
    it('[AQP-113 AC-5] master.created: exactly one entry, object_type process_item, the actor, the request ID of the response, before null and after the new state', async () => {
      const answer = await create('Qa5-Created-Rate', { defaultValue: '4.5' });
      const id = idOf(answer);
      const entries = await entriesFor(db, id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        event: 'master.created',
        object_type: 'process_item',
        object_id: id,
        object_label: 'Qa5-Created-Rate',
        actor_id: adminId,
        actor_label: 'Invented Admin',
        request_id: answer.requestId,
        before: null,
        after: { name: 'Qa5-Created-Rate', unit: 'per kg', defaultValue: '4.50' },
      });
      expect(answer.requestId).toBeTruthy();
    });

    it('[AQP-113 AC-5] master.edited: exactly one entry per change, with before and after, and the new name as the label after a rename', async () => {
      const id = idOf(await create('Qa5-Edited-Rate'));
      const changed = await call('PATCH', id, { name: 'Qa5-Edited-Renamed', defaultValue: '8.25' });
      const entries = await entriesFor(db, id);
      expect(entryEvents(entries).sort()).toEqual(['master.created', 'master.edited']);
      expect(entries.find((entry) => entry.event === 'master.edited')).toMatchObject({
        object_type: 'process_item',
        object_label: 'Qa5-Edited-Renamed',
        actor_id: adminId,
        request_id: changed.requestId,
        before: { name: 'Qa5-Edited-Rate', unit: 'per kg', defaultValue: '1.37' },
        after: { name: 'Qa5-Edited-Renamed', unit: 'per kg', defaultValue: '8.25' },
      });
    });

    it('[AQP-113 AC-5] master.deleted: exactly one entry with the last state and after null; the object ID outlives the row', async () => {
      const id = idOf(await create('Qa5-Deleted-Rate', { defaultValue: '3.5' }));
      const deleted = await call('DELETE', id);
      const entries = await entriesFor(db, id);
      expect(entryEvents(entries)).toEqual(expect.arrayContaining(['master.created', 'master.deleted']));
      expect(entries.filter((entry) => entry.event === 'master.deleted')).toHaveLength(1);
      expect(entries.find((entry) => entry.event === 'master.deleted')).toMatchObject({
        object_type: 'process_item',
        object_label: 'Qa5-Deleted-Rate',
        actor_id: adminId,
        request_id: deleted.requestId,
        before: { name: 'Qa5-Deleted-Rate', unit: 'per kg', defaultValue: '3.50' },
        after: null,
      });
    });

    it('[AQP-113 AC-5] the old AC text master.process_item.* is NOT used: the only master events are master.created, master.edited and master.deleted', async () => {
      const { rows } = await db.owner.query<{ event: string }>("SELECT DISTINCT event FROM audit_log WHERE object_type = 'process_item' ORDER BY event");
      expect(rows.map((row) => row.event)).toEqual(['master.created', 'master.deleted', 'master.edited']);
    });

    it('[AQP-113 AC-5] a save that changes nothing writes no entry (the value 1.37 typed as 01.370 is the same value)', async () => {
      const id = idOf(await create('Qa5-Nothing-Rate'));
      const count = await entryCount(db);
      const same = await call('PATCH', id, { name: 'Qa5-Nothing-Rate', unit: 'per kg', defaultValue: '01.37' });
      expect(same.status).toBe(200);
      expect(await entryCount(db)).toBe(count);
    });

    it('[AQP-113 AC-5] every kind of refusal writes no entry and changes no row: validation, name taken, name refused, in use, not found, bad ID, foreign origin', async () => {
      const id = idOf(await create('Qa5-Refusals-Rate'));
      const seed = SEED_PROCESS_ITEMS[0];
      if (seed === undefined) throw new Error('no seed');
      const count = await entryCount(db);
      const rows = await names();
      const attempts = [
        await call('POST', null, { name: '', ...NEW }),
        await create('qa5-refusals-rate'),
        await create('AB'),
        await call('DELETE', seed.id),
        await call('DELETE', '00000000-0000-4000-8000-0fffffffffff'),
        await call('PATCH', '00000000-0000-4000-8000-0fffffffffff', { defaultValue: '1.00' }),
        await call('PATCH', id, {}),
        await call('PATCH', id, { name: 'Qa5-Refusals-Rate', unit: 'per metre' }),
        await call('POST', null, { name: 'Qa5-Foreign', ...NEW }, { origin: FOREIGN_ORIGIN }),
        await call('DELETE', id, undefined, { origin: FOREIGN_ORIGIN }),
        await call('PATCH', id, { defaultValue: '9.99' }, { origin: null }),
      ];
      expect(attempts.map((attempt) => attempt.status)).toEqual([422, 422, 422, 409, 404, 404, 422, 422, 403, 403, 403]);
      expect(await entryCount(db)).toBe(count);
      expect(await names()).toEqual(rows);
      expect((await rowOf(id))?.default_value).toBe('1.3700');
    });
  });
});

describe('AC-5 atomicity through the API: the change and its entry commit together or not at all', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
    world.service = serviceOverStoredVersions();
  });

  const LATE = 'the unit of work failed after its last step';

  /** The outermost transaction fails after its work, just before the commit; a transaction opened inside it is not the outermost, so it commits. */
  function lateFailingRunner(): TransactionRunner {
    const real = createTransactionRunner(db.prisma);
    let depth = 0;
    return {
      async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
        const outermost = depth === 0;
        depth += 1;
        try {
          return await real.run(async (tx) => {
            const result = await work(tx);
            if (outermost) throw new Error(LATE);
            return result;
          });
        } finally {
          depth -= 1;
        }
      },
    };
  }

  /** The audit service refuses the first entry it is given, where the entry is written. */
  function serviceWhoseAuditRefuses(): MastersService {
    const configurations = createConfigRepository(db.prisma);
    return createMastersService({
      masters: db.masterRepository,
      transactions: db.transactions,
      audit: {
        record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')),
        list: db.audit.list,
      },
      currentConfiguration: async () => (await getCurrentVersion(configurations)).document,
    });
  }

  async function snapshot(id: string | null): Promise<{ row: unknown; entries: number }> {
    return { row: id === null ? null : ((await rowOf(id)) ?? null), entries: await entryCount(db) };
  }

  describe.each([
    ['the unit of work fails after its last step (before the commit)', () => ({ service: serviceOverStoredVersions({ transactions: lateFailingRunner() }) })],
    ['the audit service refuses the entry', () => ({ service: serviceWhoseAuditRefuses() })],
  ] as const)('%s', (_label, make) => {
    it('[AQP-113 AC-5] create: a 500 with the generic words, no rate and no entry', async () => {
      world.service = make().service;
      const before = await snapshot(null);
      const answer = await call('POST', null, { name: 'Qa5a-Create-Rate', ...NEW });
      expect(answer.status).toBe(500);
      expect(answer.text).not.toContain(LATE);
      expect(answer.text).not.toContain('Qa5a-Create-Rate');
      expect(await names()).not.toContain('Qa5a-Create-Rate');
      expect((await snapshot(null)).entries).toBe(before.entries);
    });

    it('[AQP-113 AC-5] edit: a 500, the rate is as it was and no entry is kept', async () => {
      world.service = serviceOverStoredVersions();
      const id = idOf(await create(`Qa5a-Edit-Rate-${_label.length}`));
      const before = await snapshot(id);
      world.service = make().service;
      const answer = await call('PATCH', id, { name: `Qa5a-Edit-Renamed-${_label.length}`, defaultValue: '6.50' });
      expect(answer.status).toBe(500);
      expect(await snapshot(id)).toEqual(before);
    });

    it('[AQP-113 AC-5] delete: a 500, the rate is still there and no entry is kept', async () => {
      world.service = serviceOverStoredVersions();
      const id = idOf(await create(`Qa5a-Delete-Rate-${_label.length}`));
      const before = await snapshot(id);
      world.service = make().service;
      const answer = await call('DELETE', id);
      expect(answer.status).toBe(500);
      expect(await snapshot(id)).toEqual(before);
    });
  });
});
