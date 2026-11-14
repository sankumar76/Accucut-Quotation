import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { canaryPartInputs, canaryRateFieldId, CANARY_PLANTED_RATE, CANARY_UNKNOWN_KEY } from '../../support/canary-part-inputs';
import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.04 T6 (AC-1 to AC-5, AC-7) against real PostgreSQL in a throwaway database: the estimate service over the real repositories, for the fields of sections 03 to 08. What only the
 * database can show is shown here: every new number stored as two-decimal text and the texts as typed, in one write with one new revision of the part and of the estimate; Remarks of 1,000
 * characters with its line breaks coming back from `jsonb` as it went in; Fasteners left alone not stored (a part with nothing typed holds `{}`); the typed Tool, Machining, Plating and
 * Fasteners Cost read back as typed for every role; and a part that holds a Restricted value, a value of a field a later story builds and a key that is no field, which a save keeps where it
 * was and no answer sends (STORY-05.03 review SQR-01 and SQR-05). Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const field = (letter: string): string => seedFieldAt(letter).id;
const REMARKS = field('AJ');
const FASTENERS = field('S');
const NUMBER_LETTERS = ['P', 'Q', 'R', 'T', 'U', 'V', 'W', 'X', 'Y', 'AP', 'AU', 'BM'] as const;

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let arjunId: string;
let estimateId: string;

const buildService = (): EstimateService =>
  createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    nodes: createEstimateNodeRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
  });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = buildService();
  leadId = await insertPersonAsOwner(db, 'Sections Lead', 'LEAD');
  arjunId = await insertPersonAsOwner(db, 'Sections Arjun', 'ENGINEER');
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
const lead: EstimateViewer = { get id() { return leadId; }, role: 'LEAD' };

/** Arjun's draft estimate with one part, whose ID is returned. */
async function setUpPart(): Promise<string> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ('Q-2026-0902', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  estimateId = defined((await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id])).rows[0]).id;
  return (await service.addPart(arjun, estimateId, { kind: 'item' })).nodeId;
}

async function row(nodeId: string): Promise<{ readonly inputs: Record<string, unknown>; readonly revision: number }> {
  const { rows } = await db.owner.query<{ inputs: Record<string, unknown>; revision: number }>('SELECT inputs, revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(rows[0]);
}

async function inputsRevision(): Promise<number> {
  const { rows } = await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(rows[0]).inputs_revision;
}

describe('AC-1, AC-5: the numbers and texts of sections 03 to 08', () => {
  it('stores every number as two-decimal text and the texts as typed, in one write: the part\'s revision and the estimate\'s inputs_revision rise by one', async () => {
    const nodeId = await setUpPart();
    const before = await inputsRevision();
    const values = { ...Object.fromEntries(NUMBER_LETTERS.map((letter, index) => [field(letter), `${index + 1}.5`])), [FASTENERS]: ' M6 bolt ', [REMARKS]: 'Line one\r\nLine two' };
    const saved = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values });
    const expected = { ...Object.fromEntries(NUMBER_LETTERS.map((letter, index) => [field(letter), `${index + 1}.50`])), [FASTENERS]: 'M6 bolt', [REMARKS]: 'Line one\nLine two' };
    expect(saved).toEqual({ id: nodeId, revision: 2, completeness: 'PARTIAL', inputs: expected });
    expect(await row(nodeId)).toEqual({ inputs: expected, revision: 2 });
    expect(await inputsRevision()).toBe(before + 1);
  });

  it('a number refused by the rule stores nothing, with every refused field named at once (-1, 1.234 and abc)', async () => {
    const nodeId = await setUpPart();
    const before = await inputsRevision();
    const error = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [field('P')]: '-1', [field('AP')]: '1.234', [field('BM')]: 'abc', [field('Q')]: '5' } }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error instanceof FieldValidationError ? error.fields.map((problem) => problem.field) : []).toEqual([field('P'), field('AP'), field('BM')]);
    expect((await row(nodeId)).inputs).toEqual({});
    expect(await inputsRevision()).toBe(before);
  });

  it('the same number spelled another way is no change: the same revisions', async () => {
    const nodeId = await setUpPart();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [field('BM')]: '4.50' } });
    const revision = await inputsRevision();
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [field('BM')]: '4.5' } });
    expect((await row(nodeId)).revision).toBe(2);
    expect(await inputsRevision()).toBe(revision);
  });
});

describe('AC-3, AC-4: Fasteners and Remarks', () => {
  it('Fasteners left alone is not stored, so a part with nothing typed holds {} and is EMPTY; "None" typed is stored as a text', async () => {
    const nodeId = await setUpPart();
    const left = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [FASTENERS]: '' } });
    expect(left).toMatchObject({ revision: 1, completeness: 'EMPTY', inputs: {} });
    expect((await row(nodeId)).inputs).toEqual({});
    const typed = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [FASTENERS]: 'None' } });
    expect(typed).toMatchObject({ revision: 2, completeness: 'PARTIAL', inputs: { [FASTENERS]: 'None' } });
  });

  it('Remarks of 1,000 characters with line breaks comes back from jsonb as it went in; 1,001 is refused and stores nothing', async () => {
    const nodeId = await setUpPart();
    const longest = `${'a'.repeat(499)}\n${'b'.repeat(500)}`;
    expect(longest).toHaveLength(1000);
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [REMARKS]: longest } });
    expect((await row(nodeId)).inputs[REMARKS]).toBe(longest);
    const error = await service.saveInputs(arjun, estimateId, { nodeId, revision: 2, values: { [REMARKS]: `${longest}c` } }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error instanceof FieldValidationError ? error.fields : []).toEqual([{ field: REMARKS, message: 'Use 1,000 characters or fewer.' }]);
    expect((await row(nodeId)).inputs[REMARKS]).toBe(longest);
  });

  it('a lone surrogate is a refusal under its field and not a database error (review SQR-13); nothing is stored', async () => {
    const nodeId = await setUpPart();
    const error = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [REMARKS]: 'bad\uD800text' } }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(FieldValidationError);
    expect((await row(nodeId)).inputs).toEqual({});
  });
});

describe('AC-2, AC-7: what is read back', () => {
  it('the typed Tool, Machining, Plating and Fasteners Cost come back as typed, for the Engineer and for a Lead', async () => {
    const nodeId = await setUpPart();
    const typed = { [field('AP')]: '1234.50', [field('AU')]: '678.25', [field('BM')]: '45678.75', [field('U')]: '3.50' };
    await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: typed });
    for (const viewer of [arjun, lead]) expect((await service.getNode(viewer, estimateId, nodeId)).inputs).toEqual(typed);
  });

  it('a part that holds a canary price under Material Rate / Kg, a value of a later story\'s field and an unknown key is read back with the typed values only, and a save keeps all three where they were (reviews SQR-01, SQR-05)', async () => {
    const nodeId = await setUpPart();
    const planted = canaryPartInputs(seedConfig);
    await db.owner.query('UPDATE estimate_nodes SET inputs = $2::jsonb WHERE id = $1::uuid', [nodeId, JSON.stringify({ ...planted, [field('Z')]: '1' })]);
    for (const viewer of [arjun, lead]) {
      const part = await service.getNode(viewer, estimateId, nodeId);
      expect(JSON.stringify(part)).not.toContain(CANARY_PLANTED_RATE);
      expect(Object.keys(part.inputs)).not.toContain(canaryRateFieldId(seedConfig));
      expect(Object.keys(part.inputs)).not.toContain(CANARY_UNKNOWN_KEY);
      expect(Object.keys(part.inputs)).not.toContain(field('Z'));
    }
    const saved = await service.saveInputs(arjun, estimateId, { nodeId, revision: 1, values: { [field('Y')]: '9' } });
    expect(JSON.stringify(saved)).not.toContain(CANARY_PLANTED_RATE);
    const held = (await row(nodeId)).inputs;
    expect(held[canaryRateFieldId(seedConfig)]).toBe(CANARY_PLANTED_RATE);
    expect(held[CANARY_UNKNOWN_KEY]).toBe('x');
    expect(held[field('Z')]).toBe('1');
    expect(held[field('Y')]).toBe('9.00');
  });
});
