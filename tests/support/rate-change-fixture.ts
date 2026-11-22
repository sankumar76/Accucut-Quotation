import type { RateChangeCounts } from '@/lib/estimate/rate-diff';
import { createPlanCache } from '@/lib/formula';
import type { MasterSnapshot } from '@/server/repositories/calculation-repository';
import type { CustomerCalculationRecord } from '@/server/repositories/customer-repository';
import type { MaterialCalculationRecord } from '@/server/repositories/material-repository';
import type { CalculationMasters } from '@/server/services/calculation-masters';

import { seedConfig } from './seed-config';

/**
 * The one fixture that feeds both readers of `lib/estimate/rate-diff.ts` (STORY-06.11 AC-8): the unlock preview of STORY-06.08 and the Lead's "Rates changed" notice. A calculation stored this snapshot (a customer
 * with every rate a formula of the seed configuration reads, one material, both exchange rates), and `mastersNow` answers the masters as they are now, with the changes a test asks for. The same changes give the
 * same counts to the two readers; a test of either imports this file and nothing else for its masters. Every ID, name and number is invented.
 */

export const FIXTURE_CUSTOMER_ID = '00000000-0000-4000-8000-0000000c0501';
export const FIXTURE_MATERIAL_ID = '00000000-0000-4000-8000-0000000a7e01';
/** A rate of the customer that no formula reads: a change to it must count for nothing (STORY-06.11 AC-6, architecture section 4.2). */
export const UNREFERENCED_RATE_ID = '00000000-0000-4000-8000-0000000ffff1';

/** The rates the formulas of the seed configuration read, which is what `referencedRateIds` of its plan holds. */
export const FIXTURE_REFERENCED = createPlanCache().get('seed', seedConfig.fields).referencedRateIds;

/** The snapshot the calculation stored. */
export const storedSnapshot = (): MasterSnapshot => ({
  customer: { id: FIXTURE_CUSTOMER_ID, name: 'Invented Customer' },
  rates: FIXTURE_REFERENCED.map((id, index) => ({ id, name: `Invented rate ${String(index)}`, value: '10.00' })),
  materials: [{ id: FIXTURE_MATERIAL_ID, materialInDrawing: 'Invented plate', materialConsidered: null, pricePerKg: '80.50', specificGravity: '7.85', scrapRate: '10' }],
  exchangeRates: { usd: '83.25', eur: '90.10' },
});

/** What changed in the masters since the snapshot. Each is the value now; absent means unchanged. */
export interface MastersNow {
  /** The first referenced rate of the customer. */
  readonly rate?: string;
  /** The price per kg of the material. */
  readonly price?: string;
  /** The US dollar exchange rate. */
  readonly usd?: string;
  /** The euro exchange rate. */
  readonly eur?: string;
  /** A rate no formula reads, which the customer now holds at this value. */
  readonly unreferencedRate?: string;
  readonly customerDeleted?: boolean;
  /** The customer is not there at all (a fault in the data: a snapshot names a customer the masters do not hold). */
  readonly customerMissing?: boolean;
  readonly materialDeleted?: boolean;
}

/** The three changes the story's example names: a process rate, a material price and an exchange rate. */
export const ONE_OF_EACH: MastersNow = { rate: '12.00', price: '85', usd: '84' };
export const ONE_OF_EACH_COUNTS: RateChangeCounts = { processRates: 1, materialPrices: 1, exchangeRates: 1 };
export const NO_CHANGE_COUNTS: RateChangeCounts = { processRates: 0, materialPrices: 0, exchangeRates: 0 };

/** The values a test must never find in an answer: the old and the new of every number the fixture moves. */
export const FIXTURE_VALUES = ['10.00', '12.00', '80.50', '85', '83.25', '84', '90.10'] as const;

export interface FixtureMasters {
  readonly masters: CalculationMasters;
  /** How many times each master read was made, for "three short keyed reads". */
  readonly reads: { readonly customer: number; readonly materials: number; readonly exchange: number };
}

/** The masters as they are now: the snapshot's values with the changes asked for. A deleted customer or material is the record the repository gives for one. */
export function mastersNow(now: MastersNow = {}): FixtureMasters {
  const reads = { customer: 0, materials: 0, exchange: 0 };
  const customer: CustomerCalculationRecord = now.customerDeleted
    ? { deleted: true, id: FIXTURE_CUSTOMER_ID, name: 'Invented Customer' }
    : {
        deleted: false,
        customer: {
          id: FIXTURE_CUSTOMER_ID,
          name: 'Invented Customer',
          shortName: 'INV',
          phone: null,
          email: null,
          address: null,
          rates: [
            ...FIXTURE_REFERENCED.map((id, index) => ({ processItemId: id, name: `Invented rate ${String(index)}`, unit: 'per kg', defaultValue: '1.00', value: index === 0 && now.rate !== undefined ? now.rate : '10.00' })),
            { processItemId: UNREFERENCED_RATE_ID, name: 'Invented rate no formula reads', unit: 'per kg', defaultValue: '1.00', value: now.unreferencedRate ?? '5.00' },
          ],
        },
      };
  const material: MaterialCalculationRecord = {
    id: FIXTURE_MATERIAL_ID,
    materialInDrawing: 'Invented plate',
    materialConsidered: null,
    pricePerKg: now.price ?? '80.50',
    specificGravity: '7.85',
    scrapRate: '10',
    deleted: now.materialDeleted === true,
  };
  const masters: CalculationMasters = {
    findCustomerForCalculation: () => {
      reads.customer += 1;
      return Promise.resolve(now.customerMissing === true ? null : customer);
    },
    findMaterialsForCalculation: () => {
      reads.materials += 1;
      return Promise.resolve([material]);
    },
    readExchangeRates: () => {
      reads.exchange += 1;
      return Promise.resolve({ usd: now.usd ?? '83.25', eur: now.eur ?? '90.10', stamp: null });
    },
  };
  return { masters, get reads() { return { ...reads }; } };
}
