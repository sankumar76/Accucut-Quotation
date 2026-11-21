import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.05 AC-3, AC-4, AC-5 (FR-048; SPEC section 14.4; A-03) against real PostgreSQL in a throwaway database: the rule of Fasteners Qty (T) and Cost (U) is applied by the SERVER, in the
 * save's own transaction. While Fasteners (S) is "None" (any letter case, spaces around it) or blank, a Qty and a Cost that the part holds are stored as `0.00` in the `jsonb` and read as
 * 0.00, even if they were typed before; the write that does it raises the part's `revision` and the estimate's `inputs_revision` together (or neither); a part with nothing typed holds `{}`.
 * What the in-memory world cannot show is the stored JSON itself and the row lock, so this reads the row. The same cases without a database are in `tests/unit/estimate/fasteners-save.test.ts`.
 * Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const S = seedFieldAt('S').id;
const T = seedFieldAt('T').id;
const U = seedFieldAt('U').id;
const LENGTH = seedFieldAt('J').id;

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let estimateId: string;

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
    configurationById: () => Promise.resolve(seedConfig),
  });
  leadId = await insertPersonAsOwner(db, 'Fasteners Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Fasteners Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

const arjun: EstimateViewer = {
  get id() {
    return arjunId;
  },
  role: 'ENGINEER',
};
const lead: EstimateViewer = {
  get id() {
    return leadId;
  },
  role: 'LEAD',
};

/** Arjun's draft estimate with one part, whose ID is returned. */
async function setUpPart(): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ('Q-2026-0905', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  return (await service.addPart(arjun, estimateId, { kind: 'item' })).nodeId;
}

async function row(nodeId: string): Promise<{ readonly inputs: Record<string, unknown>; readonly revision: number }> {
  const result = await db.owner.query<{ inputs: Record<string, unknown>; revision: number }>('SELECT inputs, revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(result.rows[0]);
}

async function inputsRevision(): Promise<number> {
  const result = await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(result.rows[0]).inputs_revision;
}

const save = (nodeId: string, revision: number, values: Record<string, string>) => service.saveInputs(arjun, estimateId, { nodeId, revision, values });

describe('AC-3: Fasteners becoming "None" or blank stores Qty and Cost as 0.00', () => {
  it('a Qty and a Cost typed under "M6 bolt" are stored as 0.00 when Fasteners is saved as "None"; both revisions rise by one, in one transaction', async () => {
    const nodeId = await setUpPart();
    await save(nodeId, 1, { [S]: 'M6 bolt', [T]: '5', [U]: '3.5' });
    expect((await row(nodeId)).inputs).toEqual({ [S]: 'M6 bolt', [T]: '5.00', [U]: '3.50' });
    const before = await inputsRevision();
    const saved = await save(nodeId, 2, { [S]: 'None' });
    expect(saved.inputs).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00' });
    expect(await row(nodeId)).toEqual({ inputs: { [S]: 'None', [T]: '0.00', [U]: '0.00' }, revision: 3 });
    expect(await inputsRevision()).toBe(before + 1);
  });

  it.each([['none'], [' NONE '], ['']])('Fasteners saved as %j stores the typed Qty and Cost as 0.00', async (fasteners) => {
    const nodeId = await setUpPart();
    await save(nodeId, 1, { [S]: 'Bolts', [T]: '5', [U]: '3.5' });
    await save(nodeId, 2, { [S]: fasteners });
    const stored = (await row(nodeId)).inputs;
    expect(stored[T]).toBe('0.00');
    expect(stored[U]).toBe('0.00');
  });

  it('a Qty sent in the same save that makes Fasteners "None" is stored as 0.00: the server applies the rule, whatever the browser sent', async () => {
    const nodeId = await setUpPart();
    await save(nodeId, 1, { [S]: 'None', [T]: '9', [U]: '8', [LENGTH]: '10' });
    expect((await row(nodeId)).inputs).toEqual({ [S]: 'None', [LENGTH]: '10.00' });
  });

  it('a part with nothing typed holds {} and stays EMPTY; "None" and a blank leave no 0 behind', async () => {
    const nodeId = await setUpPart();
    expect(await save(nodeId, 1, { [S]: '', [T]: '', [U]: '' })).toMatchObject({ revision: 1, completeness: 'EMPTY', inputs: {} });
    expect((await row(nodeId)).inputs).toEqual({});
  });
});

describe('AC-2: Fasteners becoming anything else shows Qty and Cost, and they take new values', () => {
  it('after "None" and then "Rivets" they hold 0.00, and a new Qty and Cost are stored as typed', async () => {
    const nodeId = await setUpPart();
    await save(nodeId, 1, { [S]: 'Bolts', [T]: '5', [U]: '3.5' });
    await save(nodeId, 2, { [S]: 'None' });
    await save(nodeId, 3, { [S]: 'Rivets' });
    expect((await row(nodeId)).inputs).toEqual({ [S]: 'Rivets', [T]: '0.00', [U]: '0.00' });
    await save(nodeId, 4, { [T]: '7.5', [U]: '1' });
    expect((await row(nodeId)).inputs).toEqual({ [S]: 'Rivets', [T]: '7.50', [U]: '1.00' });
  });
});

describe('AC-5 (A-03): a hidden Qty or Cost is never sent back as it was stored', () => {
  async function setUpStale(): Promise<string> {
    const nodeId = await setUpPart();
    await db.owner.query('UPDATE estimate_nodes SET inputs = $2::jsonb WHERE id = $1::uuid', [nodeId, JSON.stringify({ [S]: 'None', [T]: '5.00', [U]: '3.50', [LENGTH]: '10.00' })]);
    return nodeId;
  }

  it('the read of a part with a stale Qty and Cost answers 0.00 for both, for an Engineer and for a Lead, and the row is not changed by reading', async () => {
    const nodeId = await setUpStale();
    for (const viewer of [arjun, lead]) {
      const part = await service.getNode(viewer, estimateId, nodeId);
      expect(part.inputs, viewer.role).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00', [LENGTH]: '10.00' });
    }
    expect((await row(nodeId)).inputs[T]).toBe('5.00');
  });

  it('a save that changes nothing writes nothing; a save that changes something else stores the stale values as 0.00 and raises both revisions', async () => {
    const nodeId = await setUpStale();
    const before = await inputsRevision();
    const same = await save(nodeId, 1, { [LENGTH]: '10' });
    expect(same.inputs).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00', [LENGTH]: '10.00' });
    expect(await row(nodeId)).toMatchObject({ revision: 1 });
    expect(await inputsRevision()).toBe(before);
    await save(nodeId, 1, { [LENGTH]: '11' });
    expect(await row(nodeId)).toEqual({ inputs: { [S]: 'None', [T]: '0.00', [U]: '0.00', [LENGTH]: '11.00' }, revision: 2 });
    expect(await inputsRevision()).toBe(before + 1);
  });
});
