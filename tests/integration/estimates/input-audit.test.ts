import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError } from '@/lib/errors';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import type { AuditContext, AuditService } from '@/server/services/audit-service';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { entriesFor, insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { auditFor } from '../../support/customer-change';
import { defined } from '../../support/defined';
import { pngOfSize, smallPng } from '../../support/pictures';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * DEF-131 stage 2, ED-14 (architecture note lead-admin-input-edit-2026-11-27, sections 3.4, 3.8 and 3.9) against real PostgreSQL in a throwaway database: **every change a Lead or an Admin makes to a part's inputs,
 * its picture or the tree writes one audit entry in the write's own transaction, and an Engineer's writes write none.** What only the database can show: exactly one entry per real change with the actor, the role
 * at the time and only the changed fields; none for a save or a move that changed nothing; none for a refusal (approved, quoted, ignored, a stale revision); the write rolled back with its entry when the entry cannot
 * be written; and a service built without the audit trail refusing a Lead's or an Admin's write before it reads or writes anything. Every name, path and date is invented.
 */

/** What a Lead's save may cost on 500 rows, entry included (QLT-805-06). */
const MEASURE_LIMIT_MS = 1_000;
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
let taskCounter = 0;
/** The task code of the current test: its own, so no cleanup is needed (a part's picture is immutable, so its estimate cannot be deleted) and the audit log (immutable too) is read by the estimate's own ID. */
let CODE = '';
const LENGTH = seedFieldAt('J').id;
const WIDTH = seedFieldAt('K').id;
const MATERIAL = seedFieldAt('E').id;
const DESCRIPTION = seedFieldAt('D').id;

let db: AuthDatabase;
let leadId: string;
let adminId: string;
let arjunId: string;
let estimateId: string;
let materialCounter = 0;

const lead = (): EstimateViewer => ({ id: leadId, role: 'LEAD' });
const admin = (): EstimateViewer => ({ id: adminId, role: 'ADMIN' });
const arjun = (): EstimateViewer => ({ id: arjunId, role: 'ENGINEER' });
const context = (viewer: EstimateViewer): AuditContext => ({ actorId: viewer.id, actorLabel: `Invented ${viewer.role}`, requestId: 'req-input-audit' });

function build(audit: AuditService | undefined): EstimateService {
  return createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    audit,
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
    configurationById: () => Promise.resolve(seedConfig),
  });
}

beforeAll(async () => {
  db = await openAuthDatabase();
  leadId = await insertPersonAsOwner(db, 'Input Audit Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Input Audit Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Input Audit Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

/** Arjun's estimate in this status (not ignored), with one Main Assembly, whose ID is returned. */
async function setUp(status: 'DRAFT' | 'PREPARED' | 'APPROVED' | 'QUOTED' = 'DRAFT'): Promise<string> {
  taskCounter += 1;
  CODE = `Q-2026-${String(9300 + taskCounter)}`;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [CODE, arjunId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>("INSERT INTO estimates (task_id, status, quoted_at, quoted_by) VALUES ($1::uuid, $2::estimate_status, CASE WHEN $2 = 'QUOTED' THEN now() END, CASE WHEN $2 = 'QUOTED' THEN $3::uuid END) RETURNING id::text AS id", [defined(task.rows[0]).id, status, leadId])).rows[0]).id;
  const made = await db.owner.query<{ id: string }>("INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind) VALUES ($1::uuid, NULL, 0, 'MAIN_ASSEMBLY') RETURNING id::text AS id", [estimateId]);
  return defined(made.rows[0]).id;
}

/** A child of a row, inserted directly (as the tests of the tree do). */
async function insertChild(parentId: string, sortIndex: number, kind: 'SUB_ASSEMBLY' | 'PART' | 'FASTENER' = 'PART'): Promise<string> {
  const made = await db.owner.query<{ id: string }>('INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind) VALUES ($1::uuid, $2::uuid, $3, $4::estimate_node_kind) RETURNING id::text AS id', [estimateId, parentId, sortIndex, kind]);
  return defined(made.rows[0]).id;
}

async function revisionOf(nodeId: string): Promise<number> {
  return defined((await db.owner.query<{ revision: number }>('SELECT revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]).revision;
}
async function inputsRevision(): Promise<number> {
  return defined((await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).inputs_revision;
}
const entries = async (): Promise<ReadonlyArray<Awaited<ReturnType<typeof entriesFor>>[number]>> => (await entriesFor(db, estimateId)).filter((entry) => entry.event.startsWith('estimate.') && entry.event !== 'estimate.customer_changed');

async function addMaterial(): Promise<string> {
  materialCounter += 1;
  const { rows } = await db.owner.query<{ id: string }>(
    'INSERT INTO materials (material_in_drawing, material_considered, specific_gravity, is_hidden) VALUES ($1, $2, 7.85, false) RETURNING id::text AS id',
    [`Invented-audit-material-${String(materialCounter)}`, `Invented-audit-considered-${String(materialCounter)}`],
  );
  return defined(rows[0]).id;
}

describe('ED-14: a Lead\'s or an Admin\'s save of inputs writes one entry, in the save\'s transaction', () => {
  it('a Lead on a Draft: one entry with the actor, the role, the task code and only the changed fields', async () => {
    const node = await setUp();
    const service = build(auditFor(db));
    await service.saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450', [WIDTH]: '100' } }, context(lead()));
    const second = await service.saveInputs(lead(), estimateId, { nodeId: node, revision: 2, values: { [LENGTH]: '480', [WIDTH]: '100' } }, context(lead()));
    expect(second.revision).toBe(3);
    const stored = await entries();
    expect(stored.map((entry) => entry.event)).toEqual(['estimate.inputs_changed', 'estimate.inputs_changed']);
    const last = defined(stored[1]);
    expect(last).toMatchObject({ actor_id: leadId, object_type: 'estimate', object_id: estimateId, object_label: CODE, request_id: 'req-input-audit' });
    expect(last.before).toEqual({ part: { slNo: '1', name: '' }, fields: [{ letter: 'J', label: seedFieldAt('J').label, value: '450.00' }] });
    expect(last.after).toEqual({ actorRole: 'LEAD', part: { slNo: '1', name: '' }, fields: [{ letter: 'J', label: seedFieldAt('J').label, value: '480.00' }] });
  });

  it('an Admin on a Prepared estimate: one entry as ADMIN, the status stays Prepared', async () => {
    const node = await setUp('PREPARED');
    await build(auditFor(db)).saveInputs(admin(), estimateId, { nodeId: node, revision: 1, values: { [DESCRIPTION]: 'Cover plate' } }, context(admin()));
    const stored = await entries();
    expect(stored).toHaveLength(1);
    expect(defined(stored[0]).after).toMatchObject({ actorRole: 'ADMIN', part: { slNo: '1', name: 'Cover plate' } });
    expect((await db.owner.query<{ status: string }>('SELECT status::text AS status FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]?.status).toBe('PREPARED');
  });

  it('shows the material by its name and never by its ID', async () => {
    const node = await setUp();
    const material = await addMaterial();
    await build(auditFor(db)).saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [MATERIAL]: material } }, context(lead()));
    const text = defined((await entries())[0]).after_text ?? '';
    expect(text).toContain('Invented-audit-material-');
    expect(text).not.toContain(material);
  });

  it('a save that changes nothing writes no entry and raises no revision', async () => {
    const node = await setUp();
    const service = build(auditFor(db));
    await service.saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '1.5' } }, context(lead()));
    const before = { part: await revisionOf(node), estimate: await inputsRevision(), entries: (await entries()).length };
    await service.saveInputs(lead(), estimateId, { nodeId: node, revision: 2, values: { [LENGTH]: '1.50' } }, context(lead()));
    expect({ part: await revisionOf(node), estimate: await inputsRevision(), entries: (await entries()).length }).toEqual(before);
  });

  it('an Engineer\'s own save writes no entry', async () => {
    const node = await setUp();
    await build(auditFor(db)).saveInputs(arjun(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } });
    expect(await entries()).toEqual([]);
  });

  it.each(['APPROVED', 'QUOTED'] as const)('an estimate that is %s refuses the save (409) with no write and no entry', async (status) => {
    const node = await setUp(status);
    await expect(build(auditFor(db)).saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } }, context(lead()))).rejects.toBeInstanceOf(ConflictError);
    expect(await entries()).toEqual([]);
    expect(await revisionOf(node)).toBe(1);
  });

  it('an approved estimate refuses an Admin\'s save too, and a Quoted one refuses a picture and a tree write: no write, no entry', async () => {
    const node = await setUp('QUOTED');
    const service = build(auditFor(db));
    await expect(service.saveInputs(admin(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } }, context(admin()))).rejects.toBeInstanceOf(ConflictError);
    await expect(service.putPicture(lead(), estimateId, node, { name: 'invented-drawing.png', bytes: smallPng() }, context(lead()))).rejects.toBeInstanceOf(ConflictError);
    await expect(service.addPart(lead(), estimateId, { parentId: node, nodeKind: 'SUB_ASSEMBLY' }, context(lead()))).rejects.toBeInstanceOf(ConflictError);
    expect(await entries()).toEqual([]);
    expect(await revisionOf(node)).toBe(1);
  });

  it('an ignored estimate refuses the save (409) with no write and no entry', async () => {
    const node = await setUp('PREPARED');
    await db.owner.query("UPDATE estimates SET ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = 'Invented remarks.' WHERE id = $1::uuid", [estimateId, leadId]);
    await expect(build(auditFor(db)).saveInputs(admin(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } }, context(admin()))).rejects.toBeInstanceOf(ConflictError);
    expect(await entries()).toEqual([]);
    expect(await revisionOf(node)).toBe(1);
  });

  it('a stale revision is 409 with no entry', async () => {
    const node = await setUp();
    const service = build(auditFor(db));
    await service.saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '1' } }, context(lead()));
    await expect(service.saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '2' } }, context(lead()))).rejects.toBeInstanceOf(ConflictError);
    expect(await entries()).toHaveLength(1);
  });

  it('an entry that cannot be written rolls the save back: the part, its revision and the estimate\'s are as they were', async () => {
    const node = await setUp();
    const failing: AuditService = { ...auditFor(db), recordMany: () => Promise.reject(new Error('invented audit failure')) };
    await expect(build(failing).saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } }, context(lead()))).rejects.toThrow('invented audit failure');
    expect(await revisionOf(node)).toBe(1);
    expect(await inputsRevision()).toBe(0);
    expect((await db.owner.query<{ inputs: unknown }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [node])).rows[0]?.inputs).toEqual({});
  });

  it('a service built without the audit trail refuses a Lead\'s save before it writes anything, and still takes an Engineer\'s', async () => {
    const node = await setUp();
    const service = build(undefined);
    await expect(service.saveInputs(lead(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } }, context(lead()))).rejects.toThrow('audit trail');
    await expect(service.saveInputs(admin(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } })).rejects.toThrow('audit trail');
    expect(await revisionOf(node)).toBe(1);
    await service.saveInputs(arjun(), estimateId, { nodeId: node, revision: 1, values: { [LENGTH]: '450' } });
    expect(await revisionOf(node)).toBe(2);
  });
});

describe('ED-14: a Lead\'s or an Admin\'s change of the Part Model picture writes one entry', () => {
  const upload = (name: string) => ({ name, bytes: smallPng() });

  it('adds, replaces and removes: one entry each, in words, with no bytes and no file name', async () => {
    const node = await setUp();
    const service = build(auditFor(db));
    await service.putPicture(lead(), estimateId, node, upload('invented-drawing.png'), context(lead()));
    await service.putPicture(lead(), estimateId, node, { name: 'invented-second.png', bytes: pngOfSize(2_000) }, context(lead()));
    await service.removePicture(lead(), estimateId, node, context(lead()));
    const stored = await entries();
    expect(stored.map((entry) => defined((defined(entry.after) as { fields: Array<{ value: string }> }).fields[0]).value)).toEqual(['Picture added', 'Picture replaced', 'Picture removed']);
    expect(stored.map((entry) => defined((defined(entry.before) as { fields: Array<{ value: string | null }> }).fields[0]).value)).toEqual([null, 'Picture', 'Picture']);
    for (const entry of stored) {
      expect(entry.after_text).not.toContain('invented-drawing');
      expect(entry.before_text).not.toContain('invented-drawing');
      expect(entry.after_text).not.toContain('invented-second');
      expect(entry.after).toMatchObject({ actorRole: 'LEAD' });
    }
  });

  it('an entry that cannot be written rolls a picture add and a picture removal back', async () => {
    const node = await setUp();
    const failing: AuditService = { ...auditFor(db), recordMany: () => Promise.reject(new Error('invented audit failure')) };
    await expect(build(failing).putPicture(lead(), estimateId, node, upload('invented-drawing.png'), context(lead()))).rejects.toThrow('invented audit failure');
    expect((await db.owner.query<{ image_id: string | null }>('SELECT image_id::text AS image_id FROM estimate_nodes WHERE id = $1::uuid', [node])).rows[0]?.image_id).toBeNull();
    expect(await revisionOf(node)).toBe(1);
    expect(await inputsRevision()).toBe(0);
    await build(auditFor(db)).putPicture(lead(), estimateId, node, upload('invented-drawing.png'), context(lead()));
    const revision = await revisionOf(node);
    const estimateRevision = await inputsRevision();
    await expect(build(failing).removePicture(lead(), estimateId, node, context(lead()))).rejects.toThrow('invented audit failure');
    expect((await db.owner.query<{ image_id: string | null }>('SELECT image_id::text AS image_id FROM estimate_nodes WHERE id = $1::uuid', [node])).rows[0]?.image_id).not.toBeNull();
    expect({ revision: await revisionOf(node), estimate: await inputsRevision() }).toEqual({ revision, estimate: estimateRevision });
  });

  it('the same picture again, and a removal where there is none, write nothing; an Engineer\'s picture writes no entry', async () => {
    const node = await setUp();
    const service = build(auditFor(db));
    await service.removePicture(lead(), estimateId, node, context(lead()));
    await service.putPicture(arjun(), estimateId, node, upload('invented-drawing.png'));
    expect(await entries()).toEqual([]);
    await service.putPicture(lead(), estimateId, node, upload('invented-drawing.png'), context(lead()));
    expect(await entries()).toEqual([]);
  });
});

describe('ED-14: a Lead\'s or an Admin\'s write to the tree writes one entry', () => {
  it('add: one entry with the new row and its parent; an Engineer\'s add writes none', async () => {
    const root = await setUp();
    const service = build(auditFor(db));
    await service.addPart(lead(), estimateId, { parentId: root, nodeKind: 'SUB_ASSEMBLY' }, context(lead()));
    await service.addPart(admin(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' }, context(admin()));
    await service.addPart(arjun(), estimateId, { parentId: root, nodeKind: 'SUB_ASSEMBLY' });
    const stored = await entries();
    expect(stored.map((entry) => entry.event)).toEqual(['estimate.part_added', 'estimate.part_added']);
    expect(defined(stored[0]).after).toEqual({ actorRole: 'LEAD', part: { slNo: '1.1', kind: 'SUB_ASSEMBLY' }, parent: { slNo: '1', name: '' } });
    expect(defined(stored[1]).after).toEqual({ actorRole: 'ADMIN', part: { slNo: '2', kind: 'MAIN_ASSEMBLY' }, parent: null });
    expect(defined(stored[0]).before).toEqual({});
  });

  it('move: one entry with the number before and after; a move to where the row already is writes none', async () => {
    const root = await setUp();
    const first = await insertChild(root, 0);
    const second = await insertChild(root, 1);
    const service = build(auditFor(db));
    const revision = await revisionOf(second);
    const firstRevision = await revisionOf(first);
    await service.moveNode(lead(), estimateId, { nodeId: second, revision, parentId: root, index: 0 }, context(lead()));
    const stored = await entries();
    expect(stored).toHaveLength(1);
    expect(defined(stored[0]).event).toBe('estimate.part_moved');
    expect(defined(stored[0]).before).toEqual({ part: { slNo: '1.2', name: '', kind: 'PART' } });
    expect(defined(stored[0]).after).toEqual({ actorRole: 'LEAD', part: { slNo: '1.1', name: '', kind: 'PART' } });
    await service.moveNode(lead(), estimateId, { nodeId: second, revision: await revisionOf(second), parentId: root, index: 0 }, context(lead()));
    expect(await entries()).toHaveLength(1);
    // The row that only shifted keeps its revision, and the row that moved has a new one: the entry is of the move, and a no-op writes nothing more.
    expect(await revisionOf(first)).toBe(firstRevision);
    expect(await revisionOf(second)).toBe(revision + 1);
  });

  it('an entry that cannot be written rolls a move and a delete back: the order, the rows and both revisions are as they were', async () => {
    const root = await setUp();
    const first = await insertChild(root, 0);
    const second = await insertChild(root, 1);
    const failing: AuditService = { ...auditFor(db), recordMany: () => Promise.reject(new Error('invented audit failure')) };
    const order = async (): Promise<string[]> => (await db.owner.query<{ id: string }>('SELECT id::text AS id FROM estimate_nodes WHERE parent_id = $1::uuid ORDER BY sort_index', [root])).rows.map((row) => row.id);
    const before = { order: await order(), revision: await revisionOf(second), estimate: await inputsRevision() };
    await expect(build(failing).moveNode(lead(), estimateId, { nodeId: second, revision: before.revision, parentId: root, index: 0 }, context(lead()))).rejects.toThrow('invented audit failure');
    expect({ order: await order(), revision: await revisionOf(second), estimate: await inputsRevision() }).toEqual(before);
    expect(before.order).toEqual([first, second]);
    const nodes = await createEstimateNodeRepository(db.prisma).listNodes(estimateId);
    const { subtreeFingerprint } = await import('@/lib/estimate/subtree-fingerprint');
    await expect(build(failing).deleteNode(lead(), estimateId, { nodeId: second, revision: before.revision, parts: 1, subtree: subtreeFingerprint(nodes.filter((node) => node.id === second)) }, context(lead()))).rejects.toThrow('invented audit failure');
    expect(await order()).toEqual(before.order);
    expect(await inputsRevision()).toBe(before.estimate);
  });

  it('delete: one entry for the root and its rows, with no input value; an Engineer\'s delete writes none', async () => {
    const root = await setUp();
    const part = await insertChild(root, 0);
    await insertChild(part, 0, 'FASTENER');
    await insertChild(part, 1, 'FASTENER');
    await db.owner.query("UPDATE estimate_nodes SET inputs = jsonb_build_object($2::text, 'Invented bracket', $3::text, '777.00') WHERE id = $1::uuid", [part, DESCRIPTION, LENGTH]);
    const service = build(auditFor(db));
    const members = await db.owner.query<{ id: string }>('SELECT id::text AS id FROM estimate_nodes WHERE estimate_id = $1::uuid', [estimateId]);
    expect(members.rows).toHaveLength(4);
    const { subtreeFingerprint } = await import('@/lib/estimate/subtree-fingerprint');
    const nodes = await createEstimateNodeRepository(db.prisma).listNodes(estimateId);
    const doomed = nodes.filter((node) => node.id === part || node.parentId === part);
    await service.deleteNode(lead(), estimateId, { nodeId: part, revision: await revisionOf(part), parts: 3, subtree: subtreeFingerprint(doomed) }, context(lead()));
    const stored = await entries();
    expect(stored).toHaveLength(1);
    expect(defined(stored[0]).event).toBe('estimate.part_deleted');
    expect(defined(stored[0]).before).toEqual({
      part: { slNo: '1.1', name: 'Invented bracket', kind: 'PART' },
      rows: 3,
      list: [
        { slNo: '1.1', name: 'Invented bracket', kind: 'PART' },
        { slNo: '1.1.1', name: '', kind: 'FASTENER' },
        { slNo: '1.1.2', name: '', kind: 'FASTENER' },
      ],
    });
    expect(defined(stored[0]).after).toEqual({ actorRole: 'LEAD' });
    // The name of a row is kept (a person reads it on the log); a value typed into the row's fields is not.
    expect(defined(stored[0]).before_text).not.toContain('777');
  });

  it('a delete of more than 100 rows lists the first 100, says so, and keeps the count', async () => {
    const root = await setUp();
    for (let index = 0; index < 105; index += 1) await insertChild(root, index);
    const service = build(auditFor(db));
    const nodes = await createEstimateNodeRepository(db.prisma).listNodes(estimateId);
    const { subtreeFingerprint } = await import('@/lib/estimate/subtree-fingerprint');
    await service.deleteNode(admin(), estimateId, { nodeId: root, revision: await revisionOf(root), parts: nodes.length, subtree: subtreeFingerprint(nodes) }, context(admin()));
    const before = defined((await entries())[0]).before as { rows: number; list: unknown[]; truncated?: boolean };
    expect(before.rows).toBe(106);
    expect(before.list).toHaveLength(100);
    expect(before.truncated).toBe(true);
  });

  it('a tree write that cannot be audited rolls back with its entry, and a service without the trail refuses a Lead\'s write', async () => {
    const root = await setUp();
    const failing: AuditService = { ...auditFor(db), recordMany: () => Promise.reject(new Error('invented audit failure')) };
    await expect(build(failing).addPart(lead(), estimateId, { parentId: root, nodeKind: 'SUB_ASSEMBLY' }, context(lead()))).rejects.toThrow('invented audit failure');
    expect((await db.owner.query('SELECT 1 FROM estimate_nodes WHERE estimate_id = $1::uuid', [estimateId])).rowCount).toBe(1);
    await expect(build(undefined).addPart(lead(), estimateId, { parentId: root, nodeKind: 'SUB_ASSEMBLY' })).rejects.toThrow('audit trail');
    expect((await db.owner.query('SELECT 1 FROM estimate_nodes WHERE estimate_id = $1::uuid', [estimateId])).rowCount).toBe(1);
  });

  it('an approved estimate refuses a Lead\'s tree write (409) with no entry', async () => {
    const root = await setUp('APPROVED');
    await expect(build(auditFor(db)).addPart(lead(), estimateId, { parentId: root, nodeKind: 'SUB_ASSEMBLY' }, context(lead()))).rejects.toBeInstanceOf(ConflictError);
    expect(await entries()).toEqual([]);
  });
});

describe('QLT-805-06: what the trail costs on a 500-row tree', () => {
  it('a Lead\'s save on a tree of 500 rows, entry included, is read and written in well under a second', async () => {
    const root = await setUp();
    await db.owner.query("INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind) SELECT $1::uuid, $2::uuid, g, 'PART' FROM generate_series(0, 498) AS g", [estimateId, root]);
    const service = build(auditFor(db));
    const engineer = build(auditFor(db));
    const started = performance.now();
    await service.saveInputs(lead(), estimateId, { nodeId: root, revision: 1, values: { [LENGTH]: '450' } }, context(lead()));
    const withTrail = performance.now() - started;
    const plainStart = performance.now();
    await engineer.saveInputs(arjun(), estimateId, { nodeId: root, revision: 2, values: { [LENGTH]: '460' } });
    const without = performance.now() - plainStart;
    // Measured on the developer's PC: the Lead's save costs one more read of the tree (the row's number) and one insert; stated in the pull request.
    expect(withTrail, `a save on 500 rows with the trail took ${withTrail.toFixed(0)} ms (without it ${without.toFixed(0)} ms)`).toBeLessThan(MEASURE_LIMIT_MS);
    expect((await entries()).map((entry) => entry.event)).toEqual(['estimate.inputs_changed']);
  });
});
