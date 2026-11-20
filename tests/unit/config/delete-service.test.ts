import { describe, expect, it } from 'vitest';

import { fieldUses } from '@/lib/config/field-delete';
import { insertFields } from '@/lib/config/field-insert';
import { withFormula } from '@/lib/config/formula-edit';
import { StepUpFailed, StepUpLocked } from '@/lib/errors';
import { fieldLetter } from '@/lib/fields/registry';
import { isProtectedField } from '@/lib/fields/protected';
import { parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';
import { createAuditService } from '@/server/services/audit-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import type { ConfigEditCaller } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import type { ConfigRepository, ConfigVersionRecord } from '@/server/repositories/config-repository';

import { createFakeAuditWorld } from '../../support/fake-audit';
import { defined } from '../../support/defined';
import { newOutput } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.04 AC-1 to AC-4, AC-6 and AC-8 at the rules, with no database: who may call (the Admin alone, checked again before anything is read), what the references read answers, the order of the delete's
 * checks (role, field, protected, references, then the password, then the transaction: a refusal costs nothing and a blocked field never asks for a password), one version and one audit entry, and the races (a
 * version made while the password was being checked, and a formula edited after the dialog opened). The real table, the transaction, two deletes racing and the audit rollback are
 * `tests/integration/config/delete-field.test.ts`. Every name is invented.
 */

const ADMIN: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Admin', role: 'ADMIN' }, requestId: 'req-0000aaaa' };
const LEAD: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Lead', role: 'LEAD' }, requestId: 'req-0000bbbb' };
const ENGINEER: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Invented Engineer', role: 'ENGINEER' }, requestId: 'req-0000cccc' };

const RIGHT = 'Invented-right-password-1';
const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));

/** A seed input that nothing uses and the portal does not need: the field these tests delete. */
const FREE = defined(seedConfig.fields.find((field) => field.kind === 'input' && !isProtectedField(field) && fieldUses(seedConfig, RATES, field.id).length === 0));
const USED = seedFieldAt('AL');

function record(number: number, snapshot: unknown): ConfigVersionRecord {
  return { id: `00000000-0000-4000-8000-0ccc000000${String(number).padStart(2, '0')}`, number, snapshot, createdBy: null, reason: 'Invented', createdAt: new Date('2026-11-05T09:00:00.000Z') };
}

interface World {
  readonly service: ConfigStructureService;
  readonly versions: ConfigVersionRecord[];
  readonly inserts: Array<{ baseNumber: number; snapshot: unknown; reason: string; createdBy: string }>;
  readonly reads: { latest: number };
  readonly passwords: string[];
  readonly audit: ReturnType<typeof createFakeAuditWorld>;
}

/** `whenPasswordChecked` runs at the moment the password is checked (another save landing while the Admin types or while the hash is worked out). */
function world(options: { readonly document?: ConfigDocument; readonly whenPasswordChecked?: (versions: ConfigVersionRecord[]) => void; readonly stepUp?: (password: string) => void } = {}): World {
  const versions = [record(1, options.document ?? seedConfig)];
  const inserts: World['inserts'] = [];
  const reads = { latest: 0 };
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
    findById: (id) => Promise.resolve(versions.find((each) => each.id === id) ?? null),
    readVersionUse: () => Promise.resolve({ savedByName: null, estimatesInUse: 0 }),
  };
  const audit = createFakeAuditWorld();
  const service = createConfigStructureService({
    configurations,
    masters: { listProcessItems: () => Promise.resolve(SEED_PROCESS_ITEMS.map((item) => ({ ...item, defaultValue: '0.00' }))) },
    stepUp: {
      verifyStepUp(_caller, password) {
        passwords.push(password);
        options.stepUp?.(password);
        if (password !== RIGHT) return Promise.reject(new StepUpFailed('That password is not correct. Try again.'));
        options.whenPasswordChecked?.(versions);
        return Promise.resolve();
      },
    },
    transactions: audit.transactions,
    audit: createAuditService({ audit: audit.audit }),
    cache: createConfigVersionCache(),
  });
  return { service, versions, inserts, reads, passwords, audit };
}

const rejection = async (promise: Promise<unknown>): Promise<Error & { code?: string; httpStatus?: number; currentVersion?: number; uses?: ReadonlyArray<{ kind: string }> }> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected a refusal.');
};

describe('AC-1: the Admin alone, checked again before anything is read', () => {
  it.each([
    ['a Lead', LEAD],
    ['an Engineer', ENGINEER],
  ])('refuses %s with 403 on both methods and reads, asks and writes nothing', async (_who, caller) => {
    const w = world();
    for (const call of [() => w.service.listReferences(caller, FREE.id), () => w.service.deleteField(caller, FREE.id, { password: RIGHT })]) {
      expect(await rejection(call())).toMatchObject({ httpStatus: 403 });
    }
    expect(w.reads.latest).toBe(0);
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });
});

describe('AC-2: what the references read answers', () => {
  it('lists every formula that uses the field, by column letter, label and formula in display form, and then the other uses', async () => {
    const answer = await world().service.listReferences(ADMIN, USED.id);
    expect(answer).toMatchObject({ fieldId: USED.id, letter: 'AL', label: USED.label });
    expect(answer.uses[0]).toMatchObject({ kind: 'formula', letter: 'AY', formula: 'AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX' });
  });

  it('answers an empty list for a field nothing uses, and stores and asks nothing', async () => {
    const w = world();
    expect(await w.service.listReferences(ADMIN, FREE.id)).toEqual({ fieldId: FREE.id, letter: fieldLetter(FREE), label: FREE.label, uses: [] });
    expect(w.inserts).toEqual([]);
    expect(w.passwords).toEqual([]);
  });

  it('answers 404 for an ID that is no field and 409 SYSTEM_FIELD for a protected one, in that order', async () => {
    const w = world();
    expect(await rejection(w.service.listReferences(ADMIN, '00000000-0000-4000-8000-00000000dead'))).toMatchObject({ httpStatus: 404 });
    expect(await rejection(w.service.listReferences(ADMIN, seedFieldAt('BG').id))).toMatchObject({ httpStatus: 409, code: 'SYSTEM_FIELD' });
  });

  it('refuses a delete of a field that is used with 409 FIELD_IN_USE and the same list, never asks for the password and stores nothing', async () => {
    const w = world();
    const error = await rejection(w.service.deleteField(ADMIN, USED.id, { password: RIGHT }));
    expect(error).toMatchObject({ httpStatus: 409, code: 'FIELD_IN_USE', message: expect.stringMatching(/^Cannot delete AL .+ yet\. (1 formula uses|\d+ formulas use|1 place uses|\d+ places use) this field\.$/) });
    expect(error.uses).toEqual((await w.service.listReferences(ADMIN, USED.id)).uses);
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });
});

describe('AC-4: the order of the checks, so a refusal costs nothing', () => {
  it('answers 404 for an unknown field and 409 SYSTEM_FIELD for a protected one (a system role and a key the code needs), asking for no password for either', async () => {
    const w = world();
    expect(await rejection(w.service.deleteField(ADMIN, '00000000-0000-4000-8000-00000000dead', { password: RIGHT }))).toMatchObject({ httpStatus: 404 });
    for (const letter of ['A', 'BG', 'BL', 'BM', 'BO', 'E', 'F', 'I', 'BH', 'BI', 'BJ', 'BK', 'BN']) {
      expect(await rejection(w.service.deleteField(ADMIN, seedFieldAt(letter).id, { password: RIGHT })), letter).toMatchObject({ httpStatus: 409, code: 'SYSTEM_FIELD' });
    }
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
  });

  it('refuses a wrong password with 422 STEP_UP_FAILED, stores nothing and writes no audit entry', async () => {
    const w = world();
    expect(await rejection(w.service.deleteField(ADMIN, FREE.id, { password: 'Invented-wrong-password-1' }))).toBeInstanceOf(StepUpFailed);
    expect(w.passwords).toEqual(['Invented-wrong-password-1']);
    expect(w.inserts).toEqual([]);
    expect(w.versions).toHaveLength(1);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('lets a blocked step-up (429) through and stores nothing', async () => {
    const w = world({
      stepUp: () => {
        throw new StepUpLocked('Too many wrong passwords. Try again in 15 minutes.');
      },
    });
    expect(await rejection(w.service.deleteField(ADMIN, FREE.id, { password: RIGHT }))).toBeInstanceOf(StepUpLocked);
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('passes the password to the step-up and nowhere else: it is in no stored version, no reason and no audit entry', async () => {
    const w = world();
    await w.service.deleteField(ADMIN, FREE.id, { password: RIGHT });
    expect(w.passwords).toEqual([RIGHT]);
    expect(JSON.stringify([w.inserts, w.audit.audit.appended])).not.toContain(RIGHT);
  });
});

describe('AC-3, AC-6 and AC-8: the delete, one version and one audit entry', () => {
  it('stores version 2 with the field gone, every later position one lower, every other field as it was and no formula rewritten, and answers the words', async () => {
    const w = world();
    const result = await w.service.deleteField(ADMIN, FREE.id, { password: RIGHT });
    expect(result).toEqual({ version: 2, message: 'Field deleted. Configuration version 2.' });
    expect(w.inserts).toHaveLength(1);
    expect(w.inserts[0]).toMatchObject({ baseNumber: 1, createdBy: ADMIN.user.id, reason: `Deleted ${fieldLetter(FREE)} ${FREE.label}` });

    const stored = parseConfigDocument(defined(w.versions[1]).snapshot);
    expect(stored.fields).toHaveLength(seedConfig.fields.length - 1);
    expect(stored.fields.map((field) => field.position)).toEqual(stored.fields.map((_field, index) => index + 1));
    const kept = seedConfig.fields.filter((field) => field.id !== FREE.id);
    expect(stored.fields.map((field) => ({ ...field, position: 0 }))).toEqual(kept.map((field) => ({ ...field, position: 0 })));
  });

  it('records one config.field_deleted entry in the same transaction: who, the column as it was, what moved and the version, and no password', async () => {
    const w = world();
    await w.service.deleteField(ADMIN, FREE.id, { password: RIGHT });
    expect(w.audit.audit.committed).toHaveLength(1);
    const [row] = w.audit.audit.appended;
    expect(row).toMatchObject({
      event: 'config.field_deleted',
      actorId: ADMIN.user.id,
      actorLabel: 'Invented Admin',
      objectType: 'field',
      objectId: FREE.id,
      objectLabel: `${fieldLetter(FREE)} ${FREE.label}`,
      requestId: ADMIN.requestId,
      before: { letter: fieldLetter(FREE), label: FREE.label, kind: 'input', formula: null },
    });
    const after = JSON.parse(JSON.stringify(row?.after ?? null)) as { moved: Array<{ from: string; to: string; by: number }>; version: number };
    expect(after.version).toBe(2);
    expect(after.moved).toEqual([{ from: expect.any(String), to: 'BO', by: 1 }]);
    expect(JSON.stringify(row)).not.toMatch(/password/i);
  });

  it('records the formula of a deleted output in display form (the log is read by the Admin alone), and says no other column moved for the last column', async () => {
    const made = insertFields({ document: seedConfig, rates: RATES, spec: { kind: 'output', afterFieldId: seedFieldAt('BO').id, output: newOutput({ label: 'Invented Last', formula: 'P * Cutting-Rate-per-Sec' }) } });
    if (!made.ok) throw new Error('refused');
    const w = world({ document: made.document });
    await w.service.deleteField(ADMIN, defined(made.inserted[0]).id, { password: RIGHT });
    const [row] = w.audit.audit.appended;
    expect(row).toMatchObject({ before: { letter: 'BP', label: 'Invented Last', kind: 'output', formula: 'P * Cutting-Rate-per-Sec' }, after: { moved: [], version: 2 } });
  });
});

describe('AC-3 and the races: a version made while the password was being checked, and a formula edited after the dialog opened', () => {
  it('answers 409 CONFIG_VERSION_CHANGED with the newer number, stores nothing and writes no audit entry, when a save lands while the password is checked', async () => {
    const w = world({ whenPasswordChecked: (versions) => versions.push(record(2, seedConfig)) });
    const error = await rejection(w.service.deleteField(ADMIN, FREE.id, { password: RIGHT }));
    expect(error).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
    expect(w.versions).toHaveLength(2);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('re-reads the references on every delete: a formula edited after the dialog opened to use the field is refused 409 FIELD_IN_USE and nothing is stored', async () => {
    const w = world();
    expect((await w.service.listReferences(ADMIN, FREE.id)).uses).toEqual([]);
    // Another Admin session saves a formula that reads the field: version 2.
    const reader = defined(seedConfig.fields.find((field) => field.kind === 'output' && !isProtectedField(field) && field.formula !== null && field.position > FREE.position));
    w.versions.push(record(2, withFormula(seedConfig, reader.id, `{{f:${FREE.id}}} * 2`)));
    const error = await rejection(w.service.deleteField(ADMIN, FREE.id, { password: RIGHT }));
    expect(error).toMatchObject({ httpStatus: 409, code: 'FIELD_IN_USE' });
    expect(error.uses).toEqual([expect.objectContaining({ kind: 'formula', fieldId: reader.id })]);
    expect(w.passwords).toEqual([]);
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('deletes from the latest version: a second delete of the same field is 404, not a second version', async () => {
    const w = world();
    await w.service.deleteField(ADMIN, FREE.id, { password: RIGHT });
    expect(await rejection(w.service.deleteField(ADMIN, FREE.id, { password: RIGHT }))).toMatchObject({ httpStatus: 404 });
    expect(w.versions).toHaveLength(2);
  });
});
