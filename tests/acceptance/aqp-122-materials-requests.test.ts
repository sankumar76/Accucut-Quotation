import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminId, openWorld, closeWorld, setUserId, ORIGIN } from '../support/process-master-api';
import { auditTotal, callMaterials, createMaterial, errorsOf, GOOD, idOf, loadMaterialRoutes, rowCount, rowOf } from '../support/material-master-qa-api';

/**
 * QA acceptance, AQP-122 (STORY-02.03), AC-2 and AC-3: requests that break several rules at once, requests with keys the screen never sends
 * (so a client cannot set `isHidden`, `isSystem`, `deletedAt` or an ID), bad JSON, bad IDs, an oversized name, and an edit that changes nothing.
 * Same world as `aqp-122-materials-rules.test.ts`: the real routes over real PostgreSQL. Every number is invented (`n.37`).
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

const ABOVE_ZERO = 'Enter a value above 0.';
const UNKNOWN_ID = '00000000-0000-4000-8000-0fffffffffff';

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadMaterialRoutes();
});

describe('the Material Master over the API: malformed requests (AC-2, AC-3)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });

  describe('AC-3: a request that breaks several rules, and requests that are not materials', () => {
    it('[AQP-122 AC-3] the example of the AC: a blank name, a negative price, specific gravity 0 and three decimals together: 422 names each failing field, nothing is stored', async () => {
      const count = await rowCount();
      const entries = await auditTotal();
      const refused = await callMaterials('POST', null, { materialInDrawing: ' ', materialConsidered: GOOD.materialConsidered, pricePerKg: '-5', specificGravity: '0', scrapRate: '1.234' });
      expect(refused.status).toBe(422);
      const errors = errorsOf(refused);
      expect(errors.map((error) => error.split(':')[0]).sort()).toEqual(['materialInDrawing', 'pricePerKg', 'scrapRate', 'specificGravity']);
      expect(errors).toContain(`specificGravity: ${ABOVE_ZERO}`);
      expect(refused.body?.['title']).toBe('Check the values and try again.');
      expect(await rowCount()).toBe(count);
      expect(await auditTotal()).toBe(entries);
    });

    it('[AQP-122 AC-3] a missing field, an unknown key and a key the screen never sends (id, isHidden, isSystem, deletedAt) are 422: nothing is stored, nothing is set', async () => {
      const count = await rowCount();
      const withoutConsidered = { pricePerKg: GOOD.pricePerKg, specificGravity: GOOD.specificGravity, scrapRate: GOOD.scrapRate };
      const attempts = [
        await callMaterials('POST', null, { materialInDrawing: 'Qa3-Missing', ...withoutConsidered }),
        await callMaterials('POST', null, { materialInDrawing: 'Qa3-Extra', ...GOOD, colour: 'red' }),
        await callMaterials('POST', null, { materialInDrawing: 'Qa3-Hidden', ...GOOD, isHidden: true }),
        await callMaterials('POST', null, { materialInDrawing: 'Qa3-System', ...GOOD, isSystem: true }),
        await callMaterials('POST', null, { materialInDrawing: 'Qa3-Deleted', ...GOOD, deletedAt: '2026-01-01T00:00:00Z' }),
        await callMaterials('POST', null, { id: UNKNOWN_ID, materialInDrawing: 'Qa3-Id', ...GOOD }),
        await callMaterials('POST', null, []),
        await callMaterials('POST', null, 'text'),
      ];
      expect(attempts.map((attempt) => attempt.status)).toEqual([422, 422, 422, 422, 422, 422, 422, 422]);
      expect(await rowCount()).toBe(count);
      const id = idOf(await createMaterial('Qa3-Patch-Keys'));
      for (const extra of [{ isHidden: true }, { isSystem: true }, { deletedAt: 'x' }, { id: UNKNOWN_ID }, { createdAt: 'x' }]) {
        expect((await callMaterials('PATCH', id, { pricePerKg: '1.00', ...extra })).status, JSON.stringify(extra)).toBe(422);
      }
      expect((await rowOf(id))?.is_hidden).toBe(false);
      expect((await rowOf(id))?.price_per_kg).toBe('58.3700');
    });

    it('[AQP-122 AC-3] an empty PATCH is 422; bad JSON and an empty body are 400; a path ID that is no UUID is 422; an ID nobody has is 404 (capital letters in the ID still find the material)', async () => {
      const id = idOf(await createMaterial('Qa3-Ids'));
      expect((await callMaterials('PATCH', id, {})).status).toBe(422);
      expect((await callMaterials('POST', null, undefined, { rawBody: '{not json' })).status).toBe(400);
      expect((await callMaterials('POST', null, undefined, { rawBody: '' })).status).toBe(400);
      expect((await callMaterials('PATCH', id, undefined, { rawBody: '{' })).status).toBe(400);
      expect((await callMaterials('PATCH', 'not-an-id', { pricePerKg: '1.00' })).status).toBe(422);
      expect((await callMaterials('PATCH', UNKNOWN_ID, { pricePerKg: '1.00' })).status).toBe(404);
      expect((await callMaterials('PATCH', id.toUpperCase(), { pricePerKg: '2.00' })).status).toBe(200);
    });

    it('[AQP-122 AC-3] a 1 MB name is refused as too long (422), not a 500, and no 422 echoes the typed value back', async () => {
      const refused = await createMaterial('x'.repeat(1_000_000));
      expect(refused.status).toBe(422);
      expect(refused.text.length).toBeLessThan(2_000);
      const secret = await createMaterial('Qa3-Echo', { pricePerKg: '-91.37' });
      expect(secret.text).not.toContain('91.37');
    });

    it('[AQP-122 AC-2] an edit of one field leaves the others as they were, and an edit that changes nothing is a 200 with no new entry', async () => {
      const id = idOf(await createMaterial('Qa2-Partial'));
      const patched = await callMaterials('PATCH', id, { scrapRate: '30.37' });
      expect(patched.body).toMatchObject({ materialInDrawing: 'Qa2-Partial', materialConsidered: GOOD.materialConsidered, pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '30.37' });
      const entries = await auditTotal();
      const same = await callMaterials('PATCH', id, { materialInDrawing: 'Qa2-Partial', specificGravity: '07.37', pricePerKg: '58.37' });
      expect(same.status).toBe(200);
      expect(await auditTotal()).toBe(entries);
    });
  });
});
