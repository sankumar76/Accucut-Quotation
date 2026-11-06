import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { decodeAuditCursor } from '@/server/services/audit-cursor';

import { AUDIT_REQUEST_ID, contextOf, entriesFor, insertPersonAsOwner, newPerson, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

/**
 * STORY-01.07 T4 and T6 (AC-6) against real PostgreSQL: the list over real rows, newest first, filtered, paged by (time, ID),
 * with the total; and the Who column, which shows the name the actor had when they made the change (`actor_label`) while the
 * Who filter finds a person by their ID. Rows are written by the owner with exact times far in the future, so they sort above
 * anything else. Names are invented.
 */

const BASE = Date.parse('2030-01-10T06:00:00.000Z');
const FROM = '2030-01-10';

let db: AuditDatabase;
let adminId: string;
let leadId: string;

/** One entry by `actor` (shown as `actorName`), `offsetMilliseconds` after the base time. */
async function insertAt(offsetMilliseconds: number, label: string, actor: string, actorName: string, event = 'user.created'): Promise<void> {
  await db.owner.query(
    `INSERT INTO audit_log (actor_id, actor_label, event, object_type, object_id, object_label, before, after, request_id, created_at)
     VALUES ($1, $2, $3, 'user', $1, $4, NULL, '{"role":"LEAD","isActive":true}'::jsonb, $5, $6)`,
    [actor, actorName, event, label, AUDIT_REQUEST_ID, new Date(BASE + offsetMilliseconds)],
  );
}

const labels = (page: { readonly entries: ReadonlyArray<{ readonly objectLabel: string }> }) => page.entries.map((entry) => entry.objectLabel);

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  leadId = await insertPersonAsOwner(db, 'Lead', 'LEAD');
  await insertAt(0, 'Row A', adminId, 'Invented Admin');
  await insertAt(1_000, 'Row B', leadId, 'Invented Lead');
  // Three rows in the same millisecond: only the ID separates them.
  await insertAt(2_000, 'Row C1', adminId, 'Invented Admin');
  await insertAt(2_000, 'Row C2', adminId, 'Invented Admin');
  await insertAt(2_000, 'Row C3', adminId, 'Invented Admin');
  await insertAt(3_000, 'Row D', adminId, 'Invented Admin', 'user.deactivated');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-6: the list over real rows', () => {
  it('lists newest first, with the total and the name each actor had at the time', async () => {
    const page = await db.audit.list({ limit: 200, from: FROM });
    expect(page.total).toBe(6);
    expect(labels(page).at(0)).toBe('Row D');
    expect(labels(page).at(-1)).toBe('Row A');
    expect(page.entries.find((entry) => entry.objectLabel === 'Row B')).toMatchObject({ who: 'Invented Lead', createdAt: '2030-01-10T06:00:01.000Z' });
  });

  it('filters by who, by event, by category and by day in IST', async () => {
    expect(labels(await db.audit.list({ limit: 200, from: FROM, who: leadId }))).toEqual(['Row B']);
    expect(labels(await db.audit.list({ limit: 200, from: FROM, event: 'user.deactivated' }))).toEqual(['Row D']);
    expect((await db.audit.list({ limit: 200, from: FROM, category: 'user_change' })).total).toBe(6);
    expect((await db.audit.list({ limit: 200, from: FROM, category: 'approval' })).total).toBe(0);
    // 06:00 UTC is 11:30 IST on 10 January: it is in the IST day 10 January and not in 9 January or 11 January.
    expect((await db.audit.list({ limit: 200, from: FROM, to: FROM })).total).toBe(6);
    expect((await db.audit.list({ limit: 200, from: '2030-01-11' })).total).toBe(0);
    expect((await db.audit.list({ limit: 200, from: '2030-01-09', to: '2030-01-09' })).total).toBe(0);
  });

  it('pages through every row, including rows of the same millisecond, with no gap and no repeat, and a total that stays whole', async () => {
    const seen: string[] = [];
    let cursor: ReturnType<typeof decodeAuditCursor> | undefined;
    let pages = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await db.audit.list({ limit: 2, from: FROM, ...(cursor === undefined || cursor === null ? {} : { cursor }) });
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
    const first = labels(await db.audit.list({ limit: 200, from: FROM }));
    const second = labels(await db.audit.list({ limit: 200, from: FROM }));
    expect(second).toEqual(first);
  });

  it('keeps the limit: a page never holds more than was asked for', async () => {
    expect((await db.audit.list({ limit: 1, from: FROM })).entries).toHaveLength(1);
  });

  it('an actor with no entries gives an empty page and a total of zero, not an error', async () => {
    const nobody = await insertPersonAsOwner(db, 'Nobody Acted', 'ENGINEER');
    expect(await db.audit.list({ limit: 50, who: nobody })).toEqual({ entries: [], total: 0, nextCursor: null });
  });
});

describe('AC-6: the Who column is the name at the time, and the Who filter is the person', () => {
  it('after a rename an earlier entry still shows the old name in Who, a later one shows the new name, and filtering by the person finds both', async () => {
    const person = await insertPersonAsOwner(db, 'Arjun Rai', 'LEAD');
    // Arjun makes a change under his name at the time (a person added by him, so the entry is a real one).
    await db.userService.create(contextOf(person, 'Invented Arjun Rai'), newPerson('made.by.arjun'));
    // The Admin renames him, as the Users screen does.
    await db.userService.update(contextOf(adminId, 'Invented Admin'), person, { name: 'Invented Arjun Rao' });
    await db.userService.create(contextOf(person, 'Invented Arjun Rao'), newPerson('made.by.arjun.later'));

    const byArjun = await db.audit.list({ limit: 50, who: person });
    expect(byArjun.entries.map((entry) => [entry.objectLabel, entry.who])).toEqual([
      ['Invented made.by.arjun.later', 'Invented Arjun Rao'],
      ['Invented made.by.arjun', 'Invented Arjun Rai'],
    ]);
    expect(byArjun.total).toBe(2);

    // The rename itself was made by the Admin, about him: Who is the Admin, Object is the new name, old to new in the words.
    const rename = defined((await db.audit.list({ limit: 50, event: 'user.renamed' })).entries.find((entry) => entry.objectLabel === 'Invented Arjun Rao'));
    expect(rename).toMatchObject({ who: 'Invented Admin', change: { before: 'Invented Arjun Rai', after: 'Invented Arjun Rao' } });
    expect(await entriesFor(db, person)).toHaveLength(1);
  });
});
