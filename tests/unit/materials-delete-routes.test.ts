import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { MATERIAL_CANARIES, MATERIAL_RECIPE_ID } from '../support/material-master-canary';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-02.07 (AC-3, AC-4, AC-6) for `DELETE /api/v1/materials/{id}`, through the real `withRoute`, the real session and the real masters service over in-memory
 * storage: the answer of a delete that is allowed (204, no body, the material leaves the list and the options, one `master.deleted` entry), the answer of one that is
 * refused (409 `MATERIAL_IN_USE` with the estimates named, the first ten and the count, and nothing written), the 404 and 422 of a bad ID, that a guard that cannot
 * be read refuses the delete instead of allowing it, and that the refusal carries no price, gravity or scrap rate. The real storage, the row lock, the hidden "Not
 * applicable" row and the race are tested against PostgreSQL in `tests/integration/masters/material-delete.test.ts`. Who may call is `tests/security`. Every name
 * and code is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getMastersService: () => shared.mastersService };
});

const ORIGIN = 'https://portal.example.test';
const ALPHA = MATERIAL_RECIPE_ID;
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';

const { GET } = await import('@/app/api/v1/materials/route');
const { DELETE } = await import('@/app/api/v1/materials/[id]/route');
const { GET: GET_OPTIONS } = await import('@/app/api/v1/options/materials/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, path = '/api/v1/materials'): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers: { origin: ORIGIN } });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const entriesSince = (count: number) => harness.auditWorld.audit.committed.slice(count);
const listedIds = () => harness.masters.materials.map((material) => material.id);

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  // Every test starts from the two canary materials, whatever an earlier test did.
  harness.masters.materials.splice(0, harness.masters.materials.length, ...MATERIAL_CANARIES.map((material) => ({ ...material })));
  harness.masters.materialOpenEstimates.clear();
});

describe('AC-3: a material no open estimate uses is soft-deleted', () => {
  it('answers 204 with no body, and the material leaves the list and the estimate form\'s options', async () => {
    const response = await DELETE(request('DELETE'), withId(ALPHA));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(listedIds()).not.toContain(ALPHA);
    const listed = z.array(record).parse(record.parse(await (await GET(request('GET'))).json())['materials']);
    expect(listed.map((material) => material['id'])).not.toContain(ALPHA);
    harness.signInAs('ENGINEER');
    const options = z.array(record).parse(record.parse(await (await GET_OPTIONS(request('GET', '/api/v1/options/materials'))).json())['options']);
    expect(options.map((option) => option['id'])).not.toContain(ALPHA);
  });

  it('writes exactly one master.deleted entry with object_type material, whose before is the material and whose after is null', async () => {
    const before = harness.auditWorld.audit.committed.length;
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
    const entries = entriesSince(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectId, row.objectLabel])).toEqual([['master.deleted', 'material', ALPHA, 'Canary-Material-Alpha']]);
    expect(entries[0]).toMatchObject({ before: { materialInDrawing: 'Canary-Material-Alpha', pricePerKg: '917373.37' }, after: null });
  });
});

describe('AC-3: a material a Draft or Submitted estimate has in a part is refused', () => {
  it('answers 409 MATERIAL_IN_USE naming the estimates, and changes nothing and writes no entry', async () => {
    harness.masters.materialOpenEstimates.set(ALPHA, [
      { code: 'Q-2026-0101', status: 'DRAFT' },
      { code: 'Q-2026-0102', status: 'SUBMITTED' },
    ]);
    const before = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(ALPHA));
    expect(response.status).toBe(409);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    const { requestId, ...body } = record.parse(await response.json());
    expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Canary-Material-Alpha cannot be deleted while an open estimate uses it',
      status: 409,
      code: 'MATERIAL_IN_USE',
      estimates: [
        { code: 'Q-2026-0101', status: 'DRAFT' },
        { code: 'Q-2026-0102', status: 'SUBMITTED' },
      ],
      estimateTotal: 2,
    });
    expect(listedIds()).toContain(ALPHA);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });

  it('names the first ten estimates and counts the rest', async () => {
    harness.masters.materialOpenEstimates.set(
      ALPHA,
      Array.from({ length: 13 }, (_unused, index) => ({ code: `Q-2026-${String(200 + index).padStart(4, '0')}`, status: 'DRAFT' as const })),
    );
    const body = record.parse(await (await DELETE(request('DELETE'), withId(ALPHA))).json());
    expect(z.array(record).parse(body['estimates'])).toHaveLength(10);
    expect(body['estimateTotal']).toBe(13);
  });

  it('carries no price, gravity or scrap rate of the material', async () => {
    harness.masters.materialOpenEstimates.set(ALPHA, [{ code: 'Q-2026-0101', status: 'DRAFT' }]);
    const text = await (await DELETE(request('DELETE'), withId(ALPHA))).text();
    const alpha = defined(MATERIAL_CANARIES[0]);
    for (const value of [alpha.pricePerKg, alpha.specificGravity, alpha.scrapRate]) expect(text).not.toContain(value);
  });

  it('is allowed again once no open estimate has the material (an Approved estimate does not count: AC-4)', async () => {
    harness.masters.materialOpenEstimates.set(ALPHA, [{ code: 'Q-2026-0101', status: 'DRAFT' }]);
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(409);
    harness.masters.materialOpenEstimates.clear();
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
  });

  it('a guard that cannot be read is an error and the material stays: it is never read as "unused"', async () => {
    const guard = vi.spyOn(harness.masters, 'findOpenEstimatesOfMaterial').mockRejectedValueOnce(new Error('relation "estimate_nodes" does not exist'));
    const before = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(ALPHA));
    expect(response.status).toBe(500);
    expect(listedIds()).toContain(ALPHA);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
    guard.mockRestore();
  });
});

describe('a bad ID', () => {
  it('answers 404 for an unknown ID and for one deleted already (nothing is written the second time), and 422 for one that is not a UUID', async () => {
    expect((await DELETE(request('DELETE'), withId(UNKNOWN_ID))).status).toBe(404);
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
    const entries = harness.auditWorld.audit.committed.length;
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(404);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect((await DELETE(request('DELETE'), withId('not-an-id'))).status).toBe(422);
  });

  it('reads the ID in any letter case', async () => {
    expect((await DELETE(request('DELETE'), withId(ALPHA.toUpperCase()))).status).toBe(204);
  });
});

describe('AC-6: who may delete', () => {
  it.each([
    ['a Lead', 'LEAD', 403],
    ['an Engineer', 'ENGINEER', 403],
    ['nobody signed in', null, 401],
  ] as const)('%s gets %i and the material stays', async (_who, role, status) => {
    harness.signInAs(role);
    const before = harness.auditWorld.audit.committed.length;
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(status);
    expect(listedIds()).toContain(ALPHA);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });
});
