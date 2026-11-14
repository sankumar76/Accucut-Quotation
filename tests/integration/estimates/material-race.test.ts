import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, MasterInUseError } from '@/lib/errors';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { CHOOSE_MATERIAL_MESSAGE } from '@/server/services/estimate-inputs';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { contextOf, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createHoldingRunner, createServiceHoldingBeforeCommit } from '../../support/hold-before-commit';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.03 T9 (review SQR-11 of AQP-302, AQP-306 AC-5) against real PostgreSQL in a throwaway database: the **real** `saveInputs` of the estimate service and the
 * **real** `deleteMaterial` of the Material Master serialise, in both orders, so the two can never both succeed. The save takes the estimate's row lock, then the material
 * `FOR SHARE` (`lockMaterialForUse`), then writes; the delete takes the material `FOR UPDATE` and then looks for parts that name it. A save that holds the material first
 * makes the delete wait, and the delete then sees the part and is refused; a delete that holds the material first makes the save wait, and the save then finds no material and is
 * refused. The held side finishes its work and waits, uncommitted, until the test lets it go (`tests/support/hold-before-commit.ts`). Every name, path and ID is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const MATERIAL_FIELD = seedFieldAt('E').id;

let db: AuditDatabase;
let adminId: string;
let leadId: string;
let engineerId: string;
let estimateId: string;
let nodeId: string;

const by = () => contextOf(adminId);
const arjun: EstimateViewer = { get id() { return engineerId; }, role: 'ENGINEER' };

/** The estimate service over the real repositories and the transaction runner given: the real one, or one that holds before commit. */
const serviceOver = (transactions: ReturnType<typeof createHoldingRunner>): EstimateService =>
  createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    transactions,
    materials: db.masterRepository,
    currentConfiguration: () => Promise.resolve(seedConfig),
  });

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Race Admin', 'ADMIN');
  leadId = await insertPersonAsOwner(db, 'Race Lead', 'LEAD');
  engineerId = await insertPersonAsOwner(db, 'Race Engineer', 'ENGINEER');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query('DELETE FROM materials');
});

/** A draft estimate with one empty part, for the engineer. */
async function setUpPart(): Promise<void> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ('Q-2026-0951', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [engineerId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  nodeId = (await serviceOver(db.transactions).addPart(arjun, estimateId, { kind: 'item' })).nodeId;
}

const material = (name: string) =>
  db.mastersService.createMaterial(by(), { materialInDrawing: name, materialConsidered: 'Invented steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' });

const partInputs = async (): Promise<unknown> => defined((await db.owner.query<{ inputs: unknown }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]).inputs;
const isDeleted = async (materialId: string): Promise<boolean> =>
  defined((await db.owner.query<{ deleted: boolean }>('SELECT deleted_at IS NOT NULL AS deleted FROM materials WHERE id = $1::uuid', [materialId])).rows[0]).deleted;

/** Is any session of this database waiting for a lock? `pg_locks` is readable by every role, and so are the process IDs of `pg_stat_activity`. */
async function someoneIsWaitingForALock(): Promise<boolean> {
  const { rows } = await db.owner.query<{ waiting: number }>(
    `SELECT count(*)::int AS waiting FROM pg_locks l
     WHERE NOT l.granted AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())`,
  );
  return defined(rows[0]).waiting > 0;
}

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

describe('the save of a part\'s material and the delete of that material serialise, in both orders', () => {
  it('a save that holds the material first: the delete waits, then sees the part and is refused; the part keeps the material', async () => {
    await setUpPart();
    const alpha = await material('Alpha-sheet');
    const saving = gate();
    const save = serviceOver(createHoldingRunner(db, saving.hold, saving.reachedHolding)).saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [MATERIAL_FIELD]: alpha.id } });
    // If the save fails before it holds, the race rejects with its error and the test says why.
    await Promise.race([saving.isHolding, save]);

    let deleteDone = false;
    const deletion = db.mastersService.deleteMaterial(by(), alpha.id).finally(() => {
      deleteDone = true;
    });
    // The delete has either finished (nothing made it wait) or is waiting for the lock the save holds on the material. Only then is the save let go.
    await expect.poll(async () => deleteDone || (await someoneIsWaitingForALock()), { message: 'the delete waits for the material\'s lock, or has finished' }).toBe(true);
    expect(deleteDone, 'the delete did not wait for the save').toBe(false);
    saving.release();
    await save;
    await expect(deletion).rejects.toBeInstanceOf(MasterInUseError);

    expect(await isDeleted(alpha.id)).toBe(false);
    expect(await partInputs()).toEqual({ [MATERIAL_FIELD]: alpha.id });
  });

  it('a delete that holds the material first: the save waits, then finds no material and is refused; the part keeps no material', async () => {
    await setUpPart();
    const alpha = await material('Alpha-sheet');
    const deleting = gate();
    const deletion = createServiceHoldingBeforeCommit(db, deleting.hold, deleting.reachedHolding).deleteMaterial(by(), alpha.id);
    await Promise.race([deleting.isHolding, deletion]);

    let saveDone = false;
    const save = serviceOver(db.transactions)
      .saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [MATERIAL_FIELD]: alpha.id } })
      .finally(() => {
        saveDone = true;
      });
    await expect.poll(async () => saveDone || (await someoneIsWaitingForALock()), { message: 'the save waits for the material\'s lock, or has finished' }).toBe(true);
    expect(saveDone, 'the save did not wait for the delete').toBe(false);
    deleting.release();
    await deletion;
    const refusal = await save.catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect(refusal instanceof FieldValidationError && refusal.fields).toEqual([{ field: MATERIAL_FIELD, message: CHOOSE_MATERIAL_MESSAGE }]);
    expect(await isDeleted(alpha.id)).toBe(true);
    expect(await partInputs()).toEqual({});
  });
});
