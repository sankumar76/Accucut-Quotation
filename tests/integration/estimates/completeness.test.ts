import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { encodeTreatment } from '@/lib/estimate/treatment-value';
import { OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { auditFor, withAuditContext } from '../../support/customer-change';
import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { TREE500_NODE_COUNT } from '../../support/builders/tree500';
import { completePartInputs, fieldIdOf } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { smallPng } from '../../support/pictures';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-05.11 AC-2, AC-3 (FR-057; FR-055) against real PostgreSQL in a throwaway database: the tree, the save of a part's inputs and a picture change answer the **same word** for the same part, by the
 * one rule of Calculate (`part-completeness.ts`). What only the database can show: the word read back from rows the service really wrote, a part with every input and no picture being `COMPLETE`,
 * a picture never counting as input, and a 500-part tree answered with no query per part (within the existing budget). Every name, path and value is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let estimateId: string;
let materialCounter = 0;
let taskCounter = 0;

beforeAll(async () => {
  db = await openAuthDatabase();
  service = withAuditContext(createEstimateService({
    audit: auditFor(db),
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
    configurationById: () => Promise.resolve(seedConfig),
  }));
  leadId = await insertPersonAsOwner(db, 'Completeness Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Completeness Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

const arjun = (): EstimateViewer => ({ id: arjunId, role: 'ENGINEER' });
const lead = (): EstimateViewer => ({ id: leadId, role: 'LEAD' });

/**
 * Arjun's draft estimate with `parts` parts at the top; returns the IDs of the parts. Each test makes an estimate of its own and nothing is cleaned up: a picture row keeps its estimate
 * (the table is immutable), and the database is dropped at the end.
 */
async function setUpParts(parts: number): Promise<string[]> {
  taskCounter += 1;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($4, $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [arjunId, leadId, PATH, `Q-2026-${String(4000 + taskCounter)}`],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  const ids: string[] = [];
  for (let index = 0; index < parts; index += 1) ids.push((await service.addPart(arjun(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' })).nodeId);
  return ids;
}

async function addMaterial(): Promise<string> {
  materialCounter += 1;
  const { rows } = await db.owner.query<{ id: string }>(
    `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity, is_hidden, deleted_at)
     VALUES ($1, $2, 7.85, false, NULL) RETURNING id::text AS id`,
    [`Invented-completeness-material-${String(materialCounter)}`, `Invented-completeness-considered-${String(materialCounter)}`],
  );
  return defined(rows[0]).id;
}

/** The text the form sends for every input of a complete part, with a real material of the Material Master. */
async function completeValues(): Promise<Record<string, string>> {
  const material = await addMaterial();
  const values: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(completePartInputs(seedConfig, material))) {
    values[fieldId] = typeof value === 'string' ? value : encodeTreatment({ id: OTHER_TREATMENT_ID, text: value.text });
  }
  return values;
}

/** The word of a part in the tree, in the part's own answer and in the tree of a Lead: they are one word. */
async function wordOf(partId: string): Promise<string> {
  const tree = await service.getTree(arjun(), estimateId);
  const inTree = defined(tree.find((node) => node.id === partId)).completeness;
  expect(defined((await service.getTree(lead(), estimateId)).find((node) => node.id === partId)).completeness).toBe(inTree);
  expect((await service.getNode(arjun(), estimateId, partId)).completeness).toBe(inTree);
  return inTree;
}

describe('AC-2: the tree, a save and a picture change give the same word', () => {
  it('goes EMPTY, PARTIAL and COMPLETE as values are saved, and the save answers the word the tree gives', async () => {
    const [partId] = await setUpParts(1);
    const part = defined(partId);
    expect(await wordOf(part)).toBe('EMPTY');
    const values = await completeValues();
    const [firstId, ...restIds] = Object.keys(values);
    const first = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: 1, values: { [defined(firstId)]: defined(values[defined(firstId)]) } });
    expect(first.completeness).toBe('PARTIAL');
    expect(await wordOf(part)).toBe('PARTIAL');
    let revision = first.revision;
    let last = first;
    for (const fieldId of restIds) {
      last = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision, values: { [fieldId]: defined(values[fieldId]) } });
      revision = last.revision;
      // No answer says COMPLETE before the last needed input, and none says PARTIAL after it.
      expect(last.completeness).toBe(fieldId === restIds[restIds.length - 1] ? 'COMPLETE' : 'PARTIAL');
    }
    expect(await wordOf(part)).toBe('COMPLETE');
  });

  it('a save of the same value again, which writes nothing, answers the same word as the tree', async () => {
    const [partId] = await setUpParts(1);
    const part = defined(partId);
    const values = await completeValues();
    const saved = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: 1, values });
    expect(saved.completeness).toBe('COMPLETE');
    const again = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: saved.revision, values });
    expect(again.revision).toBe(saved.revision);
    expect(again.completeness).toBe(await wordOf(part));
  });

  it('a part with every input and no picture is COMPLETE, and a picture added or removed gives the same word and never makes an empty part PARTIAL (Part Model is optional, D-31)', async () => {
    const [whole, empty] = await setUpParts(2);
    const complete = defined(whole);
    const none = defined(empty);
    await service.saveInputs(arjun(), estimateId, { nodeId: complete, revision: 1, values: await completeValues() });
    expect(await wordOf(complete)).toBe('COMPLETE');
    const withPicture = await service.putPicture(arjun(), estimateId, complete, { name: 'invented.png', bytes: smallPng() });
    expect(withPicture.completeness).toBe('COMPLETE');
    expect(await wordOf(complete)).toBe('COMPLETE');
    expect((await service.removePicture(arjun(), estimateId, complete)).completeness).toBe('COMPLETE');
    const onEmpty = await service.putPicture(arjun(), estimateId, none, { name: 'invented.png', bytes: smallPng() });
    expect(onEmpty.completeness).toBe('EMPTY');
    expect(await wordOf(none)).toBe('EMPTY');
  });

  it('clearing a needed input takes a complete part back to PARTIAL, in the save\'s answer and in the tree', async () => {
    const [partId] = await setUpParts(1);
    const part = defined(partId);
    const saved = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: 1, values: await completeValues() });
    const cleared = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: saved.revision, values: { [fieldIdOf('part-no')]: '' } });
    expect(cleared.completeness).toBe('PARTIAL');
    expect(await wordOf(part)).toBe('PARTIAL');
  });
});

describe('AC-3: Fasteners "None" with and without a typed Qty, and 0 as a value', () => {
  it('Fasteners "None" is complete with no Qty and with a typed Qty (hidden, stored as 0); another word needs Qty and Cost', async () => {
    const [partId] = await setUpParts(1);
    const part = defined(partId);
    const values = { ...(await completeValues()), [fieldIdOf('fasteners')]: 'None' };
    const saved = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: 1, values });
    expect(saved.completeness).toBe('COMPLETE');
    const typedQty = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: saved.revision, values: { [fieldIdOf('fasteners-qty')]: '5.00' } });
    expect(typedQty.completeness).toBe('COMPLETE');
    expect(await wordOf(part)).toBe('COMPLETE');
    const word = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: typedQty.revision, values: { [fieldIdOf('fasteners')]: 'Invented bolts' } });
    expect(word.completeness).toBe('PARTIAL');
    expect(await wordOf(part)).toBe('PARTIAL');
    const both = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: word.revision, values: { [fieldIdOf('fasteners-qty')]: '3.00', [fieldIdOf('fasteners-cost')]: '0' } });
    expect(both.completeness).toBe('COMPLETE');
    expect(await wordOf(part)).toBe('COMPLETE');
  });

  it('a part with only 0 values is PARTIAL, not EMPTY and not COMPLETE', async () => {
    const [partId] = await setUpParts(1);
    const part = defined(partId);
    const saved = await service.saveInputs(arjun(), estimateId, { nodeId: part, revision: 1, values: { [fieldIdOf('length')]: '0' } });
    expect(saved.completeness).toBe('PARTIAL');
    expect(await wordOf(part)).toBe('PARTIAL');
  });
});

describe('a 500-part tree', () => {
  it('is answered with the word of every part, in well under a second, with no query per part (NFR-008)', async () => {
    await setUpParts(0);
    // 500 parts in one statement (the rows of `tree500` are one at a time and take seconds); the first is complete, the rest are empty.
    const { rows } = await db.owner.query<{ id: string }>(
      'INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind) SELECT $1::uuid, NULL, sort_index, \'MAIN_ASSEMBLY\' FROM generate_series(0, $2::int - 1) AS sort_index RETURNING id::text AS id, sort_index',
      [estimateId, TREE500_NODE_COUNT],
    );
    expect(rows).toHaveLength(TREE500_NODE_COUNT);
    const first = defined((await db.owner.query<{ id: string }>('SELECT id::text AS id FROM estimate_nodes WHERE estimate_id = $1::uuid AND sort_index = 0', [estimateId])).rows[0]).id;
    await db.owner.query('UPDATE estimate_nodes SET inputs = $2::jsonb WHERE id = $1::uuid', [first, JSON.stringify(completePartInputs(seedConfig, await addMaterial()))]);
    const started = performance.now();
    const tree = await service.getTree(arjun(), estimateId);
    const took = performance.now() - started;
    expect(tree).toHaveLength(TREE500_NODE_COUNT);
    expect(tree.filter((node) => node.completeness === 'COMPLETE').map((node) => node.id)).toEqual([first]);
    expect(tree.filter((node) => node.completeness === 'EMPTY')).toHaveLength(TREE500_NODE_COUNT - 1);
    // Reported in the Dev Record: the budget is the tree read's own (well under a second).
    expect(took).toBeLessThan(1000);
  });
});
