import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUserService } from '@/server/services/user-service';
import { AUDIT_EVENTS, isAuditEventName, wiredEvents } from '@/server/services/audit-events';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import { clientFor } from '@/server/repositories/transaction';

import {
  ADMIN_NAME,
  AUDIT_REQUEST_ID,
  contextOf,
  entriesFor,
  entryCount,
  FIRST_PASSWORD,
  insertPersonAsOwner,
  newPerson,
  openAuditDatabase,
  userRow,
  type AuditDatabase,
} from '../../support/audit-database';
import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-01.07 T2, T3 and T6 (AC-2 to AC-6) against real PostgreSQL in a throwaway database: the audit service and the user
 * service over the real repositories and the real runtime role. What only a database can prove: that a rolled-back change takes
 * its entry with it and a committed one leaves exactly one; that every one of the six user events writes the right row; what
 * the stored JSON holds; that a later rename leaves an earlier entry alone. The list over real rows is `audit-list-database`,
 * and the row lock is `audit-lock`. Names and values are invented.
 */

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-2: the entry and the change are one transaction', () => {
  it('a transaction that rolls back takes its entry with it', async () => {
    const before = await entryCount(db);
    const failure = new Error('the change failed after the entry was recorded');
    await expect(
      db.transactions.run(async (tx) => {
        await db.audit.record(tx, { event: 'user.created', actorId: adminId, actorLabel: ADMIN_NAME, requestId: AUDIT_REQUEST_ID, object: { id: adminId, label: 'Rolled Back' }, before: null, after: { role: 'LEAD', isActive: true } });
        // Inside the transaction the entry is there to this connection...
        const seen = await clientFor(db.prisma, tx).auditLog.count({ where: { objectLabel: 'Rolled Back' } });
        expect(seen).toBe(1);
        throw failure;
      }),
    ).rejects.toBe(failure);
    // ...and gone for everyone after the rollback.
    expect(await entryCount(db)).toBe(before);
    const { rows } = await db.owner.query("SELECT 1 FROM audit_log WHERE object_label = 'Rolled Back'");
    expect(rows).toEqual([]);
  });

  it('a transaction that commits leaves exactly one entry, and nobody else sees it before the commit', async () => {
    const before = await entryCount(db);
    let seenByAnotherConnection = -1;
    await db.transactions.run(async (tx) => {
      await db.audit.record(tx, { event: 'user.created', actorId: adminId, actorLabel: ADMIN_NAME, requestId: AUDIT_REQUEST_ID, object: { id: adminId, label: 'Committed' }, before: null, after: { role: 'LEAD', isActive: true } });
      seenByAnotherConnection = await entryCount(db);
    });
    expect(seenByAnotherConnection).toBe(before);
    expect(await entryCount(db)).toBe(before + 1);
    expect(await db.owner.query("SELECT 1 FROM audit_log WHERE object_label = 'Committed'").then((result) => result.rowCount)).toBe(1);
  });

  it('a handle is dead once its transaction has finished: it cannot reach the database again', async () => {
    let kept: Parameters<Parameters<typeof db.transactions.run>[0]>[0] | undefined;
    await db.transactions.run((tx) => {
      kept = tx;
      return Promise.resolve();
    });
    expect(() => clientFor(db.prisma, defined(kept))).toThrow('not opened by a TransactionRunner, or has finished');
    await expect(db.audit.record(defined(kept), { event: 'user.created', actorId: adminId, actorLabel: ADMIN_NAME, requestId: AUDIT_REQUEST_ID, object: { id: adminId, label: 'Late' }, before: null, after: { role: 'LEAD', isActive: true } })).rejects.toThrow();
  });

  it('a person change whose entry is refused is rolled back whole: the role is unchanged and there is no entry', async () => {
    const person = await db.userService.create(by(), newPerson('rollback.role', 'LEAD'));
    const entriesBefore = await entryCount(db);
    const failing = createUserService({
      users: db.users,
      throttles: db.throttles,
      hasher: createTestHasher(),
      transactions: db.transactions,
      audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')), list: db.audit.list },
      keySecret: 'invented-throttle-key-material',
    });
    await expect(failing.update(by(), person.id, { role: 'ENGINEER' })).rejects.toBeInstanceOf(AuditEntryRefusedError);
    expect((await userRow(db, person.id)).role).toBe('LEAD');
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it('a creation whose entry is refused leaves no person behind', async () => {
    const failing = createUserService({
      users: db.users,
      throttles: db.throttles,
      hasher: createTestHasher(),
      transactions: db.transactions,
      audit: { record: () => Promise.reject(new AuditEntryRefusedError('secret', 'after.x')), list: db.audit.list },
      keySecret: 'invented-throttle-key-material',
    });
    await expect(failing.create(by(), newPerson('never.added'))).rejects.toBeInstanceOf(AuditEntryRefusedError);
    const { rows } = await db.owner.query("SELECT 1 FROM users WHERE email = 'never.added@example.test'");
    expect(rows).toEqual([]);
  });

  it('a password reset whose entry is refused leaves the old password in place and the person\'s sessions alone', async () => {
    const person = await db.userService.create(by(), newPerson('rollback.reset'));
    const { rows: beforeRows } = await db.owner.query<{ password_hash: string; session_version: number; must_change_password: boolean }>(
      'SELECT password_hash, session_version, must_change_password FROM users WHERE id = $1',
      [person.id],
    );
    await db.owner.query('UPDATE users SET must_change_password = false WHERE id = $1', [person.id]);
    const failing = createUserService({
      users: db.users,
      throttles: db.throttles,
      hasher: createTestHasher(),
      transactions: db.transactions,
      audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'before')), list: db.audit.list },
      keySecret: 'invented-throttle-key-material',
    });
    await expect(failing.resetPassword(by(), person.id, 'invented-temporary-password-2')).rejects.toBeInstanceOf(AuditEntryRefusedError);
    const { rows: afterRows } = await db.owner.query<{ password_hash: string; session_version: number; must_change_password: boolean }>(
      'SELECT password_hash, session_version, must_change_password FROM users WHERE id = $1',
      [person.id],
    );
    expect(afterRows[0]).toEqual({ ...defined(beforeRows[0]), must_change_password: false });
  });
});

describe('AC-3: one test per event type (the six wired events of the registry)', () => {
  /** One scenario for each wired event. The test below fails if the registry wires an event this table has no scenario for. */
  const SCENARIOS: Readonly<Record<string, () => Promise<{ readonly objectId: string; readonly label: string; readonly before: unknown; readonly after: unknown }>>> = {
    'user.created': async () => {
      const created = await db.userService.create(by(), newPerson('event.created', 'LEAD'));
      return { objectId: created.id, label: 'Invented event.created', before: null, after: { role: 'LEAD', isActive: true } };
    },
    'user.renamed': async () => {
      const person = await db.userService.create(by(), newPerson('event.renamed'));
      await db.userService.update(by(), person.id, { name: 'Invented Event Renamed Two' });
      return { objectId: person.id, label: 'Invented Event Renamed Two', before: { name: 'Invented event.renamed' }, after: { name: 'Invented Event Renamed Two' } };
    },
    'user.role_changed': async () => {
      const person = await db.userService.create(by(), newPerson('event.role'));
      await db.userService.update(by(), person.id, { role: 'LEAD' });
      return { objectId: person.id, label: 'Invented event.role', before: { role: 'ENGINEER' }, after: { role: 'LEAD' } };
    },
    'user.deactivated': async () => {
      const person = await db.userService.create(by(), newPerson('event.deactivated'));
      await db.userService.update(by(), person.id, { isActive: false });
      return { objectId: person.id, label: 'Invented event.deactivated', before: { isActive: true }, after: { isActive: false } };
    },
    'user.activated': async () => {
      const person = await db.userService.create(by(), newPerson('event.activated'));
      await db.userService.update(by(), person.id, { isActive: false });
      await db.userService.update(by(), person.id, { isActive: true });
      return { objectId: person.id, label: 'Invented event.activated', before: { isActive: false }, after: { isActive: true } };
    },
    'user.password_reset': async () => {
      const person = await db.userService.create(by(), newPerson('event.reset'));
      await db.userService.resetPassword(by(), person.id, 'invented-temporary-password-2');
      return { objectId: person.id, label: 'Invented event.reset', before: { mustChangePassword: true }, after: { mustChangePassword: true } };
    },
  };

  it('has a scenario for every event the registry wires, and for no other', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual([...wiredEvents()].sort());
  });

  it.each(Object.keys(SCENARIOS))('%s creates exactly one entry of its kind, with every part, committed with the change', async (event) => {
    const scenario = defined(SCENARIOS[event]);
    const { objectId, label, before, after } = await scenario();
    const mine = (await entriesFor(db, objectId)).filter((entry) => entry.event === event);
    expect(mine).toHaveLength(1);
    const entry = defined(mine[0]);
    const definition = isAuditEventName(event) ? AUDIT_EVENTS[event] : undefined;
    expect(entry).toMatchObject({
      actor_id: adminId,
      actor_label: ADMIN_NAME,
      object_type: defined(definition).objectType,
      object_id: objectId,
      object_label: label,
      before,
      after,
      request_id: AUDIT_REQUEST_ID,
    });
    expect(entry.created_at).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - entry.created_at.getTime())).toBeLessThan(60_000);
  });

  it('a person created has a null before in the column, and the whole create is one entry', async () => {
    const created = await db.userService.create(by(), newPerson('column.null'));
    const entries = await entriesFor(db, created.id);
    expect(entries).toHaveLength(1);
    expect(defined(entries[0]).before_text).toBeNull();
  });

  it('a request that changes the role and deactivates raises two entries in one transaction', async () => {
    const person = await db.userService.create(by(), newPerson('two.events'));
    await db.userService.update(by(), person.id, { role: 'LEAD', isActive: false });
    expect((await entriesFor(db, person.id)).map((entry) => entry.event)).toEqual(['user.created', 'user.role_changed', 'user.deactivated']);
    expect(await userRow(db, person.id)).toMatchObject({ role: 'LEAD', is_active: false });
  });

  it('refused changes leave no entry: a second Admin, the own role, an unknown person', async () => {
    const before = await entryCount(db);
    await expect(db.userService.create(by(), { ...newPerson('second.admin'), role: 'ADMIN' })).rejects.toMatchObject({ httpStatus: 409 });
    await expect(db.userService.update(by(), adminId, { role: 'LEAD' })).rejects.toMatchObject({ httpStatus: 409 });
    await expect(db.userService.update(by(), '00000000-0000-4000-8000-0000000000ff', { role: 'LEAD' })).rejects.toMatchObject({ httpStatus: 404 });
    await expect(db.userService.resetPassword(by(), adminId, 'invented-temporary-password-2')).rejects.toMatchObject({ httpStatus: 409 });
    expect(await entryCount(db)).toBe(before);
  });

  it('a name plus a role in one save writes two entries in one transaction, both under the new name; nothing changed writes none', async () => {
    const person = await db.userService.create(by(), newPerson('name.and.role'));
    await db.userService.update(by(), person.id, { name: 'Invented Both Changed', role: 'LEAD' });
    const afterBoth = await entriesFor(db, person.id);
    expect(afterBoth.map((entry) => [entry.event, entry.object_label])).toEqual([
      ['user.created', 'Invented name.and.role'],
      ['user.renamed', 'Invented Both Changed'],
      ['user.role_changed', 'Invented Both Changed'],
    ]);
    await db.userService.update(by(), person.id, { name: 'Invented Both Changed', role: 'LEAD', isActive: true });
    expect(await entriesFor(db, person.id)).toHaveLength(3);
  });

  it('a name-only save writes exactly one user.renamed entry, holding the old and the new name and nothing else', async () => {
    const person = await db.userService.create(by(), newPerson('name.only'));
    await db.userService.update(by(), person.id, { name: 'Invented Name Only Two' });
    const renamed = (await entriesFor(db, person.id)).filter((entry) => entry.event === 'user.renamed');
    expect(renamed).toHaveLength(1);
    expect(defined(renamed[0])).toMatchObject({ before: { name: 'Invented name.only' }, after: { name: 'Invented Name Only Two' } });
  });

  it('a rename that is rolled back writes no entry and leaves the name (AC-2)', async () => {
    const person = await db.userService.create(by(), newPerson('rename.rollback'));
    const failing = createUserService({
      users: db.users,
      throttles: db.throttles,
      hasher: createTestHasher(),
      transactions: db.transactions,
      audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')), list: db.audit.list },
      keySecret: 'invented-throttle-key-material',
    });
    await expect(failing.update(by(), person.id, { name: 'Invented Never Saved' })).rejects.toBeInstanceOf(AuditEntryRefusedError);
    expect((await userRow(db, person.id)).name).toBe('Invented rename.rollback');
    expect(await entriesFor(db, person.id)).toHaveLength(1);
  });
});

describe('AC-4: the stored JSON holds no password, no hash and no token', () => {
  it('after all six events, no stored before or after holds the password, an argon2 hash, or a key that names one', async () => {
    const person = await db.userService.create(by(), newPerson('secrets.check'));
    await db.userService.update(by(), person.id, { name: 'Invented Secrets Renamed' });
    await db.userService.update(by(), person.id, { role: 'LEAD' });
    await db.userService.update(by(), person.id, { isActive: false });
    await db.userService.update(by(), person.id, { isActive: true });
    await db.userService.resetPassword(by(), person.id, 'invented-temporary-password-2');
    const entries = await entriesFor(db, person.id);
    expect(entries.map((entry) => entry.event)).toEqual(['user.created', 'user.renamed', 'user.role_changed', 'user.deactivated', 'user.activated', 'user.password_reset']);
    for (const entry of entries) {
      const stored = `${entry.before_text ?? ''} ${entry.after_text ?? ''}`;
      expect(stored).not.toContain(FIRST_PASSWORD);
      expect(stored).not.toContain('invented-temporary-password-2');
      expect(stored).not.toContain('$argon2');
      expect(stored.toLowerCase()).not.toMatch(/passwordhash|password_hash|"password"|"token"|"hash"|"secret"/);
    }
    // And no entry at all, for anyone, holds a hash of anyone's password.
    const { rows } = await db.owner.query("SELECT count(*) FROM audit_log WHERE before::text LIKE '%argon2%' OR after::text LIKE '%argon2%'");
    expect(rows[0]).toEqual({ count: '0' });
  });

  it('a name that says "password" or "hash" as plain text is recorded as it is', async () => {
    const created = await db.userService.create(by(), { ...newPerson('plain.words'), name: 'Password Hash Tester' });
    expect(defined((await entriesFor(db, created.id))[0]).object_label).toBe('Password Hash Tester');
  });
});

describe('AC-5: the label is the name at the time', () => {
  it('a rename later leaves the old entry with the old name, and a new entry carries the new one', async () => {
    const created = await db.userService.create(by(), newPerson('rename.me'));
    await db.userService.update(by(), created.id, { name: 'Invented Renamed Person' });
    await db.userService.update(by(), created.id, { role: 'LEAD' });
    const entries = await entriesFor(db, created.id);
    expect(entries.map((entry) => [entry.event, entry.object_label])).toEqual([
      ['user.created', 'Invented rename.me'],
      ['user.renamed', 'Invented Renamed Person'],
      ['user.role_changed', 'Invented Renamed Person'],
    ]);
    expect((await userRow(db, created.id)).name).toBe('Invented Renamed Person');
  });

  it('a self-rename: the entry names the Admin as they were (Who) and as they are now (Object)', async () => {
    const selfAdmin = await insertPersonAsOwner(db, 'Self Renamer', 'LEAD');
    await db.userService.update(contextOf(selfAdmin, 'Invented Self Renamer'), selfAdmin, { name: 'Invented Self Renamed' });
    const entry = defined((await entriesFor(db, selfAdmin))[0]);
    expect(entry).toMatchObject({ event: 'user.renamed', actor_id: selfAdmin, actor_label: 'Invented Self Renamer', object_id: selfAdmin, object_label: 'Invented Self Renamed' });
  });

  it('a name changed in the database directly does not reach the entries that already exist', async () => {
    const created = await db.userService.create(by(), newPerson('rename.direct'));
    await db.owner.query("UPDATE users SET name = 'Someone Else Entirely' WHERE id = $1", [created.id]);
    const page = await db.audit.list({ limit: 200, who: adminId });
    const entry = defined(page.entries.find((candidate) => candidate.objectLabel === 'Invented rename.direct'));
    expect(entry.event).toBe('user.created');
  });
});
