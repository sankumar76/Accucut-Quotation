import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { approvedEstimateOf, approvedValuesOf, openApprovedWorld, type ApprovedWorld } from '../../support/approved-world';
import { defined } from '../../support/defined';

/**
 * STORY-06.09 AC-5 (ADR-007, NFR-026, NFR-007, negative; architecture section 5.1) against real PostgreSQL in a throwaway database: for an estimate that **is approved** (a real Calculate and a real approval),
 * the runtime role's `UPDATE` and `DELETE` on its `calculations` and `calculation_rows`, and its `UPDATE` of `approvals.approved_price`, are refused by the missing grant; the owner's are refused by the
 * triggers, whoever asks. After every refusal the estimate shows and stores exactly what it did. The grants and triggers as such are also read by `tests/integration/calc/immutability.test.ts` (STORY-03.05) and
 * `grants.test.ts` (STORY-06.06); this file is the story's own check on an approved estimate, statement by statement. Every value is invented.
 */

let world: ApprovedWorld;
let estimateId: string;
let calculationId: string;

beforeAll(async () => {
  world = await openApprovedWorld();
  const approved = await approvedEstimateOf(world);
  estimateId = approved.estimateId;
  calculationId = approved.calculationId;
}, 120_000);

afterAll(async () => {
  await world.db.close();
});

/** A statement, as the title says, and the one ID it is bound to (`$1`): the estimate's for `approvals` and `calculations`, the calculation's for its rows. */
const statements = (): ReadonlyArray<readonly [title: string, sql: string, id: string, table: string]> => [
  ['UPDATE of the approved price', 'UPDATE approvals SET approved_price = approved_price + 1 WHERE estimate_id = $1::uuid', estimateId, 'approvals'],
  ['UPDATE of the calculation\'s product figures', "UPDATE calculations SET product_values = '{}'::jsonb WHERE estimate_id = $1::uuid", estimateId, 'calculations'],
  ['UPDATE of the calculation\'s master snapshot', "UPDATE calculations SET master_snapshot = '{}'::jsonb WHERE estimate_id = $1::uuid", estimateId, 'calculations'],
  ['UPDATE of the calculation\'s configuration version', 'UPDATE calculations SET config_version_id = gen_random_uuid() WHERE estimate_id = $1::uuid', estimateId, 'calculations'],
  ['DELETE of the calculation', 'DELETE FROM calculations WHERE estimate_id = $1::uuid', estimateId, 'calculations'],
  ['UPDATE of a row\'s outputs', "UPDATE calculation_rows SET outputs = '{}'::jsonb WHERE calculation_id = $1::uuid", calculationId, 'calculation_rows'],
  ['UPDATE of a row\'s resolved inputs', "UPDATE calculation_rows SET inputs = '{}'::jsonb WHERE calculation_id = $1::uuid", calculationId, 'calculation_rows'],
  ['DELETE of a row', 'DELETE FROM calculation_rows WHERE calculation_id = $1::uuid', calculationId, 'calculation_rows'],
];

describe('AC-5: the runtime role cannot change what an approved estimate was approved with', () => {
  it.each(statements().map(([title]) => title))('%s is refused by the missing grant (42501), and the estimate shows and stores what it did', async (title) => {
    const [, sql, id] = defined(statements().find(([candidate]) => candidate === title));
    const before = await approvedValuesOf(world, estimateId);
    await expect(world.db.runtime.query(sql, [id])).rejects.toMatchObject({ code: '42501' });
    expect(await approvedValuesOf(world, estimateId)).toEqual(before);
  });
});

describe('AC-5: the owner cannot either: the triggers refuse every role', () => {
  it.each(statements().map(([title]) => title))('%s is refused by a trigger, and the estimate shows and stores what it did', async (title) => {
    const [, sql, id, table] = defined(statements().find(([candidate]) => candidate === title));
    const before = await approvedValuesOf(world, estimateId);
    const words = table === 'approvals' ? 'The approved values of an approval cannot be changed.' : `Table "${table}" is immutable`;
    await expect(world.db.owner.query(sql, [id])).rejects.toThrow(words);
    expect(await approvedValuesOf(world, estimateId)).toEqual(before);
  });

  it('the approval itself cannot be deleted by the owner, and the estimate is still approved at its price', async () => {
    await expect(world.db.owner.query('DELETE FROM approvals WHERE estimate_id = $1::uuid', [estimateId])).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('Table "approvals" is immutable: DELETE is not allowed') });
    const costs = await world.review.getCosts(world.lead, estimateId);
    expect(costs.approval).toMatchObject({ price: '1000.00' });
  });
});
