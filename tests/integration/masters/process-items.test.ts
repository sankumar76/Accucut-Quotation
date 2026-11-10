import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_REFUSED_CODE, NAME_TAKEN_CODE, NotFoundError, ProcessItemInUseError } from '@/lib/errors';
import { MasterConstraintError } from '@/server/repositories/master-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-02.01 T1 and T5 (AC-1 to AC-5) against real PostgreSQL in a throwaway database: the migration's 15 rows against
 * `seed-ids.ts`, the rules the database itself keeps (a name unique ignoring letter case, a rate of 0 or more, no TRUNCATE for the
 * runtime role), and the Process Master service over the real repositories: each change in one transaction with its audit entry, a
 * refused change writing none, and two requests at once. Names and numbers are invented (`n.37`, ADR-014).
 */

const LATE_FAILURE = 'a failure after the entry was written';
const CUTTING = defined(SEED_PROCESS_ITEMS[0]);
const PLATING = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Plating-rate-per-sqin'));
const FOAM = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Foam Cost'));

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);

async function rows() {
  const { rows: found } = await db.owner.query<{ id: string; name: string; unit: string; default_value: string }>(
    'SELECT id::text, name, unit, default_value::text FROM process_items ORDER BY created_at, id',
  );
  return found;
}

async function byName(name: string) {
  const { rows: found } = await db.owner.query<{ id: string; default_value: string; unit: string }>(
    'SELECT id::text, default_value::text, unit FROM process_items WHERE name = $1',
    [name],
  );
  return found[0];
}

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-1 (T1): the migration inserts the 15 seed items, with the fixed IDs', () => {
  it('holds exactly the rows of prisma/seed/config/seed-ids.ts: ID, name, unit, in SPEC order, and a default value of 0', async () => {
    const found = await rows();
    expect(found.map(({ id, name, unit }) => ({ id, name, unit }))).toEqual(SEED_PROCESS_ITEMS.map(({ id, name, unit }) => ({ id, name, unit })));
    expect(found).toHaveLength(15);
    expect(found.every((row) => Number(row.default_value) === 0)).toBe(true);
  });

  it('carries no rate value: every default is 0 and the table holds nothing the Admin has not typed (ADR-014)', async () => {
    const { rows: nonZero } = await db.owner.query('SELECT 1 FROM process_items WHERE default_value <> 0');
    expect(nonZero).toEqual([]);
  });

  it('is listed in SPEC order by the repository, each with a two-decimal value', async () => {
    const listed = await db.masterRepository.listProcessItems();
    expect(listed.map((item) => item.name)).toEqual(SEED_PROCESS_ITEMS.map((item) => item.name));
    expect(listed.every((item) => item.defaultValue === '0.00')).toBe(true);
  });

  it('is listed by the service with the formulas that use each rate (the seed registry)', async () => {
    const items = await db.mastersService.listProcessItems();
    expect(items.find((item) => item.id === CUTTING.id)?.usedBy).toEqual([{ letter: 'AL', label: 'Cutting Cost' }]);
    expect(items.find((item) => item.id === PLATING.id)?.usedBy).toEqual([]);
  });
});

describe('AC-2: the rules of the database itself, whatever the code checked', () => {
  const insert = "INSERT INTO process_items (name, unit, default_value) VALUES ($1, 'per kg', $2)";

  it('refuses a name that differs from another only in letter case, for the owner and for the runtime role', async () => {
    await expect(db.owner.query(insert, ['FOAM COST', 0])).rejects.toThrow('uq_process_items_name_lower');
    await expect(db.runtime.query(insert, ['foam cost', 0])).rejects.toThrow('uq_process_items_name_lower');
    expect(await rows()).toHaveLength(15);
  });

  it('refuses the same name exactly', async () => {
    await expect(db.runtime.query(insert, ['Foam Cost', 0])).rejects.toThrow(/uq_process_items_name/);
  });

  it('refuses a negative default and a blank name', async () => {
    await expect(db.runtime.query(insert, ['Invented-negative', -1])).rejects.toThrow('ck_process_items_default_value_not_negative');
    await expect(db.runtime.query(insert, ['   ', 0])).rejects.toThrow('ck_process_items_name_not_blank');
  });

  it('stores up to four decimals and refuses a value over 14 digits before the point (Decimal(18,4))', async () => {
    await db.owner.query(insert, ['Invented-decimal', '12345678901234.5678']);
    expect((await byName('Invented-decimal'))?.default_value).toBe('12345678901234.5678');
    await expect(db.owner.query(insert, ['Invented-too-big', '123456789012345'])).rejects.toThrow();
  });

  it('lets the runtime role read, add, change and delete rows, but not truncate the table', async () => {
    await db.runtime.query(insert, ['Invented-grant-check', 1.37]);
    await db.runtime.query("UPDATE process_items SET default_value = 2.37 WHERE name = 'Invented-grant-check'");
    await db.runtime.query("DELETE FROM process_items WHERE name = 'Invented-grant-check'");
    await expect(db.runtime.query('TRUNCATE process_items')).rejects.toThrow(/permission denied/);
  });
});

describe('AC-2, AC-5: adding a rate', () => {
  it('stores the rate and writes exactly one master.created entry, with who, when, the object, before and after', async () => {
    const entries = await entryCount(db);
    const created = await db.mastersService.createProcessItem(by(), { name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.5' });
    expect(created).toMatchObject({ name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.50', usedBy: [] });
    expect(Number((await byName('Buffing-rate-per-sqin'))?.default_value)).toBe(1.5);
    expect(await entryCount(db)).toBe(entries + 1);
    const [entry] = await entriesFor(db, created.id);
    expect(entry).toMatchObject({
      event: 'master.created',
      actor_id: adminId,
      actor_label: 'Invented Admin',
      object_type: 'process_item',
      object_id: created.id,
      object_label: 'Buffing-rate-per-sqin',
      before: null,
      after: { name: 'Buffing-rate-per-sqin', unit: 'per sq in', defaultValue: '1.50' },
      request_id: 'req-0a0b0c0d',
    });
    expect(entry?.created_at).toBeInstanceOf(Date);
  });

  it('refuses a name differing only in letter case, a column letter and a name that reads as other rates; nothing is stored or recorded', async () => {
    const entries = await entryCount(db);
    const stored = (await rows()).length;
    const taken = await refusal(db.mastersService.createProcessItem(by(), { name: 'buffing-RATE-per-sqin', unit: 'per kg', defaultValue: '1.37' }));
    expect(taken).toMatchObject({ code: NAME_TAKEN_CODE });
    const letters = await refusal(db.mastersService.createProcessItem(by(), { name: 'AL', unit: 'per kg', defaultValue: '1.37' }));
    expect(letters).toMatchObject({ code: NAME_REFUSED_CODE });
    // DEF-006 against the real set of names.
    const composite = await refusal(db.mastersService.createProcessItem(by(), { name: 'Foam Cost-Transport %', unit: 'per kg', defaultValue: '1.37' }));
    expect(composite).toMatchObject({ code: NAME_REFUSED_CODE });
    for (const error of [taken, letters, composite]) expect(error).toBeInstanceOf(FieldValidationError);
    expect(await entryCount(db)).toBe(entries);
    expect((await rows()).length).toBe(stored);
  });
});

describe('AC-3, AC-5: changing a rate', () => {
  it('renames it (the ID stays, so a formula keeps working) and writes one master.edited entry with the whole rate before and after', async () => {
    const updated = await db.mastersService.updateProcessItem(by(), FOAM.id, { name: 'Foam-Cost-per-sqft', defaultValue: '21.37' });
    expect(updated).toMatchObject({ id: FOAM.id, name: 'Foam-Cost-per-sqft', defaultValue: '21.37', usedBy: [{ letter: 'AW', label: 'Foam Cost' }] });
    const entries = await entriesFor(db, FOAM.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      event: 'master.edited',
      object_type: 'process_item',
      object_label: 'Foam-Cost-per-sqft',
      before: { name: 'Foam Cost', unit: 'per sq ft', defaultValue: '0.00' },
      after: { name: 'Foam-Cost-per-sqft', unit: 'per sq ft', defaultValue: '21.37' },
    });
  });

  it('keeps the rate\'s entries under the name it had at the time: a later rename does not rewrite an earlier entry', async () => {
    await db.mastersService.updateProcessItem(by(), FOAM.id, { name: 'Foam-Cost-2' });
    expect((await entriesFor(db, FOAM.id)).map((entry) => entry.object_label)).toEqual(['Foam-Cost-per-sqft', 'Foam-Cost-2']);
  });

  it('writes nothing for a save that changes nothing, and refuses a rename to another rate\'s name', async () => {
    const entries = await entryCount(db);
    await db.mastersService.updateProcessItem(by(), FOAM.id, { name: 'Foam-Cost-2', unit: 'per sq ft', defaultValue: '021.37' });
    expect(await entryCount(db)).toBe(entries);
    expect(await refusal(db.mastersService.updateProcessItem(by(), FOAM.id, { name: 'transport %' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(await entryCount(db)).toBe(entries);
  });

  it('says not found for a rate that does not exist, and for text that is not an ID', async () => {
    expect(await refusal(db.mastersService.updateProcessItem(by(), '00000000-0000-4000-8000-0bbb00000009', { unit: 'per kg' }))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.updateProcessItem(by(), 'not-an-id', { unit: 'per kg' }))).toBeInstanceOf(NotFoundError);
  });
});

describe('AC-4, AC-5: deleting a rate', () => {
  it('refuses a rate a formula uses with the formulas named, and changes and records nothing', async () => {
    const entries = await entryCount(db);
    const error = await refusal(db.mastersService.deleteProcessItem(by(), CUTTING.id));
    expect(error).toBeInstanceOf(ProcessItemInUseError);
    expect(error).toMatchObject({ httpStatus: 409, usedBy: [{ letter: 'AL', label: 'Cutting Cost' }] });
    expect((await rows()).some((row) => row.id === CUTTING.id)).toBe(true);
    expect(await entryCount(db)).toBe(entries);
  });

  it('refuses a rate that two formulas use and lists both', async () => {
    const { cloneSeedConfig } = await import('../../support/seed-config');
    const document = cloneSeedConfig();
    const fields = document.fields.map((field) =>
      field.kind === 'output' && field.label === 'Bending Cost' && field.formula !== null ? { ...field, formula: `${field.formula} + {{rate:${CUTTING.id}}}` } : field,
    );
    const service = db.buildMastersService({ configuration: { ...document, fields } });
    const error = await refusal(service.deleteProcessItem(by(), CUTTING.id));
    expect((error as ProcessItemInUseError).usedBy.map((use) => use.letter)).toEqual(['AL', 'AM']);
  });

  it('deletes a rate no formula uses and writes one master.deleted entry with its last state', async () => {
    await db.mastersService.updateProcessItem(by(), PLATING.id, { defaultValue: '1.37' });
    await db.mastersService.deleteProcessItem(by(), PLATING.id);
    expect((await rows()).some((row) => row.id === PLATING.id)).toBe(false);
    const entries = await entriesFor(db, PLATING.id);
    expect(entries.map((entry) => entry.event).sort()).toEqual(['master.deleted', 'master.edited']);
    expect(entries.find((entry) => entry.event === 'master.deleted')).toMatchObject({ object_label: 'Plating-rate-per-sqin', before: { name: 'Plating-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' }, after: null });
  });

  it('says not found for a rate that is gone', async () => {
    expect(await refusal(db.mastersService.deleteProcessItem(by(), PLATING.id))).toBeInstanceOf(NotFoundError);
  });
});

describe('AC-5 (DEF-017): an entry commits with its change, or not at all', () => {
  /** The outermost transaction fails after its work; one opened inside it commits (tests/support/late-failure-runner.ts, #130). */
  function failingAfterTheLastStep(): TransactionRunner {
    return createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
  }

  it('create: no rate is left and no entry is kept', async () => {
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.createProcessItem(by(), { name: 'Late-failure-create', unit: 'per kg', defaultValue: '1.37' })).rejects.toThrow(LATE_FAILURE);
    expect(await byName('Late-failure-create')).toBeUndefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('update: the rate is as it was and no entry is kept', async () => {
    const before = await byName('Transport %');
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.updateProcessItem(by(), defined(before).id, { defaultValue: '9.37' })).rejects.toThrow(LATE_FAILURE);
    expect((await byName('Transport %'))?.default_value).toBe(before?.default_value);
    expect(await entryCount(db)).toBe(entries);
  });

  it('delete: the rate is still there and no entry is kept', async () => {
    const created = await db.mastersService.createProcessItem(by(), { name: 'Late-failure-delete', unit: 'per kg', defaultValue: '1.37' });
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.deleteProcessItem(by(), created.id)).rejects.toThrow(LATE_FAILURE);
    expect(await byName('Late-failure-delete')).toBeDefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('an entry the audit service refuses takes the change back (a rate is never changed without its record)', async () => {
    const entries = await entryCount(db);
    // An empty actor label is refused by the audit service, inside the transaction.
    await expect(db.mastersService.createProcessItem({ ...by(), actorLabel: '' }, { name: 'Refused-entry', unit: 'per kg', defaultValue: '1.37' })).rejects.toMatchObject({ reason: 'shape' });
    expect(await byName('Refused-entry')).toBeUndefined();
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('two requests at once', () => {
  it('let exactly one of several simultaneous creations of one name (in different letter case) win; the others are told the name is taken', async () => {
    const attempts = await Promise.allSettled(
      ['Race-Rate', 'RACE-RATE', 'race-rate', 'Race-rate'].map((name) => db.mastersService.createProcessItem(by(), { name, unit: 'per kg', defaultValue: '1.37' })),
    );
    const winners = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const losers = attempts.flatMap((attempt) => (attempt.status === 'rejected' ? [attempt.reason as unknown] : []));
    expect(winners).toHaveLength(1);
    for (const loser of losers) expect(loser).toMatchObject({ code: NAME_TAKEN_CODE });
    const { rows: found } = await db.owner.query("SELECT 1 FROM process_items WHERE lower(name) = 'race-rate'");
    expect(found).toHaveLength(1);
  });
});

describe('the repository itself: the rule of the database for names, whatever the service checked first', () => {
  it('turns a repeated name, in any letter case, into MasterConstraintError on an add and on a rename, and rolls the transaction back', async () => {
    const added = db.transactions.run((tx) => db.masterRepository.createProcessItem({ name: 'TRANSPORT %', unit: '%', defaultValue: '1.00' }, tx));
    await expect(added).rejects.toBeInstanceOf(MasterConstraintError);
    const renamed = db.transactions.run((tx) => db.masterRepository.updateProcessItem(FOAM.id, { name: 'transport %' }, tx));
    await expect(renamed).rejects.toBeInstanceOf(MasterConstraintError);
    expect((await byName('Transport %'))?.unit).toBe('%');
  });

  it('answers null for a change to a rate that is not there, false for a delete of one, and null for text that is not an ID', async () => {
    const gone = '00000000-0000-4000-8000-0bbb00000009';
    expect(await db.transactions.run((tx) => db.masterRepository.updateProcessItem(gone, { unit: 'per kg' }, tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.deleteProcessItem(gone, tx))).toBe(false);
    expect(await db.transactions.run((tx) => db.masterRepository.findProcessItemForUpdate('not-an-id', tx))).toBeNull();
  });
});
