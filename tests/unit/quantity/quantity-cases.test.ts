import { describe, expect, it } from 'vitest';

import { Decimal, type Value } from '@/lib/decimal';
import { calculateProductTotals, type ProductRow } from '@/lib/estimate/product-totals';
import { compilePlan } from '@/lib/formula';

import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

import { CE_11_REORDERED, QUANTITY_CASES, type CaseRow } from './quantity-cases';

/**
 * STORY-03.04 AC-1, AC-2, AC-3, AC-6 (FR-024, FR-025, FR-029, FR-030; test strategy sections 5.2, 5.3 and 5.5): the seed's `BL = SUM(BG)`
 * and `BN = BL / SUM(BM)` run through the real evaluator (`evaluateProductFormulas`) over each case's stated BG. The expected figures are the
 * hand-worked ones of `quantity-cases.ts`. Invented numbers only.
 */

const plan = compilePlan(seedConfig.fields);
const BG = seedFieldAt('BG').id;
const BM = seedFieldAt('BM').id;

/** A row as the totals read it: its stored BG (which may have no figure) and, if typed, its Tool Cost. */
function productRow(bg: Value, toolCost?: string): ProductRow {
  return { outputs: { values: new Map([[BG, bg]]) }, inputs: new Map(toolCost === undefined ? [] : [[BM, new Decimal(toolCost)]]) };
}

const fromCase = (rows: ReadonlyArray<CaseRow>): ProductRow[] => rows.map((row) => productRow(new Decimal(row.bg), row.toolCost));

const totalsOf = (rows: ReadonlyArray<ProductRow>) => calculateProductTotals({ document: seedConfig, plan, rows });

const shown = (value: Value): string | null => (value === null ? null : value.toString());

describe('AC-1: BL is the plain sum of BG over every row (CE-1 to CE-12)', () => {
  it.each(QUANTITY_CASES.map((c) => [c.id, c.title, c] as const))('%s: %s', (_id, _title, quantityCase) => {
    const bl = shown(totalsOf(fromCase(quantityCase.rows)).totalPrice);
    for (const wrong of quantityCase.wrong ?? []) {
      expect(bl, `BL of ${wrong.bl} would mean ${wrong.means}`).not.toBe(wrong.bl);
    }
    expect(bl).toBe(quantityCase.bl);
  });

  it('the stated BG of every row is the per-piece cost times the count, so the cases are consistent with BB = BA x H', () => {
    for (const quantityCase of QUANTITY_CASES) {
      for (const row of quantityCase.rows) {
        expect(new Decimal(row.cost).times(new Decimal(row.h)).toString(), `${quantityCase.id} row ${row.sl}`).toBe(row.bg);
      }
    }
  });

  it('CE-11: reordering the rows of CE-1, or moving the sub-part under the item, leaves BL at 30', () => {
    expect(shown(totalsOf(fromCase(CE_11_REORDERED)).totalPrice)).toBe('30');
  });

  it('CE-12: an estimate with no rows totals 0, and BL does not divide by zero', () => {
    const totals = totalsOf([]);
    expect(shown(totals.totalPrice)).toBe('0');
    expect(totals.pricePerToolCost).toBeNull();
  });
});

describe('AC-2 (FR-025, D-05, CE-7): BN is BL over the total Tool Cost, with no quantity applied', () => {
  const ce7 = defined(QUANTITY_CASES.find((c) => c.id === 'CE-7'), 'case CE-7');

  it('Tool Cost 2 and 3 give a total of 5 and BN = 30 / 5 = 6', () => {
    const totals = totalsOf(fromCase(ce7.rows));
    expect(shown(totals.toolCostTotal)).toBe('5');
    expect(shown(totals.totalPrice)).toBe('30');
    expect(shown(totals.pricePerToolCost)).toBe('6');
  });

  it('the Tool Cost is totalled as typed: a row with a count of 24 does not multiply its entry', () => {
    const rows = [productRow(new Decimal('24'), '3'), productRow(new Decimal('6'), '2')];
    expect(shown(totalsOf(rows).toolCostTotal)).toBe('5');
  });

  it('with no Tool Cost, BN has no figure (a dash on screen, an empty export cell) and the total shows 0', () => {
    const totals = totalsOf(ce7.rows.map((row) => productRow(new Decimal(row.bg))));
    expect(shown(totals.toolCostTotal)).toBe('0');
    expect(totals.pricePerToolCost).toBeNull();
    expect(shown(totals.totalPrice)).toBe('30');
  });

  it('a Tool Cost entered as 0 is the same as none', () => {
    const totals = totalsOf([productRow(new Decimal('30'), '0')]);
    expect(shown(totals.toolCostTotal)).toBe('0');
    expect(totals.pricePerToolCost).toBeNull();
  });
});

describe('AC-3 (CE-8, A-07): a row without a figure in BG gives BL no figure, never a lower number', () => {
  it('one null among three makes BL and BN null', () => {
    const totals = totalsOf([productRow(new Decimal('6')), productRow(null), productRow(new Decimal('24'), '5')]);
    expect(totals.totalPrice).toBeNull();
    expect(totals.pricePerToolCost).toBeNull();
    expect(shown(totals.toolCostTotal)).toBe('5');
  });
});

describe('AC-4: BO is only ever written by an approval', () => {
  it('has no figure here, whatever the rows hold', () => {
    expect(totalsOf(fromCase(QUANTITY_CASES.flatMap((c) => c.rows))).approvedPrice).toBeNull();
    expect(totalsOf([]).approvedPrice).toBeNull();
  });

  it('is not among the calculated product values: BL and BN only', () => {
    const totals = totalsOf(fromCase(QUANTITY_CASES.flatMap((c) => c.rows)));
    expect([...totals.values.keys()].sort()).toEqual([seedFieldAt('BL').id, seedFieldAt('BN').id].sort());
  });
});

/** A small deterministic generator (mulberry32), so a failing tree can be rebuilt from its seed without a library. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GeneratedRow {
  readonly h: Decimal;
  readonly cost: Decimal;
}

const HS = ['0', '0.5', '1', '1.25', '2', '3', '6', '24'];
const COSTS = ['0', '1', '2.5', '10', '17.25', '200'];

/** Rows with a count of 0, a fraction, 1 and above, and costs of 0 and above, as the strategy asks. */
function generate(seed: number): GeneratedRow[] {
  const next = random(seed);
  const count = 1 + Math.floor(next() * 12);
  return Array.from({ length: count }, () => ({
    h: new Decimal(HS[Math.floor(next() * HS.length)] ?? '1'),
    cost: new Decimal(COSTS[Math.floor(next() * COSTS.length)] ?? '1'),
  }));
}

const bgOf = (row: GeneratedRow): Decimal => row.cost.times(row.h);
const asRows = (rows: ReadonlyArray<GeneratedRow>): ProductRow[] => rows.map((row) => productRow(bgOf(row)));
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

describe('AC-6 (test strategy section 5.5): properties over generated trees, compared at 2 decimals', () => {
  it.each(SEEDS)('seed %i: BL equals the plain sum of the rows\' BG', (seed) => {
    const rows = generate(seed);
    const plain = rows.reduce((total, row) => total.plus(bgOf(row)), new Decimal(0));
    expect(totalsOf(asRows(rows)).totalPrice?.toFixed(2)).toBe(plain.toFixed(2));
  });

  it.each(SEEDS)('seed %i: reordering the rows leaves BL unchanged (CE-11)', (seed) => {
    const rows = generate(seed);
    const next = random(seed + 1000);
    const shuffled = [...rows].sort(() => next() - 0.5);
    expect(totalsOf(asRows(shuffled)).totalPrice?.toFixed(2)).toBe(totalsOf(asRows(rows)).totalPrice?.toFixed(2));
  });

  it.each(SEEDS)('seed %i: setting one row to H 0 lowers BL by that row\'s own BG and by nothing else', (seed) => {
    const rows = generate(seed);
    const index = seed % rows.length;
    const target = rows[index];
    if (target === undefined) throw new Error('The generator made no row.');
    const zeroed = rows.map((row, position) => (position === index ? { ...row, h: new Decimal(0) } : row));
    const before = totalsOf(asRows(rows)).totalPrice;
    const after = totalsOf(asRows(zeroed)).totalPrice;
    expect(after?.toFixed(2)).toBe(before?.minus(bgOf(target)).toFixed(2));
  });

  it.each(SEEDS.slice(0, 50))('seed %i: with every quantity 1, BL is the sum of the per-piece costs (CE-5)', (seed) => {
    const rows = generate(seed).map((row) => ({ ...row, h: new Decimal(1) }));
    const costs = rows.reduce((total, row) => total.plus(row.cost), new Decimal(0));
    expect(totalsOf(asRows(rows)).totalPrice?.toFixed(2)).toBe(costs.toFixed(2));
  });
});
