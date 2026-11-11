import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NAME_RESERVED_CODE, NAME_TAKEN_CODE, NotFoundError, TREATMENT_LOCKED_CODE } from '@/lib/errors';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';
import { OTHER_TREATMENT_ID } from '../../support/treatment-canary';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-02.05 T1, T2 and T5 (AC-1 to AC-4, AC-6) against real PostgreSQL in a throwaway database: the rules the table itself keeps (the fixed
 * "Other" row the migration inserts, a name unique ignoring letter case and never blank, no TRUNCATE for the runtime role), the default filter of
 * architecture section 4.9 (a hidden row is never listed and never found), and the Treatment / Color service over the real repositories: each change
 * in one transaction with its audit entry, a refused change writing none, the locked "Other" entry untouched, and two requests at once. Names are
 * invented.
 *
 * The block "AC-2, AC-3 (T2): one canonical form ..." holds the G6 findings QLT-01 (one canonical form of a name) and QLT-02 (the resource answers before the
 * name does). A test title names the AC, not the review finding (STD-15).
 *
 * The audit entry commits with its change or not at all (DEF-017): the late-failure tests use the shared runner of tech-debt #130
 * (`tests/support/late-failure-runner.ts`), which fails only the outermost transaction, so an entry written in a second transaction inside the
 * change would stay behind and fail the test. Plants A3 (such an entry on an add) and A4 (on a rename and on a delete) each fail this file.
 */

const LATE_FAILURE = 'a failure after the entry was written';

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);

interface TreatmentDbRow {
  readonly id: string;
  readonly name: string;
  readonly is_system: boolean;
  readonly is_hidden: boolean;
}

async function rows(): Promise<TreatmentDbRow[]> {
  const { rows: found } = await db.owner.query<TreatmentDbRow>('SELECT id::text, name, is_system, is_hidden FROM treatments ORDER BY created_at, id');
  return found;
}

async function byName(name: string): Promise<TreatmentDbRow | undefined> {
  return (await rows()).find((row) => row.name === name);
}

const insert = 'INSERT INTO treatments (name) VALUES ($1) RETURNING id::text';

async function insertAsOwner(name: string): Promise<string> {
  const { rows: made } = await db.owner.query<{ id: string }>(insert, [name]);
  return defined(made[0]).id;
}

/** Removes what a test added (a hidden row too), whether it passed or failed, so one failure is reported once and not again by every test after it. "Other" stays: the migration put it there. */
const emptyTable = async (): Promise<void> => {
  await db.owner.query('DELETE FROM treatments WHERE id <> $1::uuid', [OTHER_TREATMENT_ID]);
};

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-1 (T1): the migration puts "Other" in the table, and the repository lists only what the default filter allows', () => {
  afterEach(emptyTable);

  it('holds exactly one row after the migration: "Other", with the fixed ID, is_system true and is_hidden false (A-1)', async () => {
    expect(await rows()).toEqual([{ id: OTHER_TREATMENT_ID, name: 'Other', is_system: true, is_hidden: false }]);
  });

  it('lists "Other" first and locked, then the treatments in the order they were added, and offers the same as options with an ID and a name only', async () => {
    const first = await insertAsOwner('Invented powder coat');
    const second = await insertAsOwner('Invented anodised');
    expect(await db.masterRepository.listTreatments()).toEqual([
      { id: OTHER_TREATMENT_ID, name: 'Other', locked: true },
      { id: first, name: 'Invented powder coat', locked: false },
      { id: second, name: 'Invented anodised', locked: false },
    ]);
    const options = await db.mastersService.listTreatmentOptions();
    expect(options.map((option) => option.name)).toEqual(['Other', 'Invented powder coat', 'Invented anodised']);
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });

  it('never lists a hidden row, and never finds one by ID: a change to it is "not found", as for an unknown ID (architecture section 4.9)', async () => {
    const shown = await insertAsOwner('Invented shown treatment');
    const { rows: hidden } = await db.owner.query<{ id: string }>("INSERT INTO treatments (name, is_system, is_hidden) VALUES ('Invented hidden entry', true, true) RETURNING id::text");
    const hiddenId = defined(hidden[0]).id;
    expect((await db.masterRepository.listTreatments()).map((treatment) => treatment.id)).toEqual([OTHER_TREATMENT_ID, shown]);
    expect((await db.masterRepository.listTreatmentOptions()).map((option) => option.id)).toEqual([OTHER_TREATMENT_ID, shown]);
    expect(await db.transactions.run((tx) => db.masterRepository.findTreatmentForUpdate(hiddenId, tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.renameTreatment(hiddenId, 'Invented renamed hidden', tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.deleteTreatment(hiddenId, tx))).toBe(false);
    const hiddenAnswer = await refusal(db.mastersService.updateTreatment(by(), hiddenId, { name: 'Invented renamed hidden' }));
    const unknownAnswer = await refusal(db.mastersService.updateTreatment(by(), '00000000-0000-4000-8000-0ccc00000009', { name: 'Invented renamed hidden' }));
    expect(hiddenAnswer).toBeInstanceOf(NotFoundError);
    expect(unknownAnswer).toBeInstanceOf(NotFoundError);
    expect(String(hiddenAnswer)).toBe(String(unknownAnswer));
    expect((await byName('Invented hidden entry'))?.is_hidden).toBe(true);
  });
});

describe('AC-2 (T1): what the table keeps, whoever writes to it', () => {
  afterEach(emptyTable);

  it('refuses a name that another row has ignoring letter case, even to the owner (the unique index), and a blank name (the CHECK)', async () => {
    await insertAsOwner('Invented powder coat');
    await expect(db.owner.query(insert, ['INVENTED POWDER COAT'])).rejects.toMatchObject({ constraint: 'uq_treatments_name_lower' });
    await expect(db.owner.query(insert, ['Invented powder coat'])).rejects.toMatchObject({ constraint: expect.stringMatching(/^uq_treatments_name/) });
    await expect(db.owner.query(insert, ['Other'])).rejects.toMatchObject({ constraint: expect.stringMatching(/^uq_treatments_name/) });
    await expect(db.owner.query(insert, ['other'])).rejects.toMatchObject({ constraint: 'uq_treatments_name_lower' });
    await expect(db.owner.query(insert, ['   '])).rejects.toMatchObject({ constraint: 'ck_treatments_name_not_blank' });
  });

  it('lets the runtime role read, add, change and delete rows, and gives it no TRUNCATE', async () => {
    const privileges = await db.owner.query<{ privilege: string; granted: boolean }>(
      `SELECT p AS privilege, has_table_privilege('accucut_app', 'treatments', p) AS granted FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p`,
    );
    expect(Object.fromEntries(privileges.rows.map((row) => [row.privilege, row.granted]))).toEqual({
      SELECT: true,
      INSERT: true,
      UPDATE: true,
      DELETE: true,
      TRUNCATE: false,
    });
  });
});

describe('AC-2, AC-6 (T2): adding a treatment', () => {
  afterEach(emptyTable);

  it('stores the trimmed name and writes exactly one master.created entry of object type treatment, with who, the object, and the name after', async () => {
    const entries = await entryCount(db);
    const created = await db.mastersService.createTreatment(by(), { name: '  Invented powder coat ' });
    expect(created).toEqual({ id: expect.any(String), name: 'Invented powder coat', locked: false });
    expect(await byName('Invented powder coat')).toMatchObject({ is_system: false, is_hidden: false });
    expect(await entryCount(db)).toBe(entries + 1);
    const [entry, ...others] = await entriesFor(db, created.id);
    expect(others).toEqual([]);
    expect(entry).toMatchObject({
      event: 'master.created',
      actor_id: adminId,
      object_type: 'treatment',
      object_id: created.id,
      object_label: 'Invented powder coat',
      before: null,
      after: { name: 'Invented powder coat' },
    });
  });

  it.each(['Other', 'OTHER', ' other ', 'Not applicable', 'NOT APPLICABLE', 'Not  applicable'])(
    'refuses the name %j with 422 NAME_RESERVED, in words that name neither entry, and stores nothing and writes no entry',
    async (name) => {
      const entries = await entryCount(db);
      const before = await rows();
      const error = await refusal(db.mastersService.createTreatment(by(), { name }));
      expect(error).toBeInstanceOf(FieldValidationError);
      expect(error).toMatchObject({ code: NAME_RESERVED_CODE, fields: [{ field: 'name', message: 'That name cannot be used.' }] });
      expect(await rows()).toEqual(before);
      expect(await entryCount(db)).toBe(entries);
    },
  );

  it('refuses a name another treatment has, ignoring letter case, with the 422 of AC-2, and writes nothing', async () => {
    await db.mastersService.createTreatment(by(), { name: 'Invented powder coat' });
    const entries = await entryCount(db);
    const error = await refusal(db.mastersService.createTreatment(by(), { name: 'INVENTED powder COAT' }));
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'name', message: 'A treatment with this name already exists.' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await rows()).filter((row) => row.name.toLowerCase() === 'invented powder coat')).toHaveLength(1);
  });
});

describe('AC-2, AC-3 (T2): one canonical form of a name, and the resource answers before the name', () => {
  afterEach(emptyTable);

  it('stores spaces collapsed and full-width letters folded, and refuses the near-duplicate with NAME_TAKEN, on an add and on a rename', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: '  Invented   powder coat ' });
    expect(created.name).toBe('Invented powder coat');
    expect((await byName('Invented powder coat'))?.id).toBe(created.id);
    const other = await db.mastersService.createTreatment(by(), { name: 'Ｉｎｖｅｎｔｅｄ anodised' });
    expect(other.name).toBe('Invented anodised');
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.createTreatment(by(), { name: 'Invented  Powder Coat' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(await refusal(db.mastersService.updateTreatment(by(), other.id, { name: 'invented powder   coat' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(await entryCount(db)).toBe(entries);
  });

  it('answers 409 for "Other" and 404 for an unknown ID before it judges the new name, even when the new name is one the system keeps', async () => {
    const entries = await entryCount(db);
    for (const name of ['Other', 'OTHER', 'Not applicable']) {
      expect(await refusal(db.mastersService.updateTreatment(by(), OTHER_TREATMENT_ID, { name }))).toMatchObject({ code: TREATMENT_LOCKED_CODE, httpStatus: 409 });
      expect(await refusal(db.mastersService.updateTreatment(by(), '00000000-0000-4000-8000-0ccc00000009', { name }))).toBeInstanceOf(NotFoundError);
    }
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-2, AC-6 (T2): renaming a treatment', () => {
  afterEach(emptyTable);

  it('renames and writes exactly one master.edited entry with the name before and after', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Invented powder coat' });
    const updated = await db.mastersService.updateTreatment(by(), created.id, { name: 'Invented hard coat' });
    expect(updated).toEqual({ id: created.id, name: 'Invented hard coat', locked: false });
    expect((await entriesFor(db, created.id)).map((entry) => [entry.event, entry.before, entry.after])).toEqual([
      ['master.created', null, { name: 'Invented powder coat' }],
      ['master.edited', { name: 'Invented powder coat' }, { name: 'Invented hard coat' }],
    ]);
  });

  it('writes no entry for a rename that changes nothing, and allows a change of its own letter case', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Invented powder coat' });
    const entries = await entryCount(db);
    await db.mastersService.updateTreatment(by(), created.id, { name: ' Invented powder coat ' });
    expect(await entryCount(db)).toBe(entries);
    await db.mastersService.updateTreatment(by(), created.id, { name: 'INVENTED POWDER COAT' });
    expect(await entryCount(db)).toBe(entries + 1);
    expect(await byName('INVENTED POWDER COAT')).toBeDefined();
  });

  it('refuses a rename onto another treatment (any letter case) or onto a name the system keeps, and changes nothing', async () => {
    const first = await db.mastersService.createTreatment(by(), { name: 'Invented powder coat' });
    await db.mastersService.createTreatment(by(), { name: 'Invented anodised' });
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.updateTreatment(by(), first.id, { name: 'invented ANODISED' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(await refusal(db.mastersService.updateTreatment(by(), first.id, { name: 'OTHER' }))).toMatchObject({ code: NAME_RESERVED_CODE });
    expect(await refusal(db.mastersService.updateTreatment(by(), first.id, { name: 'not  applicable' }))).toMatchObject({ code: NAME_RESERVED_CODE });
    expect(await byName('Invented powder coat')).toBeDefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('answers not found for an unknown ID and for text that is not an ID, and writes nothing', async () => {
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.updateTreatment(by(), '00000000-0000-4000-8000-0ccc00000009', { name: 'Invented hard coat' }))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.updateTreatment(by(), 'not-an-id', { name: 'Invented hard coat' }))).toBeInstanceOf(NotFoundError);
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-4, AC-6 (T2): deleting a treatment', () => {
  afterEach(emptyTable);

  it('removes the row and writes exactly one master.deleted entry with the name before and nothing after', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Invented powder coat' });
    await db.mastersService.deleteTreatment(by(), created.id);
    expect(await byName('Invented powder coat')).toBeUndefined();
    expect((await db.mastersService.listTreatments()).map((treatment) => treatment.name)).toEqual(['Other']);
    const deleted = defined((await entriesFor(db, created.id)).at(-1));
    expect(deleted).toMatchObject({ event: 'master.deleted', object_type: 'treatment', object_label: 'Invented powder coat', before: { name: 'Invented powder coat' }, after: null });
  });

  it('answers not found for an unknown ID and for one deleted already, and writes nothing more', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Invented powder coat' });
    await db.mastersService.deleteTreatment(by(), created.id);
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.deleteTreatment(by(), created.id))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.deleteTreatment(by(), '00000000-0000-4000-8000-0ccc00000009'))).toBeInstanceOf(NotFoundError);
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-3 (T2): the locked "Other" entry, in the service and in the repository', () => {
  afterEach(emptyTable);

  it('refuses a rename and a delete with 409 TREATMENT_LOCKED, changes nothing and writes no entry', async () => {
    const entries = await entryCount(db);
    const renamed = await refusal(db.mastersService.updateTreatment(by(), OTHER_TREATMENT_ID, { name: 'Invented renamed other' }));
    const deleted = await refusal(db.mastersService.deleteTreatment(by(), OTHER_TREATMENT_ID));
    for (const error of [renamed, deleted]) {
      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ code: TREATMENT_LOCKED_CODE, httpStatus: 409 });
    }
    expect(await rows()).toEqual([{ id: OTHER_TREATMENT_ID, name: 'Other', is_system: true, is_hidden: false }]);
    expect(await entryCount(db)).toBe(entries);
  });

  it('is kept by the repository as well: a rename or a delete of a system row does nothing, whatever the caller checked first', async () => {
    expect(await db.transactions.run((tx) => db.masterRepository.renameTreatment(OTHER_TREATMENT_ID, 'Invented renamed other', tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.deleteTreatment(OTHER_TREATMENT_ID, tx))).toBe(false);
    expect((await rows()).map((row) => row.name)).toEqual(['Other']);
  });
});

describe('AC-6 (DEF-017): an entry commits with its change, or not at all', () => {
  afterEach(emptyTable);

  /** The outermost transaction fails after its work; one opened inside it commits (tests/support/late-failure-runner.ts, #130). */
  function failingAfterTheLastStep(): TransactionRunner {
    return createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
  }

  it('add: no treatment is left and no entry is kept', async () => {
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.createTreatment(by(), { name: 'Late-failure-add' })).rejects.toThrow(LATE_FAILURE);
    expect(await byName('Late-failure-add')).toBeUndefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('rename: the treatment is as it was and no entry is kept', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Late-failure-rename' });
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.updateTreatment(by(), created.id, { name: 'Late-failure-renamed' })).rejects.toThrow(LATE_FAILURE);
    expect(await byName('Late-failure-rename')).toBeDefined();
    expect(await byName('Late-failure-renamed')).toBeUndefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('delete: the treatment is still there and no entry is kept', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Late-failure-delete' });
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.deleteTreatment(by(), created.id)).rejects.toThrow(LATE_FAILURE);
    expect(await byName('Late-failure-delete')).toBeDefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('an entry the audit service refuses takes the change back, for an add, a rename and a delete (a change is never saved without its record, NFR-007)', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Refused-entry' });
    const entries = await entryCount(db);
    const unrecorded = { ...by(), actorLabel: '' };
    // An empty actor label is refused by the audit service, inside the transaction of the change.
    await expect(db.mastersService.createTreatment(unrecorded, { name: 'Refused-add' })).rejects.toMatchObject({ reason: 'shape' });
    await expect(db.mastersService.updateTreatment(unrecorded, created.id, { name: 'Refused-rename' })).rejects.toMatchObject({ reason: 'shape' });
    await expect(db.mastersService.deleteTreatment(unrecorded, created.id)).rejects.toMatchObject({ reason: 'shape' });
    expect((await rows()).map((row) => row.name)).toEqual(['Other', 'Refused-entry']);
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('two requests at once', () => {
  afterEach(emptyTable);

  it('let exactly one of several simultaneous additions of one name (in different letter case) win; the others are told the name is taken', async () => {
    const attempts = await Promise.allSettled(
      ['Race-Treatment', 'RACE-TREATMENT', 'race-treatment', 'Race-treatment'].map((name) => db.mastersService.createTreatment(by(), { name })),
    );
    const winners = attempts.flatMap((attempt) => (attempt.status === 'fulfilled' ? [attempt.value] : []));
    expect(winners).toHaveLength(1);
    for (const attempt of attempts) {
      if (attempt.status === 'rejected') expect(attempt.reason).toMatchObject({ code: NAME_TAKEN_CODE });
    }
    expect((await rows()).filter((row) => row.name.toLowerCase() === 'race-treatment')).toHaveLength(1);
    expect(await entriesFor(db, defined(winners[0]).id)).toHaveLength(1);
  });

  it('serialise a rename and a delete of one treatment: whichever comes second finds the first one\'s result, and each wrote its own entry or none', async () => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Race-rename-delete' });
    const settled = await Promise.allSettled([
      db.mastersService.updateTreatment(by(), created.id, { name: 'Race-renamed' }),
      db.mastersService.deleteTreatment(by(), created.id),
    ]);
    const outcomes = settled.map((result) => result.status);
    expect(outcomes.filter((outcome) => outcome === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    for (const result of settled) {
      if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(NotFoundError);
    }
    expect(await byName('Race-rename-delete')).toBeUndefined();
    const events = (await entriesFor(db, created.id)).map((entry) => entry.event);
    expect(events[0]).toBe('master.created');
    expect(events).toContain('master.deleted');
  });
});
