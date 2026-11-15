import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { NOT_APPLICABLE_MATERIAL_ID } from '@/lib/masters/system-entries';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createCostDetailsService, type CostDetailsService } from '@/server/services/cost-details-service';
import { nodeCostsSchema, type NodeCostsView } from '@/server/views/schemas/node-costs';

import { completePartInputs } from '../../support/complete-part';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-06.03 AC-1, AC-2, AC-5, AC-7 and AC-8 (FR-058, FR-100; NFR-002; architecture sections 4.8, 4.9 and 6 "Cost details") against real PostgreSQL in a throwaway database, as the **runtime role**
 * (the grants of `calculations`, `calculation_rows` and `estimates` are exercised): an Engineer's Calculate stores a record, and the cost details service reads one row of it back for a Lead and an
 * Admin. Every line's value is the stored one, a master changed after the calculation changes nothing in the working (it is built from the record's own snapshot), `none` and `out-of-date` never
 * read the record, and a part of another estimate is not found. Every name and number is invented.
 */

let db: CalculationDatabase;
let details: CostDetailsService;
let reads = 0;

const lead = () => ({ id: db.personId, role: 'LEAD' as const });
const admin = () => ({ id: db.personId, role: 'ADMIN' as const });
const engineer = () => ({ id: db.engineerId, role: 'ENGINEER' as const });

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  details = createCostDetailsService({
    calculations: {
      findFigureBasis: (estimateId) => db.calculations.findFigureBasis(estimateId),
      findRowWorking: (calculationId, nodeId) => {
        reads += 1;
        return db.calculations.findRowWorking(calculationId, nodeId);
      },
    },
    nodes: db.nodes,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** An estimate of the Engineer's with parts one under the other, each complete with its own H and Machining Cost, calculated. Returns its ID and the IDs of its parts in order. */
async function calculatedEstimate(
  typed: ReadonlyArray<{ readonly h: string; readonly cost: string }>,
  materialId: string = db.materialOneId,
): Promise<{ readonly estimateId: string; readonly partIds: ReadonlyArray<string> }> {
  const estimateId = await db.addEstimate({ engineer: true });
  const partIds: string[] = [];
  let parentId: string | null = null;
  for (const [index, part] of typed.entries()) {
    const inputs = { ...completePartInputs(), [idOf('E')]: materialId, [idOf('H')]: part.h, [idOf('AP')]: part.cost, [idOf('D')]: `Invented part ${index + 1}` };
    parentId = await db.addPart(estimateId, { parentId, sortIndex: 0, inputs });
    partIds.push(parentId);
  }
  await db.service.calculate(engineer(), estimateId);
  return { estimateId, partIds };
}

/** What the record holds for a part, read as the owner: its stored outputs by field ID. */
async function storedOutputs(estimateId: string, nodeId: string): Promise<Record<string, string | null>> {
  const { rows } = await db.owner.query<{ outputs: Record<string, string | null> }>(
    'SELECT r.outputs FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid AND r.node_id = $2::uuid',
    [estimateId, nodeId],
  );
  return defined(rows[0]).outputs;
}

const linesOf = (costs: NodeCostsView) => (costs.details?.stages ?? []).flatMap((stage) => [...stage.lines]);

describe('AC-1, AC-2: a calculated estimate is read back, row by row, for a Lead and an Admin', () => {
  it('gives each part its six stages, every calculated line the value the record stores, and an answer that passes the strict schema', async () => {
    const { estimateId, partIds } = await calculatedEstimate([
      { h: '2', cost: '10' },
      { h: '6', cost: '1' },
    ]);
    for (const [index, nodeId] of partIds.entries()) {
      const stored = await storedOutputs(estimateId, nodeId);
      for (const viewer of [lead(), admin()]) {
        const costs = nodeCostsSchema.parse(await details.getNodeCosts(viewer, estimateId, nodeId));
        expect(costs.state).toBe('current');
        expect(costs.row).toEqual({ nodeId, slNo: index === 0 ? '1' : '1.1', name: `Invented part ${index + 1}` });
        expect(costs.details?.stages.map((stage) => stage.number)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(costs.details).toMatchObject({ configurationNumber: 1, letters: { count: 'H', unitPrice: 'BG' }, count: index === 0 ? '2.00' : '6.00', notApplicable: false });
        const calculated = linesOf(costs).filter((line) => line.kind === 'calculated');
        expect(calculated.length).toBeGreaterThan(20);
        for (const line of calculated) {
          expect(line.value, line.letter).toBe(stored[idOf(line.letter)]);
          expect(line.formula, line.letter).not.toBeNull();
          expect(line.working, line.letter).not.toBeNull();
        }
        expect(defined(linesOf(costs).find((line) => line.letter === 'BG')).value).toBe(stored[idOf('BG')]);
      }
    }
  });

  it('asks for a row by its Sl. No as well, and a row is its own: the second part\'s count is its own H', async () => {
    const { estimateId, partIds } = await calculatedEstimate([
      { h: '2', cost: '10' },
      { h: '6', cost: '1' },
    ]);
    const bySlNo = await details.getNodeCostsBySlNo(lead(), estimateId, '1.1');
    expect(bySlNo).toEqual(await details.getNodeCosts(lead(), estimateId, defined(partIds[1])));
    expect(bySlNo.details?.count).toBe('6.00');
  });

  it('the working is the record\'s own: a master changed after the calculation changes nothing in it', async () => {
    const { estimateId, partIds } = await calculatedEstimate([{ h: '3', cost: '12' }]);
    const nodeId = defined(partIds[0]);
    const before = JSON.stringify(await details.getNodeCosts(lead(), estimateId, nodeId));
    await db.owner.query('UPDATE materials SET price_per_kg = price_per_kg + 999.99 WHERE id = $1::uuid', [db.materialOneId]);
    expect(JSON.stringify(await details.getNodeCosts(lead(), estimateId, nodeId))).toBe(before);
  });

  it('prints a percent rate as typed (a percentage), and the exchange rate and the material as the calculation used them', async () => {
    const { estimateId, partIds } = await calculatedEstimate([{ h: '1', cost: '5' }]);
    const costs = await details.getNodeCosts(lead(), estimateId, defined(partIds[0]));
    const line = (letter: string) => defined(linesOf(costs).find((candidate) => candidate.letter === letter));
    expect(line('BD').working).toMatch(/ × \d+(\.\d+)?%$/);
    expect(line('BH').working).toMatch(/^\d+(\.\d+)?$/);
    // The Scrap Weight can be negative when the Part Weight is above the Blank Weight, so a sign may stand before a calculated operand.
    expect(line('AK').working).toMatch(/^\(-?\d+\.\d{4} × \d+(\.\d+)?\) - \(-?\d+\.\d{4} × \d+(\.\d+)?\)$/);
  });
});

describe('AC-5: a row with the "Not applicable" material', () => {
  it('has the material rate blank and 0 for M, O and AK with no worked line, and no Material- operand in any working', async () => {
    const { estimateId, partIds } = await calculatedEstimate([{ h: '1', cost: '5' }], NOT_APPLICABLE_MATERIAL_ID);
    const costs = nodeCostsSchema.parse(await details.getNodeCosts(lead(), estimateId, defined(partIds[0])));
    const line = (letter: string) => defined(linesOf(costs).find((candidate) => candidate.letter === letter));
    expect(costs.details?.notApplicable).toBe(true);
    expect(line('I')).toMatchObject({ value: null, blank: true });
    for (const letter of ['M', 'O', 'AK']) expect(line(letter), letter).toMatchObject({ value: '0', working: null });
    expect(linesOf(costs).flatMap((candidate) => (candidate.working === null ? [] : [candidate.working])).join(' ')).not.toContain('Material-');
  });
});

describe('AC-7: cleared figures are not read at all', () => {
  it('after an input change the state is `out-of-date`, the answer is the row and the state, and the record is not read', async () => {
    const { estimateId, partIds } = await calculatedEstimate([{ h: '2', cost: '10' }]);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const before = reads;
    const costs = await details.getNodeCosts(lead(), estimateId, defined(partIds[0]));
    expect(costs).toEqual({ state: 'out-of-date', row: { nodeId: defined(partIds[0]), slNo: '1', name: 'Invented part 1' }, details: null });
    expect(reads).toBe(before);
  });

  it('no calculation: `none`, the row and no stage, and the record is not read', async () => {
    const bare = await db.addEstimate({ engineer: true });
    const nodeId = await db.addPart(bare, { inputs: { [idOf('H')]: '3' } });
    const before = reads;
    expect(await details.getNodeCosts(lead(), bare, nodeId)).toMatchObject({ state: 'none', details: null });
    expect(reads).toBe(before);
  });

  it('the record is read once while current, for the one row', async () => {
    const { estimateId, partIds } = await calculatedEstimate([{ h: '1', cost: '1' }]);
    const before = reads;
    await details.getNodeCosts(lead(), estimateId, defined(partIds[0]));
    expect(reads).toBe(before + 1);
  });
});

describe('AC-8: an Engineer is refused before anything is read, and a part of another estimate is not found', () => {
  it('an Engineer is refused, and a Lead gets a 404 for an unknown estimate, an unknown part and an ID that is no UUID', async () => {
    const { estimateId, partIds } = await calculatedEstimate([{ h: '1', cost: '1' }]);
    const before = reads;
    await expect(details.getNodeCosts(engineer(), estimateId, defined(partIds[0]))).rejects.toBeInstanceOf(ForbiddenError);
    expect(reads).toBe(before);
    for (const [id, nodeId] of [
      ['00000000-0000-4000-8000-00000000dead', defined(partIds[0])],
      [estimateId, '00000000-0000-4000-8000-00000000dead'],
      ['not-an-id', 'not-an-id'],
    ] as const) {
      await expect(details.getNodeCosts(lead(), id, nodeId)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it('the part of another estimate, asked for under this one, is the same 404 and its working is not read', async () => {
    const first = await calculatedEstimate([{ h: '1', cost: '1' }]);
    const second = await calculatedEstimate([{ h: '9', cost: '9' }]);
    const before = reads;
    await expect(details.getNodeCosts(lead(), first.estimateId, defined(second.partIds[0]))).rejects.toBeInstanceOf(NotFoundError);
    expect(reads).toBe(before);
  });
});
