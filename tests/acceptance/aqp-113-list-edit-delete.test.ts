import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAME_TAKEN_CODE, PROCESS_ITEM_IN_USE_CODE } from '@/lib/errors';
import { referenceContext } from '@/lib/fields/registry';
import { toDisplayForm } from '@/lib/formula';
import { entriesFor, entryCount } from '../support/audit-database';
import { SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';
import { ORIGIN, call, create, rename, idOf, db, adminId, names, rowOf, openWorld, closeWorld, usesFromSeed, entryEvents, setUserId, loadProcessMasterRoutes, repositoryText } from '../support/process-master-api';

/**
 * QA acceptance, AQP-113 (STORY-02.01): AC-1 the list, AC-3 edit, AC-4 delete and AC-9 the README, through the real routes over PostgreSQL
 * (see `tests/support/process-master-api.ts`). The describes share one database and run in the order written: the list is read before
 * anything changes, and the delete of the unused seed rate comes last.
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

describe('the Process master over the API: list, edit, delete (AC-1, AC-3, AC-4, AC-9)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });
  describe('AC-1: the list', () => {
    it('[AQP-113 AC-1] lists the 15 rates of SPEC 4.1 by name and unit, each with a default of 0 and no customer value', async () => {
      const answer = await call('GET', null);
      expect(answer.status).toBe(200);
      const rates = (answer.body?.['processItems'] ?? []) as Array<{ id: string; name: string; unit: string; defaultValue: string }>;
      expect(rates).toHaveLength(15);
      // SPEC 4.1 (the requirements document) is the oracle for names: every seed name appears in it. Only the names are looked for.
      const spec = repositoryText('ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md');
      for (const rate of rates) expect(spec.includes(rate.name), `SPEC 4.1 names ${rate.name}`).toBe(true);
      expect(new Set(rates.map((rate) => rate.name)).size).toBe(15);
      for (const rate of rates) expect(Number(rate.defaultValue), rate.name).toBe(0);
      for (const rate of rates) expect(rate.defaultValue).toMatch(/^\d+\.\d{2}$/);
      expect(rates.map((rate) => rate.name).sort()).toEqual(SEED_PROCESS_ITEMS.map((seed) => seed.name).sort());
    });

    it('[AQP-113 AC-1] "Used in" equals the formulas that hold the rate, recomputed from the seed text: 14 rates are used, Plating-rate-per-sqin is used by none', async () => {
      const answer = await call('GET', null);
      const rates = (answer.body?.['processItems'] ?? []) as Array<{ id: string; name: string; usedBy: Array<{ letter: string; label: string }> }>;
      for (const rate of rates) expect(rate.usedBy, rate.name).toEqual(usesFromSeed(rate.id));
      const unused = rates.filter((rate) => rate.usedBy.length === 0).map((rate) => rate.name);
      expect(unused).toEqual(['Plating-rate-per-sqin']);
      for (const rate of rates) for (const use of rate.usedBy) expect(use.letter).toMatch(/^[A-Z]{1,2}$/);
    });

    it('[AQP-113 AC-1] the answer holds no key other than id, name, unit, defaultValue and usedBy (strict contract)', async () => {
      const answer = await call('GET', null);
      const rates = (answer.body?.['processItems'] ?? []) as Array<Record<string, unknown>>;
      for (const rate of rates) expect(Object.keys(rate).sort()).toEqual(['defaultValue', 'id', 'name', 'unit', 'usedBy']);
      expect(Object.keys(answer.body ?? {})).toEqual(['processItems']);
      expect(answer.headers.get('cache-control')).toBe('private, no-store');
    });
  });

  describe('AC-3: edit a rate; the formulas keep the ID', () => {
    it('[AQP-113 AC-3] changes name, unit and default value together, and the ID does not change', async () => {
      const added = await create('Qa3-Edit-Rate');
      const id = idOf(added);
      const changed = await call('PATCH', id, { name: 'Qa3-Edited-Rate', unit: 'per hole', defaultValue: '7.5' });
      expect(changed.status).toBe(200);
      expect(changed.body).toMatchObject({ id, name: 'Qa3-Edited-Rate', unit: 'per hole', defaultValue: '7.50' });
      expect(await rowOf(id)).toMatchObject({ name: 'Qa3-Edited-Rate', unit: 'per hole' });
    });

    it('[AQP-113 AC-3] changes one field at a time and leaves the other two as they were', async () => {
      const id = idOf(await create('Qa3-One-Field-Rate'));
      expect((await call('PATCH', id, { defaultValue: '2.37' })).body).toMatchObject({ name: 'Qa3-One-Field-Rate', unit: 'per kg', defaultValue: '2.37' });
      expect((await call('PATCH', id, { unit: 'per sq ft' })).body).toMatchObject({ name: 'Qa3-One-Field-Rate', unit: 'per sq ft', defaultValue: '2.37' });
      expect((await rename(id, 'Qa3-One-Field-Renamed')).body).toMatchObject({ name: 'Qa3-One-Field-Renamed', unit: 'per sq ft', defaultValue: '2.37' });
    });

    it('[AQP-113 AC-3] renaming a rate a formula uses keeps its ID and its "Used in", and the stored formula (which holds the ID) reads with the new name', async () => {
      const cutting = SEED_PROCESS_ITEMS[0];
      if (cutting === undefined) throw new Error('no seed');
      const before = await call('GET', null);
      const listBefore = (before.body?.['processItems'] ?? []) as Array<{ id: string; name: string; usedBy: unknown }>;
      const usedBefore = listBefore.find((rate) => rate.id === cutting.id)?.usedBy;
      expect(usedBefore).toEqual(usesFromSeed(cutting.id));
      const versionsBefore = await db.owner.query<{ count: string }>('SELECT count(*) FROM config_versions');

      const renamed = await rename(cutting.id, 'Qa3-Cutting-Renamed');
      expect(renamed.status).toBe(200);
      expect(renamed.body).toMatchObject({ id: cutting.id, name: 'Qa3-Cutting-Renamed' });
      const after = ((await call('GET', null)).body?.['processItems'] ?? []) as Array<{ id: string; name: string; usedBy: unknown }>;
      expect(after.find((rate) => rate.id === cutting.id)).toMatchObject({ name: 'Qa3-Cutting-Renamed', usedBy: usedBefore });

      // The configuration is untouched (no new version), and its formula, shown with the new names, carries the new name.
      const versionsAfter = await db.owner.query<{ count: string }>('SELECT count(*) FROM config_versions');
      expect(versionsAfter.rows[0]?.count).toBe(versionsBefore.rows[0]?.count);
      const holder = seedConfig.fields.find((field) => field.kind === 'output' && field.formula?.includes(`{{rate:${cutting.id}}}`));
      if (holder === undefined || holder.kind !== 'output' || holder.formula === null) throw new Error('no formula holds the rate');
      const { rows } = await db.owner.query<{ id: string; name: string }>('SELECT id::text, name FROM process_items');
      expect(toDisplayForm(holder.formula, referenceContext(seedConfig, rows))).toContain('Qa3-Cutting-Renamed');

      expect((await rename(cutting.id, cutting.name)).status).toBe(200);
    });

    it('[AQP-113 AC-3] a rename that changes only letter case is accepted where it breaks nothing; a rate keeps its own name when only the unit changes', async () => {
      const id = idOf(await create('Qa3-Case-Rate'));
      expect((await rename(id, 'QA3-CASE-RATE')).status).toBe(200);
      expect((await call('PATCH', id, { name: 'QA3-CASE-RATE', unit: 'per sq in' })).status).toBe(200);
    });

    it('[AQP-113 AC-3] a rename onto another rate\'s name (any case) is refused NAME_TAKEN and the rate keeps its name', async () => {
      const first = idOf(await create('Qa3-First-Rate'));
      await create('Qa3-Second-Rate');
      const refused = await rename(first, 'qa3-second-RATE');
      expect(refused.status).toBe(422);
      expect(refused.body?.['code']).toBe(NAME_TAKEN_CODE);
      expect((await rowOf(first))?.name).toBe('Qa3-First-Rate');
    });

    it('[AQP-113 AC-3] an empty change is refused (422); an unknown key is refused; a bad value is refused and nothing changes', async () => {
      const id = idOf(await create('Qa3-Empty-Change'));
      expect((await call('PATCH', id, {})).status).toBe(422);
      expect((await call('PATCH', id, { colour: 'red' })).status).toBe(422);
      expect((await call('PATCH', id, { defaultValue: '-3' })).status).toBe(422);
      expect((await call('PATCH', id, { unit: 'per metre' })).status).toBe(422);
      expect(await rowOf(id)).toMatchObject({ name: 'Qa3-Empty-Change', unit: 'per kg' });
    });

    it('[AQP-113 AC-3] an ID that is not a UUID is refused before any lookup (422); a UUID nobody has is 404; capital letters in the ID still find the rate', async () => {
      expect((await call('PATCH', 'not-an-id', { defaultValue: '1.00' })).status).toBe(422);
      expect((await call('PATCH', '00000000-0000-4000-8000-0fffffffffff', { defaultValue: '1.00' })).status).toBe(404);
      const id = idOf(await create('Qa3-Upper-Id-Rate'));
      expect((await call('PATCH', id.toUpperCase(), { defaultValue: '9.00' })).status).toBe(200);
    });
  });

  describe('AC-4: delete', () => {
    it('[AQP-113 AC-4] a rate no formula uses is deleted: 204 with no body, the row is gone, and the list no longer shows it', async () => {
      const id = idOf(await create('Qa4-Unused-Rate'));
      const deleted = await call('DELETE', id);
      expect(deleted.status).toBe(204);
      expect(deleted.text).toBe('');
      expect(await rowOf(id)).toBeUndefined();
      const list = ((await call('GET', null)).body?.['processItems'] ?? []) as Array<{ id: string }>;
      expect(list.some((rate) => rate.id === id)).toBe(false);
    });

    it('[AQP-113 AC-4] the unused SEED rate (Plating-rate-per-sqin) can be deleted, and the other 14 cannot', async () => {
      const blocked: string[] = [];
      for (const seed of SEED_PROCESS_ITEMS) {
        if (seed.name === 'Plating-rate-per-sqin') continue;
        const answer = await call('DELETE', seed.id);
        expect(answer.status, seed.name).toBe(409);
        blocked.push(seed.name);
      }
      expect(blocked).toHaveLength(14);
      expect(await names()).toEqual(expect.arrayContaining(blocked));
    });

    it('[AQP-113 AC-4] a used rate is refused with 409 PROCESS_ITEM_IN_USE and the formulas as plain {letter, label} text; nothing changes and no entry is written', async () => {
      const seed = SEED_PROCESS_ITEMS[0];
      if (seed === undefined) throw new Error('no seed');
      const entries = await entryCount(db);
      const answer = await call('DELETE', seed.id);
      expect(answer.status).toBe(409);
      expect(answer.body?.['code']).toBe(PROCESS_ITEM_IN_USE_CODE);
      expect(answer.body?.['usedBy']).toEqual(usesFromSeed(seed.id));
      expect((answer.body?.['usedBy'] as unknown[]).length).toBeGreaterThan(0);
      for (const use of answer.body?.['usedBy'] as Array<Record<string, unknown>>) expect(Object.keys(use).sort()).toEqual(['label', 'letter']);
      // AC-4 (PO ruling, plain text and no link): the answer carries no URL, no href and no route.
      expect(answer.text).not.toMatch(/https?:|href|\/config\/fields/i);
      expect(await rowOf(seed.id)).toBeDefined();
      expect(await entryCount(db)).toBe(entries);
    });

    it('[AQP-113 AC-4] a rate that was already deleted answers 404 (the second delete), as does an ID nobody has; an invalid ID is 422', async () => {
      const id = idOf(await create('Qa4-Twice-Rate'));
      expect((await call('DELETE', id)).status).toBe(204);
      expect((await call('DELETE', id)).status).toBe(404);
      expect((await call('DELETE', '00000000-0000-4000-8000-0fffffffffff')).status).toBe(404);
      expect((await call('DELETE', 'nope')).status).toBe(422);
    });
  });

  describe('AC-4 (continued): the unused seed rate', () => {
    it('[AQP-113 AC-4] Plating-rate-per-sqin, used by no formula, is deleted (204) and writes one master.deleted entry', async () => {
      const plating = SEED_PROCESS_ITEMS.find((seed) => seed.name === 'Plating-rate-per-sqin');
      if (plating === undefined) throw new Error('no seed');
      expect((await call('DELETE', plating.id)).status).toBe(204);
      expect(entryEvents(await entriesFor(db, plating.id))).toEqual(['master.deleted']);
      expect(await names()).not.toContain('Plating-rate-per-sqin');
    });
  });

  describe('AC-9: the README says the 15 rates are entered before any estimate is calculated', () => {
    it('[AQP-113 AC-9] README.md has a "First use" section that tells the Admin to enter the rates in Masters > Process before calculating', () => {
      const readme = repositoryText('README.md');
      const start = readme.search(/^#{1,6}\s*First use/im);
      expect(start, 'a First use heading').toBeGreaterThanOrEqual(0);
      const section = readme.slice(start, start + 2_500);
      expect(section).toMatch(/15/);
      expect(section).toMatch(/Process/i);
      expect(section).toMatch(/calculat/i);
    });
  });
});
