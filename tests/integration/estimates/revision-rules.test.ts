import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { PART_CHANGED_CODE } from '@/server/services/estimate-inputs';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { pngOfSize, smallPng } from '../../support/pictures';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.08 AC-2, AC-3, AC-6, AC-7 against real PostgreSQL in a throwaway database: the revision matrix of every writer of an input. For each one, a real change raises `inputs_revision` by exactly one in
 * the same transaction; the same thing again (a value equal after normalisation, whitespace only, the same customer, the same picture, a move to where the part already is, a blank where nothing was) writes
 * nothing, so it raises nothing and the row is not touched; and a change that is changed back counts as two. Two saves of one part at once, and a save racing a customer change, are serialised by the estimate's
 * lock: nothing is lost and nothing is counted twice. AC-7 is exactly this rule, because the clearing of figures (STORY-06.04) reads `inputs_revision` and nothing else. Every name, path and file is invented.
 *
 * Pictures cannot be deleted (the table is immutable), and a picture keeps its estimate, so each test makes an estimate of its own and nothing is cleaned up: the database is dropped at the end.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const LENGTH = seedFieldAt('J').id;
const PART_NO = seedFieldAt('B').id;
const REMARKS = seedFieldAt('AJ').id;

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let taskCounter = 0;
let customerCounter = 0;

const buildService = (): EstimateService =>
  createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
  });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = buildService();
  leadId = await insertPersonAsOwner(db, 'Revision Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Revision Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

const arjun = (): EstimateViewer => ({ id: arjunId, role: 'ENGINEER' });

interface World {
  readonly estimateId: string;
  readonly first: string;
  readonly second: string;
}

/** A new draft estimate of Arjun's with two top-level parts, each at revision 1. */
async function setUpEstimate(): Promise<World> {
  taskCounter += 1;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [`Q-2026-${String(5000 + taskCounter)}`, arjunId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  const estimateId = defined(estimate.rows[0]).id;
  const first = (await service.addPart(arjun(), estimateId, { kind: 'item' })).nodeId;
  const second = (await service.addPart(arjun(), estimateId, { kind: 'item' })).nodeId;
  return { estimateId, first, second };
}

async function newCustomer(): Promise<string> {
  customerCounter += 1;
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name) VALUES ($1) RETURNING id::text AS id', [`Revision Customer ${String(customerCounter)}`]);
  return defined(rows[0]).id;
}

interface Counts {
  readonly estimate: number;
  readonly part: number;
  /** When the estimate row and the part row were last written: a save that changes nothing leaves both exactly as they were. */
  readonly estimateWritten: string;
  readonly partWritten: string;
}

async function counts(world: World, nodeId: string): Promise<Counts> {
  const estimate = await db.owner.query<{ inputs_revision: number; written: string }>('SELECT inputs_revision, updated_at::text AS written FROM estimates WHERE id = $1::uuid', [world.estimateId]);
  const part = await db.owner.query<{ revision: number; written: string }>('SELECT revision, updated_at::text AS written FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return { estimate: defined(estimate.rows[0]).inputs_revision, part: defined(part.rows[0]).revision, estimateWritten: defined(estimate.rows[0]).written, partWritten: defined(part.rows[0]).written };
}

const partRevision = async (nodeId: string): Promise<number> => (await db.owner.query<{ revision: number }>('SELECT revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]?.revision ?? 0;

/** Saves values into a part as it is now (its revision is read, as the page holds it), and answers what the part holds. */
async function saveNow(world: World, nodeId: string, values: Record<string, string>) {
  return service.saveInputs(arjun(), world.estimateId, { nodeId, revision: await partRevision(nodeId), values });
}

describe('AC-2, AC-3: a value in any input (a number, a text, Remarks)', () => {
  it('a real change raises inputs_revision by one and the part by one, in the same transaction', async () => {
    const world = await setUpEstimate();
    for (const values of [{ [LENGTH]: '3' }, { [PART_NO]: 'FR-1' }, { [REMARKS]: 'Deburr the edge.' }]) {
      const before = await counts(world, world.first);
      await saveNow(world, world.first, values);
      const after = await counts(world, world.first);
      expect(after.estimate, JSON.stringify(values)).toBe(before.estimate + 1);
      expect(after.part, JSON.stringify(values)).toBe(before.part + 1);
    }
  });

  it('the same value again, `1.50` then `1.5`, whitespace only, and a blank where nothing was: nothing is written, no revision moves, and the answer is the part as it is', async () => {
    const world = await setUpEstimate();
    const saved = await saveNow(world, world.first, { [LENGTH]: '1.50', [PART_NO]: 'FR-1', [REMARKS]: 'None' });
    const before = await counts(world, world.first);
    for (const values of [{ [LENGTH]: '1.5' }, { [LENGTH]: ' 01.5 ' }, { [PART_NO]: '  FR-1  ' }, { [REMARKS]: ' None ' }, { [LENGTH]: '1.50', [PART_NO]: 'FR-1' }, { [seedFieldAt('K').id]: '' }, { [seedFieldAt('K').id]: '   ' }]) {
      expect(await saveNow(world, world.first, values), JSON.stringify(values)).toEqual(saved);
    }
    expect(await counts(world, world.first)).toEqual(before);
  });

  it('a value changed and changed back counts as two changes: the revision does not return to what it was', async () => {
    const world = await setUpEstimate();
    await saveNow(world, world.first, { [LENGTH]: '1' });
    const before = await counts(world, world.first);
    await saveNow(world, world.first, { [LENGTH]: '2' });
    await saveNow(world, world.first, { [LENGTH]: '1' });
    const after = await counts(world, world.first);
    expect(after.estimate).toBe(before.estimate + 2);
    expect(after.part).toBe(before.part + 2);
  });

  it('a change of a part counts on the estimate, whichever part it is: two parts, two changes', async () => {
    const world = await setUpEstimate();
    const before = await counts(world, world.first);
    await saveNow(world, world.first, { [LENGTH]: '1' });
    await saveNow(world, world.second, { [LENGTH]: '1' });
    expect((await counts(world, world.first)).estimate).toBe(before.estimate + 2);
  });
});

describe('AC-3: the customer', () => {
  it('a first choice and a different customer are changes; the same customer again, and a change back, behave as the rule says', async () => {
    const world = await setUpEstimate();
    const [a, b] = [await newCustomer(), await newCustomer()];
    const start = (await counts(world, world.first)).estimate;
    await service.setCustomer(arjun(), world.estimateId, a);
    await service.setCustomer(arjun(), world.estimateId, a);
    expect((await counts(world, world.first)).estimate).toBe(start + 1);
    await service.setCustomer(arjun(), world.estimateId, b);
    await service.setCustomer(arjun(), world.estimateId, a);
    expect((await counts(world, world.first)).estimate).toBe(start + 3);
  });

  it('the same customer again writes nothing: the estimate row is not touched', async () => {
    const world = await setUpEstimate();
    const customer = await newCustomer();
    await service.setCustomer(arjun(), world.estimateId, customer);
    const before = await counts(world, world.first);
    await service.setCustomer(arjun(), world.estimateId, customer);
    expect(await counts(world, world.first)).toEqual(before);
  });
});

describe('AC-3: the parts tree', () => {
  it('adding a part is a change; moving a part to where it already is changes nothing; a real move is a change, and moving back is a second one', async () => {
    const world = await setUpEstimate();
    const start = (await counts(world, world.first)).estimate;
    await service.addPart(arjun(), world.estimateId, { kind: 'beside', nodeId: world.second });
    expect((await counts(world, world.first)).estimate).toBe(start + 1);

    const before = await counts(world, world.first);
    await service.moveNode(arjun(), world.estimateId, { nodeId: world.first, revision: await partRevision(world.first), parentId: null, index: 0 });
    expect(await counts(world, world.first)).toEqual(before);

    await service.moveNode(arjun(), world.estimateId, { nodeId: world.second, revision: await partRevision(world.second), parentId: null, index: 0 });
    await service.moveNode(arjun(), world.estimateId, { nodeId: world.second, revision: await partRevision(world.second), parentId: null, index: 1 });
    expect((await counts(world, world.first)).estimate).toBe(before.estimate + 2);
  });
});

describe('AC-3: the picture', () => {
  it('adding is a change; the same file again changes nothing; removing is a change; removing from a part with none changes nothing', async () => {
    const world = await setUpEstimate();
    const start = (await counts(world, world.first)).estimate;
    await service.putPicture(arjun(), world.estimateId, world.first, { name: 'cabinet.png', bytes: smallPng() });
    expect((await counts(world, world.first)).estimate).toBe(start + 1);

    const afterAdd = await counts(world, world.first);
    await service.putPicture(arjun(), world.estimateId, world.first, { name: 'cabinet.png', bytes: smallPng() });
    expect(await counts(world, world.first)).toEqual(afterAdd);

    await service.removePicture(arjun(), world.estimateId, world.first);
    expect((await counts(world, world.first)).estimate).toBe(afterAdd.estimate + 1);

    const afterRemove = await counts(world, world.first);
    await service.removePicture(arjun(), world.estimateId, world.first);
    expect(await counts(world, world.first)).toEqual(afterRemove);
  });

  it('a different picture replaces the first and is a change, and the first one back is another', async () => {
    const world = await setUpEstimate();
    await service.putPicture(arjun(), world.estimateId, world.first, { name: 'one.png', bytes: smallPng() });
    const before = await counts(world, world.first);
    await service.putPicture(arjun(), world.estimateId, world.first, { name: 'two.png', bytes: pngOfSize(1_000) });
    await service.putPicture(arjun(), world.estimateId, world.first, { name: 'one.png', bytes: smallPng() });
    expect((await counts(world, world.first)).estimate).toBe(before.estimate + 2);
  });
});

describe('AC-6: two writers at once lose nothing and are counted once each', () => {
  it('two saves of the same value for the same part with the same revision: one wins, the other is 409, and the estimate counts one change', async () => {
    const world = await setUpEstimate();
    const before = await counts(world, world.first);
    const revision = await partRevision(world.first);
    const outcomes = await Promise.allSettled([
      service.saveInputs(arjun(), world.estimateId, { nodeId: world.first, revision, values: { [LENGTH]: '3' } }),
      service.saveInputs(arjun(), world.estimateId, { nodeId: world.first, revision, values: { [LENGTH]: '3' } }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const refused = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(refused?.status === 'rejected' && refused.reason).toMatchObject({ code: PART_CHANGED_CODE });
    const after = await counts(world, world.first);
    expect(after.estimate).toBe(before.estimate + 1);
    expect(after.part).toBe(before.part + 1);
  });

  it('two saves of different values for the same part with the same revision: the loser keeps nothing of its own in the row, and says so with 409 (the page then offers the newer value)', async () => {
    const world = await setUpEstimate();
    const revision = await partRevision(world.first);
    const outcomes = await Promise.allSettled([
      service.saveInputs(arjun(), world.estimateId, { nodeId: world.first, revision, values: { [LENGTH]: '3' } }),
      service.saveInputs(arjun(), world.estimateId, { nodeId: world.first, revision, values: { [LENGTH]: '4' } }),
    ]);
    const won = outcomes.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
    expect(won).toHaveLength(1);
    const stored = await db.owner.query<{ inputs: Record<string, string> }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [world.first]);
    expect(defined(stored.rows[0]).inputs).toEqual(won[0]?.inputs);
  });

  it('a save and a change of customer at once are both kept, and the estimate counts both', async () => {
    const world = await setUpEstimate();
    const customer = await newCustomer();
    const before = await counts(world, world.first);
    const revision = await partRevision(world.first);
    await Promise.all([service.saveInputs(arjun(), world.estimateId, { nodeId: world.first, revision, values: { [LENGTH]: '5' } }), service.setCustomer(arjun(), world.estimateId, customer)]);
    expect((await counts(world, world.first)).estimate).toBe(before.estimate + 2);
  });

  it('two saves of two different parts of one estimate at once are both kept, and the estimate counts both', async () => {
    const world = await setUpEstimate();
    const before = await counts(world, world.first);
    await Promise.all([
      service.saveInputs(arjun(), world.estimateId, { nodeId: world.first, revision: await partRevision(world.first), values: { [LENGTH]: '6' } }),
      service.saveInputs(arjun(), world.estimateId, { nodeId: world.second, revision: await partRevision(world.second), values: { [LENGTH]: '7' } }),
    ]);
    expect((await counts(world, world.first)).estimate).toBe(before.estimate + 2);
  });
});
