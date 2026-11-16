import { describe, expect, it } from 'vitest';

import { buildCostWorking, type CostWorking } from '@/lib/estimate/cost-working';

import { SEED_PLAN, storedRowOf, type StoredRowOptions } from '../../support/stored-row';
import { seedConfig } from '../../support/seed-config';

/**
 * GitHub #432, DL-225 (architecture section 4.2, test 5; the AQP-320 reader): the cost details working looks each rate operand up by ID, so a record of either snapshot shape gives the same working.
 * Shape 1 is a record stored before the change, with every rate of the customer, as `storedRowOf` makes it; shape 2 keeps only the plan's referenced rates, in the order of the set. Every value is invented.
 */

const UNUSED_RATE_NAME = 'Plating-rate-per-sqin';
const OTHER_UNUSED_VALUE = '99';

function working(options: StoredRowOptions = {}, onlyReferenced = false): CostWorking {
  const row = storedRowOf(options);
  const rates = onlyReferenced ? SEED_PLAN.referencedRateIds.flatMap((id) => row.snapshot.rates.filter((rate) => rate.id === id)) : row.snapshot.rates;
  return buildCostWorking({ document: seedConfig, plan: SEED_PLAN, inputs: row.inputs, outputs: row.outputs, snapshot: { ...row.snapshot, rates } });
}

describe('both shapes of the master snapshot give the same working (#432)', () => {
  it('a record with every rate of the customer and a record of the same inputs with only the referenced rates show the same operands and values', () => {
    expect(working({}, true)).toEqual(working({}, false));
  });

  it('the first shape holds exactly one rate that no seed formula reads, and the second shape leaves it out', () => {
    const row = storedRowOf();
    const referenced = new Set(SEED_PLAN.referencedRateIds);
    expect(row.snapshot.rates.filter((rate) => !referenced.has(rate.id)).map((rate) => rate.name)).toEqual([UNUSED_RATE_NAME]);
  });

  it('a rate that no formula reads can have another value in the record without changing the working', () => {
    expect(working({ rates: { [UNUSED_RATE_NAME]: OTHER_UNUSED_VALUE } })).toEqual(working());
  });
});
