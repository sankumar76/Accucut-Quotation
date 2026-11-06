import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';

/**
 * STORY-01.07 T1 and T6 (AC-1, NFR-007, negative): `audit_log` cannot be changed or removed, by the runtime role (no grant) or by
 * the owner (a trigger), and the guards are on the table and not only in the code. Real PostgreSQL, in a throwaway database,
 * because an append-only table cannot be emptied afterwards. Every name is invented.
 */

const INSERT = `INSERT INTO audit_log (actor_id, actor_label, event, object_type, object_id, object_label, before, after, request_id)
                VALUES ($1, 'Invented Actor', 'user.created', 'user', $1, 'Invented Person', NULL, '{"role":"ENGINEER","isActive":true}'::jsonb, 'req-0a0b0c0d')
                RETURNING id`;
/** PostgreSQL's code for a statement refused for lack of a privilege. */
const PERMISSION_DENIED = '42501';
/** The code the trigger raises with (`integrity_constraint_violation`). */
const INTEGRITY_VIOLATION = '23000';

let db: AuditDatabase;
let actorId: string;
let entryId: string;

async function failureOf(run: () => Promise<unknown>): Promise<{ readonly code?: string; readonly message: string }> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error) return { message: error.message, ...('code' in error && typeof error.code === 'string' ? { code: error.code } : {}) };
  }
  throw new Error('The statement was expected to be refused, and was not.');
}

async function entryCount(): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
  return Number(rows[0]?.count);
}

beforeAll(async () => {
  db = await openAuditDatabase();
  actorId = await insertPersonAsOwner(db, 'Actor');
  const { rows } = await db.owner.query<{ id: string }>(INSERT, [actorId]);
  entryId = rows[0]?.id ?? '';
});

afterAll(async () => {
  await db.close();
});

describe('AC-1: the runtime role has no UPDATE, DELETE or TRUNCATE grant, and is refused before the trigger is reached', () => {
  it('holds SELECT and INSERT and nothing that changes or removes a row', async () => {
    const { rows } = await db.owner.query<{ privilege: string; allowed: boolean }>(
      `SELECT p AS privilege, has_table_privilege('accucut_app', 'audit_log', p) AS allowed
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.allowed]))).toEqual({
      SELECT: true,
      INSERT: true,
      UPDATE: false,
      DELETE: false,
      TRUNCATE: false,
      REFERENCES: false,
      TRIGGER: false,
    });
  });

  it('as the runtime role, a direct UPDATE is refused for lack of a grant, and nothing changes', async () => {
    const refusal = await failureOf(() => db.runtime.query("UPDATE audit_log SET object_label = 'Rewritten' WHERE id = $1", [entryId]));
    expect(refusal.code).toBe(PERMISSION_DENIED);
    expect(refusal.message).toContain('permission denied');
    const { rows } = await db.owner.query<{ object_label: string }>('SELECT object_label FROM audit_log WHERE id = $1', [entryId]);
    expect(rows[0]?.object_label).toBe('Invented Person');
  });

  it('as the runtime role, a direct DELETE and a TRUNCATE are refused for lack of a grant, and the entry is still there', async () => {
    expect((await failureOf(() => db.runtime.query('DELETE FROM audit_log WHERE id = $1', [entryId]))).code).toBe(PERMISSION_DENIED);
    expect((await failureOf(() => db.runtime.query('TRUNCATE audit_log'))).code).toBe(PERMISSION_DENIED);
    expect(await entryCount()).toBe(1);
  });

  it('the runtime role can still append and read, which is what the portal needs', async () => {
    const { rows } = await db.runtime.query<{ id: string }>(INSERT, [actorId]);
    expect(rows).toHaveLength(1);
    const read = await db.runtime.query('SELECT id FROM audit_log');
    expect(read.rowCount).toBe(2);
  });
});

describe('AC-1: the owner is refused by a trigger, which no grant can lift', () => {
  it('as the owner, a direct UPDATE is refused by the trigger, and nothing changes', async () => {
    const refusal = await failureOf(() => db.owner.query("UPDATE audit_log SET object_label = 'Rewritten' WHERE id = $1", [entryId]));
    expect(refusal.code).toBe(INTEGRITY_VIOLATION);
    expect(refusal.message).toBe('Table "audit_log" is immutable: UPDATE is not allowed.');
    const { rows } = await db.owner.query<{ object_label: string }>('SELECT object_label FROM audit_log WHERE id = $1', [entryId]);
    expect(rows[0]?.object_label).toBe('Invented Person');
  });

  it('as the owner, a direct DELETE and a TRUNCATE are refused by the trigger, and no entry is lost', async () => {
    const before = await entryCount();
    expect((await failureOf(() => db.owner.query('DELETE FROM audit_log WHERE id = $1', [entryId]))).message).toBe('Table "audit_log" is immutable: DELETE is not allowed.');
    expect((await failureOf(() => db.owner.query('DELETE FROM audit_log'))).code).toBe(INTEGRITY_VIOLATION);
    expect((await failureOf(() => db.owner.query('TRUNCATE audit_log'))).message).toBe('Table "audit_log" is immutable: TRUNCATE is not allowed.');
    expect(await entryCount()).toBe(before);
  });

  it('the guards are on the table: two triggers, one for rows and one for TRUNCATE, using the shared function', async () => {
    const { rows } = await db.owner.query<{ tgname: string; function: string }>(
      `SELECT t.tgname, p.proname AS function FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE t.tgrelid = 'audit_log'::regclass AND NOT t.tgisinternal ORDER BY t.tgname`,
    );
    expect(rows).toEqual([
      { tgname: 'trg_audit_log_forbid_change', function: 'forbid_immutable_change' },
      { tgname: 'trg_audit_log_forbid_truncate', function: 'forbid_immutable_change' },
    ]);
  });
});

describe('AC-1 and AC-3: the shape of the table', () => {
  it('has the columns of the story, a time stamped by the database and no updated_at (an append-only table by design)', async () => {
    const { rows } = await db.owner.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'audit_log' ORDER BY ordinal_position`,
    );
    expect(rows.map((row) => row.column_name)).toEqual(['id', 'actor_id', 'actor_label', 'event', 'object_type', 'object_id', 'object_label', 'before', 'after', 'request_id', 'created_at']);
    expect(Object.fromEntries(rows.filter((row) => row.is_nullable === 'YES').map((row) => [row.column_name, true]))).toEqual({ before: true, after: true });
  });

  it('stamps the time at the millisecond, so the cursor a JavaScript Date makes is exact', async () => {
    const { rows } = await db.owner.query<{ whole_ms: boolean }>('SELECT (extract(microseconds FROM created_at)::bigint % 1000 = 0) AS whole_ms FROM audit_log');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.whole_ms)).toBe(true);
  });

  it('keeps a missing before as SQL NULL, not as the JSON text "null"', async () => {
    const { rows } = await db.owner.query<{ is_null: boolean; as_text: string | null }>('SELECT before IS NULL AS is_null, before::text AS as_text FROM audit_log WHERE id = $1', [entryId]);
    expect(rows[0]).toEqual({ is_null: true, as_text: null });
  });

  it('refuses an entry that does not say who made it by name: actor_label is NOT NULL (architecture v0.27)', async () => {
    const refusal = await failureOf(() =>
      db.owner.query(
        `INSERT INTO audit_log (actor_id, event, object_type, object_id, object_label, request_id)
         VALUES ($1, 'user.created', 'user', $1, 'Invented Person', 'req-0a0b0c0d')`,
        [actorId],
      ),
    );
    expect(refusal.message).toContain('actor_label');
  });

  it('refuses an entry whose actor is not a user: a foreign key, with no cascade', async () => {
    const refusal = await failureOf(() => db.owner.query(INSERT, ['00000000-0000-4000-8000-0000000000ff']));
    expect(refusal.message).toContain('fk_audit_log_actor_id');
  });

  it('does not let a person who made entries be deleted: users are deactivated and never deleted', async () => {
    const refusal = await failureOf(() => db.owner.query('DELETE FROM users WHERE id = $1', [actorId]));
    expect(refusal.message).toContain('fk_audit_log_actor_id');
  });
});
