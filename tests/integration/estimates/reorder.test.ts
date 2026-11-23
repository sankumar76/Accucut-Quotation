import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, TreeChangedError } from '@/lib/errors';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, MOVE_ACROSS_PARENTS_CODE, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';

/**
 * AQP-406 (CR-01 item 3D; AC-1, AC-3, AC-4, AC-9; A-CR01-5 confirmed 2026-11-23) against real PostgreSQL: the move route's service as the handle and the menu use it. A row is reordered only among the rows with
 * the same parent, with everything under it, and every row is renumbered (Main Assembly 1 and 2 swapped; 1.1.2 and 1.1.3 swapped); a move to another parent is 422 `MOVE_ACROSS_PARENTS` under `parentId`; a Lead and
 * an Admin may reorder a Draft and a Prepared estimate and an Engineer only their own Draft; nobody may reorder an Approved, a Quoted or an Ignored one; and a stale revision is 409 with the tree as it is now and
 * writes nothing. The figures clearing is `cleared.test.ts`; the pure rules are `tests/unit/estimate/tree.test.ts`. Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let estimateId: string;
let taskCounter = 0;

const arjun: EstimateViewer = { get id() { return arjunId; }, role: 'ENGINEER' };
const priya: EstimateViewer = { get id() { return priyaId; }, role: 'ENGINEER' };
const lead: EstimateViewer = { get id() { return leadId; }, role: 'LEAD' };
const admin: EstimateViewer = { get id() { return adminId; }, role: 'ADMIN' };

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    ...inputsDependencies(),
  });
  leadId = await insertPersonAsOwner(db, 'Reorder Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Reorder Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Reorder Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Reorder Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
});

async function newEstimate(): Promise<string> {
  taskCounter += 1;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [`Q-2026-${String(7000 + taskCounter)}`, arjunId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  return defined(estimate.rows[0]).id;
}

const add = async (parentId: string | null, nodeKind: 'MAIN_ASSEMBLY' | 'SUB_ASSEMBLY' | 'PART' | 'FASTENER'): Promise<string> => (await service.addPart(arjun, estimateId, { parentId, nodeKind })).nodeId;

interface Built {
  readonly main1: string;
  readonly main2: string;
  readonly sub: string;
  readonly partA: string;
  readonly partB: string;
  readonly partC: string;
  readonly under2: string;
}

/** 1 Main with 1.1 Sub-Assembly holding 1.1.1, 1.1.2 and 1.1.3 (three Parts), and 2 Main with 2.1 under it. */
async function build(): Promise<Built> {
  const main1 = await add(null, 'MAIN_ASSEMBLY');
  const sub = await add(main1, 'SUB_ASSEMBLY');
  const partA = await add(sub, 'PART');
  const partB = await add(sub, 'PART');
  const partC = await add(sub, 'PART');
  const main2 = await add(null, 'MAIN_ASSEMBLY');
  const under2 = await add(main2, 'PART');
  return { main1, main2, sub, partA, partB, partC, under2 };
}

/** The Sl. No of every row in reading order, keyed by row, as the server numbers them. */
async function numbers(viewer: EstimateViewer = lead): Promise<Map<string, string>> {
  return new Map((await service.getTree(viewer, estimateId)).map((node) => [node.id, node.slNo]));
}

const revisionOf = async (nodeId: string): Promise<number> => defined((await service.getTree(lead, estimateId)).find((node) => node.id === nodeId)).revision;
const inputsRevision = async (): Promise<number> => defined((await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).inputs_revision;
const places = async (): Promise<string> => JSON.stringify((await db.owner.query('SELECT id::text, parent_id::text, sort_index FROM estimate_nodes WHERE estimate_id = $1::uuid ORDER BY id', [estimateId])).rows);

describe('AC-1: a drop or a menu move reorders among the rows with the same parent, with everything under the row, and renumbers every row', () => {
  it('swaps Main Assembly 1 and 2: the rows under each go with it, and every number follows', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    const before = await numbers();
    expect(before.get(tree.main1)).toBe('1');
    expect(before.get(tree.under2)).toBe('2.1');
    // Main 2 dropped before Main 1: place 0 among the top-level rows.
    await service.moveNode(lead, estimateId, { nodeId: tree.main2, revision: await revisionOf(tree.main2), parentId: null, index: 0 });
    const after = await numbers();
    expect(after.get(tree.main2)).toBe('1');
    expect(after.get(tree.under2)).toBe('1.1');
    expect(after.get(tree.main1)).toBe('2');
    expect(after.get(tree.sub)).toBe('2.1');
    expect(after.get(tree.partA)).toBe('2.1.1');
    expect(after.get(tree.partC)).toBe('2.1.3');
  });

  it('swaps 1.1.2 and 1.1.3 and leaves 1.1.1 where it is', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    await service.moveNode(lead, estimateId, { nodeId: tree.partC, revision: await revisionOf(tree.partC), parentId: tree.sub, index: 1 });
    const after = await numbers();
    expect([tree.partA, tree.partC, tree.partB].map((id) => after.get(id))).toEqual(['1.1.1', '1.1.2', '1.1.3']);
  });

  it('moves a row to the place a drag ends at and the place Move down gives: the same result', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    // Move down from the first of three is place 1; dropped below the middle of the second it is place 1 too.
    await service.moveNode(lead, estimateId, { nodeId: tree.partA, revision: await revisionOf(tree.partA), parentId: tree.sub, index: 1 });
    const after = await numbers();
    expect([tree.partB, tree.partA, tree.partC].map((id) => after.get(id))).toEqual(['1.1.1', '1.1.2', '1.1.3']);
  });

  it('raises inputs_revision once for a move and writes nothing for a move to where the row already is', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    const start = await inputsRevision();
    await service.moveNode(lead, estimateId, { nodeId: tree.partB, revision: await revisionOf(tree.partB), parentId: tree.sub, index: 0 });
    expect(await inputsRevision()).toBe(start + 1);
    const stored = await places();
    await service.moveNode(lead, estimateId, { nodeId: tree.partB, revision: await revisionOf(tree.partB), parentId: tree.sub, index: 0 });
    expect(await inputsRevision()).toBe(start + 1);
    expect(await places()).toBe(stored);
  });
});

describe('AC-3: a different parent is not offered, and the server refuses it', () => {
  it('refuses a move under another row with 422 MOVE_ACROSS_PARENTS under parentId, and writes nothing', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    const stored = await places();
    const start = await inputsRevision();
    for (const parentId of [tree.main2, tree.main1, tree.partA, null]) {
      const refused = await service.moveNode(lead, estimateId, { nodeId: tree.partB, revision: await revisionOf(tree.partB), parentId, index: 0 }).catch((error: unknown) => error);
      expect(refused, String(parentId)).toBeInstanceOf(FieldValidationError);
      expect(refused).toMatchObject({ code: MOVE_ACROSS_PARENTS_CODE, httpStatus: 422 });
    }
    expect(await places()).toBe(stored);
    expect(await inputsRevision()).toBe(start);
  });
});

describe('AC-4: who may reorder, and when', () => {
  const reorder = (viewer: EstimateViewer, tree: Built) => service.moveNode(viewer, estimateId, { nodeId: tree.partC, revision: 1, parentId: tree.sub, index: 0 });

  it('lets an Engineer reorder their own Draft, and a Lead and an Admin reorder a Draft', async () => {
    for (const viewer of [arjun, lead, admin]) {
      estimateId = await newEstimate();
      const tree = await build();
      const start = await inputsRevision();
      await reorder(viewer, tree);
      expect(await inputsRevision()).toBe(start + 1);
      expect((await numbers()).get(tree.partC)).toBe('1.1.1');
      await db.owner.query('DELETE FROM estimate_nodes');
      await db.owner.query('DELETE FROM estimates');
      await db.owner.query('DELETE FROM tasks');
    }
  });

  it('lets a Lead and an Admin reorder a Prepared estimate (it raises inputs_revision, so the figures wait for a recalculation), and refuses the Engineer', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    await db.owner.query(`UPDATE estimates SET status = 'PREPARED' WHERE id = $1::uuid`, [estimateId]);
    const stored = await places();
    await expect(reorder(arjun, tree)).rejects.toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
    expect(await places()).toBe(stored);
    const start = await inputsRevision();
    await reorder(lead, tree);
    expect(await inputsRevision()).toBe(start + 1);
    await service.moveNode(admin, estimateId, { nodeId: tree.partC, revision: await revisionOf(tree.partC), parentId: tree.sub, index: 2 });
    expect(await inputsRevision()).toBe(start + 2);
  });

  it.each([
    ['an Approved', `UPDATE estimates SET status = 'APPROVED' WHERE id = $1::uuid`],
    ['a Quoted', `UPDATE estimates SET status = 'QUOTED', quoted_by = $2::uuid, quoted_at = now() WHERE id = $1::uuid`],
    ['an Ignored', `UPDATE estimates SET ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = 'Invented remarks.' WHERE id = $1::uuid`],
  ])('refuses every role on %s estimate and writes nothing', async (_name, sql) => {
    estimateId = await newEstimate();
    const tree = await build();
    await db.owner.query(sql, sql.includes('$2') ? [estimateId, leadId] : [estimateId]);
    const stored = await places();
    for (const viewer of [arjun, lead, admin]) {
      await expect(reorder(viewer, tree), viewer.role).rejects.toMatchObject({ httpStatus: 409 });
    }
    expect(await places()).toBe(stored);
  });

  it('is 404 for another Engineer, whatever the row', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    await expect(reorder(priya, tree)).rejects.toMatchObject({ httpStatus: 404 });
  });
});

describe('AC-9: a stale revision is 409 with the tree as it is now, and nothing is saved twice', () => {
  it('refuses a move made from a tree that has changed since the person looked, with the fresh tree, and writes nothing', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    const seen = await revisionOf(tree.partA);
    // Someone else moves the same row first.
    await service.moveNode(lead, estimateId, { nodeId: tree.partA, revision: seen, parentId: tree.sub, index: 2 });
    const stored = await places();
    const start = await inputsRevision();
    const refused = await service.moveNode(arjun, estimateId, { nodeId: tree.partA, revision: seen, parentId: tree.sub, index: 1 }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(TreeChangedError);
    expect(refused).toMatchObject({ code: 'TREE_CHANGED', httpStatus: 409 });
    // The body carries the tree as it is now: the row is last under 1.1.
    const fresh = (refused as TreeChangedError).tree;
    expect(fresh.find((node) => node.id === tree.partA)?.slNo).toBe('1.1.3');
    expect(await places()).toBe(stored);
    expect(await inputsRevision()).toBe(start);
  });

  it('saves one of two drops of the same row made at once, and the other is 409 (never twice)', async () => {
    estimateId = await newEstimate();
    const tree = await build();
    const seen = await revisionOf(tree.partA);
    const results = await Promise.allSettled([
      service.moveNode(lead, estimateId, { nodeId: tree.partA, revision: seen, parentId: tree.sub, index: 2 }),
      service.moveNode(lead, estimateId, { nodeId: tree.partA, revision: seen, parentId: tree.sub, index: 1 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
