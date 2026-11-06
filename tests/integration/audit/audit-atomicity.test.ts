import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditEntryRefusedError } from '@/server/services/audit-secrets';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, newPerson, openAuditDatabase, userRow, type AuditDatabase } from '../../support/audit-database';
import { createUserServiceThatFails, LATE_FAILURE } from '../../support/late-failure';

/**
 * DEF-017 (STORY-01.07 AC-2, AC-3; QA-F1 of the G7 report): for each of the six audited events, a step that fails **after** the
 * audit entry was written, in the same unit of work, leaves no entry and no change. The existing tests make the entry itself fail,
 * which is rolled back whether the entry shares the change's transaction or has one of its own; these make the failure come
 * later, so an entry written in a transaction of its own (a bypass of the one transaction) survives and the test fails.
 *
 * Each test: the failing service is asked for the change and rejects; nothing about the person or the log has moved; and, as a
 * control that the change was a real one, the same change through the ordinary service writes exactly one entry of that kind.
 * The failure is made by `createUserServiceThatFails` (tests/support/late-failure.ts). Real PostgreSQL; names are invented.
 */

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);
const failsLast = () => createUserServiceThatFails(db, { kind: 'after-the-last-step' });

/**
 * The kinds of the entries about one object, in alphabetical order. Entries of one transaction can share a millisecond, and then
 * the log's own order (time, then a random ID) is not their order of writing, so these tests compare the set, not the sequence.
 */
async function eventsOf(objectId: string): Promise<ReadonlyArray<string>> {
  return (await entriesFor(db, objectId)).map((entry) => entry.event).sort();
}

/** The same, for writing an expectation: the names given, in alphabetical order. */
const kinds = (names: ReadonlyArray<string>): ReadonlyArray<string> => [...names].sort();

/** What a reset changes, read back: the hash, the session counter and the flag. */
async function credentialsOf(id: string) {
  const { rows } = await db.owner.query<{ password_hash: string; session_version: number; must_change_password: boolean }>(
    'SELECT password_hash, session_version, must_change_password FROM users WHERE id = $1',
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('No such user row.');
  return row;
}

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('DEF-017: a failure after the entry was written takes the entry and the change back, for every audited event', () => {
  it('user.created: no person is left and no entry is kept', async () => {
    const input = newPerson('late.created', 'LEAD');
    const entriesBefore = await entryCount(db);

    await expect(failsLast().create(by(), input)).rejects.toBe(LATE_FAILURE);

    expect((await db.owner.query('SELECT 1 FROM users WHERE email = $1', [input.email])).rowCount).toBe(0);
    expect((await db.owner.query('SELECT 1 FROM audit_log WHERE object_label = $1', [input.name])).rowCount).toBe(0);
    expect(await entryCount(db)).toBe(entriesBefore);

    // Control: the same creation through the ordinary service works (the e-mail address is free) and writes its one entry.
    const created = await db.userService.create(by(), input);
    expect(await eventsOf(created.id)).toEqual(kinds(['user.created']));
  });

  it('user.renamed: the name is unchanged and there is no rename entry', async () => {
    const person = await db.userService.create(by(), newPerson('late.renamed'));
    const rowBefore = await userRow(db, person.id);

    await expect(failsLast().update(by(), person.id, { name: 'Invented Late Renamed Two' })).rejects.toBe(LATE_FAILURE);

    expect(await userRow(db, person.id)).toEqual(rowBefore);
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created']));

    await db.userService.update(by(), person.id, { name: 'Invented Late Renamed Two' });
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.renamed']));
  });

  it('user.renamed, in a save that also changes the role: when the second entry is refused, the rename entry goes too', async () => {
    const person = await db.userService.create(by(), newPerson('late.rename.and.role'));
    const rowBefore = await userRow(db, person.id);

    // The first entry (the rename) was written; the second (the role) is refused. The rename entry must not survive.
    await expect(
      createUserServiceThatFails(db, { kind: 'refuse-entry', number: 2 }).update(by(), person.id, { name: 'Invented Late Both', role: 'LEAD' }),
    ).rejects.toBeInstanceOf(AuditEntryRefusedError);

    expect(await userRow(db, person.id)).toEqual(rowBefore);
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created']));

    await db.userService.update(by(), person.id, { name: 'Invented Late Both', role: 'LEAD' });
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.renamed', 'user.role_changed']));
  });

  it('user.role_changed: the role is unchanged and there is no role entry', async () => {
    const person = await db.userService.create(by(), newPerson('late.role'));
    const rowBefore = await userRow(db, person.id);

    await expect(failsLast().update(by(), person.id, { role: 'LEAD' })).rejects.toBe(LATE_FAILURE);

    expect(await userRow(db, person.id)).toEqual(rowBefore);
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created']));

    await db.userService.update(by(), person.id, { role: 'LEAD' });
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.role_changed']));
  });

  it('user.deactivated: the person is still active and there is no deactivation entry', async () => {
    const person = await db.userService.create(by(), newPerson('late.deactivated'));
    const rowBefore = await userRow(db, person.id);

    await expect(failsLast().update(by(), person.id, { isActive: false })).rejects.toBe(LATE_FAILURE);

    expect(await userRow(db, person.id)).toEqual(rowBefore);
    expect(rowBefore.is_active).toBe(true);
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created']));

    await db.userService.update(by(), person.id, { isActive: false });
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.deactivated']));
  });

  it('user.activated: the person is still deactivated and there is no activation entry', async () => {
    const person = await db.userService.create(by(), newPerson('late.activated'));
    await db.userService.update(by(), person.id, { isActive: false });
    const rowBefore = await userRow(db, person.id);
    expect(rowBefore.is_active).toBe(false);

    await expect(failsLast().update(by(), person.id, { isActive: true })).rejects.toBe(LATE_FAILURE);

    expect(await userRow(db, person.id)).toEqual(rowBefore);
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.deactivated']));

    await db.userService.update(by(), person.id, { isActive: true });
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.deactivated', 'user.activated']));
  });

  it('user.password_reset: the password, the sessions and the flag are unchanged and there is no reset entry', async () => {
    const person = await db.userService.create(by(), newPerson('late.reset'));
    // A person who has already set their own password, so a reset (which sets the flag back) would be seen.
    await db.owner.query('UPDATE users SET must_change_password = false WHERE id = $1', [person.id]);
    const credentialsBefore = await credentialsOf(person.id);

    await expect(failsLast().resetPassword(by(), person.id, 'invented-temporary-password-2')).rejects.toBe(LATE_FAILURE);

    expect(await credentialsOf(person.id)).toEqual(credentialsBefore);
    expect(credentialsBefore.must_change_password).toBe(false);
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created']));

    await db.userService.resetPassword(by(), person.id, 'invented-temporary-password-2');
    expect(await eventsOf(person.id)).toEqual(kinds(['user.created', 'user.password_reset']));
  });
});
