import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { decodeAuditCursor } from '@/server/services/audit-cursor';

import { AUDIT_REQUEST_ID, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

/**
 * STORY-08.07 (AC-1 to AC-4, AC-7, AC-8) against real PostgreSQL: the history of configuration changes is the audit log with the "Configuration change"
 * category. The four kinds are written through the real audit service and read back with their kind and their words; the Who filter finds a person by ID;
 * the day boundaries are the IST ones (an entry at 23:30 IST on the 4th is on the 4th); 120 entries page by cursor; a formula of 2,000 characters
 * survives the round trip; and an entry cannot be changed or removed by the runtime role or by the owner. A throwaway database, because the audit table
 * cannot be emptied. Every name and formula is invented.
 */

const BASE = Date.parse('2031-03-01T00:00:00.000Z');
const LONG_FORMULA = `P * ${'Invented-Rate '.repeat(150)}`.trim().slice(0, 2_000);
const PERMISSION_DENIED = '42501';
const INTEGRITY_VIOLATION = '23000';

let db: AuditDatabase;
let adminOne: string;
let adminTwo: string;

/** One formula-change entry by `actor`, at an exact instant (written by the owner, as the list tests do; the shapes are the event's own). */
async function insertFormulaChange(at: string, actor: string, actorName: string, label: string, formula = 'P'): Promise<void> {
  await db.owner.query(
    `INSERT INTO audit_log (actor_id, actor_label, event, object_type, object_id, object_label, before, after, request_id, created_at)
     VALUES ($1, $2, 'config.formula_changed', 'field', $1, $3, $4::jsonb, $5::jsonb, $6, $7)`,
    [actor, actorName, label, JSON.stringify({ formula }), JSON.stringify({ formula: `${formula} * 2`, version: 3 }), AUDIT_REQUEST_ID, new Date(at)],
  );
}

const labels = (page: { readonly entries: ReadonlyArray<{ readonly objectLabel: string }> }): string[] => page.entries.map((entry) => entry.objectLabel);

beforeAll(async () => {
  db = await openAuditDatabase();
  adminOne = await insertPersonAsOwner(db, 'Admin One', 'ADMIN');
  adminTwo = await insertPersonAsOwner(db, 'Admin Two', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-1, AC-2, AC-4: every kind of configuration entry, written through the audit service, reads back with its kind and its words', () => {
  it('lists the formula edit, the field insert, the field delete and the revert, in the category "Configuration change"', async () => {
    const context = { actorId: adminOne, actorLabel: 'Invented Admin One', requestId: AUDIT_REQUEST_ID };
    await db.transactions.run(async (tx) => {
      await db.audit.record(tx, { ...context, event: 'config.formula_changed', object: { id: adminOne, label: 'AL Cutting Cost' }, before: { formula: 'P * 3' }, after: { formula: 'P * 4', version: 12 } });
      await db.audit.record(tx, {
        ...context,
        event: 'config.field_inserted',
        object: { id: adminOne, label: 'AY Invented Notch Count' },
        before: null,
        after: { fields: [{ letter: 'AY', label: 'Invented Notch Count', kind: 'input', follows: 'AX', formula: null }], moved: [{ from: 'AY', to: 'BO', by: 1 }], version: 13 },
      });
      await db.audit.record(tx, {
        ...context,
        event: 'config.field_deleted',
        object: { id: adminOne, label: 'AY Invented Notch Count' },
        before: { letter: 'AY', label: 'Invented Notch Count', kind: 'input', formula: null },
        after: { moved: [{ from: 'AZ', to: 'BP', by: 1 }], version: 14 },
      });
      await db.audit.record(tx, {
        ...context,
        event: 'config.reverted',
        object: { id: adminOne, label: 'Checkpoint "Before AY insert"' },
        before: { version: 8 },
        after: { version: 9, copiedFrom: 7 },
      });
    });
    const page = await db.audit.list({ limit: 50, category: 'config_change' });
    const byEvent = new Map(page.entries.map((entry) => [entry.event, entry]));
    expect([...byEvent.keys()].sort()).toEqual(['config.field_deleted', 'config.field_inserted', 'config.formula_changed', 'config.reverted']);
    expect(byEvent.get('config.formula_changed')).toMatchObject({ kindLabel: 'Formula edit', who: 'Invented Admin One', objectLabel: 'AL Cutting Cost', change: { before: 'P * 3', after: 'P * 4 (configuration version 12)' } });
    expect(byEvent.get('config.field_inserted')).toMatchObject({ kindLabel: 'Field insert', change: { before: 'Not in the worksheet' } });
    expect(byEvent.get('config.field_deleted')).toMatchObject({ kindLabel: 'Field delete', change: { before: 'Column AY, Invented Notch Count' } });
    expect(byEvent.get('config.reverted')).toMatchObject({
      kindLabel: 'Checkpoint revert',
      objectLabel: 'Checkpoint "Before AY insert"',
      change: { before: 'Version 8', after: 'Version 9 (from version 7)' },
    });
    for (const entry of page.entries) expect(entry.category).toEqual({ id: 'config_change', label: 'Configuration change' });
  });

  it('keeps a formula of 2,000 characters whole, before and after', async () => {
    await insertFormulaChange('2031-02-01T06:00:00.000Z', adminOne, 'Invented Admin One', 'AL Long Formula', LONG_FORMULA);
    const page = await db.audit.list({ limit: 50, category: 'config_change', from: '2031-02-01', to: '2031-02-01' });
    expect(page.entries).toHaveLength(1);
    expect(defined(page.entries[0]).change).toEqual({ before: LONG_FORMULA, after: `${LONG_FORMULA} * 2 (configuration version 3)` });
  });
});

describe('AC-3: configuration entries by two Admins over three IST days', () => {
  beforeAll(async () => {
    // IST is UTC+5:30: 23:30 IST on 4 January is 18:00 UTC on the 4th; 00:01 IST on the 5th is 18:31 UTC on the 4th; 23:59 IST on the 6th is 18:29 UTC on the 6th.
    await insertFormulaChange('2031-01-03T06:00:00.000Z', adminOne, 'Invented Admin One', 'Day3 One');
    await insertFormulaChange('2031-01-04T18:00:00.000Z', adminTwo, 'Invented Admin Two', 'Day4 late');
    await insertFormulaChange('2031-01-04T18:31:00.000Z', adminOne, 'Invented Admin One', 'Day5 early');
    await insertFormulaChange('2031-01-06T18:29:00.000Z', adminTwo, 'Invented Admin Two', 'Day6 last minute');
  });

  const window = { from: '2031-01-03', to: '2031-01-06' };

  it('finds the entries of one person by ID, not by text', async () => {
    expect(labels(await db.audit.list({ limit: 50, category: 'config_change', ...window, who: adminTwo }))).toEqual(['Day6 last minute', 'Day4 late']);
    expect(labels(await db.audit.list({ limit: 50, category: 'config_change', ...window, who: adminOne }))).toEqual(['Day5 early', 'Day3 One']);
  });

  it('puts an entry at 23:30 IST on the 4th on the 4th, and one at 00:01 IST on the 5th on the 5th', async () => {
    expect(labels(await db.audit.list({ limit: 50, category: 'config_change', from: '2031-01-04', to: '2031-01-04' }))).toEqual(['Day4 late']);
    expect(labels(await db.audit.list({ limit: 50, category: 'config_change', from: '2031-01-05', to: '2031-01-05' }))).toEqual(['Day5 early']);
    expect(labels(await db.audit.list({ limit: 50, category: 'config_change', from: '2031-01-06', to: '2031-01-06' }))).toEqual(['Day6 last minute']);
  });

  it('combined with Who, From and To, returns only the matching entries; no match is an empty page', async () => {
    expect(labels(await db.audit.list({ limit: 50, category: 'config_change', who: adminTwo, from: '2031-01-05', to: '2031-01-06' }))).toEqual(['Day6 last minute']);
    expect(await db.audit.list({ limit: 50, category: 'config_change', who: adminOne, from: '2031-01-06', to: '2031-01-06' })).toEqual({ entries: [], total: 0, nextCursor: null });
  });
});

describe('AC-3: more than one page of configuration entries', () => {
  it('pages 120 entries by cursor with no gap, no repeat and a total that stays whole', async () => {
    const insertions = Array.from({ length: 120 }, (_, index) => insertFormulaChange(new Date(BASE + index * 1_000).toISOString(), adminOne, 'Invented Admin One', `Paged ${String(index).padStart(3, '0')}`));
    await Promise.all(insertions);
    const seen: string[] = [];
    let cursor: ReturnType<typeof decodeAuditCursor> | undefined;
    let pages = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await db.audit.list({ limit: 50, category: 'config_change', from: '2031-03-01', to: '2031-03-01', ...(cursor === undefined || cursor === null ? {} : { cursor }) });
      pages += 1;
      expect(page.total).toBe(120);
      seen.push(...labels(page));
      if (page.nextCursor === null) break;
      cursor = decodeAuditCursor(page.nextCursor);
    }
    expect(pages).toBe(3);
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
    expect(seen.at(0)).toBe('Paged 119');
    expect(seen.at(-1)).toBe('Paged 000');
  });
});

describe('AC-7: a configuration entry cannot be edited or deleted', () => {
  async function failureOf(run: () => Promise<unknown>): Promise<{ readonly code?: string; readonly message: string }> {
    try {
      await run();
    } catch (error) {
      if (error instanceof Error) return { message: error.message, ...('code' in error && typeof error.code === 'string' ? { code: error.code } : {}) };
    }
    throw new Error('The statement was expected to be refused, and was not.');
  }

  it('is refused for lack of a grant to the runtime role, and by the trigger to the owner, for UPDATE, DELETE and TRUNCATE', async () => {
    const { rows } = await db.owner.query<{ id: string }>("SELECT id FROM audit_log WHERE event = 'config.formula_changed' LIMIT 1");
    const id = defined(rows[0]).id;
    expect((await failureOf(() => db.runtime.query("UPDATE audit_log SET object_label = 'Rewritten' WHERE id = $1", [id]))).code).toBe(PERMISSION_DENIED);
    expect((await failureOf(() => db.runtime.query('DELETE FROM audit_log WHERE id = $1', [id]))).code).toBe(PERMISSION_DENIED);
    expect((await failureOf(() => db.owner.query("UPDATE audit_log SET after = '{}'::jsonb WHERE id = $1", [id]))).code).toBe(INTEGRITY_VIOLATION);
    expect((await failureOf(() => db.owner.query('DELETE FROM audit_log WHERE id = $1', [id]))).message).toBe('Table "audit_log" is immutable: DELETE is not allowed.');
    expect((await failureOf(() => db.owner.query('TRUNCATE audit_log'))).message).toBe('Table "audit_log" is immutable: TRUNCATE is not allowed.');
    const after = await db.owner.query<{ object_label: string }>('SELECT object_label FROM audit_log WHERE id = $1', [id]);
    expect(after.rows[0]?.object_label).not.toBe('Rewritten');
  });
});
