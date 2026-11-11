import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { contextOf, entriesFor, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createServiceHoldingBeforeCommit } from '../../support/hold-before-commit';
import { OTHER_TREATMENT_ID } from '../../support/treatment-canary';

/**
 * STORY-02.05, QLT-03 of the G6 (NFR-007; architecture section 6, PRF-01): two changes of one treatment are SERIALISED, so the audit entry of the second
 * keeps a `before` that is the state the first one left. The table lock (`LOCK TABLE ... SHARE ROW EXCLUSIVE`) and the row lock (`FOR UPDATE`) are what do it,
 * and the first version of the tests passed with both removed (control PR 206): a rename that runs after a delete fails on a missing row whether a lock is held
 * or not.
 *
 * How it is made to depend on the locks. The first change runs through a service whose transaction waits, uncommitted, after its work is done
 * (`createServiceHoldingBeforeCommit`). The second change is started meanwhile. With the locks, it waits for them before it reads anything, and reads the
 * first one's result after the commit. Without them, it reads the stored name at once (the first change is not committed, so it still sees the old one) and
 * waits only on the row the first one updated: its `before` is then a name that was already replaced. The test lets the first transaction go only after the
 * second one is seen waiting for a lock (or has finished), so the second has certainly read, or certainly could not.
 *
 * It is a file of its own: `treatments.test.ts` is at its line limit. Names are invented.
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

afterEach(async () => {
  await db.owner.query('DELETE FROM treatments WHERE id <> $1::uuid', [OTHER_TREATMENT_ID]);
});

/** Is any session of this database waiting for a lock? `pg_locks` is readable by every role, and so are the process IDs of `pg_stat_activity`. */
async function someoneIsWaitingForALock(): Promise<boolean> {
  const { rows } = await db.owner.query<{ waiting: number }>(
    `SELECT count(*)::int AS waiting FROM pg_locks l
     WHERE NOT l.granted AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())`,
  );
  return defined(rows[0]).waiting > 0;
}

describe('AC-6, NFR-007 (T2): a second change waits for the first, so its audit "before" is the first one\'s "after"', () => {
  it.each([
    ['a second rename', 'master.edited', (id: string) => db.mastersService.updateTreatment(by(), id, { name: 'Chain-second' })],
    ['a delete', 'master.deleted', (id: string) => db.mastersService.deleteTreatment(by(), id)],
  ] as const)('%s started while the first rename is still open', async (_what, secondEvent, startSecond) => {
    const created = await db.mastersService.createTreatment(by(), { name: 'Chain-start' });
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reachedHolding: () => void = () => undefined;
    const isHolding = new Promise<void>((resolve) => {
      reachedHolding = resolve;
    });

    const first = createServiceHoldingBeforeCommit(db, hold, reachedHolding).updateTreatment(by(), created.id, { name: 'Chain-first' });
    // If the first change fails before it holds, the race rejects with its error and the test says why.
    await Promise.race([isHolding, first]);

    let secondDone = false;
    const second = startSecond(created.id).finally(() => {
      secondDone = true;
    });
    // The second change has either finished (nothing made it wait) or is waiting for a lock the first one holds. Only then is the first one let go.
    await expect.poll(async () => secondDone || (await someoneIsWaitingForALock()), { message: 'the second change waits for a lock, or has finished' }).toBe(true);
    release();
    await Promise.all([first, second]);

    const entries = await entriesFor(db, created.id);
    const firstEntry = defined(entries.find((entry) => entry.event === 'master.edited' && isNamed(entry.after, 'Chain-first')));
    const secondEntry = defined(entries.find((entry) => entry.event === secondEvent && entry !== firstEntry));
    expect(secondEntry.before, 'the second entry starts from the state the first one left').toEqual(firstEntry.after);
    expect(entries.filter((entry) => entry.event !== 'master.created')).toHaveLength(2);
  });
});

/** Is this stored JSON `{ name }` with this name? */
function isNamed(state: unknown, name: string): boolean {
  return typeof state === 'object' && state !== null && 'name' in state && state.name === name;
}
