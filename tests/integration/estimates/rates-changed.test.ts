import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError } from '@/lib/errors';
import { createPlanCache } from '@/lib/formula';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';
import { createUnlockService, type UnlockService } from '@/server/services/unlock-service';
import { costsSchema } from '@/server/views/schemas/costs';

import { adminOf, auditOf, currentCalculationOf, engineerOf, leadOf, requestFor } from '../../support/approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { ONE_OF_EACH_COUNTS } from '../../support/rate-change-fixture';
import { EXCHANGE, MATERIAL } from '../../support/row-oracle';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-06.11 AC-1, AC-3 to AC-8 (FR-106; NFR-002, NFR-010; architecture section 4.8 "Rates changed since the last calculation") against real PostgreSQL in a throwaway database, as the **runtime role**: an Engineer's
 * Calculate stores a record with its master snapshot, a master is then changed as its owner, and the Lead's and the Admin's read of the costs says how many process rates, material prices and exchange rates changed,
 * **by kind and never a value**. The matrix is kind x state x status x who: each kind alone and together; a current, an out-of-date and a never-calculated estimate; a Prepared, an approved and an unlocked
 * (Draft) one; the Lead, the Admin and the Engineer. The same counts come from the unlock preview of an approved estimate over the same masters (AC-8: one pure function, `rate-diff`). Every estimate has a customer
 * and a material of its own so no test moves another's masters; the exchange rates are shared by the whole file and are put back after each change. Every name, ID and number is invented.
 */

let db: CalculationDatabase;
let review: EstimateReviewService;
let ownCount = 0;
const lead = () => leadOf(db);

const configurations = () => createConfigRepository(db.prisma);

beforeAll(async () => {
  db = await openCalculationDatabase();
  const cache = createConfigVersionCache();
  review = createEstimateReviewService({
    calculations: db.calculations,
    approvals: db.approvals,
    nodes: db.nodes,
    estimates: db.estimates,
    masters: db.masterRepository,
    configuration: { current: () => getCurrentVersion(configurations(), cache), byId: (id) => getVersionById(configurations(), id, cache) },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** The unlock service over the real repositories, to take an approved estimate back to Draft (STORY-06.08). */
function unlocking(): UnlockService {
  return createUnlockService({
    estimates: db.estimates,
    approvals: db.approvals,
    calculations: db.calculations,
    masters: db.masterRepository,
    // The latest version is read each time, so a version added by a test is the current one at once.
    configuration: { current: () => getCurrentVersion(configurations(), createConfigVersionCache()), byId: (id) => getVersionById(configurations(), id, createConfigVersionCache()) },
    transactions: db.transactions,
    workflow: { transition: db.estimateService.transition, audit: db.audit },
  });
}

/** A customer of its own, with the rates of the shared one, so its rates can change without touching the other tests' estimates. */
async function ownCustomer(): Promise<string> {
  ownCount += 1;
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, left(md5($1), 10)) RETURNING id::text', [`Invented rates customer ${String(ownCount)}`]);
  const id = defined(rows[0]).id;
  await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT $1::uuid, process_item_id, value FROM customer_rates WHERE customer_id = $2::uuid', [id, db.customerId]);
  return id;
}

/** A material of its own, with the numbers of the shared one. */
async function ownMaterial(): Promise<string> {
  ownCount += 1;
  const { rows } = await db.owner.query<{ id: string }>(
    'INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id::text',
    [`Invented rates plate ${String(ownCount)}`, 'Invented steel', MATERIAL.pricePerKg, MATERIAL.specificGravity, MATERIAL.scrapRate],
  );
  return defined(rows[0]).id;
}

interface World {
  readonly estimateId: string;
  readonly customerId: string;
  readonly materialId: string;
  readonly calculationId: string;
  /** A rate of the customer that the calculation used (the first of its snapshot). */
  readonly rateId: string;
}

/** A Prepared estimate of the Engineer's on a customer and a material of its own, calculated. */
async function calculatedOnOwnMasters(): Promise<World> {
  const customerId = await ownCustomer();
  const materialId = await ownMaterial();
  const estimateId = await db.addEstimate({ engineer: true, customerId });
  await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: materialId } });
  await db.service.calculate(engineerOf(db), estimateId);
  const calculationId = await currentCalculationOf(db, estimateId);
  const used = await db.owner.query<{ id: string }>("SELECT master_snapshot->'rates'->0->>'id' AS id FROM calculations WHERE id = $1::uuid", [calculationId]);
  return { estimateId, customerId, materialId, calculationId, rateId: defined(defined(used.rows[0]).id) };
}

const changeRate = (world: World): Promise<unknown> =>
  db.owner.query('UPDATE customer_rates SET value = value + 1 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [world.customerId, world.rateId]);
const changeMaterial = (world: World): Promise<unknown> => db.owner.query('UPDATE materials SET price_per_kg = price_per_kg + 1 WHERE id = $1::uuid', [world.materialId]);

/** Runs `work` with the exchange rates as they are, and puts them back after, so a later estimate of this file that expects no change still sees none. */
async function keepingExchangeRates(work: () => Promise<void>): Promise<void> {
  const before = await db.owner.query<{ currency: string; inr_value: string }>('SELECT currency, inr_value::text FROM exchange_rates ORDER BY currency');
  try {
    await work();
  } finally {
    for (const rate of before.rows) await db.owner.query('UPDATE exchange_rates SET inr_value = $2::numeric WHERE currency = $1', [rate.currency, rate.inr_value]);
  }
}
const changeUsd = (): Promise<unknown> => db.owner.query("UPDATE exchange_rates SET inr_value = inr_value + 1 WHERE currency = 'USD'");
const changeEur = (): Promise<unknown> => db.owner.query("UPDATE exchange_rates SET inr_value = inr_value + 1 WHERE currency = 'EUR'");

const noticeOf = async (estimateId: string, viewer = lead()) => (await review.getCosts(viewer, estimateId)).ratesChanged;

describe('AC-1, AC-7: a prepared estimate with current figures says how many of each kind changed', () => {
  it('nothing changed: no notice', async () => {
    const world = await calculatedOnOwnMasters();
    expect(await noticeOf(world.estimateId)).toBeNull();
  });

  it('a master saved again with the same value changed nothing: no notice', async () => {
    const world = await calculatedOnOwnMasters();
    await db.owner.query('UPDATE customer_rates SET value = value WHERE customer_id = $1::uuid', [world.customerId]);
    await db.owner.query('UPDATE materials SET price_per_kg = price_per_kg WHERE id = $1::uuid', [world.materialId]);
    expect(await noticeOf(world.estimateId)).toBeNull();
  });

  it.each([
    ['a process rate', async (world: World) => void (await changeRate(world)), { processRates: 1, materialPrices: 0, exchangeRates: 0 }],
    ['a material price', async (world: World) => void (await changeMaterial(world)), { processRates: 0, materialPrices: 1, exchangeRates: 0 }],
  ])('%s alone is one of that kind and nothing else', async (_name, change, counts) => {
    const world = await calculatedOnOwnMasters();
    await change(world);
    expect(await noticeOf(world.estimateId)).toEqual(counts);
  });

  it('an exchange rate alone is one, and both are two', async () => {
    const world = await calculatedOnOwnMasters();
    await keepingExchangeRates(async () => {
      await changeUsd();
      expect(await noticeOf(world.estimateId)).toEqual({ processRates: 0, materialPrices: 0, exchangeRates: 1 });
      await changeEur();
      expect(await noticeOf(world.estimateId)).toEqual({ processRates: 0, materialPrices: 0, exchangeRates: 2 });
    });
  });

  it('a process rate, a material price and an exchange rate: one of each, and the answer holds no value, no ID and no name', async () => {
    const world = await calculatedOnOwnMasters();
    await keepingExchangeRates(async () => {
      await changeRate(world);
      await changeMaterial(world);
      await changeUsd();
      const costs = costsSchema.parse(await review.getCosts(lead(), world.estimateId));
      expect(costs.ratesChanged).toEqual(ONE_OF_EACH_COUNTS);
      const text = JSON.stringify(costs.ratesChanged);
      expect(text).not.toContain(world.rateId);
      expect(text).not.toContain(world.materialId);
      expect(text).not.toContain(EXCHANGE.usd);
      expect(Object.keys(defined(costs.ratesChanged)).sort()).toEqual(['exchangeRates', 'materialPrices', 'processRates']);
    });
  });
});

describe('AC-5, AC-7 (NFR-002): the Admin sees it too, an Engineer never reaches it', () => {
  it('the Lead and the Admin get the same counts; the Engineer is refused before anything is read', async () => {
    const world = await calculatedOnOwnMasters();
    await changeMaterial(world);
    expect(await noticeOf(world.estimateId, lead())).toEqual({ processRates: 0, materialPrices: 1, exchangeRates: 0 });
    expect(await noticeOf(world.estimateId, adminOf(db))).toEqual({ processRates: 0, materialPrices: 1, exchangeRates: 0 });
    await expect(review.getCosts(engineerOf(db), world.estimateId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('AC-3: an approved estimate has no notice, whatever changes', () => {
  it('the notice goes with the approval: before it there is one, after it none, and the figures stand', async () => {
    const world = await calculatedOnOwnMasters();
    await changeMaterial(world);
    expect(await noticeOf(world.estimateId)).toEqual({ processRates: 0, materialPrices: 1, exchangeRates: 0 });
    await db.approvalService.approve(lead(), world.estimateId, requestFor(db, world.calculationId, '2500.00'));
    const approved = await review.getCosts(lead(), world.estimateId);
    expect(approved.state).toBe('current');
    expect(approved.ratesChanged).toBeNull();
    await changeRate(world);
    expect(await noticeOf(world.estimateId)).toBeNull();
  });
});

describe('AC-4: out-of-date and never-calculated estimates have no notice', () => {
  it('an input changed after the calculation: the figures are cleared, and so is the notice', async () => {
    const world = await calculatedOnOwnMasters();
    await changeMaterial(world);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [world.estimateId]);
    const costs = await review.getCosts(lead(), world.estimateId);
    expect(costs.state).toBe('out-of-date');
    expect(costs.ratesChanged).toBeNull();
  });

  it('an estimate that was never calculated has none', async () => {
    const bare = await db.addEstimate({ engineer: true });
    const costs = await review.getCosts(lead(), bare);
    expect(costs.state).toBe('none');
    expect(costs.ratesChanged).toBeNull();
  });
});

describe('AC-6: a master this calculation did not use, and a configuration change alone, give no notice', () => {
  it('a rate no formula reads, a material no part names, and a new configuration version: nothing is told', async () => {
    const world = await calculatedOnOwnMasters();
    const used = createPlanCache().get('seed', seedConfig.fields).referencedRateIds.map((id) => id.toLowerCase());
    const rates = await db.owner.query<{ id: string }>('SELECT process_item_id::text AS id FROM customer_rates WHERE customer_id = $1::uuid', [world.customerId]);
    const unreferenced = rates.rows.map((row) => row.id).filter((id) => !used.includes(id.toLowerCase()));
    expect(unreferenced.length, 'the seed holds a rate that no formula reads').toBeGreaterThan(0);
    await db.owner.query('UPDATE customer_rates SET value = value + 1 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [world.customerId, defined(unreferenced[0])]);
    const otherMaterial = await ownMaterial();
    await db.owner.query('UPDATE materials SET price_per_kg = price_per_kg + 1 WHERE id = $1::uuid', [otherMaterial]);
    const document = await db.owner.query<{ snapshot: unknown }>('SELECT snapshot FROM config_versions ORDER BY number DESC LIMIT 1');
    const next = await db.owner.query<{ n: number }>('SELECT max(number) + 1 AS n FROM config_versions');
    await db.owner.query("INSERT INTO config_versions (number, snapshot, reason) VALUES ($1, $2::jsonb, 'Invented formula change')", [defined(next.rows[0]).n, JSON.stringify(defined(document.rows[0]).snapshot)]);
    expect(await noticeOf(world.estimateId)).toBeNull();
  });
});

describe('a material deleted since: the page is still drawn, with no notice', () => {
  it('a soft-deleted material cannot be counted, and Calculate would say why in its own words', async () => {
    const world = await calculatedOnOwnMasters();
    await changeMaterial(world);
    await db.owner.query('UPDATE materials SET deleted_at = now() WHERE id = $1::uuid', [world.materialId]);
    const costs = await review.getCosts(lead(), world.estimateId);
    expect(costs.state).toBe('current');
    expect(costs.ratesChanged).toBeNull();
  });
});

describe('AC-10, AC-8: an unlocked Draft with current figures is told the same, and the unlock preview of an approved estimate over the same masters counts the same', () => {
  it('a Draft after an unlock, figures current, rates changed: the notice; and its counts equal the preview\'s for the approval', async () => {
    const world = await calculatedOnOwnMasters();
    await db.approvalService.approve(lead(), world.estimateId, requestFor(db, world.calculationId, '2500.00'));
    await keepingExchangeRates(async () => {
      await changeRate(world);
      await changeMaterial(world);
      await changeUsd();
      // Before the unlock the approval stands: no notice, and the preview tells what changed since it.
      expect(await noticeOf(world.estimateId)).toBeNull();
      const preview = await unlocking().preview(lead(), world.estimateId);
      await unlocking().unlock(lead(), world.estimateId, { reason: 'The customer asked for a new fixture.', audit: auditOf(db) });
      const draft = await review.getCosts(lead(), world.estimateId);
      expect(draft.state).toBe('current');
      expect(draft.ratesChanged).toEqual(preview.changed);
      expect(draft.ratesChanged).toEqual(ONE_OF_EACH_COUNTS);
    });
  });
});

describe('AC-7 (NFR-010): the read stays short', () => {
  it('a prepared estimate with changed rates is answered well inside the bound of the costs view', async () => {
    const world = await calculatedOnOwnMasters();
    await changeMaterial(world);
    const started = performance.now();
    await review.getCosts(lead(), world.estimateId);
    // A loose bound for a loaded runner; the measure of NFR-010 is p95 500 ms, and the notice adds one status read, one snapshot read and the three keyed reads of the masters.
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
