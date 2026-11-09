import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransactionRunner, type Transaction, type TransactionRunner } from '@/server/repositories/transaction';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import { createMastersService, type MastersService } from '@/server/services/masters-service';
import { world, db, adminId, leadId, engineerId, openWorld, closeWorld, setUserId, ORIGIN, FOREIGN_ORIGIN } from '../support/process-master-api';
import { seedConfig } from '../support/seed-config';
import { auditTotal, callMaterials, createMaterial, entriesOfObject, GOOD, idOf, insertAsOwner, loadMaterialRoutes, materialEntries, rowCount, rowOf } from '../support/material-master-qa-api';

/**
 * QA acceptance, AQP-122 (STORY-02.03) AC-5 (FR-011) on the corrected text (Jira 11187): every successful add or update writes exactly one audit
 * entry, `master.created` or `master.edited`, with `object_type` `material`, with who, when, object, before and after, **in the change's own
 * transaction**; a refusal writes none. The atomicity tests (DL-107, DEF-017) fail the unit of work after its last step (an entry written in a
 * second transaction inside the change would survive) and refuse the entry where it is written (a change committed before an entry written after
 * the commit would survive). QA planted a bypass per event in `masters-service.ts` (omitted entry, second transaction, after the commit); each made a
 * test of this file fail (the table is in the test report). Entries are read with plain SQL.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

const UNKNOWN_ID = '00000000-0000-4000-8000-0fffffffffff';
const LATE = 'the unit of work failed after its last step';

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadMaterialRoutes();
});

describe('AQP-122 AC-5: one audit entry per successful change', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
    world.service = db.buildMastersService();
  });

  it('[AQP-122 AC-5] master.created: exactly one entry, object_type material, the object, the actor, the request ID of the response, before null and the whole new state', async () => {
    const answer = await createMaterial('Qa5-Created-Sheet', { pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' });
    const id = idOf(answer);
    const entries = await entriesOfObject(id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      event: 'master.created',
      object_type: 'material',
      object_id: id,
      object_label: 'Qa5-Created-Sheet',
      actor_id: adminId,
      request_id: answer.requestId,
      before: null,
      after: { materialInDrawing: 'Qa5-Created-Sheet', materialConsidered: GOOD.materialConsidered, pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' },
    });
    expect(answer.requestId).toBeTruthy();
    const { rows } = await db.owner.query<{ actor_label: string; created_at: Date }>('SELECT actor_label, created_at FROM audit_log WHERE object_id = $1', [id]);
    expect(rows[0]?.actor_label).toBe('Invented Admin');
    expect(Math.abs(Date.now() - (rows[0]?.created_at.getTime() ?? 0))).toBeLessThan(60_000);
  });

  it('[AQP-122 AC-5] master.edited: exactly one entry per update, with the whole before and after; a multi-field edit is one entry; the label is the new name after a rename', async () => {
    const id = idOf(await createMaterial('Qa5-Edited-Sheet'));
    const changed = await callMaterials('PATCH', id, { materialInDrawing: 'Qa5-Edited-Renamed', pricePerKg: '60.37', specificGravity: '7.73', scrapRate: '23.37', materialConsidered: 'Invented changed' });
    expect(changed.status).toBe(200);
    const entries = await entriesOfObject(id);
    expect(entries.map((entry) => entry.event)).toEqual(['master.created', 'master.edited']);
    expect(entries[1]).toMatchObject({
      object_type: 'material',
      object_label: 'Qa5-Edited-Renamed',
      actor_id: adminId,
      request_id: changed.requestId,
      before: { materialInDrawing: 'Qa5-Edited-Sheet', materialConsidered: GOOD.materialConsidered, pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' },
      after: { materialInDrawing: 'Qa5-Edited-Renamed', materialConsidered: 'Invented changed', pricePerKg: '60.37', specificGravity: '7.73', scrapRate: '23.37' },
    });
  });

  it('[AQP-122 AC-5] three edits are three entries and each entry\'s before is the previous entry\'s after (a trail that can be followed)', async () => {
    const id = idOf(await createMaterial('Qa5-Trail-Sheet'));
    for (const price of ['61.37', '62.37', '63.37']) expect((await callMaterials('PATCH', id, { pricePerKg: price })).status).toBe(200);
    const entries = await entriesOfObject(id);
    expect(entries.map((entry) => entry.event)).toEqual(['master.created', 'master.edited', 'master.edited', 'master.edited']);
    for (let index = 1; index < entries.length; index += 1) {
      expect(entries[index]?.before).toEqual(entries[index - 1]?.after);
    }
    expect(entries[3]?.after).toMatchObject({ pricePerKg: '63.37' });
  });

  it('[AQP-122 AC-5] the only events for a material are master.created and master.edited: the old text master.material.* is not used', async () => {
    await createMaterial('Qa5-Events-Sheet');
    const { rows } = await db.owner.query<{ event: string }>("SELECT DISTINCT event FROM audit_log WHERE object_type = 'material' ORDER BY event");
    expect(rows.map((row) => row.event)).toEqual(['master.created', 'master.edited']);
    const { rows: other } = await db.owner.query<{ count: string }>("SELECT count(*) FROM audit_log WHERE event LIKE 'master.material%'");
    expect(Number(other[0]?.count)).toBe(0);
  });

  it('[AQP-122 AC-5] a rename that changes only the letter case is a change and writes one entry; a save that changes nothing writes none (the same value typed another way is no change)', async () => {
    const id = idOf(await createMaterial('Qa5-Case-Sheet'));
    expect((await callMaterials('PATCH', id, { materialInDrawing: 'QA5-CASE-SHEET' })).status).toBe(200);
    expect((await entriesOfObject(id)).map((entry) => entry.event)).toEqual(['master.created', 'master.edited']);
    const count = await auditTotal();
    const same = await callMaterials('PATCH', id, { materialInDrawing: ' QA5-CASE-SHEET ', pricePerKg: '058.37', specificGravity: '07.37', scrapRate: '22.37', materialConsidered: GOOD.materialConsidered });
    expect(same.status).toBe(200);
    expect(await auditTotal()).toBe(count);
  });

  it('[AQP-122 AC-5] every kind of refusal writes no entry and changes no row: validation, name taken, gravity 0, not found, hidden, bad ID, bad JSON, foreign or missing Origin, Lead, Engineer, signed out', async () => {
    const id = idOf(await createMaterial('Qa5-Refusals-Sheet'));
    const hidden = await insertAsOwner({ name: 'Qa5-Hidden-Sheet', considered: null, hidden: true });
    const entries = await auditTotal();
    const rows = await rowCount();
    const before = await rowOf(id);
    const attempts = [
      await createMaterial(''),
      await createMaterial('qa5-refusals-sheet'),
      await createMaterial('Qa5-Zero', { specificGravity: '0' }),
      await callMaterials('PATCH', id, { specificGravity: '0' }),
      await callMaterials('PATCH', id, { materialInDrawing: 'Qa5-Hidden-Sheet', pricePerKg: '-1' }),
      await callMaterials('PATCH', UNKNOWN_ID, { pricePerKg: '1.00' }),
      await callMaterials('PATCH', hidden, { pricePerKg: '1.00' }),
      await callMaterials('PATCH', 'nope', { pricePerKg: '1.00' }),
      await callMaterials('PATCH', id, {}),
      await callMaterials('POST', null, undefined, { rawBody: '{' }),
      await callMaterials('POST', null, { materialInDrawing: 'Qa5-Foreign-2', ...GOOD }, { origin: FOREIGN_ORIGIN }),
      await callMaterials('PATCH', id, { pricePerKg: '9.99' }, { origin: null }),
    ];
    expect(attempts.map((attempt) => attempt.status)).toEqual([422, 422, 422, 422, 422, 404, 404, 422, 422, 400, 403, 403]);
    for (const who of [leadId, engineerId, null]) {
      setUserId(who);
      expect((await createMaterial('Qa5-Not-Allowed')).status).toBe(who === null ? 401 : 403);
      expect((await callMaterials('PATCH', id, { pricePerKg: '5.00' })).status).toBe(who === null ? 401 : 403);
    }
    expect(await auditTotal()).toBe(entries);
    expect(await rowCount()).toBe(rows);
    expect(await rowOf(id)).toEqual(before);
    expect((await materialEntries()).some((entry) => entry.object_label === 'Qa5-Foreign-2')).toBe(false);
  });

  it('[AQP-122 AC-5] two edits of one material at once: both succeed or one is refused, and the entries match the successes exactly, in a chain', async () => {
    const id = idOf(await createMaterial('Qa5-Concurrent-Sheet'));
    const answers = await Promise.all([callMaterials('PATCH', id, { pricePerKg: '71.37' }), callMaterials('PATCH', id, { scrapRate: '31.37' }), callMaterials('PATCH', id, { specificGravity: '7.77' })]);
    expect(answers.every((answer) => answer.status === 200)).toBe(true);
    const entries = await entriesOfObject(id);
    expect(entries.filter((entry) => entry.event === 'master.edited')).toHaveLength(3);
    const edits = entries.slice(1);
    expect(edits[0]?.before).toEqual(entries[0]?.after);
    for (let index = 1; index < edits.length; index += 1) expect(edits[index]?.before).toEqual(edits[index - 1]?.after);
    expect(await rowOf(id)).toMatchObject({ price_per_kg: '71.3700', scrap_rate: '31.3700', specific_gravity: '7.7700' });
  });
});

describe('AQP-122 AC-5 atomicity: the change and its entry commit together or not at all (DL-107)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
    world.service = db.buildMastersService();
  });

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

  /** The audit service refuses the entry where it is written. */
  function serviceWhoseAuditRefuses(): MastersService {
    return createMastersService({
      masters: db.masterRepository,
      transactions: db.transactions,
      audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')), list: db.audit.list },
      currentConfiguration: () => Promise.resolve(seedConfig),
    });
  }

  async function snapshot(id: string | null) {
    return { row: id === null ? null : ((await rowOf(id)) ?? null), entries: await auditTotal(), rows: await rowCount() };
  }

  describe.each([
    ['the unit of work fails after its last step (before the commit)', () => db.buildMastersService({ transactions: lateFailingRunner() })],
    ['the audit service refuses the entry', serviceWhoseAuditRefuses],
  ] as const)('%s', (label, make) => {
    it('[AQP-122 AC-5] master.created: a 500 with the generic words, no row and no entry', async () => {
      const before = await snapshot(null);
      world.service = make();
      const answer = await createMaterial(`Qa5a-Create-${label.length}`);
      expect(answer.status).toBe(500);
      expect(answer.text).not.toContain(LATE);
      expect(answer.text).not.toContain('Qa5a-Create');
      expect(await snapshot(null)).toEqual(before);
    });

    it('[AQP-122 AC-5] master.edited: a 500, the material is as it was (every field) and no entry is kept (the update twin)', async () => {
      const id = idOf(await createMaterial(`Qa5a-Edit-${label.length}`));
      const before = await snapshot(id);
      world.service = make();
      for (const change of [{ pricePerKg: '99.37' }, { materialInDrawing: `Qa5a-Renamed-${label.length}`, specificGravity: '9.37', scrapRate: '9.73', materialConsidered: 'Invented moved' }]) {
        const answer = await callMaterials('PATCH', id, change);
        expect(answer.status).toBe(500);
        expect(answer.text).not.toContain(LATE);
      }
      expect(await snapshot(id)).toEqual(before);
    });
  });

  it('[AQP-122 AC-5] after the audit service works again, the same create succeeds (the failed attempt left no name behind)', async () => {
    world.service = serviceWhoseAuditRefuses();
    expect((await createMaterial('Qa5a-Retry-Sheet')).status).toBe(500);
    world.service = db.buildMastersService();
    const again = await createMaterial('Qa5a-Retry-Sheet');
    expect(again.status).toBe(201);
    expect(await entriesOfObject(idOf(again))).toHaveLength(1);
  });
});
