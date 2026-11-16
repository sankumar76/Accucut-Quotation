import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';
import { costsSchema } from '@/server/views/schemas/costs';

import { completePartInputs } from '../../support/complete-part';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { addTree500Estimate } from '../../support/calculate-tree';
import { TREE500_NODE_COUNT } from '../../support/builders/tree500';
import { defined } from '../../support/defined';
import { formatReport, summarise } from '../../support/perf-stats';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-06.02 AC-4, AC-7 and AC-8 (FR-024, FR-025, FR-029; NFR-002, NFR-010; architecture sections 4.8 and 6 "Cost") against real PostgreSQL in a throwaway database, as the **runtime role** (the grants of
 * `calculations`, `calculation_rows` and `estimates` are exercised): an Engineer's Calculate stores a record, and the review service reads it back for a Lead and an Admin. The figures of the answer
 * are the stored ones, `none` and `out-of-date` hold none of them and never read the record, the configuration number is the one the calculation was made with, and a tree of 500 parts is
 * answered well inside the loose bound (the measure is printed; NFR-010 is p95 500 ms). Every name and number is invented.
 */

let db: CalculationDatabase;
let review: EstimateReviewService;
let reads = 0;

const lead = () => ({ id: db.personId, role: 'LEAD' as const });
const engineer = () => ({ id: db.engineerId, role: 'ENGINEER' as const });

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  review = createEstimateReviewService({
    calculations: {
      findFigureBasis: (estimateId) => db.calculations.findFigureBasis(estimateId),
      findReviewFigures: (calculationId) => {
        reads += 1;
        return db.calculations.findReviewFigures(calculationId);
      },
    },
    approvals: db.approvals,
    nodes: db.nodes,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** An estimate of the Engineer's with `count` parts one under the other, each complete, with its own H and Machining Cost, calculated. Returns its ID and the IDs of its parts in order. */
async function calculatedEstimate(typed: ReadonlyArray<{ readonly h: string; readonly cost: string }>): Promise<{ readonly estimateId: string; readonly partIds: ReadonlyArray<string> }> {
  const estimateId = await db.addEstimate({ engineer: true });
  const partIds: string[] = [];
  let parentId: string | null = null;
  for (const [index, part] of typed.entries()) {
    const inputs = { ...completePartInputs(), [idOf('E')]: db.materialOneId, [idOf('H')]: part.h, [idOf('AP')]: part.cost, [idOf('D')]: `Invented part ${index + 1}` };
    parentId = await db.addPart(estimateId, { parentId, sortIndex: 0, inputs });
    partIds.push(parentId);
  }
  await db.service.calculate(engineer(), estimateId);
  return { estimateId, partIds };
}

/** What the record holds, read as the owner: each row's BG by node, and the product values. */
async function storedRecord(estimateId: string): Promise<{ readonly bg: ReadonlyMap<string, string>; readonly productValues: Record<string, string | null>; readonly createdAt: Date }> {
  const rows = await db.owner.query<{ node_id: string; bg: string }>(
    `SELECT r.node_id::text AS node_id, r.outputs ->> $2 AS bg FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid`,
    [estimateId, idOf('BG')],
  );
  const record = await db.owner.query<{ product_values: Record<string, string | null>; created_at: Date }>('SELECT product_values, created_at FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
  return { bg: new Map(rows.rows.map((row) => [row.node_id, row.bg])), productValues: defined(record.rows[0]).product_values, createdAt: defined(record.rows[0]).created_at };
}

describe('AC-4: a calculated estimate is read back for a Lead and an Admin', () => {
  it('gives each part its stored BG and its typed count, BL as stored, the time and the version of the record, and an answer that passes the strict schema', async () => {
    const { estimateId, partIds } = await calculatedEstimate([
      { h: '2', cost: '10' },
      { h: '6', cost: '1' },
      { h: '24', cost: '1' },
    ]);
    const stored = await storedRecord(estimateId);
    for (const viewer of [lead(), { id: db.personId, role: 'ADMIN' as const }]) {
      const costs = costsSchema.parse(await review.getCosts(viewer, estimateId));
      expect(costs.state).toBe('current');
      expect(costs.nodes.map((node) => node.id)).toEqual(partIds);
      expect(costs.nodes.map((node) => node.slNo)).toEqual(['1', '1.1', '1.1.1']);
      expect(costs.nodes.map((node) => node.count)).toEqual(['2', '6', '24']);
      expect(costs.nodes.map((node) => node.figures?.unitPrice)).toEqual(partIds.map((id) => stored.bg.get(id)));
      expect(costs.totals?.totalPrice).toBe(stored.productValues['totalPrice']);
      expect(costs.calculatedAt).toBe(stored.createdAt.toISOString());
      expect(costs.configurationNumber).toBe(1);
      expect(costs.letters).toMatchObject({ count: 'H', unitPrice: 'BG', totalPrice: 'BL', approvedPrice: 'BO' });
    }
  });

  it('BL is the plain sum of the BG column of the rows (no multiplying down the tree), at full precision', async () => {
    const { estimateId } = await calculatedEstimate([
      { h: '1', cost: '10' },
      { h: '1', cost: '5' },
      { h: '2', cost: '3.5' },
    ]);
    const costs = await review.getCosts(lead(), estimateId);
    const sum = costs.nodes.reduce((total, node) => total.plus(new Decimal(defined(node.figures?.unitPrice ?? undefined))), new Decimal(0));
    expect(sum.equals(new Decimal(defined(costs.totals?.totalPrice ?? undefined)))).toBe(true);
  });

  it('the version number is the one the calculation was made with, not the one in force now', async () => {
    const { estimateId } = await calculatedEstimate([{ h: '1', cost: '1' }]);
    await db.owner.query("INSERT INTO config_versions (number, snapshot, reason) VALUES (2, $1::jsonb, 'Invented later version')", [JSON.stringify(seedConfig)]);
    // Version 2 stays (a version is never removed); the tests below calculate with it and do not look at the number.
    expect((await review.getCosts(lead(), estimateId)).configurationNumber).toBe(1);
  });

  it('another estimate\'s calculation is never shown: an estimate with none is `none`, with no figure, and its record is not read', async () => {
    await calculatedEstimate([{ h: '1', cost: '1' }]);
    const bare = await db.addEstimate({ engineer: true });
    await db.addPart(bare, { inputs: { [idOf('H')]: '3' } });
    const before = reads;
    const costs = await review.getCosts(lead(), bare);
    expect(costs).toMatchObject({ state: 'none', totals: null, calculatedAt: null, configurationNumber: null });
    expect(costs.nodes.map((node) => [node.count, node.figures])).toEqual([['3', null]]);
    expect(reads).toBe(before);
  });
});

describe('AC-7: cleared figures are not read at all', () => {
  it('after an input change the state is `out-of-date`, no figure is in the answer and the record is not read', async () => {
    const { estimateId } = await calculatedEstimate([
      { h: '2', cost: '10' },
      { h: '6', cost: '1' },
    ]);
    const stored = await storedRecord(estimateId);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const before = reads;
    const costs = await review.getCosts(lead(), estimateId);
    expect(costs.state).toBe('out-of-date');
    expect(costs.totals).toBeNull();
    expect(costs.nodes.every((node) => node.figures === null)).toBe(true);
    expect(reads).toBe(before);
    expect(JSON.stringify(costs)).not.toContain(defined(stored.productValues['totalPrice'] ?? undefined));
    // The count stays: it is an input.
    expect(costs.nodes.map((node) => node.count)).toEqual(['2', '6']);
  });

  it('the figures are read once while current, by the ID of the linked calculation', async () => {
    const { estimateId } = await calculatedEstimate([{ h: '1', cost: '1' }]);
    const before = reads;
    await review.getCosts(lead(), estimateId);
    expect(reads).toBe(before + 1);
  });
});

describe('AC-5: refusals and unknown estimates', () => {
  it('an Engineer is refused before anything is read, and an unknown or malformed ID is a 404 for a Lead', async () => {
    const { estimateId } = await calculatedEstimate([{ h: '1', cost: '1' }]);
    const before = reads;
    await expect(review.getCosts(engineer(), estimateId)).rejects.toBeInstanceOf(ForbiddenError);
    expect(reads).toBe(before);
    for (const id of ['00000000-0000-4000-8000-00000000dead', 'not-an-id']) await expect(review.getCosts(lead(), id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('AC-8 (NFR-010): 500 parts', () => {
  it('is answered in full, and the time is printed against a loose bound (the NFR is p95 500 ms)', { timeout: 120_000 }, async () => {
    const estimateId = await addTree500Estimate(db);
    await db.service.calculate(engineer(), estimateId);
    const samples: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      const costs = await review.getCosts(lead(), estimateId);
      samples.push(performance.now() - started);
      expect(costs.state).toBe('current');
      expect(costs.nodes).toHaveLength(TREE500_NODE_COUNT);
      expect(costs.nodes.every((node) => node.figures !== null)).toBe(true);
    }
    process.stdout.write(`\n${formatReport(`AC-8 estimate review of ${TREE500_NODE_COUNT} parts through estimate-review-service.getCosts (PostgreSQL), 5 runs`, summarise(samples))}`);
    expect(summarise(samples).maxMs).toBeLessThan(2_000);
  });
});
