import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, MasterInUseError, MATERIAL_IN_USE_CODE, NAME_TAKEN_CODE, NotFoundError } from '@/lib/errors';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { clientFor, createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createHoldingRunner, createServiceHoldingBeforeCommit } from '../../support/hold-before-commit';
import { createLateFailingRunner } from '../../support/late-failure-runner';

/**
 * STORY-02.07 (AC-3, AC-4, AC-5, AC-8) against real PostgreSQL in a throwaway database: the delete of a material over the real repositories. It is soft
 * (`deleted_at`); it is refused with the estimates named while a Draft or Submitted estimate has the material in a part (`estimate_nodes.inputs`), whatever the
 * shape the part form will give that value, and allowed when only Approved ones do; the hidden "Not applicable" row is a 404 and never deleted; one
 * `master.deleted` entry is written in the transaction of the delete and none when it is refused; the name of a deleted material stays taken (the unique indexes
 * are not partial); a guard that is asked about something that is not a material ID throws and never answers "unused"; and a delete and a writer of a part's
 * Material in Drawing serialise, in both orders, so the two can never both succeed (AC-5). Every name, path and code is invented.
 *
 * **The writer.** The part form (STORY-05.03) does not exist yet, so the writer in the race tests is written here as its contract says (documented on
 * `MaterialMethods.lockMaterialForUse`): the estimate's row lock first, then the material `FOR SHARE` in the same transaction, then the write to the part's
 * inputs. `createHoldingRunner` keeps that transaction open, uncommitted, until the test lets it go, and the test sees the other request wait on a lock.
 *
 * The audit entry commits with its change or not at all: the late-failure test uses the shared runner of tech-debt #130 (`tests/support/late-failure-runner.ts`).
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const LATE_FAILURE = 'a failure after the entry was written';
const OPEN_ESTIMATES_NAMED = 10;
/** The key a part's value for the material has in these tests. Invented: the guard finds the ID wherever it is in the inputs. */
const FIELD = 'invented-material-field';
const MISSING_ID = '00000000-0000-4000-8000-00000000dead';

let db: AuditDatabase;
let adminId: string;
let leadId: string;
let engineerId: string;
let codes = 0;

const by = () => contextOf(adminId);

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  leadId = await insertPersonAsOwner(db, 'Lead', 'LEAD');
  engineerId = await insertPersonAsOwner(db, 'Engineer', 'ENGINEER');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  // A part refers to its estimate and an estimate to its task, with no cascade, so they go in that order, and the materials last.
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query('DELETE FROM materials');
  codes = 0;
});

const material = (name: string) =>
  db.mastersService.createMaterial(by(), { materialInDrawing: name, materialConsidered: 'Invented steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' });

type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

interface MadeEstimate {
  readonly estimateId: string;
  readonly code: string;
  readonly nodeIds: ReadonlyArray<string>;
}

/** A task with its estimate in this status and one part for each value of `inputs` (a part with `{}` has no material). */
async function estimateWith(status: Status, parts: ReadonlyArray<Record<string, unknown>>): Promise<MadeEstimate> {
  codes += 1;
  const code = `Q-2026-${String(9000 + codes).padStart(4, '0')}`;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, notes)
     VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented hopper cover', NULL) RETURNING id::text AS id`,
    [code, engineerId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status) RETURNING id::text AS id', [
    defined(task.rows[0]).id,
    status,
  ]);
  const estimateId = defined(estimate.rows[0]).id;
  const nodeIds: string[] = [];
  for (const [index, inputs] of parts.entries()) {
    const node = await db.owner.query<{ id: string }>(
      'INSERT INTO estimate_nodes (estimate_id, sort_index, inputs) VALUES ($1::uuid, $2::int, $3::jsonb) RETURNING id::text AS id',
      [estimateId, index, JSON.stringify(inputs)],
    );
    nodeIds.push(defined(node.rows[0]).id);
  }
  return { estimateId, code, nodeIds };
}

interface StoredMaterial {
  readonly deleted: boolean;
}

async function stored(materialId: string): Promise<StoredMaterial> {
  const { rows } = await db.owner.query<{ deleted: boolean }>('SELECT deleted_at IS NOT NULL AS deleted FROM materials WHERE id = $1::uuid', [materialId]);
  return { deleted: defined(rows[0]).deleted };
}

const deletedEntries = async (materialId: string) => (await entriesFor(db, materialId)).filter((entry) => entry.event === 'master.deleted');

async function inUse(materialId: string): Promise<MasterInUseError> {
  const refusal = await db.mastersService.deleteMaterial(by(), materialId).catch((error: unknown) => error);
  expect(refusal).toBeInstanceOf(MasterInUseError);
  if (!(refusal instanceof MasterInUseError)) throw new Error('the delete was not refused');
  return refusal;
}

/** Is any session of this database waiting for a lock? `pg_locks` is readable by every role, and so are the process IDs of `pg_stat_activity`. */
async function someoneIsWaitingForALock(): Promise<boolean> {
  const { rows } = await db.owner.query<{ waiting: number }>(
    `SELECT count(*)::int AS waiting FROM pg_locks l
     WHERE NOT l.granted AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())`,
  );
  return defined(rows[0]).waiting > 0;
}

describe('AC-3: a material no open estimate uses is soft-deleted', () => {
  it('sets deleted_at and keeps the row, and the material leaves the list, the options and the lookup for a change', async () => {
    const alpha = await material('Alpha-sheet');
    const bravo = await material('Bravo-sheet');
    await db.mastersService.deleteMaterial(by(), alpha.id);
    expect(await stored(alpha.id)).toEqual({ deleted: true });
    expect((await db.mastersService.listMaterials()).map((row) => row.materialInDrawing)).toEqual(['Bravo-sheet']);
    expect((await db.mastersService.listMaterialOptions()).map((option) => option.id)).toEqual([bravo.id]);
    await expect(db.mastersService.updateMaterial(by(), alpha.id, { scrapRate: '23.37' })).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored(bravo.id)).toEqual({ deleted: false });
  });

  it('writes exactly one master.deleted entry, in the same transaction, with the material as it was and null after', async () => {
    const alpha = await material('Alpha-sheet');
    const entries = await entryCount(db);
    await db.mastersService.deleteMaterial(by(), alpha.id);
    expect(await entryCount(db)).toBe(entries + 1);
    const [entry] = await deletedEntries(alpha.id);
    expect(entry).toMatchObject({
      event: 'master.deleted',
      actor_id: adminId,
      object_type: 'material',
      object_id: alpha.id,
      object_label: 'Alpha-sheet',
      before: { materialInDrawing: 'Alpha-sheet', materialConsidered: 'Invented steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' },
      after: null,
    });
  });

  it('a second delete, an unknown ID and text that is no ID are a 404 and write nothing more', async () => {
    const alpha = await material('Alpha-sheet');
    await db.mastersService.deleteMaterial(by(), alpha.id);
    const entries = await entryCount(db);
    await expect(db.mastersService.deleteMaterial(by(), alpha.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(db.mastersService.deleteMaterial(by(), MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(db.mastersService.deleteMaterial(by(), 'not-an-id')).rejects.toBeInstanceOf(NotFoundError);
    expect(await entryCount(db)).toBe(entries);
  });

  it('the hidden "Not applicable" row is a 404 and is never deleted', async () => {
    const hidden = await db.owner.query<{ id: string }>(
      "INSERT INTO materials (material_in_drawing, material_considered, is_hidden) VALUES ('Hidden-entry-for-test', NULL, true) RETURNING id::text AS id",
    );
    const hiddenId = defined(hidden.rows[0]).id;
    const entries = await entryCount(db);
    await expect(db.mastersService.deleteMaterial(by(), hiddenId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored(hiddenId)).toEqual({ deleted: false });
    expect(await entryCount(db)).toBe(entries);
  });

  it('leaves the entry and the change together or not at all: a failure after the entry was written leaves the material listed and no entry', async () => {
    const alpha = await material('Alpha-sheet');
    const entries = await entryCount(db);
    const failing: TransactionRunner = createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
    await expect(db.buildMastersService({ transactions: failing }).deleteMaterial(by(), alpha.id)).rejects.toThrow(LATE_FAILURE);
    expect(await stored(alpha.id)).toEqual({ deleted: false });
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-3: a material that a Draft or Submitted estimate has in a part is refused, and nothing changes', () => {
  it.each([
    ['a bare ID', (id: string) => ({ [FIELD]: id })],
    ['an object with the ID and the words', (id: string) => ({ [FIELD]: { id, text: 'Invented steel' } })],
    ['the ID in upper case', (id: string) => ({ [FIELD]: id.toUpperCase() })],
    ['the ID deep inside another value', (id: string) => ({ other: { nested: [{ choice: { materialId: id } }] } })],
  ] as const)('%s, in a Draft or a Submitted estimate: 409 MaterialInUse naming its task code and status', async (_shape, inputsFor) => {
    for (const status of ['DRAFT', 'SUBMITTED'] as const) {
      const alpha = await material(`Alpha-${status}`);
      const { code } = await estimateWith(status, [{}, inputsFor(alpha.id)]);
      const entries = await entryCount(db);
      const refusal = await inUse(alpha.id);
      expect(refusal).toMatchObject({ code: MATERIAL_IN_USE_CODE, httpStatus: 409, estimates: [{ code, status }], total: 1 });
      expect(await stored(alpha.id)).toEqual({ deleted: false });
      expect(await entryCount(db)).toBe(entries);
      expect((await db.mastersService.listMaterialOptions()).map((option) => option.id)).toContain(alpha.id);
      await db.owner.query('DELETE FROM estimate_nodes');
      await db.owner.query('DELETE FROM estimates');
      await db.owner.query('DELETE FROM tasks');
    }
  });

  it('counts an estimate once however many of its parts use the material, and not another material, an empty part or another estimate', async () => {
    const alpha = await material('Alpha-sheet');
    const bravo = await material('Bravo-sheet');
    const { code } = await estimateWith('DRAFT', [{ [FIELD]: alpha.id }, { [FIELD]: alpha.id }, { [FIELD]: bravo.id }, {}]);
    await estimateWith('DRAFT', [{ [FIELD]: bravo.id }]);
    const refusal = await inUse(alpha.id);
    expect(refusal.total).toBe(1);
    expect(refusal.estimates).toEqual([{ code, status: 'DRAFT' }]);
  });

  it('names the first ten by task code and counts all of them; an Approved estimate is not counted', async () => {
    const alpha = await material('Alpha-sheet');
    const made: string[] = [];
    for (let index = 0; index < 12; index += 1) made.push((await estimateWith(index % 2 === 0 ? 'DRAFT' : 'SUBMITTED', [{ [FIELD]: alpha.id }])).code);
    await estimateWith('APPROVED', [{ [FIELD]: alpha.id }]);
    const refusal = await inUse(alpha.id);
    expect(refusal.total).toBe(12);
    expect(refusal.estimates.map((use) => use.code)).toEqual([...made].sort().slice(0, OPEN_ESTIMATES_NAMED));
  });

  it('is allowed once the part no longer has the material', async () => {
    const alpha = await material('Alpha-sheet');
    const { nodeIds } = await estimateWith('DRAFT', [{ [FIELD]: alpha.id }]);
    await inUse(alpha.id);
    await db.owner.query("UPDATE estimate_nodes SET inputs = '{}'::jsonb WHERE id = $1::uuid", [defined(nodeIds[0])]);
    await db.mastersService.deleteMaterial(by(), alpha.id);
    expect((await stored(alpha.id)).deleted).toBe(true);
  });
});

describe('AC-4: a material used only by Approved estimates may be deleted, and they keep what they hold', () => {
  it('deletes it, and the Approved estimate and its part are exactly as they were', async () => {
    const alpha = await material('Alpha-sheet');
    const { estimateId, nodeIds } = await estimateWith('APPROVED', [{ [FIELD]: { id: alpha.id, text: 'Alpha-sheet' } }]);
    await db.mastersService.deleteMaterial(by(), alpha.id);
    expect((await stored(alpha.id)).deleted).toBe(true);
    const part = await db.owner.query<{ inputs: unknown }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [defined(nodeIds[0])]);
    expect(part.rows).toEqual([{ inputs: { [FIELD]: { id: alpha.id, text: 'Alpha-sheet' } } }]);
    const kept = await db.owner.query<{ status: string }>('SELECT status::text AS status FROM estimates WHERE id = $1::uuid', [estimateId]);
    expect(kept.rows).toEqual([{ status: 'APPROVED' }]);
    // The master's own lookup does not find a deleted material: what an Approved estimate shows is its own stored copy (the calculation's snapshot and resolved text), not this lookup.
    expect(await db.masterRepository.findMaterialForCalculation(alpha.id)).toBeNull();
  });
});

describe('the guard never reads an unknown as "unused"', () => {
  it('throws for an ID that is not a UUID (the material guard and the customer guard), and answers 0 for a UUID no part has', async () => {
    await expect(db.transactions.run((tx) => db.masterRepository.findOpenEstimatesOfMaterial('not-an-id', tx))).rejects.toThrow('The open-estimate check needs a material ID.');
    await expect(db.transactions.run((tx) => db.masterRepository.findOpenEstimatesOfCustomer('not-an-id', tx))).rejects.toThrow('The open-estimate check needs a customer ID.');
    await expect(db.transactions.run((tx) => db.masterRepository.findOpenEstimatesOfMaterial(MISSING_ID, tx))).resolves.toEqual({ total: 0, estimates: [] });
  });
});

describe('AC-8: the name of a deleted material', () => {
  it('stays taken, because the unique indexes on the name are not partial: adding it again is 422 NAME_TAKEN, and a different name is fine', async () => {
    const alpha = await material('Alpha-sheet');
    await db.mastersService.deleteMaterial(by(), alpha.id);
    const refusal = await material('ALPHA-SHEET').catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect(refusal).toMatchObject({ code: NAME_TAKEN_CODE });
    await expect(material('Alpha-sheet-two')).resolves.toMatchObject({ materialInDrawing: 'Alpha-sheet-two' });
  });
});

describe('AC-5: the delete and a writer of a part\'s material serialise, in both orders', () => {
  /** What the part form's save must do (the contract of `lockMaterialForUse`): the estimate's row lock, then the material `FOR SHARE`, then the write. It stays uncommitted until `hold` is resolved. */
  function writeMaterialIntoPart(estimateId: string, nodeId: string, materialId: string, hold: Promise<void>, onHolding: () => void): Promise<void> {
    const runner = createHoldingRunner(db, hold, onHolding);
    const estimates = createEstimateRepository(db.prisma);
    return runner.run(async (tx) => {
      await estimates.lockEstimate(estimateId, tx);
      if (!(await db.masterRepository.lockMaterialForUse(materialId, tx))) throw new FieldValidationError([{ field: FIELD, message: 'Choose a material from the list.' }]);
      await clientFor(db.prisma, tx).$executeRaw`
        UPDATE estimate_nodes SET inputs = jsonb_build_object(${FIELD}::text, jsonb_build_object('id', ${materialId}::text)) WHERE id = ${nodeId}::uuid`;
    });
  }

  const partInputs = async (nodeId: string) => {
    const { rows } = await db.owner.query<{ inputs: unknown }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
    return defined(rows[0]).inputs;
  };

  const gate = () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reachedHolding: () => void = () => undefined;
    const isHolding = new Promise<void>((resolve) => {
      reachedHolding = resolve;
    });
    return { hold, release, isHolding, reachedHolding };
  };

  it('a write that holds the material first: the delete waits, then sees the part and is refused; the part keeps the material', async () => {
    const alpha = await material('Alpha-sheet');
    const { estimateId, nodeIds } = await estimateWith('DRAFT', [{}]);
    const nodeId = defined(nodeIds[0]);
    const writing = gate();
    const write = writeMaterialIntoPart(estimateId, nodeId, alpha.id, writing.hold, writing.reachedHolding);
    // If the write fails before it holds, the race rejects with its error and the test says why.
    await Promise.race([writing.isHolding, write]);

    let deleteDone = false;
    const deletion = db.mastersService.deleteMaterial(by(), alpha.id).finally(() => {
      deleteDone = true;
    });
    // The delete has either finished (nothing made it wait) or is waiting for the lock the write holds on the material. Only then is the write let go.
    await expect.poll(async () => deleteDone || (await someoneIsWaitingForALock()), { message: 'the delete waits for the material\'s lock, or has finished' }).toBe(true);
    expect(deleteDone, 'the delete did not wait for the write').toBe(false);
    writing.release();
    await write;
    await expect(deletion).rejects.toBeInstanceOf(MasterInUseError);

    expect(await stored(alpha.id)).toEqual({ deleted: false });
    expect(await partInputs(nodeId)).toEqual({ [FIELD]: { id: alpha.id } });
    expect(await deletedEntries(alpha.id)).toEqual([]);
  });

  it('a delete that holds the material first: the write waits, then finds no material and is refused; the part keeps no material', async () => {
    const alpha = await material('Alpha-sheet');
    const { estimateId, nodeIds } = await estimateWith('DRAFT', [{}]);
    const nodeId = defined(nodeIds[0]);
    const deleting = gate();
    const deletion = createServiceHoldingBeforeCommit(db, deleting.hold, deleting.reachedHolding).deleteMaterial(by(), alpha.id);
    await Promise.race([deleting.isHolding, deletion]);

    let writeDone = false;
    const write = writeMaterialIntoPart(estimateId, nodeId, alpha.id, Promise.resolve(), () => undefined).finally(() => {
      writeDone = true;
    });
    await expect.poll(async () => writeDone || (await someoneIsWaitingForALock()), { message: 'the write waits for the material\'s lock, or has finished' }).toBe(true);
    expect(writeDone, 'the write did not wait for the delete').toBe(false);
    deleting.release();
    await deletion;
    await expect(write).rejects.toBeInstanceOf(FieldValidationError);

    expect((await stored(alpha.id)).deleted).toBe(true);
    expect(await partInputs(nodeId)).toEqual({});
    expect(await deletedEntries(alpha.id)).toHaveLength(1);
  });

  it('lockMaterialForUse: a live material is locked (the hidden "Not applicable" row too), a deleted one, an unknown one and a non-ID are not', async () => {
    const alpha = await material('Alpha-sheet');
    const gone = await material('Gone-sheet');
    await db.mastersService.deleteMaterial(by(), gone.id);
    const hidden = await db.owner.query<{ id: string }>(
      "INSERT INTO materials (material_in_drawing, material_considered, is_hidden) VALUES ('Hidden-entry-for-test', NULL, true) RETURNING id::text AS id",
    );
    const locked = (id: string) => db.transactions.run((tx) => db.masterRepository.lockMaterialForUse(id, tx));
    expect(await locked(alpha.id)).toBe(true);
    expect(await locked(defined(hidden.rows[0]).id)).toBe(true);
    expect(await locked(gone.id)).toBe(false);
    expect(await locked(MISSING_ID)).toBe(false);
    expect(await locked('not-an-id')).toBe(false);
  });

  it('two deletes at once: one wins, the other is a 404, and one entry is written', async () => {
    const alpha = await material('Alpha-sheet');
    const results = await Promise.allSettled([db.mastersService.deleteMaterial(by(), alpha.id), db.mastersService.deleteMaterial(by(), alpha.id)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.flatMap((result) => (result.status === 'rejected' ? [result.reason as unknown] : []));
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toBeInstanceOf(NotFoundError);
    expect(await deletedEntries(alpha.id)).toHaveLength(1);
  });
});
