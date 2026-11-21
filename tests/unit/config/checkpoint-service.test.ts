import { describe, expect, it } from 'vitest';

import { documentsEqual } from '@/lib/config/revert';
import { insertFields } from '@/lib/config/field-insert';
import { CONFIG_VERSION_CHANGED_CODE, StepUpFailed, StepUpLocked } from '@/lib/errors';
import { parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';
import type { CheckpointRecord } from '@/server/repositories/config-checkpoint-repository';
import type { ConfigRepository, ConfigVersionRecord } from '@/server/repositories/config-repository';
import { createAuditService } from '@/server/services/audit-service';
import { createConfigCheckpointService, type ConfigCheckpointService } from '@/server/services/config-checkpoint-service';
import type { ConfigEditCaller } from '@/server/services/config-edit-service';
import { createConfigVersionCache } from '@/server/services/config-service';

import { createFakeAuditWorld } from '../../support/fake-audit';
import { createFakeCheckpointRepository, type FakeCheckpointRepository } from '../../support/fake-checkpoints';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig } from '../../support/seed-config';

/**
 * STORY-08.06 AC-2 to AC-4, AC-5, AC-7 and AC-8 at the rules, with no database: who may call (the Admin alone, checked again before anything is read), what a save of a checkpoint stores (a name for the latest version, no
 * version, no password, no audit entry: D-1), and the order of a revert's checks (role, target, base version, nothing to revert, usable target, then the password, then the transaction: a refusal costs nothing and a
 * target that cannot be reverted to never asks for a password), one version equal to the target's snapshot, one audit entry, and the races. The real table, the transaction, two reverts racing and the audit rollback are
 * `tests/integration/config/checkpoints-revert.test.ts`. Every name is invented.
 */

const ADMIN: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Admin', role: 'ADMIN' }, requestId: 'req-0000aaaa' };
const LEAD: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Lead', role: 'LEAD' }, requestId: 'req-0000bbbb' };
const ENGINEER: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Invented Engineer', role: 'ENGINEER' }, requestId: 'req-0000cccc' };

const RIGHT = 'Invented-right-password-1';
const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name, defaultValue: '0.00' }));

const idOf = (number: number): string => `00000000-0000-4000-8000-0ccc000000${String(number).padStart(2, '0')}`;
const record = (number: number, snapshot: unknown): ConfigVersionRecord => ({ id: idOf(number), number, snapshot, createdBy: null, reason: 'Invented', createdAt: new Date('2026-11-05T09:00:00.000Z') });

/** Version 2 is version 1 with one input inserted: a real change, made by the real insert. */
function withInsert(from: ConfigDocument): ConfigDocument {
  const made = insertFields({ document: from, rates: RATES, spec: inputAfterAx({ label: 'Invented Checkpoint Input' }) });
  if (!made.ok) throw new Error('refused');
  return made.document;
}

interface World {
  readonly service: ConfigCheckpointService;
  readonly versions: ConfigVersionRecord[];
  readonly checkpoints: FakeCheckpointRepository;
  readonly inserts: Array<{ baseNumber: number; snapshot: unknown; reason: string; createdBy: string }>;
  readonly reads: { latest: number; byId: number; checkpointInserts: number; checkpointLists: number };
  readonly passwords: string[];
  readonly audit: ReturnType<typeof createFakeAuditWorld>;
}

/** Two versions (the seed, and the seed with an input inserted) unless a test gives its own; `whenPasswordChecked` runs at the moment the password is checked. */
function world(options: { readonly versions?: ReadonlyArray<ConfigVersionRecord>; readonly rates?: typeof RATES; readonly whenPasswordChecked?: (versions: ConfigVersionRecord[]) => void; readonly stepUp?: (password: string) => void } = {}): World {
  const versions = [...(options.versions ?? [record(1, seedConfig), record(2, withInsert(seedConfig))])];
  const inserts: World['inserts'] = [];
  const reads = { latest: 0, byId: 0, checkpointInserts: 0, checkpointLists: 0 };
  const passwords: string[] = [];
  const configurations: ConfigRepository = {
    insertSeedVersionIfNone: () => Promise.resolve(false),
    insertVersionAfter(version) {
      inserts.push({ baseNumber: version.baseNumber, snapshot: version.snapshot, reason: version.reason, createdBy: version.createdBy });
      const latest = Math.max(...versions.map((each) => each.number));
      if (latest !== version.baseNumber) return Promise.resolve(null);
      const stored = record(latest + 1, version.snapshot);
      versions.push(stored);
      return Promise.resolve({ id: stored.id, number: stored.number });
    },
    findLatestRef() {
      reads.latest += 1;
      const latest = versions.reduce((best, each) => (each.number > best.number ? each : best));
      return Promise.resolve({ id: latest.id, number: latest.number });
    },
    findById(id) {
      reads.byId += 1;
      return Promise.resolve(versions.find((each) => each.id === id) ?? null);
    },
    readVersionUse: () => Promise.resolve({ savedByName: null, estimatesInUse: 0 }),
  };
  const fake = createFakeCheckpointRepository(configurations);
  const checkpoints: FakeCheckpointRepository = {
    ...fake,
    insertCheckpoint: (checkpoint) => {
      reads.checkpointInserts += 1;
      return fake.insertCheckpoint(checkpoint);
    },
    listCheckpoints: () => {
      reads.checkpointLists += 1;
      return fake.listCheckpoints();
    },
  };
  const audit = createFakeAuditWorld();
  const service = createConfigCheckpointService({
    configurations,
    checkpoints,
    masters: { listProcessItems: () => Promise.resolve(options.rates ?? RATES) },
    stepUp: {
      verifyStepUp(_caller, password) {
        passwords.push(password);
        options.stepUp?.(password);
        if (password !== RIGHT) return Promise.reject(new StepUpFailed('That password is not correct.'));
        options.whenPasswordChecked?.(versions);
        return Promise.resolve();
      },
    },
    transactions: audit.transactions,
    audit: createAuditService({ audit: audit.audit }),
    cache: createConfigVersionCache(),
  });
  return { service, versions, checkpoints: fake, inserts, reads, passwords, audit };
}

type Refusal = Error & { code?: string; httpStatus?: number; currentVersion?: number; fields?: ReadonlyArray<{ field: string; message: string }> };
const rejection = async (promise: Promise<unknown>): Promise<Refusal> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected a refusal.');
};

describe('AC-9: the Admin alone, checked again before anything is read', () => {
  it.each([
    ['a Lead', LEAD],
    ['an Engineer', ENGINEER],
  ])('refuses %s with 403 on all three methods and reads, asks and writes nothing', async (_who, caller) => {
    const w = world();
    for (const call of [() => w.service.listCheckpoints(caller), () => w.service.saveCheckpoint(caller, { name: 'Invented' }), () => w.service.revert(caller, idOf(1), { password: RIGHT, baseVersion: 2 })]) {
      expect(await rejection(call())).toMatchObject({ httpStatus: 403 });
    }
    expect(w.reads).toEqual({ latest: 0, byId: 0, checkpointInserts: 0, checkpointLists: 0 });
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
    expect(w.checkpoints.rows).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });
});

describe('AC-2: save a checkpoint', () => {
  it('names the current latest version with the trimmed name and answers the row: no version, no password, no audit entry (D-1)', async () => {
    const w = world();
    const saved = await w.service.saveCheckpoint(ADMIN, { name: '  Before   AY insert ' });
    expect(saved).toMatchObject({ name: 'Before AY insert', versionId: idOf(2), versionNumber: 2, savedBy: 'Invented Admin' });
    expect(saved.savedAt).toBe('2026-11-06T10:00:00.000Z');
    expect(Object.keys(saved).sort()).toEqual(['id', 'name', 'savedAt', 'savedBy', 'versionId', 'versionNumber']);
    expect(w.versions).toHaveLength(2);
    expect(w.inserts).toEqual([]);
    expect(w.passwords).toEqual([]);
    expect(w.audit.audit.appended).toEqual([]);
  });

  it('refuses an empty name, a spaces-only name and a 101-character name with the field message, and stores nothing', async () => {
    const w = world();
    for (const [name, message] of [
      ['', 'Enter a name for this checkpoint.'],
      ['    ', 'Enter a name for this checkpoint.'],
      ['a'.repeat(101), 'Use 100 characters or fewer.'],
    ] as const) {
      expect(await rejection(w.service.saveCheckpoint(ADMIN, { name }))).toMatchObject({ httpStatus: 422, fields: [{ field: 'name', message }] });
    }
    expect(w.reads.checkpointInserts).toBe(0);
    expect(await w.service.saveCheckpoint(ADMIN, { name: 'a'.repeat(100) })).toMatchObject({ name: 'a'.repeat(100) });
  });

  it('answers 409 CHECKPOINT_NAME_TAKEN for a name that is used in any letter case or with other spacing, with the masters\' sentence', async () => {
    const w = world();
    await w.service.saveCheckpoint(ADMIN, { name: 'Before AY insert' });
    for (const name of ['Before AY insert', 'BEFORE ay INSERT', 'before   ay insert', ' Before AY insert ']) {
      expect(await rejection(w.service.saveCheckpoint(ADMIN, { name }))).toMatchObject({ httpStatus: 409, code: 'CHECKPOINT_NAME_TAKEN', message: 'A checkpoint with this name already exists. Names must be unique.' });
    }
    expect(w.checkpoints.rows).toHaveLength(1);
  });

  it('two checkpoints saved with no change between them both name the same version', async () => {
    const w = world();
    await w.service.saveCheckpoint(ADMIN, { name: 'First' });
    await w.service.saveCheckpoint(ADMIN, { name: 'Second' });
    expect(w.checkpoints.rows.map((row) => row.versionId)).toEqual([idOf(2), idOf(2)]);
  });
});

describe('AC-3: the list', () => {
  it('answers each checkpoint newest first with its version, time and person, and no snapshot', async () => {
    const w = world();
    await w.service.saveCheckpoint(ADMIN, { name: 'Older' });
    await w.service.saveCheckpoint(ADMIN, { name: 'Newer' });
    const { checkpoints } = await w.service.listCheckpoints(ADMIN);
    expect(checkpoints.map((row) => row.name)).toEqual(['Newer', 'Older']);
    for (const row of checkpoints) expect(Object.keys(row).sort()).toEqual(['id', 'name', 'savedAt', 'savedBy', 'versionId', 'versionNumber']);
  });

  it('shows the seed checkpoint with no person', async () => {
    const seed: CheckpointRecord = { id: '00000000-0000-4000-8000-0ddd00000000', name: 'Original configuration', versionId: idOf(1), versionNumber: 1, createdAt: new Date('2026-11-01T00:00:00.000Z'), createdByName: null };
    const w = world();
    const checkpoints = createFakeCheckpointRepository({ findLatestRef: () => Promise.resolve({ id: idOf(2), number: 2 }) }, [seed]);
    const service = createConfigCheckpointService({ ...depsOf(w), checkpoints });
    expect((await service.listCheckpoints(ADMIN)).checkpoints).toEqual([{ id: seed.id, name: 'Original configuration', versionId: idOf(1), versionNumber: 1, savedAt: '2026-11-01T00:00:00.000Z', savedBy: null }]);
  });
});

/** The dependencies of a world, for a test that swaps one. */
function depsOf(w: World): Parameters<typeof createConfigCheckpointService>[0] {
  const configurations: ConfigRepository = {
    insertSeedVersionIfNone: () => Promise.resolve(false),
    insertVersionAfter: () => Promise.resolve(null),
    findLatestRef: () => Promise.resolve({ id: idOf(2), number: 2 }),
    findById: (id) => Promise.resolve(w.versions.find((each) => each.id === id) ?? null),
    readVersionUse: () => Promise.resolve({ savedByName: null, estimatesInUse: 0 }),
  };
  return { configurations, checkpoints: w.checkpoints, masters: { listProcessItems: () => Promise.resolve(RATES) }, stepUp: { verifyStepUp: () => Promise.resolve() }, transactions: w.audit.transactions, audit: createAuditService({ audit: w.audit.audit }), cache: createConfigVersionCache() };
}

describe('AC-4: the order of the checks, so a refusal costs nothing', () => {
  it('answers 404 for a version that does not exist, before the base version and the password', async () => {
    const w = world();
    expect(await rejection(w.service.revert(ADMIN, '00000000-0000-4000-8000-00000000dead', { password: RIGHT, baseVersion: 99 }))).toMatchObject({ httpStatus: 404 });
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
  });

  it('answers 409 CONFIG_VERSION_CHANGED for a base that is not the latest, with the current number, and asks no password', async () => {
    const w = world();
    const refusal = await rejection(w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 1 }));
    expect(refusal).toMatchObject({ httpStatus: 409, code: CONFIG_VERSION_CHANGED_CODE, currentVersion: 2 });
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
  });

  it('answers 409 NOTHING_TO_REVERT for the current version and for one with its content, asks no password and stores nothing', async () => {
    const same = world({ versions: [record(1, seedConfig), record(2, withInsert(seedConfig)), record(3, seedConfig)] });
    expect(await rejection(same.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 3 }))).toMatchObject({ httpStatus: 409, code: 'NOTHING_TO_REVERT', message: 'This checkpoint is the same as the current configuration.' });
    expect(await rejection(same.service.revert(ADMIN, idOf(3), { password: RIGHT, baseVersion: 3 }))).toMatchObject({ code: 'NOTHING_TO_REVERT' });
    expect(same.passwords).toEqual([]);
    expect(same.inserts).toEqual([]);
  });

  it('answers 422 naming each field of a target that reads a rate the Process master no longer has, with no rate name, asks no password and stores nothing', async () => {
    const w = world({ rates: RATES.filter((rate) => rate.name !== 'Cutting-Rate-per-Sec') });
    const refusal = await rejection(w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 }));
    expect(refusal).toMatchObject({ httpStatus: 422 });
    const messages = defined(refusal.fields).map((issue) => issue.message);
    expect(messages.some((message) => message.startsWith('AL ') && message.endsWith(' uses a rate that is no longer in the Process master.'))).toBe(true);
    for (const message of messages) expect(message).not.toContain('Cutting-Rate');
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
  });

  it('lets a wrong password (422) and a blocked step-up (429) through and stores nothing', async () => {
    const wrong = world();
    expect(await rejection(wrong.service.revert(ADMIN, idOf(1), { password: 'not-it', baseVersion: 2 }))).toBeInstanceOf(StepUpFailed);
    expect(wrong.inserts).toEqual([]);
    expect(wrong.audit.audit.committed).toEqual([]);

    const locked = world({
      stepUp: () => {
        throw new StepUpLocked('Too many wrong passwords. Try again in 15 minutes.');
      },
    });
    expect(await rejection(locked.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 }))).toBeInstanceOf(StepUpLocked);
    expect(locked.inserts).toEqual([]);
  });

  it('passes the password to the step-up and nowhere else: it is in no stored version, no reason and no audit entry', async () => {
    const w = world();
    await w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 });
    expect(w.passwords).toEqual([RIGHT]);
    expect(JSON.stringify([w.inserts.map((insert) => insert.reason), w.audit.audit.appended])).not.toContain(RIGHT);
  });
});

describe('AC-4, AC-7 and AC-8: the revert, one version equal to the target and one audit entry', () => {
  it('stores version 3 whose snapshot equals version 1\'s exactly, answers {version, copiedFrom, undoVersionId} and names the version that was latest as the undo', async () => {
    const w = world();
    await w.service.saveCheckpoint(ADMIN, { name: 'Before the input' });
    const answer = await w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 });
    expect(answer).toEqual({ version: 3, copiedFrom: 1, undoVersionId: idOf(2) });
    expect(w.inserts).toHaveLength(1);
    expect(w.inserts[0]).toMatchObject({ baseNumber: 2, createdBy: ADMIN.user.id });
    expect(documentsEqual(defined(w.versions[2]).snapshot, defined(w.versions[0]).snapshot)).toBe(true);
    expect(parseConfigDocument(defined(w.versions[2]).snapshot)).toEqual(seedConfig);
  });

  it('the story\'s chain: a checkpoint on one version, a change after it, the revert, and the undo, each snapshot deep-equal to its source', async () => {
    const w = world({ versions: [record(1, seedConfig)] });
    // Version 1 is the checkpoint; the change after it makes version 2.
    const changed = withInsert(seedConfig);
    w.versions.push(record(2, changed));
    const revert = await w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 });
    expect(revert).toEqual({ version: 3, copiedFrom: 1, undoVersionId: idOf(2) });
    const undo = await w.service.revert(ADMIN, revert.undoVersionId, { password: RIGHT, baseVersion: revert.version });
    expect(undo).toEqual({ version: 4, copiedFrom: 2, undoVersionId: idOf(3) });
    expect(documentsEqual(defined(w.versions[2]).snapshot, seedConfig)).toBe(true);
    expect(documentsEqual(defined(w.versions[3]).snapshot, changed)).toBe(true);
    // Version 4 holds version 2's content, so a revert to version 2 is nothing to revert; one to version 3 (the seed's content) is a change.
    expect(await rejection(w.service.revert(ADMIN, idOf(2), { password: RIGHT, baseVersion: 4 }))).toMatchObject({ code: 'NOTHING_TO_REVERT' });
    expect(await w.service.revert(ADMIN, idOf(3), { password: RIGHT, baseVersion: 4 })).toMatchObject({ version: 5, copiedFrom: 3 });
  });

  it('records one config.reverted entry in the same transaction: the checkpoint as the Object, the version before, the version made and the one copied, and no password', async () => {
    const w = world();
    await w.service.saveCheckpoint(ADMIN, { name: 'Before AY insert' });
    // The checkpoint names version 2 here (the latest when it was saved); revert to version 1 has none, so the Object is the version.
    await w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 });
    const [row] = w.audit.audit.appended;
    expect(w.audit.audit.committed).toHaveLength(1);
    expect(row).toMatchObject({ event: 'config.reverted', actorId: ADMIN.user.id, actorLabel: 'Invented Admin', objectType: 'config_version', objectId: idOf(1), objectLabel: 'Version 1', requestId: ADMIN.requestId, before: { version: 2 }, after: { version: 3, copiedFrom: 1 } });
    expect(JSON.stringify(row)).not.toMatch(/password|formula/i);
  });

  it('names the checkpoint in the Object and the reason when the target has one', async () => {
    const w = world();
    await w.service.saveCheckpoint(ADMIN, { name: 'Before AY insert' });
    w.versions.push(record(3, seedConfig));
    await w.service.revert(ADMIN, idOf(2), { password: RIGHT, baseVersion: 3 });
    const [row] = w.audit.audit.appended;
    expect(row).toMatchObject({ objectLabel: 'Checkpoint "Before AY insert"', before: { version: 3 }, after: { version: 4, copiedFrom: 2 } });
    expect(defined(w.inserts[0]).reason).toBe('Reverted to checkpoint "Before AY insert" (version 2)');
  });

});

describe('AC-4: the races', () => {
  it('answers 409 CONFIG_VERSION_CHANGED, with the newer number, when another save lands while the password is checked, and stores nothing', async () => {
    const w = world({ whenPasswordChecked: (versions) => versions.push(record(3, withInsert(withInsert(seedConfig)))) });
    const refusal = await rejection(w.service.revert(ADMIN, idOf(1), { password: RIGHT, baseVersion: 2 }));
    expect(refusal).toMatchObject({ httpStatus: 409, code: CONFIG_VERSION_CHANGED_CODE, currentVersion: 3 });
    expect(w.versions).toHaveLength(3);
    expect(w.audit.audit.committed).toEqual([]);
  });
});
