import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { CHOOSE_TREATMENT_MESSAGE, encodeTreatment } from '@/lib/estimate/treatment-value';
import { NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID, OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';
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
 * STORY-05.06 AC-1, AC-4 (architecture section 5.1 "A treatment on an estimate, and deleting one", QLT-09) against real PostgreSQL in a throwaway database: Treatment / Color is stored in the part's
 * `jsonb` as `{ "id", "text" }` with the row's name written by the server; the surface treatments are stored as `1` and `0`; a treatment that is deleted leaves the part its words (the delete
 * succeeds, because no table has a foreign key to `treatments`); a rename changes no part; a save of the part unchanged after the delete is accepted; and a deleted ID chosen afresh is 422
 * under G. What the in-memory world cannot show is the stored JSON, the hidden "Not applicable" row of the migration and the catalogue's own list of keys. Every name and path is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const G = seedFieldAt('G').id;
const PRIMER = seedFieldAt('AA').id;
const LENGTH = seedFieldAt('J').id;
const POWDER = 'Invented powder finish';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let estimateId: string;
let treatmentCounter = 0;

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
  });
  leadId = await insertPersonAsOwner(db, 'Treatment Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Treatment Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query(`DELETE FROM treatments WHERE NOT is_system AND NOT is_hidden`);
});

const arjun: EstimateViewer = {
  get id() {
    return arjunId;
  },
  role: 'ENGINEER',
};

async function insertTreatment(name = `${POWDER} ${(treatmentCounter += 1)}`): Promise<{ readonly id: string; readonly name: string }> {
  const result = await db.owner.query<{ id: string }>(`INSERT INTO treatments (name) VALUES ($1) RETURNING id::text AS id`, [name]);
  return { id: defined(result.rows[0]).id, name };
}

/** Arjun's draft estimate with one part, whose ID is returned. */
async function setUpPart(): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ('Q-2026-0906', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  return (await service.addPart(arjun, estimateId, { kind: 'item' })).nodeId;
}

async function stored(nodeId: string): Promise<{ readonly inputs: Record<string, unknown>; readonly revision: number }> {
  const result = await db.owner.query<{ inputs: Record<string, unknown>; revision: number }>('SELECT inputs, revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(result.rows[0]);
}

const save = (nodeId: string, revision: number, values: Record<string, string>) => service.saveInputs(arjun, estimateId, { nodeId, revision, values });

async function refusal(promise: Promise<unknown>): Promise<ReadonlyArray<{ field: string; message: string }>> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(FieldValidationError);
  return error instanceof FieldValidationError ? error.fields : [];
}

describe('AC-4: what a part stores for Treatment / Color', () => {
  it('a listed treatment is stored as { id, text } with the name of its row, whatever words the client sent; the part is read back with the same choice', async () => {
    const nodeId = await setUpPart();
    const powder = await insertTreatment();
    const saved = await save(nodeId, 1, { [G]: encodeTreatment({ id: powder.id, text: 'Words the client made up' }) });
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: powder.id, text: powder.name } });
    expect(saved.inputs).toEqual({ [G]: encodeTreatment({ id: powder.id, text: powder.name }) });
    expect((await service.getNode(arjun, estimateId, nodeId)).inputs).toEqual({ [G]: encodeTreatment({ id: powder.id, text: powder.name }) });
  });

  it('"Not applicable", a hidden row that the Admin never lists, is found by its fixed ID and stored with the row\'s own name (FR-018)', async () => {
    const nodeId = await setUpPart();
    const row = await db.owner.query<{ name: string; is_hidden: boolean }>(`SELECT name, is_hidden FROM treatments WHERE id = $1::uuid`, [NOT_APPLICABLE_TREATMENT_ID]);
    expect(row.rows[0]).toEqual({ name: NOT_APPLICABLE_NAME, is_hidden: true });
    await save(nodeId, 1, { [G]: encodeTreatment({ id: NOT_APPLICABLE_TREATMENT_ID, text: 'Something else' }) });
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: NOT_APPLICABLE_TREATMENT_ID, text: NOT_APPLICABLE_NAME } });
  });

  it('"Other" is stored with the words typed, trimmed, and its row is the locked one of the migration', async () => {
    const nodeId = await setUpPart();
    await save(nodeId, 1, { [G]: encodeTreatment({ id: OTHER_TREATMENT_ID, text: '  Invented matt black ' }) });
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: OTHER_TREATMENT_ID, text: 'Invented matt black' } });
    expect((await db.owner.query<{ is_system: boolean }>(`SELECT is_system FROM treatments WHERE id = $1::uuid`, [OTHER_TREATMENT_ID])).rows[0]?.is_system).toBe(true);
  });

  it('an ID that no row has is 422 under G, and so is text that is not a UUID (a 422, never a 500); nothing of the save is stored', async () => {
    const nodeId = await setUpPart();
    for (const id of ['00000000-0000-4000-8000-000700000fff', 'not-a-uuid']) {
      expect(await refusal(save(nodeId, 1, { [G]: encodeTreatment({ id, text: 'x' }), [LENGTH]: '5' })), id).toEqual([{ field: G, message: CHOOSE_TREATMENT_MESSAGE }]);
    }
    expect(await stored(nodeId)).toEqual({ inputs: {}, revision: 1 });
  });
});

describe('architecture section 5.1: deleting and renaming a treatment a draft uses', () => {
  it('the delete succeeds, and the part keeps its words and is read back with them', async () => {
    const nodeId = await setUpPart();
    const powder = await insertTreatment();
    await save(nodeId, 1, { [G]: encodeTreatment({ id: powder.id, text: '' }) });
    const deleted = await db.owner.query(`DELETE FROM treatments WHERE id = $1::uuid`, [powder.id]);
    expect(deleted.rowCount).toBe(1);
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: powder.id, text: powder.name } });
    expect((await service.getNode(arjun, estimateId, nodeId)).inputs).toEqual({ [G]: encodeTreatment({ id: powder.id, text: powder.name }) });
  });

  it('the part saved unchanged after the delete is accepted and writes nothing for G; another field saved beside it leaves G as it was', async () => {
    const nodeId = await setUpPart();
    const powder = await insertTreatment();
    await save(nodeId, 1, { [G]: encodeTreatment({ id: powder.id, text: '' }) });
    await db.owner.query(`DELETE FROM treatments WHERE id = $1::uuid`, [powder.id]);
    const unchanged = await save(nodeId, 2, { [G]: encodeTreatment({ id: powder.id, text: 'Words the client made up' }) });
    expect(unchanged.revision).toBe(2);
    await save(nodeId, 2, { [LENGTH]: '5' });
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: powder.id, text: powder.name }, [LENGTH]: '5.00' });
  });

  it('choosing the deleted ID afresh, from a part that holds another treatment, is 422 under G', async () => {
    const nodeId = await setUpPart();
    const gone = await insertTreatment();
    const kept = await insertTreatment();
    await db.owner.query(`DELETE FROM treatments WHERE id = $1::uuid`, [gone.id]);
    await save(nodeId, 1, { [G]: encodeTreatment({ id: kept.id, text: '' }) });
    expect(await refusal(save(nodeId, 2, { [G]: encodeTreatment({ id: gone.id, text: 'x' }) }))).toEqual([{ field: G, message: CHOOSE_TREATMENT_MESSAGE }]);
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: kept.id, text: kept.name } });
  });

  it('a rename changes no part, and choosing the entry again takes the new name', async () => {
    const nodeId = await setUpPart();
    const powder = await insertTreatment();
    await save(nodeId, 1, { [G]: encodeTreatment({ id: powder.id, text: '' }) });
    await db.owner.query(`UPDATE treatments SET name = $2 WHERE id = $1::uuid`, [powder.id, `${powder.name} renamed`]);
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: powder.id, text: powder.name } });
    await save(nodeId, 2, { [G]: encodeTreatment({ id: powder.id, text: '' }) });
    expect((await stored(nodeId)).inputs).toEqual({ [G]: { id: powder.id, text: `${powder.name} renamed` } });
  });

  it('no table has a foreign key to treatments (the catalogue says so, not only the schema file)', async () => {
    const result = await db.owner.query<{ count: string }>(`SELECT count(*)::text AS count FROM pg_constraint WHERE contype = 'f' AND confrelid = 'treatments'::regclass`);
    expect(result.rows[0]?.count).toBe('0');
  });
});

describe('AC-1: the surface treatments are stored as 1 and 0', () => {
  it('a chosen one is stored as 1 and one that is left as 0, in the same jsonb as the other values, and a part with none chosen stays as it was', async () => {
    const nodeId = await setUpPart();
    await save(nodeId, 1, { [PRIMER]: '1' });
    expect((await stored(nodeId)).inputs).toEqual({ [PRIMER]: '1' });
    await save(nodeId, 2, { [PRIMER]: '0', [LENGTH]: '3' });
    expect((await stored(nodeId)).inputs).toEqual({ [PRIMER]: '0', [LENGTH]: '3.00' });
  });

  it('a part that never had a treatment chosen holds {} and stays EMPTY', async () => {
    const nodeId = await setUpPart();
    expect((await stored(nodeId)).inputs).toEqual({});
  });
});
