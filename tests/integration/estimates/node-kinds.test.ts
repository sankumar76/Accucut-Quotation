import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { ALLOWED_CHILDREN, NODE_KINDS, type NodeKind, type ParentKind } from '@/lib/estimate/node-kinds';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, MAX_PARTS_PER_ESTIMATE, MOVE_ACROSS_PARENTS_CODE, NODE_KIND_NOT_ALLOWED_CODE, TREE_FULL_CODE, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { partsTreeSchema } from '@/server/views/schemas';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';

/**
 * AQP-403 (CR-01 item 3A; SPEC 6.1, tests 14.30 to 14.35) against real PostgreSQL: the add rule for every pair of parent kind and kind, the new row last, the kind stored in `node_kind`, the move
 * refusal across parents, the 2,000-part limit with kinded adds, and that an Engineer's tree carries the kind and no figure. The pure rules are `tests/unit/estimate-node-kinds-service.test.ts`; the
 * migration and its backfill are `node-kind-migration.test.ts`. Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let estimateId: string;
let taskCounter = 0;

const arjun: EstimateViewer = { get id() { return arjunId; }, role: 'ENGINEER' };
const lead: EstimateViewer = { get id() { return leadId; }, role: 'LEAD' };

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    ...inputsDependencies(),
  });
  leadId = await insertPersonAsOwner(db, 'Kinds Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Kinds Arjun', 'ENGINEER');
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
    [`Q-2026-${String(6000 + taskCounter)}`, arjunId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  return defined(estimate.rows[0]).id;
}

const add = async (parentId: string | null, nodeKind: NodeKind): Promise<string> => (await service.addPart(arjun, estimateId, { parentId, nodeKind })).nodeId;

/** 1 Main, 1.1 Sub-Assembly, 1.1.1 Part, 1.1.1.1 Fastener, 1.2 Part, 1.3 Fastener: one row of each kind. */
async function kindedTree(): Promise<Record<ParentKind, string | null>> {
  const main = await add(null, 'MAIN_ASSEMBLY');
  const sub = await add(main, 'SUB_ASSEMBLY');
  const part = await add(sub, 'PART');
  const fastener = await add(part, 'FASTENER');
  await add(main, 'PART');
  await add(main, 'FASTENER');
  return { TOP: null, MAIN_ASSEMBLY: main, SUB_ASSEMBLY: sub, PART: part, FASTENER: fastener };
}

const storedKinds = async (): Promise<Array<{ id: string; kind: string; parent: string | null; place: number }>> =>
  (await db.owner.query<{ id: string; kind: string; parent: string | null; place: number }>('SELECT id::text AS id, node_kind::text AS kind, parent_id::text AS parent, sort_index AS place FROM estimate_nodes WHERE estimate_id = $1::uuid ORDER BY id', [estimateId])).rows;

const inputsRevision = async (): Promise<number> => defined((await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).inputs_revision;

describe('AC-3 (14.30): the add rule for every pair of parent kind and kind, through the real tables', () => {
  it('allows exactly the pairs of ALLOWED_CHILDREN, stores the kind in node_kind, and writes nothing for a refused pair', async () => {
    estimateId = await newEstimate();
    const parents = await kindedTree();
    for (const parent of Object.keys(parents) as ParentKind[]) {
      for (const kind of NODE_KINDS) {
        const rows = await storedKinds();
        const revision = await inputsRevision();
        const result = await service.addPart(arjun, estimateId, { parentId: parents[parent], nodeKind: kind }).then(
          (added) => added,
          (error: unknown) => error,
        );
        if (ALLOWED_CHILDREN[parent].includes(kind)) {
          const added = result as Awaited<ReturnType<EstimateService['addPart']>>;
          expect((await storedKinds()).find((row) => row.id === added.nodeId)).toMatchObject({ kind, parent: parents[parent] });
          expect(await inputsRevision()).toBe(revision + 1);
        } else {
          expect(result, `${kind} under ${parent}`).toBeInstanceOf(FieldValidationError);
          expect(result).toMatchObject({ code: NODE_KIND_NOT_ALLOWED_CODE, httpStatus: 422 });
          expect(await storedKinds()).toEqual(rows);
          expect(await inputsRevision()).toBe(revision);
        }
      }
    }
  });

  it('adds the new row last under its parent: the next place after every sibling, and 0 for the first', async () => {
    estimateId = await newEstimate();
    const main = await add(null, 'MAIN_ASSEMBLY');
    for (let n = 0; n < 3; n += 1) await add(main, 'PART');
    const last = await add(main, 'FASTENER');
    const rows = await storedKinds();
    expect(rows.filter((row) => row.parent === main).map((row) => row.place).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(rows.find((row) => row.id === last)?.place).toBe(3);
    expect(rows.find((row) => row.id === main)?.place).toBe(0);
    const second = await add(null, 'MAIN_ASSEMBLY');
    expect((await storedKinds()).find((row) => row.id === second)?.place).toBe(1);
  });

  it('keeps the limit of 2,000 parts: a kinded add at the limit is 422 TREE_FULL and writes nothing, and one under the limit goes through', async () => {
    estimateId = await newEstimate();
    await db.owner.query(
      `INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind) SELECT $1::uuid, NULL, n, 'MAIN_ASSEMBLY' FROM generate_series(0, $2::int - 2) AS n`,
      [estimateId, MAX_PARTS_PER_ESTIMATE],
    );
    expect(await storedKinds()).toHaveLength(MAX_PARTS_PER_ESTIMATE - 1);
    await add(null, 'MAIN_ASSEMBLY');
    expect(await storedKinds()).toHaveLength(MAX_PARTS_PER_ESTIMATE);
    await expect(service.addPart(arjun, estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' })).rejects.toMatchObject({ code: TREE_FULL_CODE });
    expect(await storedKinds()).toHaveLength(MAX_PARTS_PER_ESTIMATE);
  });
});

describe('AC-5 (A-CR01-5, 14.32): moves stay inside the parent', () => {
  it('refuses a move to another parent with 422 MOVE_ACROSS_PARENTS and writes nothing; a move within the parent raises inputs_revision once and changes no kind', async () => {
    estimateId = await newEstimate();
    const parents = await kindedTree();
    const rows = await storedKinds();
    const revision = await inputsRevision();
    const row = defined(rows.find((candidate) => candidate.parent === parents.MAIN_ASSEMBLY && candidate.kind === 'FASTENER'));
    const refused = await service.moveNode(lead, estimateId, { nodeId: row.id, revision: 1, parentId: parents.SUB_ASSEMBLY, index: 0 }).catch((error: unknown) => error);
    expect(refused).toMatchObject({ code: MOVE_ACROSS_PARENTS_CODE, httpStatus: 422 });
    expect(await storedKinds()).toEqual(rows);
    expect(await inputsRevision()).toBe(revision);

    await service.moveNode(lead, estimateId, { nodeId: row.id, revision: 1, parentId: parents.MAIN_ASSEMBLY, index: 0 });
    expect(await inputsRevision()).toBe(revision + 1);
    const after = await storedKinds();
    expect(after.map(({ id, kind, parent }) => [id, kind, parent])).toEqual(rows.map(({ id, kind, parent }) => [id, kind, parent]));
    expect(after.find((candidate) => candidate.id === row.id)?.place).toBe(0);
  });
});

describe('AC-7 (NFR-002): the tree carries the kind for every role and no figure', () => {
  it('an Engineer\'s tree has the seven facts of a part and passes the strict schema; a Lead\'s is the same', async () => {
    estimateId = await newEstimate();
    await kindedTree();
    const asEngineer = await service.getTree(arjun, estimateId);
    expect(await service.getTree(lead, estimateId)).toEqual(asEngineer);
    const parsed = partsTreeSchema.parse({ nodes: [...asEngineer] });
    for (const node of parsed.nodes) expect(Object.keys(node).sort()).toEqual(['completeness', 'id', 'label', 'nodeKind', 'parentId', 'revision', 'slNo']);
    expect(parsed.nodes.map((node) => node.nodeKind)).toEqual(['MAIN_ASSEMBLY', 'SUB_ASSEMBLY', 'PART', 'FASTENER', 'PART', 'FASTENER']);
  });
});
