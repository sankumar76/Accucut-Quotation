import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';

import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { addTree500Estimate } from '../../support/calculate-tree';
import { TREE500_NODE_COUNT } from '../../support/builders/tree500';
import { defined } from '../../support/defined';
import { formatReport, summarise } from '../../support/perf-stats';

/**
 * STORY-05.09 AC-8 (NFR-008): a Calculate of the `tree500` estimate through the WHOLE path, against PostgreSQL: the parts are read, 500 parts are checked, the masters are read in the transaction,
 * 500 rows are calculated and inserted, the status is set and the transaction commits. The p95 line of NFR-008 (under 2 s) is held by `tests/perf/calc-500-nodes.test.ts`, which runs on demand
 * on a quiet machine (the per-pull-request path never runs a timing, STORY-03.06 AC-4). This test is in the pull-request path, so it asserts the answer and the stored rows, **prints the
 * measure**, and holds only a loose bound (5 s: a regression catcher on a shared runner, not the NFR). Every value is invented.
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

describe('AC-8: a Calculate of 500 parts, through the whole path', () => {
  it('stores 500 rows, submits the estimate, and takes well under the loose bound (the measure is printed)', { timeout: 120_000 }, async () => {
    const viewer = { id: db.engineerId, role: 'ENGINEER' as const };
    const samples: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      const estimateId = await addTree500Estimate(db);
      const started = performance.now();
      const answer = await db.service.calculate(viewer, estimateId);
      samples.push(performance.now() - started);
      expect(answer).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
      const stored = await db.owner.query<{ rows: string; status: string }>(
        `SELECT (SELECT count(*) FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid) AS rows,
                (SELECT status::text FROM estimates WHERE id = $1::uuid) AS status`,
        [estimateId],
      );
      expect(defined(stored.rows[0])).toEqual({ rows: String(TREE500_NODE_COUNT), status: 'SUBMITTED' });
    }
    process.stdout.write(`\n${formatReport(`AC-8 Calculate of ${TREE500_NODE_COUNT} parts through calculation-service.calculate (PostgreSQL), ${RUNS} runs`, summarise(samples))}`);
    expect(summarise(samples).maxMs).toBeLessThan(LOOSE_BOUND_MS);
  });
});
