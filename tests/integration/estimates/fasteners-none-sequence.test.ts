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
 * DEF-038 (AQP-341) against real PostgreSQL: the journey of `estimate-fasteners.spec.ts:113` (Fasteners "M6 bolt", a Qty, a Cost, then "None") as the part form sends it, one save at a time with the
 * revision the one before made, and then every way the server answers about the part. Whatever the screen shows, the server must hold `None` / `0.00` / `0.00` the moment the save of "None" is
 * answered, and nothing it answers afterwards may carry the old values. Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-341';
const S = seedFieldAt('S').id;
const T = seedFieldAt('T').id;
const U = seedFieldAt('U').id;

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
  leadId = await insertPersonAsOwner(db, 'Sequence Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Sequence Arjun', 'ENGINEER');
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

async function setUpPart(): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ('Q-2026-0341', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  return (await service.addPart(arjun, estimateId, { kind: 'item' })).nodeId;
}

async function stored(nodeId: string): Promise<Record<string, unknown>> {
  const result = await db.owner.query<{ inputs: Record<string, unknown> }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(result.rows[0]).inputs;
}

/** What the part form does: each save carries the revision the save before it answered. */
async function journey(nodeId: string): Promise<void> {
  let revision = 1;
  for (const values of [{ [S]: 'M6 bolt' }, { [T]: '5' }, { [U]: '3.5' }, { [S]: 'None' }]) {
    revision = (await service.saveInputs(arjun, estimateId, { nodeId, revision, values })).revision;
  }
}

/** The part as the page reads it back (`GET .../nodes/{id}`), by field ID. */
async function readBack(nodeId: string): Promise<Readonly<Record<string, string>>> {
  return (await service.getNode(arjun, estimateId, nodeId)).inputs;
}

describe('AQP-341 (DEF-038): "None" is what the server holds the moment its save is answered', () => {
  it('one part: after Fasteners, Qty, Cost and "None", the row, the read of the part and the next save all say None / 0.00 / 0.00', async () => {
    const nodeId = await setUpPart();
    await journey(nodeId);
    expect(await stored(nodeId)).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00' });
    expect(await readBack(nodeId)).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00' });
  });

  it('many parts at once, the journey of the part form on each with reads in between: no read, at any time after the save of "None" was answered, shows an old value', async () => {
    const nodeIds = await Promise.all(Array.from({ length: 12 }, (_, index) => setUpAnotherPart(index)));
    const wrong: string[] = [];
    await Promise.all(
      nodeIds.map(async ({ estimate, node }) => {
        let revision = 1;
        const save = async (values: Record<string, string>) => {
          revision = (await service.saveInputs(arjun, estimate, { nodeId: node, revision, values })).revision;
        };
        for (let round = 0; round < 6; round += 1) {
          await save({ [S]: 'M6 bolt' });
          await save({ [T]: '5' });
          await save({ [U]: '3.5' });
          await save({ [S]: 'None' });
          const [row, read] = await Promise.all([stored(node), service.getNode(arjun, estimate, node)]);
          if (row[S] !== 'None' || row[T] !== '0.00' || row[U] !== '0.00') wrong.push(`row ${JSON.stringify(row)}`);
          if (read.inputs[S] !== 'None' || read.inputs[T] !== '0.00' || read.inputs[U] !== '0.00') wrong.push(`read ${JSON.stringify(read.inputs)}`);
        }
      }),
    );
    expect(wrong).toEqual([]);
  }, 60_000);

  it('a Qty and the save of "None" sent at the same revision: one wins, the other is a 409, and the part never ends as None with a Qty', async () => {
    const nodeId = await setUpPart();
    let revision = 1;
    revision = (await service.saveInputs(arjun, estimateId, { nodeId, revision, values: { [S]: 'M6 bolt' } })).revision;
    const settled = await Promise.allSettled([
      service.saveInputs(arjun, estimateId, { nodeId, revision, values: { [T]: '5' } }),
      service.saveInputs(arjun, estimateId, { nodeId, revision, values: { [S]: 'None' } }),
    ]);
    expect(settled.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const now = await service.getNode(arjun, estimateId, nodeId);
    // The one that was refused is sent again with the new revision, as the part form does.
    await service.saveInputs(arjun, estimateId, { nodeId, revision: now.revision, values: { [S]: 'None' } });
    const held = await stored(nodeId);
    expect(held[S]).toBe('None');
    // Whichever save won, a Qty is either not stored (None came first and the rule hid it) or 0.00 (it came first and the rule zeroed it).
    expect([undefined, '0.00']).toContain(held[T]);
  });
});

/** One more draft estimate of Arjun's with one part (its own task code), for the test that runs many journeys at once. */
async function setUpAnotherPart(index: number): Promise<{ estimate: string; node: string }> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [`Q-2026-${String(3000 + index)}`, arjunId, leadId, PATH],
  );
  const estimate = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  return { estimate, node: (await service.addPart(arjun, estimate, { kind: 'item' })).nodeId };
}
