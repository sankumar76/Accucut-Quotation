import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { addTree500Estimate } from '../../support/calculate-tree';
import { TREE500_NODE_COUNT } from '../../support/builders/tree500';
import { defined } from '../../support/defined';
import { formatReport, summarise } from '../../support/perf-stats';

/**
 * STORY-06.04 AC-3 and AC-8 (NFR-008; FR-061; architecture sections 4.2 and 4.8) against real PostgreSQL in a throwaway database, as the **runtime role**: a Lead's Recalculate of the `tree500` estimate runs
 * through the SAME path as the Engineer's Calculate (one service, one transaction, the masters and the configuration read inside it), stores 500 rows made by the Lead, and keeps the estimate PREPARED. This
 * test is in the pull-request path, so it asserts the stored rows, **prints the measure** and holds only a loose bound (5 s: a regression catcher on a shared runner, not the NFR); the p95 line of NFR-008
 * (under 2 s) is `tests/perf/calc-500-nodes.test.ts`'s, which runs on demand on a quiet machine (STORY-03.06 AC-4). The cleared-state matrix of every writer is `tests/integration/estimates/cleared.test.ts`.
 * Every value is invented.
 */

const RUNS = 3;
const LOOSE_BOUND_MS = 5_000;

let db: CalculationDatabase;

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-8: a Recalculate of 500 parts, through the whole path', () => {
  it('stores 500 rows in the Lead\'s name, keeps the estimate PREPARED, and takes well under the loose bound (the measure is printed)', { timeout: 120_000 }, async () => {
    const engineer = { id: db.engineerId, role: 'ENGINEER' as const };
    const lead = { id: db.personId, role: 'LEAD' as const };
    const samples: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      const estimateId = await addTree500Estimate(db);
      await db.service.calculate(engineer, estimateId);
      // An input changes (the estimate's revision goes up), so the figures are cleared and the Lead presses Recalculate.
      await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
      const started = performance.now();
      await db.service.recalculate(lead, estimateId);
      samples.push(performance.now() - started);
      const stored = await db.owner.query<{ rows: string; status: string; made_by: string; revisions_match: boolean }>(
        `SELECT (SELECT count(*) FROM calculation_rows r WHERE r.calculation_id = c.id) AS rows,
                e.status::text AS status, c.created_by::text AS made_by, c.inputs_revision = e.inputs_revision AS revisions_match
           FROM estimates e JOIN calculations c ON c.id = e.current_calculation_id WHERE e.id = $1::uuid`,
        [estimateId],
      );
      expect(defined(stored.rows[0])).toEqual({ rows: String(TREE500_NODE_COUNT), status: 'PREPARED', made_by: db.personId, revisions_match: true });
    }
    process.stdout.write(`\n${formatReport(`AC-8 Recalculate of ${TREE500_NODE_COUNT} parts through calculation-service.recalculate (PostgreSQL), ${RUNS} runs`, summarise(samples))}`);
    expect(summarise(samples).maxMs).toBeLessThan(LOOSE_BOUND_MS);
  });
});

describe('AC-3: one path for both presses', () => {
  it('the same estimate calculated by the Engineer and recalculated by the Lead from the same inputs and masters gets the same figures: two records, equal to the last digit', async () => {
    const engineer = { id: db.engineerId, role: 'ENGINEER' as const };
    const lead = { id: db.personId, role: 'LEAD' as const };
    const estimateId = await db.addCompleteEstimate({ parts: 2 });
    await db.service.calculate(engineer, estimateId);
    await db.service.recalculate(lead, estimateId);
    const { rows } = await db.owner.query<{ product_values: unknown; outputs: unknown }>(
      `SELECT c.product_values, (SELECT json_agg(r.outputs ORDER BY r.sl_no) FROM calculation_rows r WHERE r.calculation_id = c.id) AS outputs
         FROM calculations c WHERE c.estimate_id = $1::uuid ORDER BY c.created_at, c.id`,
      [estimateId],
    );
    expect(rows).toHaveLength(2);
    expect(defined(rows[1]).product_values).toEqual(defined(rows[0]).product_values);
    expect(defined(rows[1]).outputs).toEqual(defined(rows[0]).outputs);
  });
});
