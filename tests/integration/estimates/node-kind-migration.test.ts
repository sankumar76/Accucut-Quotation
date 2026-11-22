import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NODE_KINDS, type NodeKind } from '@/lib/estimate/node-kinds';

import { buildTree500 } from '../../support/builders/tree500';
import { defined } from '../../support/defined';
import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * AQP-403 AC-1 (ADR-020 Verification): the migration `20261123140000_estimate_node_kind` on a copy of a database with trees in it. The scratch database has every migration; the documented rollback
 * (drop the column and the enum) takes it back to the state before this story, trees of every shape are written the way the previous release wrote them (no kind), and the migration file is run
 * from disk. Every row must then have the kind the shape gives it, and nothing else about any row may change: no row added or removed, no place, parent, input, revision or time. Every name is invented.
 */

const MIGRATION = fileURLToPath(new URL('../../../prisma/migrations/20261123140000_estimate_node_kind/migration.sql', import.meta.url));
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let scratch: ScratchDatabase;
let client: Client;
let leadId: string;
let engineerId: string;
let taskCounter = 0;

interface Row {
  readonly id: string;
  readonly estimate_id: string;
  readonly parent_id: string | null;
  readonly sort_index: number;
  readonly inputs: Record<string, unknown>;
  readonly image_id: string | null;
  readonly revision: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/** Every column of the table the migration must leave alone, in a fixed order. */
async function snapshot(): Promise<Row[]> {
  const { rows } = await client.query<Row>(
    'SELECT id::text, estimate_id::text, parent_id::text, sort_index, inputs, image_id::text, revision, created_at, updated_at FROM estimate_nodes ORDER BY estimate_id, id',
  );
  return rows;
}

async function estimateSnapshot(): Promise<unknown[]> {
  const { rows } = await client.query('SELECT * FROM estimates ORDER BY id');
  return rows;
}

async function kinds(): Promise<Map<string, string>> {
  const { rows } = await client.query<{ id: string; node_kind: string }>('SELECT id::text, node_kind::text FROM estimate_nodes');
  return new Map(rows.map((row) => [row.id, row.node_kind]));
}

async function newEstimate(): Promise<string> {
  taskCounter += 1;
  const task = await client.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [`Q-2026-${String(7000 + taskCounter)}`, engineerId, leadId, PATH],
  );
  const estimate = await client.query<{ id: string }>('INSERT INTO estimates (task_id, inputs_revision) VALUES ($1::uuid, 7) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  return defined(estimate.rows[0]).id;
}

/** A node as the previous release wrote it: no kind. A distinct revision, inputs and times, so a rewrite of any of them would show. */
async function insertLegacy(estimateId: string, parentId: string | null, place: number, tag: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, inputs, revision, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, '2026-11-10T10:00:00Z', '2026-11-11T11:00:00Z') RETURNING id::text AS id`,
    [estimateId, parentId, place, JSON.stringify({ tag }), 3 + place],
  );
  return defined(rows[0]).id;
}

beforeAll(async () => {
  scratch = await createMigratedScratchDatabase();
  client = new Client({ connectionString: scratch.ownerUrl });
  await client.connect();
  // The rollback of the migration's own header: the database as the previous release left it.
  await client.query('ALTER TABLE "estimate_nodes" DROP COLUMN "node_kind"');
  await client.query('DROP TYPE "estimate_node_kind"');
  const lead = await client.query<{ id: string }>(`INSERT INTO users (name, email, password_hash, role) VALUES ('Invented Lead', 'lead@example.test', 'invented-hash', 'LEAD') RETURNING id::text AS id`);
  const engineer = await client.query<{ id: string }>(`INSERT INTO users (name, email, password_hash, role) VALUES ('Invented Engineer', 'engineer@example.test', 'invented-hash', 'ENGINEER') RETURNING id::text AS id`);
  leadId = defined(lead.rows[0]).id;
  engineerId = defined(engineer.rows[0]).id;
}, 120_000);

afterAll(async () => {
  await client.end();
  await scratch.drop();
});

describe('the migration on trees of every shape', () => {
  const expected = new Map<string, NodeKind>();
  let before: Row[];
  let estimatesBefore: unknown[];

  beforeAll(async () => {
    // Estimate 1: a Main Assembly with a branch (B, which holds C, which holds F) and a leaf at depth 2 (D), and a second top-level row (E) with nothing under it.
    const one = await newEstimate();
    const a = await insertLegacy(one, null, 0, 'A');
    const b = await insertLegacy(one, a, 0, 'B');
    const d = await insertLegacy(one, a, 1, 'D');
    const c = await insertLegacy(one, b, 0, 'C');
    const f = await insertLegacy(one, c, 0, 'F');
    const e = await insertLegacy(one, null, 1, 'E');
    expected.set(a, 'MAIN_ASSEMBLY').set(b, 'SUB_ASSEMBLY').set(d, 'PART').set(c, 'PART').set(f, 'PART').set(e, 'MAIN_ASSEMBLY');

    // Estimate 2: the tree500 shape, six levels deep, with the rule applied by an independent walk of the fixture.
    const two = await newEstimate();
    const built = buildTree500().nodes;
    const parents = new Set(built.map((node) => node.parentIndex));
    const ids: string[] = [];
    const places = new Map<number | null, number>();
    for (const node of built) {
      const place = places.get(node.parentIndex) ?? 0;
      places.set(node.parentIndex, place + 1);
      const id = await insertLegacy(two, node.parentIndex === null ? null : defined(ids[node.parentIndex]), place, node.sl);
      ids.push(id);
      expected.set(id, node.depth === 1 ? 'MAIN_ASSEMBLY' : node.depth === 2 && parents.has(node.index) ? 'SUB_ASSEMBLY' : 'PART');
    }

    // Estimate 3: an estimate with no rows at all, and one with only a leaf at the top.
    await newEstimate();
    const three = await newEstimate();
    expected.set(await insertLegacy(three, null, 0, 'alone'), 'MAIN_ASSEMBLY');

    // Estimate 4: rows that no walk from the top reaches (two rows that are each other's parent; the schema forbids only a row being its own parent). They must not fail the migration: they become Parts.
    const four = await newEstimate();
    const x = await insertLegacy(four, null, 0, 'x');
    const y = await insertLegacy(four, x, 0, 'y');
    await client.query('UPDATE estimate_nodes SET parent_id = $2::uuid WHERE id = $1::uuid', [x, y]);
    expected.set(x, 'PART').set(y, 'PART');

    before = await snapshot();
    estimatesBefore = await estimateSnapshot();
    await client.query(readFileSync(MIGRATION, 'utf8'));
  }, 120_000);

  it('gives every row the kind its shape gives it: depth 1 a Main Assembly, depth 2 with a child a Sub-Assembly, every other row a Part (500-node, six-level tree included)', async () => {
    const stored = await kinds();
    expect(stored.size).toBe(expected.size);
    expect(stored.size).toBeGreaterThan(500);
    const wrong = [...expected].filter(([id, kind]) => stored.get(id) !== kind);
    expect(wrong).toEqual([]);
    // The rule never makes a Fastener: a Fastener cannot be told from a part by shape.
    expect([...stored.values()].includes('FASTENER')).toBe(false);
  });

  it('adds no row and removes none, and changes nothing else about any row: parent, place, inputs, picture, revision and both times; and no estimate row changes', async () => {
    const after = await snapshot();
    expect(after).toHaveLength(before.length);
    expect(after).toEqual(before);
    expect(await estimateSnapshot()).toEqual(estimatesBefore);
  });

  it('creates the enum with the four kinds in order, and makes the column NOT NULL with no default', async () => {
    const labels = await client.query<{ label: string }>(`SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'estimate_node_kind' ORDER BY e.enumsortorder`);
    expect(labels.rows.map((row) => row.label)).toEqual([...NODE_KINDS]);
    const column = await client.query<{ is_nullable: string; column_default: string | null }>(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'estimate_nodes' AND column_name = 'node_kind'`);
    expect(column.rows[0]).toEqual({ is_nullable: 'NO', column_default: null });
  });

  it('refuses a row with no kind, and a kind that is not one of the four (Sub-part is not stored)', async () => {
    const estimateId = await newEstimate();
    await expect(client.query('INSERT INTO estimate_nodes (estimate_id, sort_index) VALUES ($1::uuid, 0)', [estimateId])).rejects.toMatchObject({ code: '23502' });
    await expect(client.query(`INSERT INTO estimate_nodes (estimate_id, sort_index, node_kind) VALUES ($1::uuid, 0, 'SUB_PART')`, [estimateId])).rejects.toMatchObject({ code: '22P02' });
  });
});
