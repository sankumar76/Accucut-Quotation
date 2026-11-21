import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { documentsEqual } from '@/lib/config/revert';
import { StepUpFailed, StepUpLocked } from '@/lib/errors';
import { systemClock } from '@/lib/time';
import { createConfigCheckpointRepository } from '@/server/repositories/config-checkpoint-repository';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createAuditService } from '@/server/services/audit-service';
import { createConfigCheckpointService, type ConfigCheckpointService } from '@/server/services/config-checkpoint-service';
import { createConfigEditService, type ConfigEditCaller, type ConfigEditService } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import { createStepUpService } from '@/server/services/step-up-service';

import { KEY_SECRET } from '../../support/audit-database';
import { createTestHasher, insertUser } from '../../support/builders/user';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.06 AC-1 to AC-5, AC-7 and AC-8 (FR-077, FR-078, FR-080, FR-079; SPEC section 14 item 8) against real PostgreSQL in a throwaway database, as the runtime role, with the real step-up service and its real
 * throttle: the table of checkpoints (unique in any letter case, 1 to 100 characters, immutable for every role), a save that names the latest version and stores no version and no entry (D-1), the story's own chain
 * (a checkpoint on one version, a change after it, the revert, the undo) with each snapshot **deep-equal** to its source, the audit entry read back, a failing audit entry that takes the version back, the order of the
 * checks (a target that cannot be reverted to never asks for a password), two reverts racing and a revert racing a save, and five wrong passwords. The pure rules are `tests/unit/config/revert.test.ts`, the estimates
 * a revert must not touch are `tests/integration/config/checkpoints-estimates.test.ts`. Every name and password is invented.
 */

let db: CalculationDatabase;
let checkpoints: ConfigCheckpointService;
let edit: ConfigEditService;
let structure: ConfigStructureService;
let admin: ConfigEditCaller;
/** The number of the version made by the first test of AC-5: a formula that reads no rate. */
let plainVersion = 0;
/** How many times the password was checked, whoever asked. */
const asked = { count: 0 };

const RIGHT = 'Tn4#vLm8@Qz-right';
const WRONG = 'Not-the-right-1!';
const AL = seedFieldAt('AL');
const configurations = () => createConfigRepository(db.prisma);

/** A gate that holds each caller at the password step until every party has arrived, so a race is a race on any machine (the version is read before the password step). */
function gateOf(parties: number): () => Promise<void> {
  let arrived = 0;
  const waiting: Array<() => void> = [];
  return () =>
    new Promise<void>((resolve) => {
      arrived += 1;
      waiting.push(resolve);
      if (arrived >= parties) for (const release of waiting) release();
    });
}

function stepUp(gate?: () => Promise<void>) {
  const real = createStepUpService({ users: db.users, throttles: db.throttles, hasher: createTestHasher(), clock: systemClock, keySecret: KEY_SECRET });
  return {
    verifyStepUp: async (caller: Parameters<typeof real.verifyStepUp>[0], password: string) => {
      asked.count += 1;
      await gate?.();
      return real.verifyStepUp(caller, password);
    },
  };
}

function buildCheckpoints(over: { audit?: typeof db.audit; gate?: () => Promise<void> } = {}): ConfigCheckpointService {
  return createConfigCheckpointService({
    configurations: configurations(),
    checkpoints: createConfigCheckpointRepository(db.prisma),
    masters: db.masterRepository,
    stepUp: stepUp(over.gate),
    transactions: db.transactions,
    audit: over.audit ?? db.audit,
    cache: createConfigVersionCache(),
  });
}

async function versionNumbers(): Promise<number[]> {
  const { rows } = await db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number');
  return rows.map((row) => row.number);
}
const latestNumber = async (): Promise<number> => defined((await versionNumbers()).at(-1));

async function versionRow(number: number): Promise<{ id: string; snapshot: unknown; reason: string; created_by: string | null }> {
  const { rows } = await db.owner.query<{ id: string; snapshot: unknown; reason: string; created_by: string | null }>('SELECT id::text, snapshot, reason, created_by::text FROM config_versions WHERE number = $1', [number]);
  return defined(rows[0]);
}

const auditEntries = async () =>
  (await db.owner.query<{ event: string; actor_id: string; object_type: string; object_id: string; object_label: string; before: unknown; after: unknown }>(
    "SELECT event, actor_id::text, object_type, object_id::text, object_label, before, after FROM audit_log WHERE event = 'config.reverted' ORDER BY created_at",
  )).rows;
const checkpointRows = async () => (await db.owner.query<{ name: string; version: number; created_by: string | null }>('SELECT c.name, v.number AS version, c.created_by::text FROM config_checkpoints c JOIN config_versions v ON v.id = c.config_version_id ORDER BY c.created_at, c.id')).rows;

beforeAll(async () => {
  db = await openCalculationDatabase();
  const real = stepUp();
  checkpoints = buildCheckpoints();
  edit = createConfigEditService({ configurations: configurations(), masters: db.masterRepository, calculations: db.calculations, stepUp: real, transactions: db.transactions, audit: db.audit, cache: createConfigVersionCache() });
  structure = createConfigStructureService({ configurations: configurations(), masters: db.masterRepository, stepUp: real, transactions: db.transactions, audit: db.audit, cache: createConfigVersionCache() });
  const { id } = await insertUser(db.users, createTestHasher(), { email: 'checkpoints@example.test', name: 'Invented Checkpoint Admin', role: 'ADMIN', password: RIGHT });
  admin = { user: { id, name: 'Invented Checkpoint Admin', role: 'ADMIN' }, requestId: 'req-0000c0de' };
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-1: the table', () => {
  it('holds no checkpoint on a database that only has the invented version 1 (the seed checkpoint is the migration\'s and the seed step\'s, tested in checkpoint-migration.test.ts)', async () => {
    expect(await checkpointRows()).toEqual([]);
  });

  it('refuses a name that differs only by letter case, in the table itself (unique index on lower(name))', async () => {
    const version = await versionRow(1);
    await db.owner.query("INSERT INTO config_checkpoints (name, config_version_id) VALUES ('Invented Case', $1::uuid)", [version.id]);
    await expect(db.owner.query("INSERT INTO config_checkpoints (name, config_version_id) VALUES ('INVENTED case', $1::uuid)", [version.id])).rejects.toMatchObject({ code: '23505', constraint: 'uq_config_checkpoints_name_lower' });
  });

  it('refuses an empty name and a 101-character name in the table itself (CHECK), and accepts 100 counted in code points', async () => {
    const version = await versionRow(1);
    for (const name of ['', 'a'.repeat(101)]) await expect(db.owner.query('INSERT INTO config_checkpoints (name, config_version_id) VALUES ($1, $2::uuid)', [name, version.id])).rejects.toMatchObject({ code: '23514' });
    await db.owner.query('INSERT INTO config_checkpoints (name, config_version_id) VALUES ($1, $2::uuid)', ['\u{1F600}'.repeat(100), version.id]);
  });

  it('is immutable: the runtime role holds no UPDATE, DELETE or TRUNCATE grant (42501) and the owner is refused by the trigger, so a checkpoint is never renamed or removed', async () => {
    const before = await checkpointRows();
    for (const statement of ["UPDATE config_checkpoints SET name = 'changed'", 'DELETE FROM config_checkpoints', 'TRUNCATE config_checkpoints']) {
      await expect(db.runtime.query(statement), statement).rejects.toMatchObject({ code: '42501' });
    }
    for (const statement of ["UPDATE config_checkpoints SET name = 'changed'", 'DELETE FROM config_checkpoints', 'TRUNCATE config_checkpoints CASCADE']) {
      await expect(db.owner.query(statement), statement).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('config_checkpoints" is immutable') });
    }
    expect(await checkpointRows()).toEqual(before);
  });

  it('has the foreign keys named by the convention, with no cascade', async () => {
    const { rows } = await db.owner.query<{ conname: string; confdeltype: string }>("SELECT conname, confdeltype FROM pg_constraint WHERE conrelid = 'config_checkpoints'::regclass AND contype = 'f' ORDER BY conname");
    expect(rows).toEqual([
      { conname: 'fk_config_checkpoints_config_version_id', confdeltype: 'a' },
      { conname: 'fk_config_checkpoints_created_by', confdeltype: 'a' },
    ]);
  });
});

describe('AC-2: a checkpoint names the current latest version and stores no version, no password step and no audit entry (D-1)', () => {
  it('saves a trimmed name for version 1, with the person, and stores no version and no entry', async () => {
    const versions = await versionNumbers();
    const entries = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
    asked.count = 0;
    const saved = await checkpoints.saveCheckpoint(admin, { name: '  Invented   Original ' });
    expect(saved).toMatchObject({ name: 'Invented Original', versionNumber: 1, savedBy: 'Invented Checkpoint Admin' });
    expect(saved.versionId).toBe((await versionRow(1)).id);
    expect(await versionNumbers()).toEqual(versions);
    expect((await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log')).rows).toEqual(entries.rows);
    expect(asked.count).toBe(0);
  });

  it('answers 409 CHECKPOINT_NAME_TAKEN for the same name in another letter case or spacing, and 422 for an empty or a 101-character name', async () => {
    for (const name of ['INVENTED ORIGINAL', 'invented   original']) await expect(checkpoints.saveCheckpoint(admin, { name })).rejects.toMatchObject({ httpStatus: 409, code: 'CHECKPOINT_NAME_TAKEN' });
    await expect(checkpoints.saveCheckpoint(admin, { name: '   ' })).rejects.toMatchObject({ httpStatus: 422 });
    await expect(checkpoints.saveCheckpoint(admin, { name: 'a'.repeat(101) })).rejects.toMatchObject({ httpStatus: 422 });
  });

  it('two saves of one name at once store one row and refuse the other', async () => {
    const results = await Promise.allSettled([checkpoints.saveCheckpoint(admin, { name: 'Invented Race' }), checkpoints.saveCheckpoint(admin, { name: 'invented race' })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'CHECKPOINT_NAME_TAKEN' });
  });

  it('lists newest first with no snapshot', async () => {
    const { checkpoints: listed } = await checkpoints.listCheckpoints(admin);
    expect(listed.map((row) => row.name).slice(0, 2)).toEqual(['Invented Race', 'Invented Original']);
    for (const row of listed) expect(Object.keys(row).sort()).toEqual(['id', 'name', 'savedAt', 'savedBy', 'versionId', 'versionNumber']);
  });
});

describe('AC-4, AC-7 and AC-8: the story\'s chain, each snapshot deep-equal to its source', () => {
  let versionTwoId: string;
  let afterEdit: number;

  it('builds the chain: an input inserted (2), a checkpoint on it, a formula edit (3)', async () => {
    await structure.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Chain Input' }), baseVersion: await latestNumber() });
    const named = await checkpoints.saveCheckpoint(admin, { name: 'Before AY edit' });
    versionTwoId = named.versionId;
    expect(named.versionNumber).toBe(2);
    await edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: RIGHT, baseVersion: await latestNumber() });
    afterEdit = await latestNumber();
    expect(afterEdit).toBe(3);
  });

  it('reverts to the checkpoint\'s version: one new version (4) whose snapshot equals version 2\'s exactly, with the password asked once', async () => {
    const versions = await versionNumbers();
    asked.count = 0;
    const answer = await checkpoints.revert(admin, versionTwoId, { password: RIGHT, baseVersion: afterEdit });
    expect(answer).toEqual({ version: 4, copiedFrom: 2, undoVersionId: (await versionRow(3)).id });
    expect(asked.count).toBe(1);
    expect(await versionNumbers()).toEqual([...versions, 4]);
    const [two, four] = [await versionRow(2), await versionRow(4)];
    expect(documentsEqual(four.snapshot, two.snapshot)).toBe(true);
    expect(four.snapshot).toEqual(two.snapshot);
    expect(four.created_by).toBe(admin.user.id);
    expect(four.reason).toBe('Reverted to checkpoint "Before AY edit" (version 2)');
    // The earlier versions are untouched: nothing is edited or deleted.
    expect(await versionRow(3)).toMatchObject({ reason: expect.stringContaining('Formula of AL') });
  });

  it('writes one config.reverted entry in the same transaction: the checkpoint as the Object, version 3 before, version 4 made from 2, and no password or formula', async () => {
    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const entry = defined(entries[0]);
    expect(entry).toMatchObject({ actor_id: admin.user.id, object_type: 'config_version', object_id: versionTwoId, object_label: 'Checkpoint "Before AY edit"' });
    expect(entry.before).toEqual({ version: 3 });
    expect(entry.after).toEqual({ version: 4, copiedFrom: 2 });
    expect(JSON.stringify(entry)).not.toContain(RIGHT);
    expect(JSON.stringify(entry)).not.toMatch(/password|formula/i);
  });

  it('refuses the same revert again: version 4 has version 2\'s content, so 409 NOTHING_TO_REVERT, and the password is not asked for', async () => {
    asked.count = 0;
    const versions = await versionNumbers();
    await expect(checkpoints.revert(admin, versionTwoId, { password: RIGHT, baseVersion: 4 })).rejects.toMatchObject({ httpStatus: 409, code: 'NOTHING_TO_REVERT', message: 'This checkpoint is the same as the current configuration.' });
    expect(asked.count).toBe(0);
    expect(await versionNumbers()).toEqual(versions);
  });

  it('undoes it: a revert to the version that was latest before (3), which has no checkpoint, is version 5 equal to version 3, and the entry names the version', async () => {
    const undoTarget = (await versionRow(3)).id;
    const answer = await checkpoints.revert(admin, undoTarget, { password: RIGHT, baseVersion: 4 });
    expect(answer).toEqual({ version: 5, copiedFrom: 3, undoVersionId: (await versionRow(4)).id });
    expect((await versionRow(5)).snapshot).toEqual((await versionRow(3)).snapshot);
    expect((await versionRow(5)).reason).toBe('Reverted to version 3');
    const entries = await auditEntries();
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ object_label: 'Version 3', before: { version: 4 }, after: { version: 5, copiedFrom: 3 } });
  });
});

describe('AC-4: the order of the checks, so a refusal costs nothing', () => {
  it('a stale base version is 409 CONFIG_VERSION_CHANGED with the current number, before any password', async () => {
    asked.count = 0;
    const versions = await versionNumbers();
    const target = (await versionRow(2)).id;
    await expect(checkpoints.revert(admin, target, { password: RIGHT, baseVersion: defined(versions.at(-1)) - 1 })).rejects.toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: versions.at(-1) });
    expect(asked.count).toBe(0);
    expect(await versionNumbers()).toEqual(versions);
  });

  it('a version that does not exist is 404, and a Lead and an Engineer are 403, before anything is read or asked', async () => {
    asked.count = 0;
    await expect(checkpoints.revert(admin, '00000000-0000-4000-8000-00000000dead', { password: RIGHT, baseVersion: await latestNumber() })).rejects.toMatchObject({ httpStatus: 404 });
    const target = (await versionRow(2)).id;
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      await expect(checkpoints.revert({ ...admin, user: { ...admin.user, role } }, target, { password: RIGHT, baseVersion: await latestNumber() })).rejects.toMatchObject({ httpStatus: 403 });
      await expect(checkpoints.saveCheckpoint({ ...admin, user: { ...admin.user, role } }, { name: 'Invented Refused' })).rejects.toMatchObject({ httpStatus: 403 });
    }
    expect(asked.count).toBe(0);
  });

  it('a wrong password stores nothing and writes no entry', async () => {
    const versions = await versionNumbers();
    const entries = await auditEntries();
    // Version 4 differs from the current version 5 only if the undo had not been made; version 2 differs from it (the input is gone from 5).
    await expect(checkpoints.revert(admin, (await versionRow(2)).id, { password: WRONG, baseVersion: await latestNumber() })).rejects.toBeInstanceOf(StepUpFailed);
    expect(await versionNumbers()).toEqual(versions);
    expect(await auditEntries()).toEqual(entries);
  });

  it('takes the version back when the audit entry cannot be written: no version, no entry', async () => {
    const failing = buildCheckpoints({ audit: createAuditService({ audit: { ...db.auditRepository, append: () => Promise.reject(new Error('The audit table is not available.')) } }) });
    const versions = await versionNumbers();
    const entries = await auditEntries();
    await expect(failing.revert(admin, (await versionRow(2)).id, { password: RIGHT, baseVersion: await latestNumber() })).rejects.toThrow('The audit table is not available.');
    expect(await versionNumbers()).toEqual(versions);
    expect(await auditEntries()).toEqual(entries);
  });
});

describe('AC-4: the races', () => {
  it('two reverts from the same base at once: exactly one version is stored, the other is 409 CONFIG_VERSION_CHANGED', async () => {
    const gate = gateOf(2);
    const first = buildCheckpoints({ gate });
    const second = buildCheckpoints({ gate });
    const base = await latestNumber();
    const target = (await versionRow(2)).id;
    const outcomes = await Promise.allSettled([first.revert(admin, target, { password: RIGHT, baseVersion: base }), second.revert(admin, target, { password: RIGHT, baseVersion: base })]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(loser?.reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED' });
    expect(await latestNumber()).toBe(base + 1);
  });

  it('a revert and a formula save from the same base at once: exactly one wins, and the stored versions stay gapless', async () => {
    const gate = gateOf(2);
    const reverting = buildCheckpoints({ gate });
    const saving = createConfigEditService({ configurations: configurations(), masters: db.masterRepository, calculations: db.calculations, stepUp: stepUp(gate), transactions: db.transactions, audit: db.audit, cache: createConfigVersionCache() });
    const base = await latestNumber();
    // Version 1 is the seed: it differs from the current content, so the revert is a change; the save changes the formula of AL.
    const outcomes = await Promise.allSettled([
      reverting.revert(admin, (await versionRow(1)).id, { password: RIGHT, baseVersion: base }),
      saving.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 5', password: RIGHT, baseVersion: base }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect((outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED' });
    const numbers = await versionNumbers();
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_unused, index) => index + 1));
  });
});

describe('AC-5: a target that can no longer be used', () => {
  it('is 422 naming the field, with no rate name, asks no password and stores nothing, when a rate of the target was removed from the Process master', async () => {
    // A later version that does not read the rate (the formula of AL changed), so removing the rate breaks only the old targets.
    await edit.saveFormula(admin, AL.id, { text: 'P * 2', password: RIGHT, baseVersion: await latestNumber() });
    plainVersion = await latestNumber();
    // The rate is removed as the Process master's delete does (its customer rows go first); the master refuses this while a formula of the current version uses it, which none does now.
    await db.owner.query("DELETE FROM customer_rates WHERE process_item_id IN (SELECT id FROM process_items WHERE name = 'Cutting-Rate-per-Sec')");
    await db.owner.query("DELETE FROM process_items WHERE name = 'Cutting-Rate-per-Sec'");
    asked.count = 0;
    const versions = await versionNumbers();
    const refusal = await checkpoints.revert(admin, (await versionRow(1)).id, { password: RIGHT, baseVersion: plainVersion }).catch((error: unknown) => error);
    expect(refusal).toMatchObject({ httpStatus: 422 });
    const message = (refusal as Error).message;
    expect(message).toContain('uses a rate that is no longer in the Process master.');
    expect(message).toMatch(/AL /);
    expect(message).not.toContain('Cutting-Rate-per-Sec');
    expect(asked.count).toBe(0);
    expect(await versionNumbers()).toEqual(versions);
  });
});

describe('AC-4: five wrong passwords in a row lock the step-up, and nothing is reverted', () => {
  it('answers 429 STEP_UP_LOCKED from the sixth try, even with the right password, and stores nothing', async () => {
    // A usable target that differs from the current content: the version that does not read the removed rate, with a later formula saved after it.
    await edit.saveFormula(admin, AL.id, { text: 'P * 4', password: RIGHT, baseVersion: await latestNumber() });
    const target = (await versionRow(plainVersion)).id;
    const versions = await versionNumbers();
    const base = defined(versions.at(-1));
    for (let attempt = 0; attempt < 5; attempt += 1) await expect(checkpoints.revert(admin, target, { password: WRONG, baseVersion: base })).rejects.toBeInstanceOf(StepUpFailed);
    await expect(checkpoints.revert(admin, target, { password: RIGHT, baseVersion: base })).rejects.toBeInstanceOf(StepUpLocked);
    expect(await versionNumbers()).toEqual(versions);
  });
});
