import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { idempotencyKeys, type MailEvent } from '@/lib/mail/events';
import { MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { createEmailOutboxRepository, type EmailOutboxRepository, type OutboxMessage } from '@/server/repositories/email-outbox-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';

/**
 * STORY-09.01 AC-1 (the tables, their checks and grants), AC-2 (idempotent enqueue and rollback), AC-4 (the claim: at most 25, no row twice) and AC-5 (alerts switch, expiry,
 * finality of a skip) against real PostgreSQL, in a throwaway database with every migration applied, as the runtime role the web process and the worker use. The owner role is used
 * only to look, to plant users and to tidy. Every address and name is invented.
 */

const migration = readFileSync(fileURLToPath(new URL('../../../prisma/migrations/20261118120000_email_outbox_and_settings/migration.sql', import.meta.url)), 'utf8');

const PERMISSION_DENIED = '42501';
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const NOW = new Date('2026-11-18T10:00:00.000Z');
const minutes = (count: number): Date => new Date(NOW.getTime() + count * MILLISECONDS_PER_MINUTE);

let db: AuthDatabase;
let repository: EmailOutboxRepository;
let transactions: TransactionRunner;
let engineerId = '';
let leadId = '';

async function failureOf(run: () => Promise<unknown>): Promise<{ readonly code?: string }> {
  try {
    await run();
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return { code: error.code };
    return {};
  }
  throw new Error('The statement was expected to be refused, and was not.');
}

async function plantUser(name: string, email: string, role: 'ENGINEER' | 'LEAD', active: boolean): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, 'invented-hash', $3, $4) RETURNING id::text", [name, email, role, active]);
  return rows[0]?.id ?? '';
}

let counter = 0;
function message(overrides: Partial<OutboxMessage> = {}): OutboxMessage {
  counter += 1;
  return {
    idempotencyKey: `backup-missed:2026-11-${String(counter).padStart(4, '0')}`,
    event: 'backup-missed',
    toUserId: engineerId,
    ccUserIds: [],
    subject: 'Subject',
    bodyHtml: '<p>Body</p>',
    bodyText: 'Body',
    ...overrides,
  };
}

async function enqueue(overrides: Partial<OutboxMessage> = {}, at = NOW): Promise<OutboxMessage> {
  const planted = message(overrides);
  await transactions.run((tx) => repository.enqueue(tx, planted, at));
  return planted;
}

interface OutboxRow {
  readonly idempotency_key: string;
  readonly status: string;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly locked_until: Date | null;
  readonly sent_at: Date | null;
  readonly body_html: string;
  readonly body_text: string;
}

async function rows(): Promise<OutboxRow[]> {
  const { rows: found } = await db.owner.query<OutboxRow>('SELECT idempotency_key, status, attempts, last_error, locked_until, sent_at, body_html, body_text FROM email_outbox ORDER BY created_at, idempotency_key');
  return found;
}

const rowOf = async (key: string): Promise<OutboxRow | undefined> => (await rows()).find((row) => row.idempotency_key === key);

async function setAlerts(on: boolean): Promise<void> {
  await db.owner.query('UPDATE settings SET alerts_enabled = $1 WHERE id = 1', [on]);
}

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createEmailOutboxRepository(db.prisma);
  transactions = createTransactionRunner(db.prisma);
  engineerId = await plantUser('Invented Engineer', 'engineer.mail@example.com', 'ENGINEER', true);
  leadId = await plantUser('Invented Lead', 'lead.mail@example.com', 'LEAD', true);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.owner.query('DELETE FROM email_outbox');
  await db.owner.query("UPDATE settings SET alerts_enabled = false, sender_name = '', sender_mailbox = '' WHERE id = 1");
});

describe('AC-1: the tables', () => {
  it('AC-1: email_outbox has the columns of architecture section 5.1 as ruled, recipients by user ID and no address column', async () => {
    const { rows: columns } = await db.owner.query<{ column_name: string; data_type: string; is_nullable: string }>(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'email_outbox' ORDER BY ordinal_position",
    );
    expect(columns).toEqual([
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'idempotency_key', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'event', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'to_user_id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'cc_user_ids', data_type: 'ARRAY', is_nullable: 'YES' },
      { column_name: 'subject', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'body_html', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'body_text', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'status', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'attempts', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'next_attempt_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'locked_until', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'send_before', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'last_error', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'sent_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
    ]);
  });

  it('AC-1: settings has id, alerts_enabled, sender_name, sender_mailbox (and updated_at), and is one seeded row: id 1, alerts off, empty sender', async () => {
    const { rows: columns } = await db.owner.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' ORDER BY ordinal_position");
    expect(columns.map((column) => column.column_name)).toEqual(['id', 'alerts_enabled', 'sender_name', 'sender_mailbox', 'updated_at']);
    const { rows: seeded } = await db.owner.query('SELECT id, alerts_enabled, sender_name, sender_mailbox FROM settings');
    expect(seeded).toEqual([{ id: 1, alerts_enabled: false, sender_name: '', sender_mailbox: '' }]);
  });

  it('AC-1: the status is one of pending, sending, sent, failed, skipped (a CHECK), and every one of them is accepted', async () => {
    for (const status of ['pending', 'sending', 'sent', 'failed', 'skipped']) {
      await db.owner.query("INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text, status) VALUES ($1, 'backup-missed', $2, 's', 'h', 't', $3)", [`k-${status}`, engineerId, status]);
    }
    expect(await failureOf(() => db.owner.query("INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text, status) VALUES ('k-bad', 'backup-missed', $1, 's', 'h', 't', 'done')", [engineerId]))).toEqual({
      code: CHECK_VIOLATION,
    });
  });

  it('AC-1: the idempotency key is unique, and the defaults are pending, 0 attempts and no Cc', async () => {
    const insert = "INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text) VALUES ('k-1', 'backup-missed', $1, 's', 'h', 't')";
    await db.owner.query(insert, [engineerId]);
    expect(await failureOf(() => db.owner.query(insert, [engineerId]))).toEqual({ code: UNIQUE_VIOLATION });
    const { rows: found } = await db.owner.query('SELECT status, attempts, cc_user_ids, send_before, last_error, sent_at, locked_until FROM email_outbox');
    expect(found).toEqual([{ status: 'pending', attempts: 0, cc_user_ids: [], send_before: null, last_error: null, sent_at: null, locked_until: null }]);
  });

  it('AC-7, SQR-04: last_error holds a class code or nothing: text of an error (an address, a host, a secret) is refused by a CHECK, even for the owner and in an UPDATE', async () => {
    await enqueue();
    for (const code of [null, 'SENDER_NOT_ALLOWED', 'AUTH_FAILED', 'CONNECTION', 'NO_SENDER', 'UNKNOWN', 'NO_RECIPIENT', 'EXPIRED', 'ALERTS_OFF']) {
      await db.owner.query('UPDATE email_outbox SET last_error = $1', [code]);
    }
    for (const message of ['connection to 10.0.0.1 failed', 'login failed for planted-password', 'auth_failed', '', 'AUTH_FAILED ']) {
      expect(await failureOf(() => db.owner.query('UPDATE email_outbox SET last_error = $1', [message])), message).toEqual({ code: CHECK_VIOLATION });
      expect(await failureOf(() => db.runtime.query('UPDATE email_outbox SET last_error = $1', [message])), message).toEqual({ code: CHECK_VIOLATION });
    }
  });

  it('AC-1: the Cc list cannot be NULL, a blank event or key is refused, and a negative attempts count is refused', async () => {
    const base = ["'k-2'", "'backup-missed'", '$1', "'s'", "'h'", "'t'"];
    const insert = (column: string, value: string) => `INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text, ${column}) VALUES (${base.join(', ')}, ${value})`;
    expect(await failureOf(() => db.owner.query(insert('cc_user_ids', 'NULL'), [engineerId]))).toEqual({ code: CHECK_VIOLATION });
    expect(await failureOf(() => db.owner.query(insert('attempts', '-1'), [engineerId]))).toEqual({ code: CHECK_VIOLATION });
    expect(await failureOf(() => db.owner.query("INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text) VALUES ('k-3', '  ', $1, 's', 'h', 't')", [engineerId]))).toEqual({ code: CHECK_VIOLATION });
    expect(await failureOf(() => db.owner.query("INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text) VALUES (' ', 'backup-missed', $1, 's', 'h', 't')", [engineerId]))).toEqual({ code: CHECK_VIOLATION });
  });

  it('AC-1: the To user is a foreign key without a cascade: an unknown user is refused, and a user who has mail on record cannot be deleted', async () => {
    expect(await failureOf(() => db.owner.query("INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text) VALUES ('k-4', 'backup-missed', gen_random_uuid(), 's', 'h', 't')"))).toEqual({
      code: FOREIGN_KEY_VIOLATION,
    });
    await enqueue({ toUserId: leadId });
    expect(await failureOf(() => db.owner.query('DELETE FROM users WHERE id = $1', [leadId]))).toEqual({ code: FOREIGN_KEY_VIOLATION });
  });

  it('AC-1: settings is one row: a second id is refused by a CHECK even for the owner', async () => {
    expect(await failureOf(() => db.owner.query('INSERT INTO settings (id) VALUES (2)'))).toEqual({ code: CHECK_VIOLATION });
    expect(await failureOf(() => db.owner.query('INSERT INTO settings (id) VALUES (1)'))).toEqual({ code: UNIQUE_VIOLATION });
  });
});

describe('AC-1: the grants of the runtime role', () => {
  it('AC-1: email_outbox: SELECT, INSERT and UPDATE; no DELETE, no TRUNCATE. settings: SELECT and UPDATE; no INSERT, no DELETE', async () => {
    const { rows: privileges } = await db.owner.query<Record<string, boolean>>(
      `SELECT has_table_privilege('accucut_app', 'email_outbox', 'SELECT') AS outbox_select,
              has_table_privilege('accucut_app', 'email_outbox', 'INSERT') AS outbox_insert,
              has_table_privilege('accucut_app', 'email_outbox', 'UPDATE') AS outbox_update,
              has_table_privilege('accucut_app', 'email_outbox', 'DELETE') AS outbox_delete,
              has_table_privilege('accucut_app', 'email_outbox', 'TRUNCATE') AS outbox_truncate,
              has_table_privilege('accucut_app', 'settings', 'SELECT') AS settings_select,
              has_table_privilege('accucut_app', 'settings', 'UPDATE') AS settings_update,
              has_table_privilege('accucut_app', 'settings', 'INSERT') AS settings_insert,
              has_table_privilege('accucut_app', 'settings', 'DELETE') AS settings_delete,
              has_table_privilege('accucut_app', 'settings', 'TRUNCATE') AS settings_truncate`,
    );
    expect(privileges[0]).toEqual({
      outbox_select: true,
      outbox_insert: true,
      outbox_update: true,
      outbox_delete: false,
      outbox_truncate: false,
      settings_select: true,
      settings_update: true,
      settings_insert: false,
      settings_delete: false,
      settings_truncate: false,
    });
  });

  it('AC-1: the statements are refused as the runtime role, not only listed: DELETE on the outbox, INSERT and DELETE on settings', async () => {
    await enqueue();
    expect(await failureOf(() => db.runtime.query('DELETE FROM email_outbox'))).toEqual({ code: PERMISSION_DENIED });
    expect(await failureOf(() => db.runtime.query('INSERT INTO settings (id) VALUES (3)'))).toEqual({ code: PERMISSION_DENIED });
    expect(await failureOf(() => db.runtime.query('DELETE FROM settings'))).toEqual({ code: PERMISSION_DENIED });
    expect((await db.runtime.query('UPDATE settings SET sender_name = $1 WHERE id = 1', ['Changed by the app'])).rowCount).toBe(1);
  });

  it('AC-1: the rollback note of the migration works, and the migration runs again over the result', async () => {
    await db.owner.query('BEGIN');
    try {
      await db.owner.query('DROP TABLE "email_outbox"');
      await db.owner.query('DROP TABLE "settings"');
      await db.owner.query(migration);
      const { rows: tables } = await db.owner.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('email_outbox', 'settings')");
      expect(tables[0]?.n).toBe(2);
    } finally {
      await db.owner.query('ROLLBACK');
    }
  });
});

describe('AC-2: enqueue', () => {
  it('AC-2: queues one pending row in the caller\'s transaction, with the recipients as user IDs and the clock\'s time', async () => {
    const planted = message({ toUserId: engineerId, ccUserIds: [leadId], sendBefore: minutes(60) });
    expect(await transactions.run((tx) => repository.enqueue(tx, planted, NOW))).toBe('queued');
    const { rows: found } = await db.owner.query('SELECT event, to_user_id::text, cc_user_ids::text[], status, attempts, next_attempt_at, created_at, send_before FROM email_outbox');
    expect(found).toEqual([{ event: 'backup-missed', to_user_id: engineerId, cc_user_ids: [leadId], status: 'pending', attempts: 0, next_attempt_at: NOW, created_at: NOW, send_before: minutes(60) }]);
  });

  it('AC-2: the same idempotency key twice leaves one row, and the second call says "already queued"', async () => {
    const planted = message({ idempotencyKey: idempotencyKeys.backupMissed('2026-11-18') });
    expect(await transactions.run((tx) => repository.enqueue(tx, planted, NOW))).toBe('queued');
    expect(await transactions.run((tx) => repository.enqueue(tx, { ...planted, subject: 'A later, different subject' }, minutes(5)))).toBe('already-queued');
    const kept = await rows();
    expect(kept).toHaveLength(1);
    const { rows: subjects } = await db.owner.query('SELECT subject FROM email_outbox');
    expect(subjects).toEqual([{ subject: 'Subject' }]);
  });

  it('AC-2: the same key twice in one transaction is also one row', async () => {
    const planted = message();
    const answers = await transactions.run(async (tx) => [await repository.enqueue(tx, planted, NOW), await repository.enqueue(tx, planted, NOW)]);
    expect(answers).toEqual(['queued', 'already-queued']);
    expect(await rows()).toHaveLength(1);
  });

  it('AC-2: two different keys are two rows', async () => {
    await enqueue();
    await enqueue();
    expect(await rows()).toHaveLength(2);
  });

  it('AC-2: if the caller\'s transaction rolls back, no row exists (a rolled-back task mails nothing)', async () => {
    const planted = message();
    await expect(
      transactions.run(async (tx) => {
        await repository.enqueue(tx, planted, NOW);
        throw new Error('the caller\'s change failed');
      }),
    ).rejects.toThrow('the caller\'s change failed');
    expect(await rowOf(planted.idempotencyKey)).toBeUndefined();
  });

  it('AC-2: a retry after a rollback queues the event, because the rollback left nothing behind', async () => {
    const planted = message();
    await expect(
      transactions.run(async (tx) => {
        await repository.enqueue(tx, planted, NOW);
        throw new Error('the change of the caller failed');
      }),
    ).rejects.toThrow();
    await expect(transactions.run((tx) => repository.enqueue(tx, planted, NOW))).resolves.toBe('queued');
  });

  it.each([
    ['a To that is not a user ID', { toUserId: 'someone@example.com' }],
    ['a Cc that is an address', { ccUserIds: ['someone@example.com'] }],
    ['more than 10 Cc users', { ccUserIds: Array.from({ length: 11 }, () => '9d1e5b0c-7a3f-4c2d-8e61-5b2a4f7c9d02') }],
    ['an event that is not known', { event: 'something-else' as MailEvent }],
    ['a subject with a line break (a header injection)', { subject: 'Hi\r\nBcc: someone@example.com' }],
    ['an empty subject', { subject: '' }],
    ['an empty body', { bodyText: '' }],
    ['an empty key', { idempotencyKey: '' }],
  ])('AC-2: refuses %s, and no row is written', async (_name, overrides) => {
    await expect(enqueue(overrides)).rejects.toThrow();
    expect(await rows()).toEqual([]);
  });

  it('AC-10: a message object with a field outside the fixed shape (a cost, say) is refused, not stored, and the value is in no column', async () => {
    const CANARY = '9393.37';
    const planted = { ...message(), totalCost: CANARY };
    await expect(transactions.run((tx) => repository.enqueue(tx, planted, NOW))).rejects.toThrow();
    expect(await rows()).toEqual([]);
  });

  it('AC-2: an unknown To user is refused by the foreign key, and no row is written', async () => {
    await expect(enqueue({ toUserId: '00000000-0000-4000-8000-000000000000' })).rejects.toThrow();
    expect(await rows()).toEqual([]);
  });

  it('AC-2: a body that looks like SQL is stored as text (parameters, not splicing)', async () => {
    const planted = await enqueue({ subject: "x'); DROP TABLE email_outbox; --", bodyHtml: "<p>'; DELETE FROM users; --</p>" });
    expect((await rowOf(planted.idempotencyKey))?.body_html).toBe("<p>'; DELETE FROM users; --</p>");
    expect(await rows()).toHaveLength(1);
  });
});

describe('AC-4: the claim', () => {
  const LOCK = minutes(5);

  // The rows below are alert events, so the switch is on: what the switch does is AC-5's block.
  beforeEach(async () => {
    await setAlerts(true);
  });

  it('AC-4: with 30 due rows, one claim takes 25 in one statement, marks them sending with the lock time and 1 attempt, and leaves 5 pending', async () => {
    for (let index = 0; index < 30; index += 1) await enqueue({ idempotencyKey: `backup-missed:bulk-${String(index).padStart(2, '0')}` });
    const result = await repository.claimDue(NOW, 25, LOCK);
    expect(result.claimed).toHaveLength(25);
    expect(result.skipped).toEqual([]);
    const kept = await rows();
    expect(kept.filter((row) => row.status === 'sending')).toHaveLength(25);
    expect(kept.filter((row) => row.status === 'pending')).toHaveLength(5);
    for (const row of kept.filter((candidate) => candidate.status === 'sending')) {
      expect(row.locked_until).toEqual(LOCK);
      expect(row.attempts).toBe(1);
    }
  });

  it('AC-4: the oldest due rows go first', async () => {
    await enqueue({ idempotencyKey: 'backup-missed:newer' }, minutes(-1));
    await enqueue({ idempotencyKey: 'backup-missed:older' }, minutes(-10));
    const result = await repository.claimDue(NOW, 1, LOCK);
    const { rows: claimed } = await db.owner.query('SELECT idempotency_key FROM email_outbox WHERE id = $1', [result.claimed[0]?.id]);
    expect(claimed).toEqual([{ idempotency_key: 'backup-missed:older' }]);
  });

  it('AC-4: a row that is not due yet (next_attempt_at in the future) is not claimed', async () => {
    await enqueue({ idempotencyKey: 'backup-missed:later' }, minutes(10));
    expect((await repository.claimDue(NOW, 25, LOCK)).claimed).toEqual([]);
    expect((await repository.claimDue(minutes(10), 25, LOCK)).claimed).toHaveLength(1);
  });

  it('AC-4: a claimed row carries what the job needs to send it, and nothing else of the row', async () => {
    await enqueue({ toUserId: engineerId, ccUserIds: [leadId], subject: 'Hello', bodyHtml: '<p>Hi</p>', bodyText: 'Hi' });
    const [claimed] = (await repository.claimDue(NOW, 25, LOCK)).claimed;
    expect(claimed).toEqual({ id: expect.any(String), event: 'backup-missed', toUserId: engineerId, ccUserIds: [leadId], subject: 'Hello', bodyHtml: '<p>Hi</p>', bodyText: 'Hi', attempts: 1 });
  });

  it('AC-4: a second claim while the first rows are sending takes nothing: no row is sent twice', async () => {
    await enqueue();
    expect((await repository.claimDue(NOW, 25, LOCK)).claimed).toHaveLength(1);
    expect((await repository.claimDue(minutes(1), 25, minutes(6))).claimed).toEqual([]);
  });

  it('AC-4: three claims at once over 30 rows take every row exactly once (SKIP LOCKED)', async () => {
    for (let index = 0; index < 30; index += 1) await enqueue({ idempotencyKey: `backup-missed:race-${String(index).padStart(2, '0')}` });
    const results = await Promise.all([repository.claimDue(NOW, 12, LOCK), repository.claimDue(NOW, 12, LOCK), repository.claimDue(NOW, 12, LOCK)]);
    const ids = results.flatMap((result) => result.claimed.map((claimed) => claimed.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(24);
    expect(ids.length).toBeLessThanOrEqual(30);
    expect((await rows()).filter((row) => row.status === 'sending')).toHaveLength(ids.length);
  });
});

describe('AC-5: the alerts switch, expiry and the finality of a skip', () => {
  const LOCK = minutes(5);
  const alertKeys: ReadonlyArray<readonly [MailEvent, string]> = [
    ['task-assigned', idempotencyKeys.taskAssigned('t1', 1)],
    ['task-overdue', idempotencyKeys.taskOverdue('t1', new Date('2026-11-17T10:00:00Z'))],
    ['daily-digest', idempotencyKeys.dailyDigest('e1', '2026-11-18')],
    ['backup-missed', idempotencyKeys.backupMissed('2026-11-18')],
  ];

  it('AC-5: with alerts OFF at claim time every alert event is marked skipped (ALERTS_OFF), not sent, and not counted as claimed', async () => {
    for (const [event, key] of alertKeys) await enqueue({ event, idempotencyKey: key });
    const result = await repository.claimDue(NOW, 25, LOCK);
    expect(result.claimed).toEqual([]);
    expect(result.skipped).toHaveLength(4);
    expect(result.skipped.every((skipped) => skipped.code === 'ALERTS_OFF')).toBe(true);
    expect((await rows()).every((row) => row.status === 'skipped' && row.last_error === 'ALERTS_OFF' && row.locked_until === null && row.attempts === 0)).toBe(true);
  });

  it('AC-5: with alerts ON the same alert events are claimed to be sent', async () => {
    await setAlerts(true);
    for (const [event, key] of alertKeys) await enqueue({ event, idempotencyKey: key });
    const result = await repository.claimDue(NOW, 25, LOCK);
    expect(result.claimed).toHaveLength(4);
    expect(result.skipped).toEqual([]);
  });

  it('AC-5: password-reset ignores the switch: it is claimed with alerts OFF', async () => {
    await enqueue({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-1') });
    const result = await repository.claimDue(NOW, 25, LOCK);
    expect(result.claimed).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it('AC-5, decision D-d: a skipped row is final: switching alerts ON later does not send it, and its key stays used so the event is not queued again', async () => {
    const key = idempotencyKeys.backupMissed('2026-11-18');
    await enqueue({ event: 'backup-missed', idempotencyKey: key });
    await repository.claimDue(NOW, 25, LOCK);
    expect((await rowOf(key))?.status).toBe('skipped');
    await setAlerts(true);
    expect((await repository.claimDue(minutes(1), 25, minutes(6))).claimed).toEqual([]);
    expect(await transactions.run((tx) => repository.enqueue(tx, message({ event: 'backup-missed', idempotencyKey: key }), minutes(2)))).toBe('already-queued');
    expect((await rowOf(key))?.status).toBe('skipped');
  });

  it('a row past its send_before at claim time is skipped as EXPIRED and never sent, even for an event the switch does not govern', async () => {
    await setAlerts(true);
    const key = idempotencyKeys.passwordReset('tok-2');
    await enqueue({ event: 'password-reset', idempotencyKey: key, sendBefore: minutes(-1) });
    await enqueue({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-3'), sendBefore: minutes(30) });
    const result = await repository.claimDue(NOW, 25, LOCK);
    expect(result.claimed).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.code).toBe('EXPIRED');
    expect((await rowOf(key))?.status).toBe('skipped');
    expect((await rowOf(key))?.last_error).toBe('EXPIRED');
  });

  it('a skipped secret-bearing row has its bodies emptied (the reset link does not outlive its chance to be sent); an alert row keeps its body', async () => {
    const reset = idempotencyKeys.passwordReset('tok-4');
    await enqueue({ event: 'password-reset', idempotencyKey: reset, sendBefore: minutes(-1), bodyHtml: '<a href="https://portal.example.com/reset/abc">link</a>', bodyText: 'https://portal.example.com/reset/abc' });
    const alert = idempotencyKeys.backupMissed('2026-11-18');
    await enqueue({ event: 'backup-missed', idempotencyKey: alert });
    await repository.claimDue(NOW, 25, LOCK);
    expect(await rowOf(reset)).toMatchObject({ status: 'skipped', body_html: '', body_text: '' });
    expect(await rowOf(alert)).toMatchObject({ status: 'skipped', body_html: '<p>Body</p>', body_text: 'Body' });
  });

  it('the alerts switch is read in the claim\'s own statement: a switch turned off a moment ago is respected', async () => {
    await setAlerts(true);
    await setAlerts(false);
    await enqueue({ event: 'task-assigned', idempotencyKey: idempotencyKeys.taskAssigned('t9', 1) });
    expect((await repository.claimDue(NOW, 25, LOCK)).claimed).toEqual([]);
  });
});
