import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError, TreeChangedError } from '@/lib/errors';
import type { PartView } from '@/lib/estimate/part-view';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { descendantIds } from '@/lib/estimate/tree';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { buildTree500 } from '../../support/builders/tree500';
import { defined } from '../../support/defined';

/**
 * STORY-05.02 T3 (AC-1 to AC-8) against real PostgreSQL in a throwaway database: the estimate service over the real repositories. What only the database can show is
 * shown here: the table's own rules (a part is never its own parent or under a part of another estimate, `inputs` is an object, the runtime role can delete but not
 * truncate), a delete that removes a part and its sub-parts in one statement, the places written back 0, 1, 2, ..., `inputs_revision` rising in the same transaction (and
 * not at all when the change fails), two changes at once being serialised by the estimate's row lock (the revision counts both; only one of two moves with the same
 * revision wins), and a 500-node tree read in well under a second. Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const MISSING = '00000000-0000-4000-8000-0000000000ff';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let priyaId: string;
let estimateId: string;
let otherEstimateId: string;

const estimateRepository = (): ReturnType<typeof createEstimateRepository> => createEstimateRepository(db.prisma);
const nodeRepository = (): ReturnType<typeof createEstimateNodeRepository> => createEstimateNodeRepository(db.prisma);

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({ estimates: estimateRepository(), nodes: nodeRepository(), transactions: createTransactionRunner(db.prisma) });
  leadId = await insertPersonAsOwner(db, 'Tree Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Tree Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Tree Priya', 'ENGINEER');
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
const priya: EstimateViewer = { get id() { return priyaId; }, role: 'ENGINEER' };
const lead: EstimateViewer = { get id() { return leadId; }, role: 'LEAD' };

async function insertEstimate(code: string, engineerId: string): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [code, engineerId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  return defined(estimate.rows[0]).id;
}

/** Arjun's draft estimate, and a second one of his, which a part of the first must never reach. */
async function setUpEstimates(): Promise<void> {
  estimateId = await insertEstimate('Q-2026-0801', arjunId);
  otherEstimateId = await insertEstimate('Q-2026-0802', arjunId);
}

const numbers = (nodes: ReadonlyArray<PartView>): string[] => nodes.map((node) => node.slNo);
const idOf = (nodes: ReadonlyArray<PartView>, slNo: string): string => defined(nodes.find((node) => node.slNo === slNo)).id;

const stored = async (): Promise<{ id: string; parent: string | null; place: number; revision: number }[]> => {
  const { rows } = await db.owner.query<{ id: string; parent: string | null; place: number; revision: number }>(
    'SELECT id::text AS id, parent_id::text AS parent, sort_index AS place, revision FROM estimate_nodes WHERE estimate_id = $1::uuid ORDER BY id',
    [estimateId],
  );
  return rows;
};

/** The fingerprint the screen would send for this part: the part and every sub-part with their revisions, as stored now (what its dialog showed). */
async function seen(nodeId: string): Promise<string> {
  const rows = await stored();
  const ids = new Set([nodeId, ...descendantIds(rows.map((row) => ({ id: row.id, parentId: row.parent, sortIndex: row.place })), nodeId)]);
  return subtreeFingerprint(rows.filter((row) => ids.has(row.id)));
}

const inputsRevision = async (): Promise<number> => {
  const { rows } = await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(rows[0]).inputs_revision;
};

/** 1, 1.1, 1.1.1, 1.1.2, 1.2, 1.3, 1.4, 1.5 and 2, made by the service. */
async function storyTree(): Promise<PartView[]> {
  const one = (await service.addPart(arjun, estimateId, { kind: 'item' })).nodeId;
  const oneOne = (await service.addPart(arjun, estimateId, { kind: 'sub-part', nodeId: one })).nodeId;
  await service.addPart(arjun, estimateId, { kind: 'sub-part', nodeId: oneOne });
  await service.addPart(arjun, estimateId, { kind: 'sub-part', nodeId: oneOne });
  await service.addPart(arjun, estimateId, { kind: 'beside', nodeId: oneOne });
  for (let sibling = 0; sibling < 3; sibling += 1) await service.addPart(arjun, estimateId, { kind: 'sub-part', nodeId: one });
  const last = await service.addPart(arjun, estimateId, { kind: 'item' });
  expect(numbers(last.nodes)).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '1.4', '1.5', '2']);
  return [...last.nodes];
}

describe('the table keeps its own rules, whoever writes to it', () => {
  it('refuses a part that is its own parent, a negative place, a revision of 0 and inputs that are not an object', async () => {
    await setUpEstimates();
    const own = defined((await db.owner.query<{ id: string }>('INSERT INTO estimate_nodes (estimate_id, sort_index) VALUES ($1::uuid, 0) RETURNING id::text AS id', [estimateId])).rows[0]).id;
    await expect(db.owner.query('UPDATE estimate_nodes SET parent_id = id WHERE id = $1::uuid', [own])).rejects.toThrow(/ck_estimate_nodes_not_own_parent/);
    await expect(db.owner.query('INSERT INTO estimate_nodes (estimate_id, sort_index) VALUES ($1::uuid, -1)', [estimateId])).rejects.toThrow(/ck_estimate_nodes_sort_index_not_negative/);
    await expect(db.owner.query('INSERT INTO estimate_nodes (estimate_id, sort_index, revision) VALUES ($1::uuid, 0, 0)', [estimateId])).rejects.toThrow(/ck_estimate_nodes_revision_positive/);
    await expect(db.owner.query(`INSERT INTO estimate_nodes (estimate_id, sort_index, inputs) VALUES ($1::uuid, 0, '[]')`, [estimateId])).rejects.toThrow(/ck_estimate_nodes_inputs_is_object/);
  });

  it('refuses a parent that belongs to another estimate, on insert and on update', async () => {
    await setUpEstimates();
    const foreign = defined((await db.owner.query<{ id: string }>('INSERT INTO estimate_nodes (estimate_id, sort_index) VALUES ($1::uuid, 0) RETURNING id::text AS id', [otherEstimateId])).rows[0]).id;
    await expect(db.owner.query('INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index) VALUES ($1::uuid, $2::uuid, 0)', [estimateId, foreign])).rejects.toThrow(/same estimate/);
    const mine = defined((await db.owner.query<{ id: string }>('INSERT INTO estimate_nodes (estimate_id, sort_index) VALUES ($1::uuid, 0) RETURNING id::text AS id', [estimateId])).rows[0]).id;
    await expect(db.owner.query('UPDATE estimate_nodes SET parent_id = $2::uuid WHERE id = $1::uuid', [mine, foreign])).rejects.toThrow(/same estimate/);
  });

  it('lets the runtime role read, add, change and delete parts and not truncate the table; the table holds no cost column', async () => {
    await setUpEstimates();
    await db.runtime.query('INSERT INTO estimate_nodes (estimate_id, sort_index) VALUES ($1::uuid, 0)', [estimateId]);
    await db.runtime.query('UPDATE estimate_nodes SET sort_index = 1 WHERE estimate_id = $1::uuid', [estimateId]);
    await db.runtime.query('DELETE FROM estimate_nodes WHERE estimate_id = $1::uuid', [estimateId]);
    await expect(db.runtime.query('TRUNCATE estimate_nodes')).rejects.toThrow(/permission denied/);
    const columns = await db.owner.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'estimate_nodes' ORDER BY column_name`);
    expect(columns.rows.map((row) => row.column_name)).toEqual(['created_at', 'estimate_id', 'id', 'image_id', 'inputs', 'parent_id', 'revision', 'sort_index', 'updated_at']);
  });
});

describe('AC-1, AC-2: adding and renumbering, through the real tables', () => {
  it('builds the tree of the story, stores the places 0, 1, 2, ... in every group, and keeps Sl. No out of the table', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const rows = await stored();
    expect(rows).toHaveLength(9);
    const groups = new Map<string | null, number[]>();
    for (const row of rows) groups.set(row.parent, [...(groups.get(row.parent) ?? []), row.place]);
    for (const places of groups.values()) expect(places.sort((a, b) => a - b)).toEqual(places.map((_, place) => place));
    expect(await service.getTree(arjun, estimateId)).toEqual(tree);
    expect(await inputsRevision()).toBe(9);
  });

  it('moves up and down, to another parent and to the top, and renumbers each time', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const up = await service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '1.3'), revision: 1, parentId: idOf(tree, '1'), index: 1 });
    expect(up.find((node) => node.id === idOf(tree, '1.3'))?.slNo).toBe('1.2');
    expect(up.find((node) => node.id === idOf(tree, '1.2'))?.slNo).toBe('1.3');
    const across = await service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '1.1'), revision: 1, parentId: idOf(tree, '2'), index: 0 });
    expect(numbers(across)).toEqual(['1', '1.1', '1.2', '1.3', '1.4', '2', '2.1', '2.1.1', '2.1.2']);
    const top = await service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '1.1.2'), revision: 1, parentId: null, index: 0 });
    expect(top.find((node) => node.id === idOf(tree, '1.1.2'))?.slNo).toBe('1');
  });

  it('a part is added to the estimate it was asked for and never to another: the part of another estimate is 404', async () => {
    await setUpEstimates();
    const foreign = await service.addPart(arjun, otherEstimateId, { kind: 'item' });
    await expect(service.addPart(arjun, estimateId, { kind: 'sub-part', nodeId: foreign.nodeId })).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored()).toHaveLength(0);
  });
});

describe('AC-3: delete removes the part and its sub-parts in one statement', () => {
  it('deletes a part with 2 sub-parts when the count confirmed is 3, closes the gap, and raises the revision once', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const before = await inputsRevision();
    const left = await service.deleteNode(arjun, estimateId, { nodeId: idOf(tree, '1.1'), revision: 1, parts: 3, subtree: await seen(idOf(tree, '1.1')) });
    expect(numbers(left)).toEqual(['1', '1.1', '1.2', '1.3', '1.4', '2']);
    expect(await stored()).toHaveLength(6);
    expect(await inputsRevision()).toBe(before + 1);
  });

  it('refuses a count that is no longer right with 409 and the tree, and deletes nothing', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const shown = await seen(idOf(tree, '1.2'));
    await service.addPart(lead, estimateId, { kind: 'sub-part', nodeId: idOf(tree, '1.2') });
    const before = await inputsRevision();
    const refused = await service.deleteNode(arjun, estimateId, { nodeId: idOf(tree, '1.2'), revision: 1, parts: 1, subtree: shown }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(TreeChangedError);
    expect((refused as TreeChangedError).tree).toHaveLength(10);
    expect(await stored()).toHaveLength(10);
    expect(await inputsRevision()).toBe(before);
  });
});

describe('SQR-01: what the person confirmed is what is deleted', () => {
  it('refuses with 409 and the tree, and deletes nothing, when the count is the same but a sub-part was moved out and another moved in', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const target = idOf(tree, '1.1');
    const shown = await seen(target);
    await service.moveNode(lead, estimateId, { nodeId: idOf(tree, '1.1.2'), revision: 1, parentId: null, index: 0 });
    await service.moveNode(lead, estimateId, { nodeId: idOf(tree, '1.5'), revision: 1, parentId: target, index: 0 });
    const rows = JSON.stringify(await stored());
    const refused = await service.deleteNode(arjun, estimateId, { nodeId: target, revision: 1, parts: 3, subtree: shown }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(TreeChangedError);
    expect(JSON.stringify(await stored())).toBe(rows);
  });

  it('refuses with 409 when a sub-part was typed into since (its own revision rose), and the typed value is still there', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const target = idOf(tree, '1.1');
    const shown = await seen(target);
    await db.owner.query(`UPDATE estimate_nodes SET revision = revision + 1, inputs = '{"typed":"kept"}'::jsonb WHERE id = $1::uuid`, [idOf(tree, '1.1.2')]);
    await expect(service.deleteNode(arjun, estimateId, { nodeId: target, revision: 1, parts: 3, subtree: shown })).rejects.toBeInstanceOf(TreeChangedError);
    const kept = await db.owner.query<{ inputs: { typed?: string } }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [idOf(tree, '1.1.2')]);
    expect(defined(kept.rows[0]).inputs).toEqual({ typed: 'kept' });
    expect(await stored()).toHaveLength(9);
  });
});

describe('SQR-06: a move under a real part of another estimate is 422, not a database error', () => {
  it('answers FieldValidationError under parentId and writes nothing', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const foreign = (await service.addPart(arjun, otherEstimateId, { kind: 'item' })).nodeId;
    const rows = JSON.stringify(await stored());
    const refused = await service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '1.2'), revision: 1, parentId: foreign, index: 0 }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(FieldValidationError);
    expect((refused as FieldValidationError).fields[0]?.field).toBe('parentId');
    expect(JSON.stringify(await stored())).toBe(rows);
  });
});

describe('AC-4, AC-5: refused moves change nothing, and a change that fails leaves no trace', () => {
  it('a move under itself or a sub-part is 422 and writes nothing', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const rows = JSON.stringify(await stored());
    const before = await inputsRevision();
    await expect(service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '1'), revision: 1, parentId: idOf(tree, '1.1.2'), index: 0 })).rejects.toBeInstanceOf(FieldValidationError);
    expect(JSON.stringify(await stored())).toBe(rows);
    expect(await inputsRevision()).toBe(before);
  });

  it('a move to where the part already is writes nothing and raises nothing', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const rows = JSON.stringify(await stored());
    const before = await inputsRevision();
    await service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '1.2'), revision: 1, parentId: idOf(tree, '1'), index: 1 });
    expect(JSON.stringify(await stored())).toBe(rows);
    expect(await inputsRevision()).toBe(before);
  });

  it('an add whose revision write fails rolls back the part too: nothing is stored (one transaction)', async () => {
    await setUpEstimates();
    const failing = createEstimateService({
      estimates: { ...estimateRepository(), bumpInputsRevision: () => Promise.reject(new Error('the revision write failed')) },
      nodes: nodeRepository(),
      transactions: createTransactionRunner(db.prisma),
    });
    await expect(failing.addPart(arjun, estimateId, { kind: 'item' })).rejects.toThrow('the revision write failed');
    expect(await stored()).toHaveLength(0);
    expect(await inputsRevision()).toBe(0);
  });
});

describe('AC-6: concurrency', () => {
  it('two moves of one part with the same revision: one stands, the other is 409 with the tree', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    const target = idOf(tree, '1.4');
    const results = await Promise.allSettled([
      service.moveNode(arjun, estimateId, { nodeId: target, revision: 1, parentId: idOf(tree, '2'), index: 0 }),
      service.moveNode(lead, estimateId, { nodeId: target, revision: 1, parentId: idOf(tree, '1'), index: 0 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(TreeChangedError);
    // The winner raised the part's own revision once; the loser changed nothing.
    expect((await stored()).find((row) => row.id === target)?.revision).toBe(2);
  });

  it('ten parts added at once are all stored with distinct places, and the revision counts every one', async () => {
    await setUpEstimates();
    const results = await Promise.all(Array.from({ length: 10 }, () => service.addPart(arjun, estimateId, { kind: 'item' })));
    expect(new Set(results.map((result) => result.nodeId)).size).toBe(10);
    const rows = await stored();
    expect(rows.map((row) => row.place).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(await inputsRevision()).toBe(10);
  });
});

describe('AC-7: who may write', () => {
  it('another Engineer and an unknown estimate are 404, and a submitted estimate is 409, with nothing written', async () => {
    await setUpEstimates();
    const tree = await storyTree();
    await expect(service.addPart(priya, estimateId, { kind: 'item' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getTree(priya, estimateId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.addPart(arjun, MISSING, { kind: 'item' })).rejects.toBeInstanceOf(NotFoundError);
    await db.owner.query(`UPDATE estimates SET status = 'SUBMITTED' WHERE id = $1::uuid`, [estimateId]);
    const rows = JSON.stringify(await stored());
    await expect(service.addPart(arjun, estimateId, { kind: 'item' })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.moveNode(arjun, estimateId, { nodeId: idOf(tree, '2'), revision: 1, parentId: null, index: 0 })).rejects.toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
    await expect(service.deleteNode(arjun, estimateId, { nodeId: idOf(tree, '2'), revision: 1, parts: 1, subtree: await seen(idOf(tree, '2')) })).rejects.toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
    expect(JSON.stringify(await stored())).toBe(rows);
    expect(await service.getTree(lead, estimateId)).toHaveLength(9);
    // The shared rule (STORY-06.01): a Lead may still change a submitted estimate, nobody an approved one.
    expect((await service.addPart(lead, estimateId, { kind: 'item' })).nodes).toHaveLength(10);
    await db.owner.query(`UPDATE estimates SET status = 'APPROVED' WHERE id = $1::uuid`, [estimateId]);
    await expect(service.addPart(lead, estimateId, { kind: 'item' })).rejects.toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
  });
});

describe('AC-8: a 500-node tree', () => {
  it('is numbered as the independent builder numbers it, for every role, and read in well under a second', async () => {
    await setUpEstimates();
    const { nodes: built } = buildTree500();
    const ids: string[] = [];
    const counts = new Map<number | null, number>();
    for (const entry of built) {
      const place = counts.get(entry.parentIndex) ?? 0;
      counts.set(entry.parentIndex, place + 1);
      const parent = entry.parentIndex === null ? null : defined(ids[entry.parentIndex]);
      const { rows } = await db.owner.query<{ id: string }>('INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index) VALUES ($1::uuid, $2::uuid, $3) RETURNING id::text AS id', [estimateId, parent, place]);
      ids.push(defined(rows[0]).id);
    }
    const started = performance.now();
    const read = await service.getTree(arjun, estimateId);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(read).toHaveLength(500);
    const bySl = new Map(read.map((node) => [node.id, node.slNo]));
    built.forEach((entry, index) => expect(bySl.get(defined(ids[index]))).toBe(entry.sl));
    expect(await service.getTree(lead, estimateId)).toEqual(read);
  });
});
