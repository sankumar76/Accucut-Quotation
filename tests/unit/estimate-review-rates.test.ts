import { describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import { costsSchema } from '@/server/views/schemas/costs';

import {
  FIXTURE_VALUES,
  NO_CHANGE_COUNTS,
  ONE_OF_EACH,
  ONE_OF_EACH_COUNTS,
  type MastersNow,
} from '../support/rate-change-fixture';
import { createReviewWorld, INVENTED_CALCULATION_ID, REVIEW_ESTIMATE_ID, type ReviewWorldOptions } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * STORY-06.11 AC-1, AC-3 to AC-8 (FR-106; NFR-002, NFR-010; architecture section 4.8 "Rates changed since the last calculation"): what the review service puts under `ratesChanged`, over the one fixture the unlock
 * preview is tested with. The matrix is **kind x state x status x who**: each kind of change alone and together, the three states of the figures, the three statuses of the estimate, and the three roles. Every ID, name
 * and number is invented; the masters "now" are the fixture's.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const ADMIN = { id: '00000000-0000-4000-8000-0000000ad314', role: 'ADMIN' } as const;
const ENGINEER = { id: '00000000-0000-4000-8000-0000000e9142', role: 'ENGINEER' } as const;

const CE1 = QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1');
if (CE1 === undefined) throw new Error('The constructed case CE-1 is missing.');

const worldOf = (options: Partial<ReviewWorldOptions> = {}) => createReviewWorld({ rows: CE1.rows, bl: CE1.bl, ...options });
const costsOf = (options: Partial<ReviewWorldOptions> = {}, viewer: typeof LEAD | typeof ADMIN = LEAD) => worldOf(options).service.getCosts(viewer, REVIEW_ESTIMATE_ID);

/** One kind of change at a time, and the counts it must give. */
const KINDS: ReadonlyArray<readonly [string, MastersNow, { processRates: number; materialPrices: number; exchangeRates: number }]> = [
  ['a process rate', { rate: '12.00' }, { processRates: 1, materialPrices: 0, exchangeRates: 0 }],
  ['a material price', { price: '85' }, { processRates: 0, materialPrices: 1, exchangeRates: 0 }],
  ['the US dollar rate', { usd: '84' }, { processRates: 0, materialPrices: 0, exchangeRates: 1 }],
  ['the euro rate', { eur: '91' }, { processRates: 0, materialPrices: 0, exchangeRates: 1 }],
  ['both exchange rates', { usd: '84', eur: '91' }, { processRates: 0, materialPrices: 0, exchangeRates: 2 }],
  ['one of each (the story\'s case)', ONE_OF_EACH, ONE_OF_EACH_COUNTS],
];

describe('AC-1, AC-8: a current, prepared estimate says how many of each kind changed, and the unlock preview\'s fixture gives the same counts', () => {
  it.each(KINDS)('%s: the counts are those of the shared fixture', async (_name, changed, counts) => {
    expect((await costsOf({ mastersNow: changed })).ratesChanged).toEqual(counts);
  });

  it('nothing changed: the key is null, so the screen draws no notice', async () => {
    expect((await costsOf()).ratesChanged).toBeNull();
    expect(NO_CHANGE_COUNTS.processRates).toBe(0);
  });

  it('a master saved again with the same number changed nothing: 80.5 is 80.50, and 12 is 12.00 against 12', async () => {
    expect((await costsOf({ mastersNow: { price: '80.5', rate: '10', usd: '83.250' } })).ratesChanged).toBeNull();
  });
});

describe('AC-7 (NFR-002): counts by kind and nothing else', () => {
  it('the answer passes the strict schema, holds three keys under ratesChanged, and no old or new value anywhere in it', async () => {
    const costs = await costsOf({ mastersNow: ONE_OF_EACH });
    expect(costsSchema.parse(costs)).toEqual(costs);
    expect(Object.keys(costs.ratesChanged ?? {}).sort()).toEqual(['exchangeRates', 'materialPrices', 'processRates']);
    const text = JSON.stringify(costs);
    for (const value of FIXTURE_VALUES) expect(text, `the answer must not carry ${value}`).not.toContain(`"${value}"`);
    expect(text).not.toMatch(/Invented rate|Invented plate/);
  });

  it('an Engineer is refused before anything is read: no status, snapshot or master, and no count', async () => {
    const world = worldOf({ mastersNow: ONE_OF_EACH });
    await expect(world.service.getCosts(ENGINEER, REVIEW_ESTIMATE_ID)).rejects.toBeInstanceOf(ForbiddenError);
    expect([world.reads.basis, world.reads.access, world.reads.snapshot].map((log) => log.calls)).toEqual([[], [], []]);
    expect(world.masters.reads).toEqual({ customer: 0, materials: 0, exchange: 0 });
  });

  it('is three short keyed reads of the masters, and one each of the status and the snapshot (NFR-010)', async () => {
    const world = worldOf({ mastersNow: ONE_OF_EACH });
    await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(world.masters.reads).toEqual({ customer: 1, materials: 1, exchange: 1 });
    expect(world.reads.access.calls).toEqual([[REVIEW_ESTIMATE_ID]]);
    expect(world.reads.snapshot.calls).toEqual([[INVENTED_CALCULATION_ID]]);
  });
});

describe('AC-5: the Admin sees what the Lead sees', () => {
  it.each([LEAD, ADMIN])('$role gets the same counts', async (viewer) => {
    expect((await costsOf({ mastersNow: ONE_OF_EACH }, viewer)).ratesChanged).toEqual(ONE_OF_EACH_COUNTS);
  });
});

describe('AC-3: an approved estimate has no notice, and the masters are not even read', () => {
  it('APPROVED: null whatever changed (its figures stand)', async () => {
    const world = worldOf({ status: 'APPROVED', mastersNow: ONE_OF_EACH, approval: { price: '30.00' } });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('current');
    expect(costs.ratesChanged).toBeNull();
    expect(world.masters.reads).toEqual({ customer: 0, materials: 0, exchange: 0 });
    expect(world.reads.snapshot.calls).toEqual([]);
  });
});

describe('AC-4: state `out-of-date` and `none` have no notice, and no master is read for them', () => {
  it('OUT OF DATE: null, and neither the snapshot nor a master is read', async () => {
    const world = worldOf({ inputsRevision: 4, mastersNow: ONE_OF_EACH });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('out-of-date');
    expect(costs.ratesChanged).toBeNull();
    expect(world.reads.snapshot.calls).toEqual([]);
    expect(world.reads.access.calls).toEqual([]);
    expect(world.masters.reads).toEqual({ customer: 0, materials: 0, exchange: 0 });
  });

  it('NONE: null, and nothing is read', async () => {
    const world = worldOf({ calculated: false, mastersNow: ONE_OF_EACH });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('none');
    expect(costs.ratesChanged).toBeNull();
    expect(world.reads.snapshot.calls).toEqual([]);
    expect(world.masters.reads).toEqual({ customer: 0, materials: 0, exchange: 0 });
  });
});

describe('the matrix: state x status, for a change of every kind', () => {
  const STATUSES: ReadonlyArray<EstimateStatus> = ['DRAFT', 'PREPARED', 'APPROVED'];
  const STATES: ReadonlyArray<readonly [string, Partial<ReviewWorldOptions>]> = [
    ['current', {}],
    ['out-of-date', { inputsRevision: 4 }],
    ['none', { calculated: false }],
  ];

  it.each(STATES.flatMap(([state, options]) => STATUSES.map((status) => [state, status, options] as const)))('state %s, status %s', async (state, status, options) => {
    const costs = await costsOf({ ...options, status, mastersNow: ONE_OF_EACH });
    // Only a current calculation of an estimate that is not approved is told (AC-1, AC-3, AC-4). A DRAFT is told too: an unlocked estimate keeps current figures (AC-10).
    const told = state === 'current' && status !== 'APPROVED';
    expect(costs.ratesChanged).toEqual(told ? ONE_OF_EACH_COUNTS : null);
  });
});

describe('AC-6: a master this calculation did not use, and a formula or a configuration change alone, give no notice', () => {
  it('a rate no formula reads changes: no notice', async () => {
    expect((await costsOf({ mastersNow: { unreferencedRate: '99.00' } })).ratesChanged).toBeNull();
  });

  it('a new configuration version in force (number 10 against 9 of the calculation) is not a rate: the world already has one, and there is no notice', async () => {
    const costs = await costsOf();
    expect(costs.configurationNumber).toBe(9);
    expect(costs.ratesChanged).toBeNull();
  });

  it('only the rate it read counts: an unused rate moving with a used one changes the count by one, not two', async () => {
    expect((await costsOf({ mastersNow: { rate: '12.00', unreferencedRate: '99.00' } })).ratesChanged).toEqual({ processRates: 1, materialPrices: 0, exchangeRates: 0 });
  });
});

describe('a customer or a material deleted since or missing: the page is still drawn, with no notice', () => {
  it.each([
    ['customer', { customerDeleted: true }],
    ['material', { materialDeleted: true }],
  ] as const)('a deleted %s is not a count: null, and no error', async (_kind, changed) => {
    expect((await costsOf({ mastersNow: { ...ONE_OF_EACH, ...changed } })).ratesChanged).toBeNull();
  });

  it('a customer that the masters do not hold at all is not a count either: null, and the page is drawn', async () => {
    expect((await costsOf({ mastersNow: { ...ONE_OF_EACH, customerMissing: true } })).ratesChanged).toBeNull();
  });

  it('an estimate that is not there is the 404 it always was', async () => {
    await expect(worldOf().service.getCosts(LEAD, '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(NotFoundError);
  });
});
