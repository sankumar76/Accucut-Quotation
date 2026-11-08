import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAME_REFUSED_CODE } from '@/lib/errors';
import { RATE_SET_AMBIGUOUS_MESSAGE } from '@/lib/formula';
import { entryCount } from '../support/audit-database';
import { SEED_PROCESS_ITEMS } from '../support/seed-config';
import { ORIGIN, world, call, create, rename, idOf, firstError, db, adminId, names, rowOf, installVersion, serviceOverStoredVersions, openWorld, closeWorld, configurationWithFormula, setUserId, loadProcessMasterRoutes, aMinusB } from '../support/process-master-api';

/**
 * QA verification of DEF-006 (AQP-181, GitHub #49), the round-1 cases through the API: a compound name before or after its parts, the
 * rename path in either order, the 15 seed names with the seed configuration, and QLT-17 (only what a change introduces is counted).
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

describe('DEF-006 round-1 cases through the API (compound then parts, parts then compound, rename)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });

  it('[AQP-113 DEF-006] parts first, then the compound: the compound is refused (the case of the DEF-006 record: Cost and Waste exist, Cost-Waste is added)', async () => {
    expect((await create('Cost')).status).toBe(201);
    expect((await create('Waste')).status).toBe(201);
    const entries = await entryCount(db);
    const refused = await create('Cost-Waste');
    expect(refused.status).toBe(422);
    expect(refused.body?.['code']).toBe(NAME_REFUSED_CODE);
    expect(await names()).not.toContain('Cost-Waste');
    expect(await entryCount(db)).toBe(entries);
  });

  it('[AQP-113 DEF-006] the second case of the record: AB-Waste is refused when Waste exists (a column letter, a hyphen and a rate)', async () => {
    const refused = await create('AB-Waste');
    expect(refused.status).toBe(422);
    expect(refused.body?.['code']).toBe(NAME_REFUSED_CODE);
  });

  it('[AQP-113 DEF-006] compound first, then one part (accepted), then the other part (refused)', async () => {
    expect((await create('Rv-Cost-Rv-Waste')).status).toBe(201);
    expect((await create('Rv-Cost')).status).toBe(201);
    const refused = await create('Rv-Waste');
    expect(refused.status).toBe(422);
    expect(refused.body?.['code']).toBe(NAME_REFUSED_CODE);
    expect(firstError(refused).message).toBe(RATE_SET_AMBIGUOUS_MESSAGE);
    expect(await names()).not.toContain('Rv-Waste');
  });

  it('[AQP-113 DEF-006] the same reverse case in the other order: the second part first, then the first part', async () => {
    expect((await create('Rw-Cost-Rw-Waste')).status).toBe(201);
    expect((await create('Rw-Waste')).status).toBe(201);
    expect((await create('Rw-Cost')).status).toBe(422);
  });

  it('[AQP-113 DEF-006] rename path: Alpha and Beta become the parts of the existing Gamma-Delta: the first rename is accepted, the second is refused and the rate keeps its name', async () => {
    const alpha = idOf(await create('Rn-Alpha'));
    const beta = idOf(await create('Rn-Beta'));
    expect((await create('Rn-Gamma-Rn-Delta')).status).toBe(201);
    expect((await rename(alpha, 'Rn-Gamma')).status).toBe(200);
    const entries = await entryCount(db);
    const refused = await rename(beta, 'Rn-Delta');
    expect(refused.status).toBe(422);
    expect(refused.body?.['code']).toBe(NAME_REFUSED_CODE);
    expect((await rowOf(beta))?.name).toBe('Rn-Beta');
    expect(await entryCount(db)).toBe(entries);
  });

  it('[AQP-113 DEF-006] rename path, the other order: Delta first, then Gamma', async () => {
    const a = idOf(await create('Ro-Alpha'));
    const b = idOf(await create('Ro-Beta'));
    expect((await create('Ro-Gamma-Ro-Delta')).status).toBe(201);
    expect((await rename(b, 'Ro-Delta')).status).toBe(200);
    expect((await rename(a, 'Ro-Gamma')).status).toBe(422);
  });

  it('[AQP-113 DEF-006] rename path, forward: a rate renamed into the compound of two others is refused', async () => {
    await create('Rf-Cost');
    await create('Rf-Waste');
    const spare = idOf(await create('Rf-Spare'));
    const refused = await rename(spare, 'Rf-Cost-Rf-Waste');
    expect(refused.status).toBe(422);
    expect((await rowOf(spare))?.name).toBe('Rf-Spare');
  });

  it.each(SEED_PROCESS_ITEMS.map((seed) => ({ id: seed.id, name: seed.name })))(
    '[AQP-113 DEF-006] the seed name "$name" is accepted with the seed configuration: renamed with its first letter in the other case, then renamed back (an all-capitals name is another matter: "PER" or "SEC" reads as column letters)',
    async ({ id, name }) => {
      expect((await rename(id, `${name.charAt(0).toLowerCase()}${name.slice(1)}`)).status).toBe(200);
      expect((await rename(id, name)).status).toBe(200);
    },
  );

  it('[AQP-113 DEF-006] a new rate is accepted with the seed set and the seed configuration', async () => {
    expect((await create('Seed-Ok-Rate')).status).toBe(201);
  });
});

describe('QLT-17: only what the change introduces counts', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });

  it('[AQP-113 QLT-17] a stored set that was ambiguous already (rows put in by SQL, as a loader would) does not refuse an unrelated add or an unrelated rename', async () => {
    await db.owner.query(
      "INSERT INTO process_items (name, unit, default_value) VALUES ('Ux-Cost', 'per kg', 1), ('Ux-Waste', 'per kg', 1), ('Ux-Cost-Ux-Waste', 'per kg', 1)",
    );
    const unrelated = await create('Ux-Unrelated');
    expect(unrelated.status).toBe(201);
    const seedId = SEED_PROCESS_ITEMS[1]?.id ?? '';
    expect((await rename(seedId, 'Ux-Bending-Renamed')).status).toBe(200);
    expect((await call('PATCH', idOf(unrelated), { defaultValue: '3.00' })).status).toBe(200);
    // ... but an add that makes ANOTHER name ambiguous is still refused.
    await db.owner.query("INSERT INTO process_items (name, unit, default_value) VALUES ('Uy-Cost-Uy-Waste', 'per kg', 1), ('Uy-Cost', 'per kg', 1)");
    const refused = await create('Uy-Waste');
    expect(refused.status).toBe(422);
    expect(refused.body?.['code']).toBe(NAME_REFUSED_CODE);
  });

  it('[AQP-113 QLT-17] a formula that did not round-trip before the change does not refuse an unrelated add', async () => {
    // Stored {{Pa}}-{{Qb-Rc}} with the rate Pa-Qb-Rc already present: the formula reads back as another rate before any change of ours.
    const pa = idOf(await create('Pa'));
    const qb = idOf(await create('Qb-Rc'));
    await db.owner.query("INSERT INTO process_items (name, unit, default_value) VALUES ('Pa-Qb-Rc', 'per kg', 1)");
    await installVersion(configurationWithFormula(aMinusB(pa, qb)), 2);
    world.service = serviceOverStoredVersions();
    expect((await create('Fine-Unrelated-Rate')).status).toBe(201);
    expect((await rename(SEED_PROCESS_ITEMS[2]?.id ?? '', 'Fine-Renamed-Seed')).status).toBe(200);
  });
});
