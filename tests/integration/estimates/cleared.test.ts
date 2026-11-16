import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';
import type { EstimateViewer } from '@/server/services/estimate-service';
import { costsSchema, type CostsView } from '@/server/views/schemas/costs';

import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { pngOfSize, smallPng } from '../../support/pictures';

/**
 * STORY-06.04 AC-1, AC-2, AC-3 and AC-6 (FR-100, FR-101, FR-061; architecture sections 4.4 and 4.8) against real PostgreSQL in a throwaway database, as the **runtime role**: the matrix of every writer of an
 * input against the state of the figures before it. A Lead changes an input of a calculated estimate in each way an input can change (a typed number, Remarks, the customer, a part added, deleted, moved, a
 * picture added and removed), and **each one**, read straight after, leaves the review in the state `out-of-date` with no figure on any row and no total, the counts still there; Recalculate brings it back to
 * `current`. A save that changes nothing, and an unlock alone, leave the state as it was; a value changed and changed back stays cleared. Two presses of Recalculate at once, and a save racing a Recalculate,
 * are serialised by the estimate's row lock (nothing is lost, nothing is counted twice). Every name and number is invented.
 */

let db: CalculationDatabase;
let review: EstimateReviewService;
let customerCounter = 0;

const lead = (): EstimateViewer => ({ id: db.personId, role: 'LEAD' });
const engineer = (): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  review = createEstimateReviewService({
    calculations: db.calculations,
    approvals: db.approvals,
    nodes: db.nodes,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

interface World {
  readonly estimateId: string;
  /** The top part and the part under it. */
  readonly top: string;
  readonly child: string;
}

/** A calculated estimate of the Engineer's: two parts, one under the other, calculated, so it is SUBMITTED and the figures are current. */
async function calculatedWorld(): Promise<World> {
  const estimateId = await db.addCompleteEstimate({ parts: 2 });
  await db.service.calculate(engineer(), estimateId);
  const parts = await db.nodes.listNodes(estimateId);
  return { estimateId, top: defined(parts.find((part) => part.parentId === null)).id, child: defined(parts.find((part) => part.parentId !== null)).id };
}

async function revisionOf(nodeId: string): Promise<number> {
  return defined((await db.owner.query<{ revision: number }>('SELECT revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]).revision;
}

async function newCustomer(): Promise<string> {
  customerCounter += 1;
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name) VALUES ($1) RETURNING id::text AS id', [`Cleared Customer ${String(customerCounter)}`]);
  return defined(rows[0]).id;
}

/** The estimate's two counts: the revision of its inputs and the revision of the calculation it is linked to. */
async function revisions(estimateId: string): Promise<{ readonly inputs: number; readonly calculation: number | null }> {
  const { rows } = await db.owner.query<{ inputs: number; calculation: number | null }>(
    `SELECT e.inputs_revision AS inputs, c.inputs_revision AS calculation FROM estimates e LEFT JOIN calculations c ON c.id = e.current_calculation_id WHERE e.id = $1::uuid`,
    [estimateId],
  );
  return defined(rows[0]);
}

const costsOf = async (estimateId: string): Promise<CostsView> => costsSchema.parse(await review.getCosts(lead(), estimateId));

/** What a cleared answer holds: the state, no total, no figure on any row, and the counts of the parts that are still there (they are inputs). */
function expectCleared(costs: CostsView): void {
  expect(costs.state).toBe('out-of-date');
  expect(costs.totals).toBeNull();
  expect(costs.nodes.length).toBeGreaterThan(0);
  expect(costs.nodes.every((node) => node.figures === null)).toBe(true);
}

/** The writers that leave an empty part behind, which Recalculate then refuses until it is filled in. */
const ADDS_AN_EMPTY_PART: ReadonlySet<string> = new Set(['a part added', 'a part reordered among its siblings']);

/** Every way an input can change, each as a Lead (who may edit a submitted estimate) would make it. */
const WRITERS: ReadonlyArray<readonly [string, (world: World) => Promise<unknown>]> = [
  ['a typed number', async (world) => db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.child, revision: await revisionOf(world.child), values: { [idOf('J')]: '91' } })],
  ['Remarks', async (world) => db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.top, revision: await revisionOf(world.top), values: { [idOf('AJ')]: 'Deburr the edge.' } })],
  ['the customer', async (world) => db.estimateService.setCustomer(lead(), world.estimateId, await newCustomer())],
  ['a part added', async (world) => db.estimateService.addPart(lead(), world.estimateId, { kind: 'beside', nodeId: world.top })],
  [
    'a part deleted',
    async (world) =>
      db.estimateService.deleteNode(lead(), world.estimateId, {
        nodeId: world.child,
        revision: await revisionOf(world.child),
        parts: 1,
        subtree: subtreeFingerprint([{ id: world.child, revision: await revisionOf(world.child) }]),
      }),
  ],
  ['a part moved', async (world) => db.estimateService.moveNode(lead(), world.estimateId, { nodeId: world.child, revision: await revisionOf(world.child), parentId: null, index: 0 })],
  ['a part reordered among its siblings', async (world) => {
    const beside = await db.estimateService.addPart(lead(), world.estimateId, { kind: 'beside', nodeId: world.top });
    return db.estimateService.moveNode(lead(), world.estimateId, { nodeId: beside.nodeId, revision: await revisionOf(beside.nodeId), parentId: null, index: 0 });
  }],
  ['a picture added', async (world) => db.estimateService.putPicture(lead(), world.estimateId, world.top, { name: 'cabinet.png', bytes: smallPng() })],
  [
    'a picture removed',
    async (world) => {
      await db.estimateService.putPicture(lead(), world.estimateId, world.top, { name: 'cabinet.png', bytes: pngOfSize(1_000) });
      return db.estimateService.removePicture(lead(), world.estimateId, world.top);
    },
  ],
];

describe('AC-1: every writer clears the figures, and each is read straight after', () => {
  it.each(WRITERS)('%s: the state is `out-of-date`, no figure is in the answer, and Recalculate brings it back', async (name, write) => {
    const world = await calculatedWorld();
    expect((await costsOf(world.estimateId)).state).toBe('current');
    const before = await revisions(world.estimateId);
    await write(world);
    const after = await revisions(world.estimateId);
    expect(after.inputs, 'the input revision went up').toBeGreaterThan(before.inputs);
    expect(after.calculation, 'the record is the one it was').toBe(before.calculation);
    expectCleared(await costsOf(world.estimateId));
    if (ADDS_AN_EMPTY_PART.has(name)) {
      // The new part is empty, so Recalculate refuses (422, nothing written) and the figures stay cleared until its inputs are filled in: the same checks as Calculate (AC-3).
      await expect(db.service.recalculate(lead(), world.estimateId)).rejects.toMatchObject({ code: 'CALCULATE_BLOCKED' });
      expectCleared(await costsOf(world.estimateId));
      return;
    }
    await db.service.recalculate(lead(), world.estimateId);
    const current = await costsOf(world.estimateId);
    expect(current.state).toBe('current');
    // A customer chosen afresh has no rates of its own in this database, so its totals are empty; every other writer leaves the figures to read.
    if (name !== 'the customer') {
      expect(current.nodes.some((node) => node.figures !== null)).toBe(true);
      expect(current.totals?.totalPrice).not.toBeNull();
    }
  });

  it('the counts of the parts stay while the figures are cleared (they are inputs), and the record is not read', async () => {
    const world = await calculatedWorld();
    const before = await costsOf(world.estimateId);
    await WRITERS[0]?.[1](world);
    const cleared = await costsOf(world.estimateId);
    expect(cleared.nodes.map((node) => node.count)).toEqual(before.nodes.map((node) => node.count));
    expect(cleared.nodes.every((node) => node.count !== null)).toBe(true);
  });

  it('an estimate that was never calculated stays `none` after any change, and the review holds no figure', async () => {
    const estimateId = await db.addCompleteEstimate({ parts: 1 });
    const [top] = await db.nodes.listNodes(estimateId);
    await db.estimateService.saveInputs(engineer(), estimateId, { nodeId: defined(top).id, revision: await revisionOf(defined(top).id), values: { [idOf('J')]: '92' } });
    const costs = await costsOf(estimateId);
    expect(costs.state).toBe('none');
    expect(costs.totals).toBeNull();
    expect(costs.nodes.every((node) => node.figures === null)).toBe(true);
  });
});

describe('AC-2: a save with no real change, and a change that is changed back', () => {
  it('the same value again, whitespace only, and the same customer: the state stays `current`', async () => {
    const world = await calculatedWorld();
    await db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.child, revision: await revisionOf(world.child), values: { [idOf('AJ')]: 'Same note' } });
    await db.service.recalculate(lead(), world.estimateId);
    const before = await revisions(world.estimateId);
    await db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.child, revision: await revisionOf(world.child), values: { [idOf('AJ')]: '  Same note  ' } });
    await db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.child, revision: await revisionOf(world.child), values: { [idOf('AJ')]: 'Same note' } });
    await db.estimateService.setCustomer(lead(), world.estimateId, db.customerId);
    expect(await revisions(world.estimateId)).toEqual(before);
    expect((await costsOf(world.estimateId)).state).toBe('current');
  });

  it('a value changed and changed back is two changes: the figures stay cleared until Recalculate', async () => {
    const world = await calculatedWorld();
    const original = defined((await db.nodes.listNodes(world.estimateId)).find((node) => node.id === world.top)).inputs[idOf('J')];
    const typed = typeof original === 'string' ? original : '1';
    await db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.top, revision: await revisionOf(world.top), values: { [idOf('J')]: '93' } });
    await db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.top, revision: await revisionOf(world.top), values: { [idOf('J')]: typed } });
    expectCleared(await costsOf(world.estimateId));
  });
});

describe('AC-3: Recalculate stores a new calculation with the Lead\'s name and changes the status as the machine says', () => {
  it('a cleared Submitted estimate stays SUBMITTED, gets a second record made by the Lead, and its link moves to it', async () => {
    const world = await calculatedWorld();
    await WRITERS[0]?.[1](world);
    await db.service.recalculate(lead(), world.estimateId);
    const { rows } = await db.owner.query<{ status: string; made_by: string; calculations: string; linked: string; newest: string }>(
      `SELECT e.status::text AS status, c.created_by::text AS made_by,
              (SELECT count(*) FROM calculations WHERE estimate_id = e.id) AS calculations,
              e.current_calculation_id::text AS linked,
              (SELECT id::text FROM calculations WHERE estimate_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1) AS newest
         FROM estimates e JOIN calculations c ON c.id = e.current_calculation_id WHERE e.id = $1::uuid`,
      [world.estimateId],
    );
    expect(defined(rows[0])).toMatchObject({ status: 'SUBMITTED', made_by: db.personId, calculations: '2' });
    expect(defined(rows[0]).linked).toBe(defined(rows[0]).newest);
    expect((await revisions(world.estimateId)).calculation).toBe((await revisions(world.estimateId)).inputs);
  });

  it('an unlocked estimate (a Draft with a record) becomes SUBMITTED on a press; one that was never calculated is calculated for the first time', async () => {
    const world = await calculatedWorld();
    await db.owner.query("UPDATE estimates SET status = 'DRAFT' WHERE id = $1::uuid", [world.estimateId]);
    await db.service.recalculate(lead(), world.estimateId);
    expect((await db.owner.query<{ status: string }>('SELECT status::text FROM estimates WHERE id = $1::uuid', [world.estimateId])).rows[0]?.status).toBe('SUBMITTED');

    const fresh = await db.addCompleteEstimate({ parts: 1 });
    await db.service.recalculate(lead(), fresh);
    expect((await costsOf(fresh)).state).toBe('current');
    expect((await db.owner.query<{ made_by: string }>('SELECT created_by::text AS made_by FROM calculations WHERE estimate_id = $1::uuid', [fresh])).rows[0]?.made_by).toBe(db.personId);
  });

  it('an Approved estimate is the 409 ESTIMATE_APPROVED_IS_LOCKED and writes nothing; an Engineer is refused whatever the estimate', async () => {
    const world = await calculatedWorld();
    await db.owner.query("UPDATE estimates SET status = 'APPROVED' WHERE id = $1::uuid", [world.estimateId]);
    await expect(db.service.recalculate(lead(), world.estimateId)).rejects.toMatchObject({ code: 'ESTIMATE_APPROVED_IS_LOCKED' });
    await db.owner.query("UPDATE estimates SET status = 'SUBMITTED' WHERE id = $1::uuid", [world.estimateId]);
    await expect(db.service.recalculate(engineer(), world.estimateId)).rejects.toMatchObject({ httpStatus: 404 });
    expect(Number((await db.owner.query<{ n: string }>('SELECT count(*) AS n FROM calculations WHERE estimate_id = $1::uuid', [world.estimateId])).rows[0]?.n)).toBe(1);
  });

  it('a blank input is the 422 CALCULATE_BLOCKED and writes nothing: no record, the status and the link as they were', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    await db.addPart(estimateId, { inputs: {} });
    await expect(db.service.recalculate(lead(), estimateId)).rejects.toMatchObject({ code: 'CALCULATE_BLOCKED' });
    const { rows } = await db.owner.query<{ status: string; linked: string | null; n: string }>(
      'SELECT e.status::text AS status, e.current_calculation_id::text AS linked, (SELECT count(*) FROM calculations WHERE estimate_id = e.id) AS n FROM estimates e WHERE e.id = $1::uuid',
      [estimateId],
    );
    expect(defined(rows[0])).toEqual({ status: 'DRAFT', linked: null, n: '0' });
  });
});

describe('AC-6: an unlock alone changes no input', () => {
  it('Approved to Draft by an unlock leaves the revision and the state as they were: the figures stay current', async () => {
    const world = await calculatedWorld();
    await db.owner.query("UPDATE estimates SET status = 'APPROVED' WHERE id = $1::uuid", [world.estimateId]);
    const before = await revisions(world.estimateId);
    await db.estimateService.transition(lead(), world.estimateId, 'UNLOCK');
    expect(await revisions(world.estimateId)).toEqual(before);
    expect((await costsOf(world.estimateId)).state).toBe('current');
  });
});

describe('concurrency: the estimate\'s row lock serialises a save and a Recalculate, and two presses', () => {
  it('two presses at once make two records, and the second sees the first\'s status (one lock, no lost update)', async () => {
    const world = await calculatedWorld();
    await WRITERS[0]?.[1](world);
    const outcomes = await Promise.allSettled([db.service.recalculate(lead(), world.estimateId), db.service.recalculate(lead(), world.estimateId)]);
    expect(outcomes.every((outcome) => outcome.status === 'fulfilled')).toBe(true);
    expect(Number((await db.owner.query<{ n: string }>('SELECT count(*) AS n FROM calculations WHERE estimate_id = $1::uuid', [world.estimateId])).rows[0]?.n)).toBe(3);
    expect((await costsOf(world.estimateId)).state).toBe('current');
  });

  it('a save racing a Recalculate: whichever the lock lets in first, the end state is consistent: current only if the record was made at the revision the estimate has', async () => {
    const world = await calculatedWorld();
    await WRITERS[0]?.[1](world);
    const save = async () => db.estimateService.saveInputs(lead(), world.estimateId, { nodeId: world.top, revision: await revisionOf(world.top), values: { [idOf('AJ')]: 'Raced note' } });
    await Promise.allSettled([db.service.recalculate(lead(), world.estimateId), save()]);
    const { inputs, calculation } = await revisions(world.estimateId);
    const state = (await costsOf(world.estimateId)).state;
    expect(state).toBe(calculation === inputs ? 'current' : 'out-of-date');
  });
});
