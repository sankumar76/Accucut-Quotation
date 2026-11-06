import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { contextOf, entriesFor, insertPersonAsOwner, newPerson, openAuditDatabase, userRow, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

/**
 * STORY-01.07 QLT-88 (AC-2, AC-3): the row lock that makes an entry's "before" the state a change really replaced, shown
 * without any timing luck. A second transaction takes the lock on a person and changes them; a user change on the same person is
 * started and must wait; only when the second transaction commits does the change go on, and it then finds the state the second
 * transaction left, not the state before it. Without `FOR UPDATE` the change reads the old state at once, sees nothing to do,
 * and writes no entry, so the test fails every time, not now and then. Real PostgreSQL; names are invented.
 */

const LOCK_POLL_MILLISECONDS = 25;
const LOCK_WAIT_LIMIT_MILLISECONDS = 10_000;

let db: AuditDatabase;
let adminId: string;

/**
 * Polls until a session of this database waits for a lock that has not been granted, so the test never guesses with a sleep.
 * It reads `pg_locks`, which every role may read in full: `pg_stat_activity` hides the wait of a session of another role (the
 * runtime role here, the owner there), and `pg_locks` names the session by its process ID.
 */
async function waitUntilAStatementWaitsOnALock(client: Client): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_LIMIT_MILLISECONDS;
  while (Date.now() < deadline) {
    const { rows } = await client.query<{ waiting: string }>(
      `SELECT count(*) AS waiting FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE NOT l.granted AND a.datname = current_database()`,
    );
    if (Number(rows[0]?.waiting) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MILLISECONDS));
  }
  throw new Error('No statement started waiting on a lock in time.');
}

const roleOf = z.strictObject({ role: z.enum(['ADMIN', 'LEAD', 'ENGINEER']) });

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('QLT-88: a change waits for the lock and then records the state the lock holder left', () => {
  it('holds a second transaction on the row: the change does not finish until it commits, and its "before" is the lock holder\'s result', async () => {
    const person = await db.userService.create(contextOf(adminId), newPerson('locked', 'ENGINEER'));

    const holding = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    // The second transaction: lock the person, make them a Lead directly (no entry: it is not the service), and hold on.
    const holder = db.transactions.run(async (tx) => {
      await db.users.findAccountForUpdate(person.id, tx);
      await db.users.update(person.id, { role: 'LEAD' }, tx);
      holding.resolve();
      await release.promise;
    });
    await holding.promise;

    // The change under test: back to Engineer. It starts while the lock is held.
    let finished = false;
    const change = db.userService.update(contextOf(adminId), person.id, { role: 'ENGINEER' }).then((result) => {
      finished = true;
      return result;
    });
    await waitUntilAStatementWaitsOnALock(db.owner);
    expect(finished).toBe(false);
    expect((await userRow(db, person.id)).role).toBe('ENGINEER');

    release.resolve();
    await holder;
    const updated = await change;
    expect(updated.role).toBe('ENGINEER');

    // Its entry says what it really replaced: Lead, which only the lock holder's committed work made so.
    const changes = (await entriesFor(db, person.id)).filter((entry) => entry.event === 'user.role_changed');
    expect(changes).toHaveLength(1);
    const entry = defined(changes[0]);
    expect(roleOf.parse(entry.before)).toEqual({ role: 'LEAD' });
    expect(roleOf.parse(entry.after)).toEqual({ role: 'ENGINEER' });
    expect((await userRow(db, person.id)).role).toBe('ENGINEER');
  });

  it('a lock holder that rolls back leaves the change to find the state it began with', async () => {
    const person = await db.userService.create(contextOf(adminId), newPerson('lock.rolled.back', 'ENGINEER'));
    const holding = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const abandoned = new Error('the lock holder gave up');
    const holder = db.transactions
      .run(async (tx) => {
        await db.users.findAccountForUpdate(person.id, tx);
        await db.users.update(person.id, { role: 'LEAD' }, tx);
        holding.resolve();
        await release.promise;
        throw abandoned;
      })
      .catch((error: unknown) => error);
    await holding.promise;

    const change = db.userService.update(contextOf(adminId), person.id, { role: 'LEAD' });
    await waitUntilAStatementWaitsOnALock(db.owner);
    release.resolve();
    expect(await holder).toBe(abandoned);
    await change;

    // The holder's Lead never happened, so the change found an Engineer and made them a Lead: Engineer to Lead.
    const changes = (await entriesFor(db, person.id)).filter((entry) => entry.event === 'user.role_changed');
    expect(changes.map((entry) => [roleOf.parse(entry.before).role, roleOf.parse(entry.after).role])).toEqual([['ENGINEER', 'LEAD']]);
  });
});
