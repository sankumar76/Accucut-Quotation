import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';

import { approvedEstimateOf, approvedValuesOf, openApprovedWorld, totalOfANewCalculation, type ApprovedWorld } from '../../support/approved-world';

/**
 * STORY-02.08 AC-8 (NFR-026, ADR-007) against real PostgreSQL in a throwaway database: a changed default that reaches the customer's rates leaves an **approved** estimate exactly
 * as it was approved (the review, the cost details of every part, the stored calculation and its rows, the approval and the exported file, all through
 * `approvedValuesOf`), while an estimate calculated afterwards reads the current rates. The customer is set to hold every default first, so every rate moves; the change goes through
 * the real master service, as the screen does. Every name and number is invented.
 */

let world: ApprovedWorld;
let estimateId: string;
let materialId: string;

beforeAll(async () => {
  world = await openApprovedWorld();
  const approved = await approvedEstimateOf(world);
  estimateId = approved.estimateId;
  materialId = approved.materialId;
}, 120_000);

afterAll(async () => {
  await world.db.close();
});

async function customerRates(): Promise<ReadonlyArray<{ readonly value: string; readonly default_value: string }>> {
  const { rows } = await world.db.owner.query<{ value: string; default_value: string }>(
    'SELECT cr.value::numeric(18,2)::text AS value, pi.default_value::numeric(18,2)::text AS default_value FROM customer_rates cr JOIN process_items pi ON pi.id = cr.process_item_id WHERE cr.customer_id = $1::uuid ORDER BY pi.id',
    [world.db.customerId],
  );
  return rows;
}

describe('AC-8: history is safe when a default is propagated', () => {
  it('moves the customer to every new default, leaves the approved estimate as it was approved, and gives a later calculation the new rates', async () => {
    // The customer holds every default now, so a change of a default reaches it (the typed rates of the world are the customer's own values).
    await world.db.owner.query('UPDATE customer_rates cr SET value = pi.default_value FROM process_items pi WHERE pi.id = cr.process_item_id AND cr.customer_id = $1::uuid', [world.db.customerId]);
    const approvedBefore = await approvedValuesOf(world, estimateId);
    const totalBefore = await totalOfANewCalculation(world, materialId);

    const masters = world.db.mastersService;
    for (const item of await masters.listProcessItems()) {
      const answer = await masters.updateProcessItem(world.admin, item.id, { defaultValue: new Decimal(item.defaultValue).plus(1).toFixed(2) });
      expect(answer.propagation).toMatchObject({ previousDefault: item.defaultValue, differing: [] });
      expect(answer.propagation?.moved).toBeGreaterThanOrEqual(1);
    }

    const rates = await customerRates();
    expect(rates.length).toBeGreaterThan(0);
    for (const rate of rates) expect(rate.value).toBe(rate.default_value);
    expect(await approvedValuesOf(world, estimateId)).toEqual(approvedBefore);
    expect(await totalOfANewCalculation(world, materialId)).not.toBe(totalBefore);
  });
});
