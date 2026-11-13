import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { calculateProductTotals } from '@/lib/estimate/product-totals';
import { calculateRowOutputs } from '@/lib/estimate/row-calculator';
import { storeRowOutputs } from '@/lib/estimate/row-outputs';
import { createPlanCache } from '@/lib/formula';

import { buildTree500, TREE500_NODE_COUNT } from '../support/builders/tree500';
import { formatReport, summarise } from '../support/perf-stats';
import { EXCHANGE, MATERIAL, TYPED_RATES } from '../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';

/**
 * STORY-03.06 AC-1, AC-2 (NFR-008; test strategy sections 4 and 8): recalculating the `tree500` estimate, 20 times, has a p95 under 2 seconds.
 *
 * The path measured is the row calculator (03.03) for each of the 500 nodes, the product totals (03.04), and the in-memory build of the
 * stored record (every output as full-precision text), with the compiled plan cached by version as in architecture section 4.2. The first
 * run builds the plan and the other 19 reuse it, so the p95 includes that cost only as one of the 20 samples. It does not include the
 * database: until the Calculate flow exists (STORY-05.09) there is no insert to time (assumption A-1 of the story). When 05.09 lands, point
 * this test at the full `calculation-service` and record the change in that pull request.
 *
 * Not part of the per-pull-request path (AC-4): `vitest.config.ts` excludes `tests/perf/`, and `npm run test:perf` runs it on demand, on a
 * quiet machine, and in the nightly set once that job is added. The machine differs between runs, so the report below names it. The 2-second
 * line is the NFR; the production host is not known yet (Q-18), so this is a measure on the machine it ran on, not a promise about the host.
 * Every value is invented (NFR-006).
 */

const RUNS = 20;
const P95_LIMIT_MS = 2000;
const VERSION_ID = '00000000-0000-4000-8000-0aaa00000001';

const tree = buildTree500();
const rates = SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: new Decimal(TYPED_RATES[item.name] ?? '0') }));
const material = { pricePerKg: new Decimal(MATERIAL.pricePerKg), specificGravity: new Decimal(MATERIAL.specificGravity), scrapRate: new Decimal(MATERIAL.scrapRate) };
const exchange = { usd: new Decimal(EXCHANGE.usd), eur: new Decimal(EXCHANGE.eur) };
const plans = createPlanCache();

/** One recalculation of the whole estimate. Returns BL and the stored record, so the work cannot be skipped. */
function recalculate(): { totalPrice: string | null; stored: ReadonlyArray<Readonly<Record<string, string | null>>> } {
  const plan = plans.get(VERSION_ID, seedConfig.fields);
  const rows = tree.nodes.map((node) => ({
    inputs: node.inputs,
    outputs: calculateRowOutputs({ document: seedConfig, plan, inputs: node.inputs, rates, material, exchange }),
  }));
  const totals = calculateProductTotals({ document: seedConfig, plan, rows });
  return { totalPrice: totals.totalPrice?.toString() ?? null, stored: rows.map((row) => storeRowOutputs(row.outputs)) };
}

describe('NFR-008: recalculating tree500 takes under 2 seconds (p95 of 20 runs)', { timeout: 120_000 }, () => {
  it('has a p95 under 2 s, and the machine, p95, median and max are printed', () => {
    const samples: number[] = [];
    let firstTotal: string | null | undefined;
    for (let run = 0; run < RUNS; run += 1) {
      const started = performance.now();
      const result = recalculate();
      samples.push(performance.now() - started);
      expect(result.stored).toHaveLength(TREE500_NODE_COUNT);
      firstTotal ??= result.totalPrice;
      // The same tree gives the same answer every run, and BL has a figure.
      expect(result.totalPrice).toBe(firstTotal);
    }
    expect(firstTotal).not.toBeNull();
    const summary = summarise(samples);
    process.stdout.write(`\n${formatReport(`NFR-008 tree500, ${TREE500_NODE_COUNT} nodes, row calculator + product totals + record build`, summary)}`);
    expect(summary.p95Ms).toBeLessThan(P95_LIMIT_MS);
  });
});
