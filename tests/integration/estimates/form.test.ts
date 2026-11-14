import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, TreeChangedError } from '@/lib/errors';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { descendantIds } from '@/lib/estimate/tree';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { CHOOSE_MATERIAL_MESSAGE, PART_CHANGED_CODE } from '@/server/services/estimate-inputs';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.03 T7 (AC-3, AC-4, AC-7, AC-8) against real PostgreSQL in a throwaway database: the estimate service over the real repositories. What only the database can
 * show is shown here: the typed values stored as JSON text by field ID, the part's revision and the estimate's `inputs_revision` rising in the same transaction (and not at all
 * for a value equal after normalisation, a stale revision, a refused value, or a save whose second write fails), two saves of one part at once being serialised by the
 * estimate's row lock (one wins, the other is 409), the Material Master lookup (a material that is listed, hidden or deleted, and an ID that is not a UUID) read without
 * a number, and a delete confirmed for a part as it was being refused once a sub-part was typed into (review SQR-01 (b)). Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const MISSING = '00000000-0000-4000-8000-0000000000ff';
const LENGTH = seedFieldAt('J').id;
const WIDTH = seedFieldAt('K').id;
const PART_NO = seedFieldAt('B').id;
const MATERIAL = seedFieldAt('E').id;

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let estimateId: string;
let materialCounter = 0;

const estimateRepository = (): ReturnType<typeof createEstimateRepository> => createEstimateRepository(db.prisma);
const nodeRepository = (): ReturnType<typeof createEstimateNodeRepository> => createEstimateNodeRepository(db.prisma);

const buildService = (estimates = estimateRepository()): EstimateService =>
  createEstimateService({
    estimates,
    nodes: nodeRepository(),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
  });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = buildService();
  leadId = await insertPersonAsOwner(db, 'Form Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Form Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

const arjun: EstimateViewer = { get id() { return arjunId; }, role: 'ENGINEER' };

/** Arjun's draft estimate with one part, whose ID is returned. */
async function setUpPart(): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ('Q-2026-0901', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  return (await service.addPart(arjun, estimateId, { kind: 'item' })).nodeId;
}

interface Row {
  readonly inputs: Record<string, unknown>;
  readonly revision: number;
}

async function row(nodeId: string): Promise<Row> {
  const { rows } = await db.owner.query<Row>('SELECT inputs, revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(rows[0]);
}

async function inputsRevision(): Promise<number> {
  const { rows } = await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(rows[0]).inputs_revision;
}

/** A material of the Material Master, with a name of its own (the table keeps names unique). Returns its ID. */
async function addMaterial(options: { readonly hidden?: boolean; readonly deleted?: boolean } = {}): Promise<string> {
  materialCounter += 1;
  const considered = options.hidden === true ? null : `Invented-considered-${String(materialCounter)}`;
  const { rows } = await db.owner.query<{ id: string }>(
    `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity, is_hidden, deleted_at)
     VALUES ($1, $2, 7.85, $3, ${options.deleted === true ? 'now()' : 'NULL'}) RETURNING id::text AS id`,
    [`Invented-form-material-${String(materialCounter)}`, considered, options.hidden === true],
  );
  return defined(rows[0]).id;
}

async function problems(promise: Promise<unknown>): Promise<ReadonlyArray<{ field: string; message: string }>> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(FieldValidationError);
  return error instanceof FieldValidationError ? error.fields : [];
}

describe('AC-4, AC-7: a value saved with a real change', () => {
  it('stores the values as JSON text by field ID, and raises the part\'s revision and the estimate\'s inputs_revision by one, in one transaction', async () => {
    const nodeId = await setUpPart();
    const before = await inputsRevision();
    const saved = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '12.5', [PART_NO]: ' FR-1 ' } });
    expect(saved).toEqual({ id: nodeId, revision: 2, completeness: 'PARTIAL', inputs: { [LENGTH]: '12.50', [PART_NO]: 'FR-1' } });
    expect(await row(nodeId)).toEqual({ inputs: { [LENGTH]: '12.50', [PART_NO]: 'FR-1' }, revision: 2 });
    expect(await inputsRevision()).toBe(before + 1);
  });

  it('a value equal after normalisation changes nothing: the same revisions, and the row is not written', async () => {
    const nodeId = await setUpPart();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '1.50' } });
    const revision = await inputsRevision();
    const written = await db.owner.query<{ updated_at: Date }>('SELECT updated_at FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [LENGTH]: '1.5' } });
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [LENGTH]: '01.5', [WIDTH]: '' } });
    expect((await row(nodeId)).revision).toBe(2);
    expect(await inputsRevision()).toBe(revision);
    expect((await db.owner.query<{ updated_at: Date }>('SELECT updated_at FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]).toEqual(written.rows[0]);
  });

  it('a blank removes the value, so a part with nothing typed holds {}', async () => {
    const nodeId = await setUpPart();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '5' } });
    const cleared = await service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [LENGTH]: '' } });
    expect(cleared).toMatchObject({ revision: 3, completeness: 'EMPTY', inputs: {} });
    expect((await row(nodeId)).inputs).toEqual({});
  });

  it('refuses a stale revision with 409 and writes nothing', async () => {
    const nodeId = await setUpPart();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '1' } });
    const revision = await inputsRevision();
    const error = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [WIDTH]: '2' } }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: PART_CHANGED_CODE });
    expect((await row(nodeId)).inputs).toEqual({ [LENGTH]: '1.00' });
    expect(await inputsRevision()).toBe(revision);
  });

  it('refuses a value that is not valid with 422 under its field, and the other values of the save are not stored', async () => {
    const nodeId = await setUpPart();
    const revision = await inputsRevision();
    expect(await problems(service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '1.234', [WIDTH]: '5' } }))).toEqual([
      { field: LENGTH, message: 'Enter 0 or more, with up to 2 decimals.' },
    ]);
    expect((await row(nodeId)).inputs).toEqual({});
    expect(await inputsRevision()).toBe(revision);
  });

  it('is one transaction: when the estimate\'s revision cannot be raised, the part is not changed either', async () => {
    const nodeId = await setUpPart();
    const failing = buildService({ ...estimateRepository(), bumpInputsRevision: () => Promise.reject(new Error('the revision write failed')) });
    await expect(failing.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '3' } })).rejects.toThrow('the revision write failed');
    expect(await row(nodeId)).toEqual({ inputs: {}, revision: 1 });
  });

  it('serialises two saves of the same part at once on the estimate\'s lock: one wins, the other is 409 and the revision counts one change', async () => {
    const nodeId = await setUpPart();
    const before = await inputsRevision();
    const outcomes = await Promise.allSettled([
      service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '1' } }),
      service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [WIDTH]: '2' } }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const refused = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(refused?.status === 'rejected' && refused.reason).toMatchObject({ code: PART_CHANGED_CODE });
    expect((await row(nodeId)).revision).toBe(2);
    expect(await inputsRevision()).toBe(before + 1);
  });
});

describe('review SQR-01, SQR-02: a save changes only the keys it names, and the write is conditional on the revision read', () => {
  const NOT_BUILT = seedFieldAt('Z').id;

  async function plant(nodeId: string, inputs: Record<string, unknown>): Promise<void> {
    await db.owner.query('UPDATE estimate_nodes SET inputs = $2::jsonb WHERE id = $1::uuid', [nodeId, JSON.stringify(inputs)]);
  }

  it('a stored value of a field that is not on the form (a later story\'s, an unknown key, a non-text value) survives a save of another field; the answer lists only the form\'s', async () => {
    const nodeId = await setUpPart();
    const planted = { [LENGTH]: '1.00', [NOT_BUILT]: '7.00', invented: true, flags: { z: 1 } };
    await plant(nodeId, planted);
    const saved = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [WIDTH]: '2' } });
    expect((await row(nodeId)).inputs).toEqual({ ...planted, [WIDTH]: '2.00' });
    expect(saved.inputs).toEqual({ [LENGTH]: '1.00', [WIDTH]: '2.00' });
  });

  it('clearing one field removes only its own key', async () => {
    const nodeId = await setUpPart();
    await plant(nodeId, { [LENGTH]: '1.00', [WIDTH]: '2.00', [NOT_BUILT]: '7.00', invented: true });
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '' } });
    expect((await row(nodeId)).inputs).toEqual({ [WIDTH]: '2.00', [NOT_BUILT]: '7.00', invented: true });
  });

  it('the no-change check compares the submitted fields only: nothing is written however much else is stored', async () => {
    const nodeId = await setUpPart();
    await plant(nodeId, { [LENGTH]: '1.50', [NOT_BUILT]: '7.00', invented: true });
    const before = await inputsRevision();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [LENGTH]: '1.5' } });
    expect(await row(nodeId)).toEqual({ inputs: { [LENGTH]: '1.50', [NOT_BUILT]: '7.00', invented: true }, revision: 1 });
    expect(await inputsRevision()).toBe(before);
  });

  it('the repository writes only for the revision it was given: another revision writes nothing and answers null, the right one writes and answers the part', async () => {
    const nodeId = await setUpPart();
    const runner = createTransactionRunner(db.prisma);
    const repository = nodeRepository();
    expect(await runner.run((tx) => repository.saveInputs(estimateId, nodeId, 7, { [LENGTH]: '9.00' }, tx))).toBeNull();
    expect(await row(nodeId)).toEqual({ inputs: {}, revision: 1 });
    const written = await runner.run((tx) => repository.saveInputs(estimateId, nodeId, 1, { [LENGTH]: '9.00' }, tx));
    expect(written).toMatchObject({ id: nodeId, revision: 2, inputs: { [LENGTH]: '9.00' } });
    expect(await runner.run((tx) => repository.saveInputs(estimateId, nodeId, 1, { [LENGTH]: '3.00' }, tx))).toBeNull();
    expect((await row(nodeId)).inputs).toEqual({ [LENGTH]: '9.00' });
  });
});

describe('AC-3, AC-5: the material, read from the Material Master without a number', () => {
  it('stores the ID of a listed material by the field of Material in Drawing, in lower case, and a repeat of it changes nothing', async () => {
    const nodeId = await setUpPart();
    const material = await addMaterial();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [MATERIAL]: material.toUpperCase() } });
    expect((await row(nodeId)).inputs).toEqual({ [MATERIAL]: material });
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [MATERIAL]: material } });
    expect((await row(nodeId)).revision).toBe(2);
  });

  it('accepts the hidden "Not applicable" entry, which a part may name, and refuses a deleted material, an unknown one and a text that is not an ID', async () => {
    const nodeId = await setUpPart();
    const hidden = await addMaterial({ hidden: true });
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [MATERIAL]: hidden } });
    expect((await row(nodeId)).inputs).toEqual({ [MATERIAL]: hidden });
    for (const bad of [await addMaterial({ deleted: true }), MISSING, 'not-an-id', "'; DROP TABLE materials; --"]) {
      expect(await problems(service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [MATERIAL]: bad } }))).toEqual([{ field: MATERIAL, message: CHOOSE_MATERIAL_MESSAGE }]);
    }
    expect((await row(nodeId)).revision).toBe(2);
  });
});

describe('AC-8, SQR-01 (b), SQR-09: what the form and the part send, and the delete guard', () => {
  it('the form is built from the registry and carries the time of the last write; none before a part exists', async () => {
    await setUpPart();
    const started = Date.now();
    const form = await service.getForm(arjun, estimateId);
    expect(form.sections.map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // The database's clock and this process's may differ a little, so "just now" is within ten minutes.
    expect(Math.abs(Date.parse(defined(form.lastSavedAt)) - started)).toBeLessThan(10 * 60_000);
    await db.owner.query('DELETE FROM estimate_nodes');
    expect((await service.getForm(arjun, estimateId)).lastSavedAt).toBeNull();
  });

  it('a part is read back with the values of fields of the form only: a value of Material Rate / Kg that somehow sits in the table does not leave', async () => {
    const nodeId = await setUpPart();
    await db.owner.query('UPDATE estimate_nodes SET inputs = $2::jsonb WHERE id = $1::uuid', [nodeId, JSON.stringify({ [LENGTH]: '10.00', [seedFieldAt('I').id]: '917373.37', invented: 'x' })]);
    expect((await service.getNode(arjun, estimateId, nodeId)).inputs).toEqual({ [LENGTH]: '10.00' });
  });

  it('a delete confirmed for a part as it was is refused once a sub-part was typed into, and nothing is deleted', async () => {
    const parent = await setUpPart();
    const child = (await service.addPart(arjun, estimateId, { kind: 'sub-part', nodeId: parent })).nodeId;
    const { rows } = await db.owner.query<{ id: string; parent_id: string | null; sort_index: number; revision: number }>(
      'SELECT id::text AS id, parent_id::text AS parent_id, sort_index, revision FROM estimate_nodes WHERE estimate_id = $1::uuid',
      [estimateId],
    );
    const nodes = rows.map((node) => ({ id: node.id, parentId: node.parent_id, sortIndex: node.sort_index, revision: node.revision }));
    const members = new Set([parent, ...descendantIds(nodes, parent)]);
    const seen = subtreeFingerprint(nodes.filter((node) => members.has(node.id)));
    await service.saveInputs(arjun, estimateId, { nodeId: child, revision: 1, values: { [LENGTH]: '5' } });
    await expect(service.deleteNode(arjun, estimateId, { nodeId: parent, revision: 1, parts: 2, subtree: seen })).rejects.toBeInstanceOf(TreeChangedError);
    expect((await db.owner.query('SELECT 1 FROM estimate_nodes WHERE estimate_id = $1::uuid', [estimateId])).rowCount).toBe(2);
  });
});
