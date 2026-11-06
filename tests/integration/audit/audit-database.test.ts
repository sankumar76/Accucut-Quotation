import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUserService } from '@/server/services/user-service';
import { decodeAuditCursor } from '@/server/services/audit-cursor';
import { AUDIT_EVENTS, wiredEvents, type AuditEventName } from '@/server/services/audit-events';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import { clientFor } from '@/server/repositories/transaction';

import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';
import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';

/**
 * STORY-01.07 T2, T3 and T6 (AC-2 to AC-6) against real PostgreSQL in a throwaway database: the audit service and the user
 * service over the real repositories and the real runtime role. What only a database can prove: that a rolled-back change takes
 * its entry with it and a committed one leaves exactly one; that every one of the five user events writes the right row; what
 * the stored JSON holds; that a later rename leaves an earlier entry alone; that the list pages through real rows by (time, ID).
 * Names and values are invented.
 */

const FIRST_PASSWORD = 'invented-first-password-1';
const REQUEST_ID = 'req-0a0b0c0d';

let db: AuditDatabase;
let adminId: string;

const by = (actorId: string = adminId) => ({ actorId, requestId: REQUEST_ID });

interface StoredEntry {
  readonly event: string;
  readonly actor_id: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_label: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly before_text: string | null;
  readonly after_text: string | null;
  readonly request_id: string;
  readonly created_at: Date;
}

async function entriesFor(objectId: string): Promise<ReadonlyArray<StoredEntry>> {
  const { rows } = await db.owner.query<StoredEntry>(
    `SELECT event, actor_id, object_type, object_id, object_label, before, after, before::text AS before_text, after::text AS after_text, request_id, created_at
     FROM audit_log WHERE object_id = $1 ORDER BY created_at, id`,
    [objectId],
  );
  return rows;
}

async function entryCount(): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
  return Number(rows[0]?.count);
}

async function userRow(id: string) {
  const { rows } = await db.owner.query<{ name: string; role: string; is_active: boolean; must_change_password: boolean }>(
    'SELECT name, role, is_active, must_change_password FROM users WHERE id = $1',
    [id],
  );
  return defined(rows[0], 'user row');
}

function newPerson(label: string, role: 'LEAD' | 'ENGINEER' = 'ENGINEER') {
  return { name: `Invented ${label}`, email: `${label}@example.test`, role, password: FIRST_PASSWORD } as const;
}

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-2: the entry and the change are one transaction', () => {
  it('a transaction that rolls back takes its entry with it', async () => {
    const before = await entryCount();
    const failure = new Error('the change failed after the entry was recorded');
    await expect(
      db.transactions.run(async (tx) => {
        await db.audit.record(tx, { event: 'user.created', actorId: adminId, requestId: REQUEST_ID, object: { id: adminId, label: 'Rolled Back' }, before: null, after: { role: 'LEAD', isActive: true } });
        // Inside the transaction the entry is there to this connection...
        const seen = await clientFor(db.prisma, tx).auditLog.count({ where: { objectLabel: 'Rolled Back' } });
        expect(seen).toBe(1);
        throw failure;
      }),
    ).rejects.toBe(failure);
    // ...and gone for everyone after the rollback.
    expect(await entryCount()).toBe(before);
    const { rows } = await db.owner.query("SELECT 1 FROM audit_log WHERE object_label = 'Rolled Back'");
    expect(rows).toEqual([]);
  });

  it('a transaction that commits leaves exactly one entry, and nobody else sees it before the commit', async () => {
    const before = await entryCount();
    let seenByAnotherConnection = -1;
    await db.transactions.run(async (tx) => {
      await db.audit.record(tx, { event: 'user.created', actorId: adminId, requestId: REQUEST_ID, object: { id: adminId, label: 'Committed' }, before: null, after: { role: 'LEAD', isActive: true } });
      seenByAnotherConnection = await entryCount();
    });
    expect(seenByAnotherConnection).toBe(before);
    expect(await entryCount()).toBe(before + 1);
    expect(await db.owner.query("SELECT 1 FROM audit_log WHERE object_label = 'Committed'").then((result) => result.rowCount)).toBe(1);
  });

  it('a handle is dead once its transaction has finished: it cannot reach the database again', async () => {
    let kept: Parameters<Parameters<typeof db.transactions.run>[0]>[0] | undefined;
    await db.transactions.run((tx) => {
      kept = tx;
      return Promise.resolve();
    });
    expect(() => clientFor(db.prisma, defined(kept))).toThrow('not opened by a TransactionRunner, or has finished');
    await expect(db.audit.record(defined(kept), { event: 'user.created', actorId: adminId, requestId: REQUEST_ID, object: { id: adminId, label: 'Late' }, before: null, after: { role: 'LEAD', isActive: true } })).rejects.toThrow();
  });

  it('a person change whose entry is refused is rolled back whole: the role is unchanged and there is no entry', async () => {
    const person = await db.userService.create(by(), newPerson('rollback.role', 'LEAD'));
    const entriesBefore = await entryCount();
    const failing = createUserService({
      users: db.users,
      throttles: db.throttles,
      hasher: createTestHasher(),
      transactions: db.transactions,
      audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')), list: db.audit.list },
      keySecret: 'invented-throttle-key-material',
    });
    await expect(failing.update(by(), person.id, { role: 'ENGINEER' })).rejects.toBeInstanceOf(AuditEntryRefusedError);
    expect((await userRow(person.id)).role).toBe('LEAD');
    expect(await entryCount()).toBe(entriesBefore);
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

describe('AC-3: one test per event type (the five wired events of the registry)', () => {
  /** One scenario for each wired event. The test below fails if the registry wires an event this table has no scenario for. */
  const SCENARIOS: Readonly<Record<string, () => Promise<{ readonly objectId: string; readonly label: string; readonly before: unknown; readonly after: unknown }>>> = {
    'user.created': async () => {
      const created = await db.userService.create(by(), newPerson('event.created', 'LEAD'));
      return { objectId: created.id, label: 'Invented event.created', before: null, after: { role: 'LEAD', isActive: true } };
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
    const mine = (await entriesFor(objectId)).filter((entry) => entry.event === event);
    expect(mine).toHaveLength(1);
    const entry = defined(mine[0]);
    expect(entry).toMatchObject({
      actor_id: adminId,
      object_type: AUDIT_EVENTS[event as AuditEventName].objectType,
      object_id: objectId,
      object_label: label,
      before,
      after,
      request_id: REQUEST_ID,
    });
    expect(entry.created_at).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - entry.created_at.getTime())).toBeLessThan(60_000);
  });

  it('a person created has a null before in the column, and the whole create is one entry', async () => {
    const created = await db.userService.create(by(), newPerson('column.null'));
    const entries = await entriesFor(created.id);
    expect(entries).toHaveLength(1);
    expect(defined(entries[0]).before_text).toBeNull();
  });

  it('a request that changes the role and deactivates raises two entries in one transaction', async () => {
    const person = await db.userService.create(by(), newPerson('two.events'));
    await db.userService.update(by(), person.id, { role: 'LEAD', isActive: false });
    expect((await entriesFor(person.id)).map((entry) => entry.event)).toEqual(['user.created', 'user.role_changed', 'user.deactivated']);
    expect(await userRow(person.id)).toMatchObject({ role: 'LEAD', is_active: false });
  });

  it('refused changes leave no entry: a second Admin, the own role, an unknown person', async () => {
    const before = await entryCount();
    await expect(db.userService.create(by(), { ...newPerson('second.admin'), role: 'ADMIN' })).rejects.toMatchObject({ httpStatus: 409 });
    await expect(db.userService.update(by(), adminId, { role: 'LEAD' })).rejects.toMatchObject({ httpStatus: 409 });
    await expect(db.userService.update(by(), '00000000-0000-4000-8000-0000000000ff', { role: 'LEAD' })).rejects.toMatchObject({ httpStatus: 404 });
    await expect(db.userService.resetPassword(by(), adminId, 'invented-temporary-password-2')).rejects.toMatchObject({ httpStatus: 409 });
    expect(await entryCount()).toBe(before);
  });

  it('two changes to the same person at once are serialised: each "before" is the state the change really found', async () => {
    const person = await db.userService.create(by(), newPerson('concurrent', 'ENGINEER'));
    await Promise.all([db.userService.update(by(), person.id, { role: 'LEAD' }), db.userService.update(by(), person.id, { role: 'ENGINEER' })]);
    const changes = (await entriesFor(person.id)).filter((entry) => entry.event === 'user.role_changed');
    // Whichever went first: a chain from ENGINEER, where each step starts where the one before ended, and it ends where the person is.
    let role = 'ENGINEER';
    for (const change of changes) {
      expect(change.before).toEqual({ role });
      role = (change.after as { role: string }).role;
    }
    expect((await userRow(person.id)).role).toBe(role);
  }, 30_000);
});

describe('AC-4: the stored JSON holds no password, no hash and no token', () => {
  it('after all five events, no stored before or after holds the password, an argon2 hash, or a key that names one', async () => {
    const person = await db.userService.create(by(), newPerson('secrets.check'));
    await db.userService.update(by(), person.id, { role: 'LEAD' });
    await db.userService.update(by(), person.id, { isActive: false });
    await db.userService.update(by(), person.id, { isActive: true });
    await db.userService.resetPassword(by(), person.id, 'invented-temporary-password-2');
    const entries = await entriesFor(person.id);
    expect(entries.map((entry) => entry.event)).toEqual(['user.created', 'user.role_changed', 'user.deactivated', 'user.activated', 'user.password_reset']);
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
    expect(defined((await entriesFor(created.id))[0]).object_label).toBe('Password Hash Tester');
  });
});

describe('AC-5: the label is the name at the time', () => {
  it('a rename later leaves the old entry with the old name, and a new entry carries the new one', async () => {
    const created = await db.userService.create(by(), newPerson('rename.me'));
    await db.userService.update(by(), created.id, { name: 'Invented Renamed Person' });
    await db.userService.update(by(), created.id, { role: 'LEAD' });
    const entries = await entriesFor(created.id);
    expect(entries.map((entry) => [entry.event, entry.object_label])).toEqual([
      ['user.created', 'Invented rename.me'],
      ['user.role_changed', 'Invented Renamed Person'],
    ]);
    expect((await userRow(created.id)).name).toBe('Invented Renamed Person');
  });

  it('a name changed in the database directly does not reach the entries that already exist', async () => {
    const created = await db.userService.create(by(), newPerson('rename.direct'));
    await db.owner.query("UPDATE users SET name = 'Someone Else Entirely' WHERE id = $1", [created.id]);
    const page = await db.audit.list({ limit: 200, who: adminId });
    const entry = defined(page.entries.find((candidate) => candidate.objectLabel === 'Invented rename.direct'));
    expect(entry.event).toBe('user.created');
  });
});

describe('AC-6: the list over real rows', () => {
  let leadId: string;
  const BASE = Date.parse('2030-01-10T06:00:00.000Z');

  /** Rows far in the future so that they sort above everything else, written by the owner with exact times. */
  async function insertAt(offsetMilliseconds: number, label: string, actor: string, event = 'user.created'): Promise<void> {
    await db.owner.query(
      `INSERT INTO audit_log (actor_id, event, object_type, object_id, object_label, before, after, request_id, created_at)
       VALUES ($1, $2, 'user', $1, $3, NULL, '{"role":"LEAD","isActive":true}'::jsonb, $4, $5)`,
      [actor, event, label, REQUEST_ID, new Date(BASE + offsetMilliseconds)],
    );
  }

  beforeAll(async () => {
    leadId = await insertPersonAsOwner(db, 'Lead', 'LEAD');
    await insertAt(0, 'Row A', adminId);
    await insertAt(1_000, 'Row B', leadId);
    // Three rows in the same millisecond: only the ID separates them.
    await insertAt(2_000, 'Row C1', adminId);
    await insertAt(2_000, 'Row C2', adminId);
    await insertAt(2_000, 'Row C3', adminId);
    await insertAt(3_000, 'Row D', adminId, 'user.deactivated');
  });

  const from = '2030-01-10';
  const labels = (page: { readonly entries: ReadonlyArray<{ readonly objectLabel: string }> }) => page.entries.map((entry) => entry.objectLabel);

  it('lists newest first, with the total and the name of who made each change', async () => {
    const page = await db.audit.list({ limit: 200, from });
    expect(page.total).toBe(6);
    expect(labels(page).at(0)).toBe('Row D');
    expect(labels(page).at(-1)).toBe('Row A');
    expect(page.entries.find((entry) => entry.objectLabel === 'Row B')).toMatchObject({ who: 'Invented Lead', createdAt: '2030-01-10T06:00:01.000Z' });
  });

  it('filters by who, by event, by category and by day in IST', async () => {
    expect(labels(await db.audit.list({ limit: 200, from, who: leadId }))).toEqual(['Row B']);
    expect(labels(await db.audit.list({ limit: 200, from, event: 'user.deactivated' }))).toEqual(['Row D']);
    expect((await db.audit.list({ limit: 200, from, category: 'user_change' })).total).toBe(6);
    expect((await db.audit.list({ limit: 200, from, category: 'approval' })).total).toBe(0);
    // 06:00 UTC is 11:30 IST on 10 January: it is in the IST day 10 January and not in 9 January or 11 January.
    expect((await db.audit.list({ limit: 200, from: '2030-01-10', to: '2030-01-10' })).total).toBe(6);
    expect((await db.audit.list({ limit: 200, from: '2030-01-11' })).total).toBe(0);
    expect((await db.audit.list({ limit: 200, from: '2030-01-09', to: '2030-01-09' })).total).toBe(0);
  });

  it('pages through every row, including rows of the same millisecond, with no gap and no repeat, and a total that stays whole', async () => {
    const seen: string[] = [];
    let cursor: ReturnType<typeof decodeAuditCursor> | undefined;
    let pages = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await db.audit.list({ limit: 2, from, ...(cursor === undefined || cursor === null ? {} : { cursor }) });
      pages += 1;
      expect(page.total).toBe(6);
      seen.push(...labels(page));
      if (page.nextCursor === null) break;
      cursor = decodeAuditCursor(page.nextCursor);
    }
    expect(pages).toBe(3);
    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
    expect([...seen].sort()).toEqual(['Row A', 'Row B', 'Row C1', 'Row C2', 'Row C3', 'Row D']);
  });

  it('gives the same order twice, so a page can be asked for again', async () => {
    const first = labels(await db.audit.list({ limit: 200, from }));
    const second = labels(await db.audit.list({ limit: 200, from }));
    expect(second).toEqual(first);
  });

  it('keeps the limit: a page never holds more than was asked for', async () => {
    expect((await db.audit.list({ limit: 1, from })).entries).toHaveLength(1);
  });
});
