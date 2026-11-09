import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { loadCanaryMaterials } from '../support/material-canary-loader';
import { world, db, adminId, leadId, engineerId, openWorld, closeWorld, setUserId, ORIGIN, FOREIGN_ORIGIN } from '../support/process-master-api';
import { auditTotal, callMaterials, callOptions, createMaterial, GOOD, idOf, insertAsOwner, loadMaterialRoutes, renderMaterialsPage, rowCount, rowOf } from '../support/material-master-qa-api';

/**
 * QA acceptance, AQP-122 (STORY-02.03) AC-4 and AC-6: `GET /api/v1/options/materials` gives every role IDs, names and Material Considered and
 * no rate of any kind (checked on the keys, on the values in every common spelling, and on the repository that feeds it); the admin routes and the
 * page are for the Admin only (403 for a Lead and an Engineer, 401 signed out, SCR-26 / sign-in for the page); the role is checked before the ID
 * is looked at; and a Lead, an Engineer or a refusal never receives a canary price, specific gravity or scrap rate. The canaries are the shared
 * rows of `material-master-canary.ts` (the single definition used by the scan). All numbers are invented.
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

const UNKNOWN_ID = '00000000-0000-4000-8000-0fffffffffff';

/** A number in the spellings a leak could take: plain, with two decimals, and grouped the Indian way (lakh and crore). */
function spellings(value: string): string[] {
  const [whole = '', fraction = ''] = value.split('.');
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest === '' ? lastThree : `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
  return [value, `${whole}.${fraction}0`, `${whole}.${fraction}00`, `${grouped}.${fraction}`, `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`];
}

const CANARY_NUMBERS = MATERIAL_CANARIES.flatMap((canary) => [canary.pricePerKg, canary.specificGravity, canary.scrapRate]);
const ALL_SPELLINGS = CANARY_NUMBERS.flatMap(spellings);

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadMaterialRoutes();
});

describe('AQP-122 AC-4 and AC-6: the safe options list and access control', () => {
  let ownId: string;
  beforeAll(async () => {
    await openWorld();
    await loadCanaryMaterials(db.owner);
    await insertAsOwner({ name: 'Qa4-Hidden-Option', considered: null, hidden: true });
    await insertAsOwner({ name: 'Qa4-Deleted-Option', considered: 'Invented gone', deleted: true });
    setUserId(adminId);
    ownId = idOf(await createMaterial('Qa4-Option-Sheet', { materialConsidered: 'Invented option steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' }));
  });
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
    world.service = db.buildMastersService();
  });

  describe('AC-4: GET /api/v1/options/materials', () => {
    it.each([
      ['an Admin', () => adminId],
      ['a Lead', () => leadId],
      ['an Engineer', () => engineerId],
    ])('[AQP-122 AC-4] %s gets 200 and every entry has exactly id, name and materialConsidered, and nothing else', async (_who, whoId) => {
      setUserId(whoId());
      const answer = await callOptions();
      expect(answer.status).toBe(200);
      expect(Object.keys(answer.body ?? {})).toEqual(['options']);
      const options = answer.body?.['options'] as Array<Record<string, unknown>>;
      expect(options.length).toBeGreaterThanOrEqual(3);
      for (const option of options) {
        expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
        expect(Object.values(option).every((value) => typeof value === 'string')).toBe(true);
      }
      const mine = options.find((option) => option['id'] === ownId);
      expect(mine).toEqual({ id: ownId, name: 'Qa4-Option-Sheet', materialConsidered: 'Invented option steel' });
      expect(options.map((option) => option['name'])).toEqual(expect.arrayContaining(MATERIAL_CANARIES.map((canary) => canary.materialInDrawing)));
    });

    it('[AQP-122 AC-4] no number of any canary row appears in the options body in any spelling, and no rate-like key or word is in it, for any role', async () => {
      for (const who of [adminId, leadId, engineerId]) {
        setUserId(who);
        const { text } = await callOptions();
        for (const spelling of ALL_SPELLINGS) expect(text, `spelling ${spelling}`).not.toContain(spelling);
        expect(text).not.toMatch(/price|gravity|scrap|rate|cost|₹/i);
        expect(text).not.toMatch(/"(?:pricePerKg|specificGravity|scrapRate)"/);
      }
    });

    it('[AQP-122 AC-4] the answer is the same for the three roles, is not cached, and the hidden and deleted rows are not in it', async () => {
      const texts: string[] = [];
      for (const who of [adminId, leadId, engineerId]) {
        setUserId(who);
        const answer = await callOptions();
        texts.push(answer.text.replace(/"requestId":"[^"]*"/, ''));
        expect(answer.headers.get('cache-control')).toMatch(/no-store/);
        expect(answer.text).not.toContain('Qa4-Hidden-Option');
        expect(answer.text).not.toContain('Qa4-Deleted-Option');
      }
      expect(texts[1]).toBe(texts[0]);
      expect(texts[2]).toBe(texts[0]);
    });

    it('[AQP-122 AC-4] signed out: 401 and no data', async () => {
      setUserId(null);
      const answer = await callOptions();
      expect(answer.status).toBe(401);
      expect(answer.text).not.toContain('Canary-Material-Alpha');
    });

    it('[AQP-122 AC-4] the repository behind it reads no number: its objects have exactly three keys (a leak would have to be added in the repository AND the schema)', async () => {
      const records = await db.masterRepository.listMaterialOptions();
      expect(records.length).toBeGreaterThanOrEqual(3);
      for (const record of records) expect(Object.keys(record).sort()).toEqual(['id', 'materialConsidered', 'name']);
    });

    it('[AQP-122 AC-4] the options route imports the options schema and no Admin schema that has a rate field (static check, as ARCH-R2 asks)', () => {
      const source = readFileSync('src/app/api/v1/options/materials/route.ts', 'utf8');
      expect(source).toMatch(/schemas\/options/);
      expect(source).not.toMatch(/schemas\/materials/);
      expect(source).not.toMatch(/schemas'/);
      const schema = readFileSync('src/server/views/schemas/options.ts', 'utf8');
      expect(schema).not.toMatch(/pricePerKg|specificGravity|scrapRate|price_per_kg|specific_gravity|scrap_rate/);
      expect(schema).toMatch(/strictObject/);
    });
  });

  describe('AC-6: the admin routes and the page are for the Admin only', () => {
    const calls = () =>
      [
        () => callMaterials('GET', null),
        () => callMaterials('POST', null, { materialInDrawing: 'Qa6-Intruder', ...GOOD }),
        () => callMaterials('PATCH', ownId, { pricePerKg: '1.00' }),
        () => callMaterials('PATCH', UNKNOWN_ID, { pricePerKg: '1.00' }),
      ] as const;

    it.each([
      { who: 'a Lead', whoId: () => leadId, status: 403 },
      { who: 'an Engineer', whoId: () => engineerId, status: 403 },
      { who: 'nobody (signed out)', whoId: () => null, status: 401 },
    ])('[AQP-122 AC-6] $who gets $status on GET, POST and PATCH (a real and an invented ID alike, identical bodies), no canary number, and nothing changes', async ({ whoId, status }) => {
      setUserId(whoId());
      const entries = await auditTotal();
      const rows = await rowCount();
      const before = await rowOf(ownId);
      const answers = [];
      for (const make of calls()) answers.push(await make());
      expect(answers.map((answer) => answer.status)).toEqual([status, status, status, status]);
      const bodies = answers.map((answer) => ({ ...answer.body, requestId: undefined }));
      for (const body of bodies) expect(body).toEqual(bodies[0]);
      for (const answer of answers) {
        for (const spelling of ALL_SPELLINGS) expect(answer.text).not.toContain(spelling);
        expect(answer.text).not.toMatch(/materialInDrawing|pricePerKg|specificGravity|scrapRate|Canary-/);
      }
      expect(await auditTotal()).toBe(entries);
      expect(await rowCount()).toBe(rows);
      expect(await rowOf(ownId)).toEqual(before);
    });

    it('[AQP-122 AC-6] the page /masters/materials: a Lead and an Engineer get the forbidden screen (SCR-26), a signed-out visitor is sent to sign-in, the Admin gets the page', async () => {
      setUserId(leadId);
      await expect(renderMaterialsPage()).rejects.toThrow('NEXT_FORBIDDEN');
      setUserId(engineerId);
      await expect(renderMaterialsPage()).rejects.toThrow('NEXT_FORBIDDEN');
      setUserId(null);
      await expect(renderMaterialsPage()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);
      setUserId(adminId);
      await expect(renderMaterialsPage()).resolves.toBeDefined();
    });

    it('[AQP-122 AC-6] the Admin is sent the numbers (the control: the canaries reach the Admin and only the Admin)', async () => {
      const list = await callMaterials('GET', null);
      expect(list.status).toBe(200);
      for (const canary of MATERIAL_CANARIES) {
        expect(list.text).toContain(canary.pricePerKg);
        expect(list.text).toContain(canary.specificGravity);
        expect(list.text).toContain(canary.scrapRate);
      }
    });

    it('[AQP-122 AC-6] a refusal shown to the Admin (422, 404) never echoes a canary number or the typed number', async () => {
      const canaryId = MATERIAL_CANARIES[0]?.id ?? '';
      const refusals = [
        await callMaterials('PATCH', canaryId, { pricePerKg: '-917373.37' }),
        await callMaterials('PATCH', canaryId, { specificGravity: '0' }),
        await createMaterial(MATERIAL_CANARIES[0]?.materialInDrawing ?? ''),
        await callMaterials('PATCH', UNKNOWN_ID, { pricePerKg: '917373.37' }),
      ];
      expect(refusals.map((answer) => answer.status)).toEqual([422, 422, 422, 404]);
      for (const answer of refusals) for (const spelling of ALL_SPELLINGS) expect(answer.text).not.toContain(spelling);
    });

    it('[AQP-122 AC-6] CSRF: a foreign Origin and no Origin are refused 403 ORIGIN_REFUSED on POST and PATCH; Sec-Fetch-Site same-origin is accepted', async () => {
      const entries = await auditTotal();
      for (const origin of [FOREIGN_ORIGIN, null]) {
        for (const answer of [await callMaterials('POST', null, { materialInDrawing: 'Qa6-Csrf', ...GOOD }, { origin }), await callMaterials('PATCH', ownId, { pricePerKg: '2.00' }, { origin })]) {
          expect(answer.status).toBe(403);
          expect(answer.body?.['code']).toBe('ORIGIN_REFUSED');
        }
      }
      expect(await auditTotal()).toBe(entries);
      expect((await callMaterials('PATCH', ownId, { pricePerKg: '58.37' }, { origin: null, extraHeaders: { 'sec-fetch-site': 'same-origin' } })).status).toBe(200);
    });

    it('[AQP-122 AC-6] a deactivated Admin and a session whose version was raised are refused at the next request (401) on the list, the add and the options', async () => {
      await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [adminId]);
      try {
        expect((await callMaterials('GET', null)).status).toBe(401);
        expect((await createMaterial('Qa6-Deactivated')).status).toBe(401);
        expect((await callOptions()).status).toBe(401);
      } finally {
        await db.owner.query('UPDATE users SET is_active = true WHERE id = $1', [adminId]);
      }
      await db.owner.query('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [adminId]);
      try {
        expect((await callMaterials('GET', null)).status).toBe(401);
      } finally {
        await db.owner.query('UPDATE users SET session_version = session_version - 1 WHERE id = $1', [adminId]);
      }
      expect((await callMaterials('GET', null)).status).toBe(200);
    });

    it('[AQP-122 AC-6] the runtime role cannot delete or truncate materials (soft delete is story 02.07; the grant is SELECT, INSERT, UPDATE only)', async () => {
      await expect(db.prisma.$executeRaw`DELETE FROM materials WHERE false`).rejects.toThrow(/permission denied/);
      await expect(db.prisma.$executeRaw`TRUNCATE TABLE materials`).rejects.toThrow(/permission denied/);
    });
  });
});
