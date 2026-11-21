import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { StepUpFailed } from '@/lib/errors';
import { systemClock } from '@/lib/time';
import { createConfigCheckpointRepository } from '@/server/repositories/config-checkpoint-repository';
import { createConfigRepository } from '@/server/repositories/config-repository';
import type { AuditService } from '@/server/services/audit-service';
import { createConfigCheckpointService, type ConfigCheckpointService } from '@/server/services/config-checkpoint-service';
import { createConfigEditService, type ConfigEditCaller, type ConfigEditService } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import { createStepUpService } from '@/server/services/step-up-service';

import { KEY_SECRET } from '../../support/audit-database';
import { createTestHasher, insertUser } from '../../support/builders/user';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { inputAfterAx, pairAfterAx } from '../../support/insert-specs';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.05 AC-1 and AC-2 (FR-077, NFR-026) against real PostgreSQL in a throwaway database, as the runtime role, with the real step-up service.
 *
 * AC-1: **every method that changes the configuration is one row of one table**, and the table asserts, for each, that a successful call stores **exactly one** new version and that a refusal, a no-op and a
 * failure part-way store **none**. The methods today are `saveFormula`, `insertFields`, `deleteField` and `revert` (STORY-08.06; `saveCheckpoint` names a version and stores none, so its rows are `no-op` and `refused`). `tests/unit/config/version-writer-architecture.test.ts` fails for a writer that is not in its table.
 * AC-2: the numbers run 1, 2, 3 with no gap and no duplicate over 20 versions stored one after another; of two writers that began from the same base exactly one is stored and the other gets `null`; and a row made by
 * `insertVersionAfter` (not the seed's) cannot be updated, deleted or truncated, by the runtime role (no grant) or by the owner (trigger). Every name and password is invented.
 */

let db: CalculationDatabase;
let edit: ConfigEditService;
let structure: ConfigStructureService;
let failingEdit: ConfigEditService;
let failingStructure: ConfigStructureService;
let checkpoints: ConfigCheckpointService;
let failingCheckpoints: ConfigCheckpointService;
let admin: ConfigEditCaller;

const RIGHT = 'Tn4#vLm8@Qz-right';
const WRONG = 'Not-the-right-1!';
const AL = seedFieldAt('AL');
const BL = seedFieldAt('BL');
const PART_NO_ID = defined(seedConfig.fields.find((field) => field.key === 'part-no')).id;
const UNKNOWN_FIELD = '00000000-0000-4000-8000-00000000dead';
const configurations = () => createConfigRepository(db.prisma);

async function versionNumbers(): Promise<number[]> {
  const { rows } = await db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number');
  return rows.map((row) => row.number);
}
const latestNumber = async (): Promise<number> => defined((await versionNumbers()).at(-1));
async function versionIdOf(number: number): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>('SELECT id::text AS id FROM config_versions WHERE number = $1', [number]);
  return defined(rows[0]).id;
}

/** The audit service as it is, except that writing an entry fails: the version it was made with must go back with it. */
const failingAudit = (): AuditService => ({ ...db.audit, record: () => Promise.reject(new Error('Invented audit failure.')) });

function services(audit: AuditService): { edit: ConfigEditService; structure: ConfigStructureService; checkpoints: ConfigCheckpointService } {
  const stepUp = createStepUpService({ users: db.users, throttles: db.throttles, hasher: createTestHasher(), clock: systemClock, keySecret: KEY_SECRET });
  return {
    edit: createConfigEditService({ configurations: configurations(), masters: db.masterRepository, calculations: db.calculations, stepUp, transactions: db.transactions, audit, cache: createConfigVersionCache() }),
    structure: createConfigStructureService({ configurations: configurations(), masters: db.masterRepository, stepUp, transactions: db.transactions, audit, cache: createConfigVersionCache() }),
    checkpoints: createConfigCheckpointService({
      configurations: configurations(),
      checkpoints: createConfigCheckpointRepository(db.prisma),
      masters: db.masterRepository,
      stepUp,
      transactions: db.transactions,
      audit,
      cache: createConfigVersionCache(),
    }),
  };
}

beforeAll(async () => {
  db = await openCalculationDatabase();
  ({ edit, structure, checkpoints } = services(db.audit));
  ({ edit: failingEdit, structure: failingStructure, checkpoints: failingCheckpoints } = services(failingAudit()));
  const { id } = await insertUser(db.users, createTestHasher(), { email: 'writer@example.test', name: 'Invented Writer', role: 'ADMIN', password: RIGHT });
  admin = { user: { id, name: 'Invented Writer', role: 'ADMIN' }, requestId: 'req-0000a11c' };
}, 120_000);

afterAll(async () => {
  await db.close();
});

type Outcome = 'stored' | 'refused' | 'no-op';

interface Row {
  readonly name: string;
  readonly outcome: Outcome;
  readonly run: () => Promise<unknown>;
}

/** One row for every way each method can end. `stored` adds exactly one version; `refused` (it throws) and `no-op` (it answers and writes nothing) add none. */
const ROWS: ReadonlyArray<Row> = [
  { name: 'saveFormula: a changed formula', outcome: 'stored', run: async () => edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'saveFormula: the same text again (a no-op)', outcome: 'no-op', run: async () => edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'saveFormula: a wrong password', outcome: 'refused', run: async () => edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 3', password: WRONG, baseVersion: await latestNumber() }) },
  { name: 'saveFormula: a stale base version', outcome: 'refused', run: async () => edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 3', password: RIGHT, baseVersion: (await latestNumber()) - 1 }) },
  { name: 'saveFormula: a formula the check refuses', outcome: 'refused', run: async () => edit.saveFormula(admin, AL.id, { text: 'P * * Nothing-Like-This', password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'saveFormula: the audit entry fails part-way', outcome: 'refused', run: async () => failingEdit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 3', password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'insertFields: one input', outcome: 'stored', run: async () => structure.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Writer Input' }), baseVersion: await latestNumber() }) },
  { name: 'insertFields: an input and its cost column (a pair is one version)', outcome: 'stored', run: async () => structure.insertFields(admin, { spec: pairAfterAx({ label: 'Invented Writer Pair' }), baseVersion: await latestNumber() }) },
  { name: 'insertFields: a stale base version', outcome: 'refused', run: async () => structure.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Stale Input' }), baseVersion: (await latestNumber()) - 1 }) },
  { name: 'insertFields: an input with no label', outcome: 'refused', run: async () => structure.insertFields(admin, { spec: inputAfterAx({ label: '' }), baseVersion: await latestNumber() }) },
  { name: 'insertFields: the audit entry fails part-way', outcome: 'refused', run: async () => failingStructure.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Failing Input' }), baseVersion: await latestNumber() }) },
  { name: 'deleteField: a field a formula uses', outcome: 'refused', run: () => structure.deleteField(admin, AL.id, { password: RIGHT }) },
  { name: 'deleteField: a protected field', outcome: 'refused', run: () => structure.deleteField(admin, BL.id, { password: RIGHT }) },
  { name: 'deleteField: a field that does not exist', outcome: 'refused', run: () => structure.deleteField(admin, UNKNOWN_FIELD, { password: RIGHT }) },
  { name: 'deleteField: a wrong password', outcome: 'refused', run: () => structure.deleteField(admin, PART_NO_ID, { password: WRONG }) },
  { name: 'deleteField: the audit entry fails part-way', outcome: 'refused', run: () => failingStructure.deleteField(admin, PART_NO_ID, { password: RIGHT }) },
  { name: 'deleteField: a field nothing uses', outcome: 'stored', run: () => structure.deleteField(admin, PART_NO_ID, { password: RIGHT }) },
  // STORY-08.06: a checkpoint names a version and stores none; a revert stores one (a copy of the target) or none. The seed (version 1) differs from the current content here, so a revert to it is a change.
  { name: 'saveCheckpoint: a name for the latest version (stores a checkpoint, no version)', outcome: 'no-op', run: () => checkpoints.saveCheckpoint(admin, { name: 'Invented Writer Checkpoint' }) },
  { name: 'saveCheckpoint: a name that is taken', outcome: 'refused', run: () => checkpoints.saveCheckpoint(admin, { name: 'INVENTED writer checkpoint' }) },
  { name: 'revert: a version that does not exist', outcome: 'refused', run: async () => checkpoints.revert(admin, UNKNOWN_FIELD, { password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'revert: a stale base version', outcome: 'refused', run: async () => checkpoints.revert(admin, await versionIdOf(1), { password: RIGHT, baseVersion: (await latestNumber()) - 1 }) },
  { name: 'revert: a wrong password', outcome: 'refused', run: async () => checkpoints.revert(admin, await versionIdOf(1), { password: WRONG, baseVersion: await latestNumber() }) },
  { name: 'revert: the audit entry fails part-way', outcome: 'refused', run: async () => failingCheckpoints.revert(admin, await versionIdOf(1), { password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'revert: to an earlier version', outcome: 'stored', run: async () => checkpoints.revert(admin, await versionIdOf(1), { password: RIGHT, baseVersion: await latestNumber() }) },
  { name: 'revert: to a version whose content is the current one (nothing to revert)', outcome: 'refused', run: async () => checkpoints.revert(admin, await versionIdOf(1), { password: RIGHT, baseVersion: await latestNumber() }) },
];

describe('AC-1 (FR-077): every method that changes the configuration stores exactly one version per success and none per refusal or no-op', () => {
  it('the table lists every method of the two config edit services that changes the configuration', () => {
    const named = new Set(ROWS.map((row) => row.name.split(':')[0]));
    expect([...named].sort()).toEqual(['deleteField', 'insertFields', 'revert', 'saveCheckpoint', 'saveFormula']);
    for (const outcome of ['stored', 'refused', 'no-op'] as const) expect(ROWS.some((row) => row.outcome === outcome)).toBe(true);
  });

  it.each(ROWS.map((row) => [row.name, row] as const))('%s', async (_name, row) => {
    const before = await versionNumbers();
    const settled = await row.run().then(
      () => 'answered' as const,
      () => 'refused' as const,
    );
    const after = await versionNumbers();
    if (row.outcome === 'stored') {
      expect(settled).toBe('answered');
      expect(after).toEqual([...before, defined(before.at(-1)) + 1]);
    } else {
      expect(settled).toBe(row.outcome === 'refused' ? 'refused' : 'answered');
      expect(after).toEqual(before);
    }
  });

  it('a wrong password is the step-up\'s refusal, not some other failure that happened to store nothing', async () => {
    await expect(edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 5', password: WRONG, baseVersion: await latestNumber() })).rejects.toBeInstanceOf(StepUpFailed);
  });
});

describe('AC-2 (NFR-026): the numbers have no gap and no duplicate, and a stored version is immutable', () => {
  const SNAPSHOT = JSON.parse(JSON.stringify(seedConfig)) as unknown;
  const store = (baseNumber: number) => db.transactions.run((tx) => configurations().insertVersionAfter({ baseNumber, snapshot: SNAPSHOT, reason: 'Invented sequential version', createdBy: admin.user.id }, tx));
  let firstOfTheRun: number;

  it('20 more versions stored one after another take the next 20 numbers, in order, each answering its own number', async () => {
    firstOfTheRun = (await latestNumber()) + 1;
    for (let offset = 0; offset < 20; offset += 1) {
      const stored = await store(firstOfTheRun - 1 + offset);
      expect(stored).toMatchObject({ number: firstOfTheRun + offset });
    }
    const numbers = await versionNumbers();
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_unused, index) => index + 1));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.at(-1)).toBe(firstOfTheRun + 19);
  });

  it('two writers with the same base at once: exactly one is stored and the other gets null', async () => {
    const base = await latestNumber();
    const results = await Promise.all([store(base), store(base)]);
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(await latestNumber()).toBe(base + 1);
    expect(new Set(await versionNumbers()).size).toBe((await versionNumbers()).length);
  });

  it('a writer whose base is not the highest stores nothing and answers null', async () => {
    const before = await versionNumbers();
    expect(await store(defined(before.at(-1)) - 1)).toBeNull();
    expect(await versionNumbers()).toEqual(before);
  });

  describe('a row made by insertVersionAfter (not the seed\'s) cannot be changed or removed', () => {
    async function expectRowUnchanged(): Promise<void> {
      const { rows } = await db.owner.query<{ number: number; reason: string }>('SELECT number, reason FROM config_versions WHERE number = $1', [firstOfTheRun]);
      expect(rows).toEqual([{ number: firstOfTheRun, reason: 'Invented sequential version' }]);
    }

    it('the runtime role holds no UPDATE, DELETE or TRUNCATE grant: each is refused with 42501', async () => {
      const count = (await versionNumbers()).length;
      for (const statement of [`UPDATE config_versions SET reason = 'changed' WHERE number = ${String(firstOfTheRun)}`, `DELETE FROM config_versions WHERE number = ${String(firstOfTheRun)}`, 'TRUNCATE config_versions']) {
        await expect(db.runtime.query(statement), statement).rejects.toMatchObject({ code: '42501' });
      }
      await expectRowUnchanged();
      expect((await versionNumbers()).length).toBe(count);
    });

    it('the owner is refused by the trigger: UPDATE, DELETE and TRUNCATE ... CASCADE', async () => {
      const count = (await versionNumbers()).length;
      for (const statement of [
        `UPDATE config_versions SET snapshot = '{}'::jsonb WHERE number = ${String(firstOfTheRun)}`,
        `UPDATE config_versions SET number = 9999 WHERE number = ${String(firstOfTheRun)}`,
        `DELETE FROM config_versions WHERE number = ${String(firstOfTheRun)}`,
        'TRUNCATE config_versions CASCADE',
      ]) {
        await expect(db.owner.query(statement), statement).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('config_versions" is immutable') });
      }
      await expectRowUnchanged();
      expect((await versionNumbers()).length).toBe(count);
    });
  });
});
