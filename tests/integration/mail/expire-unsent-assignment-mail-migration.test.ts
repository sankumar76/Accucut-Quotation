import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MILLISECONDS_PER_HOUR } from '@/lib/time';
import { createEmailOutboxRepository, type EmailOutboxRepository } from '@/server/repositories/email-outbox-repository';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';

/**
 * DEF-055 (AQP-385, DL-282): the data migration `20261121160000_expire_unsent_assignment_mail` against real PostgreSQL. A `task-assigned` row that is pending and has no `send_before` (queued
 * before the fix) is given one of now, so the worker's claim skips it as `EXPIRED` and never sends it. A row of another event, a row that is sent, sending, failed or skipped, and a row that
 * already has a `send_before` (earlier or later) are not changed; a second run changes nothing. The migration is run here as the owner over rows planted by the owner, as the deploy does.
 * Every address and name is invented.
 */

const migration = readFileSync(fileURLToPath(new URL('../../../prisma/migrations/20261121160000_expire_unsent_assignment_mail/migration.sql', import.meta.url)), 'utf8');

const PLANTED_AT = new Date('2026-11-01T10:00:00.000Z');
const FUTURE = new Date('2026-12-01T10:00:00.000Z');
const PAST = new Date('2026-11-02T10:00:00.000Z');

let db: AuthDatabase;
let repository: EmailOutboxRepository;
let engineerId = '';

interface Planted {
  readonly key: string;
  readonly event: string;
  readonly status: string;
  readonly sendBefore: Date | null;
}

async function plant({ key, event, status, sendBefore }: Planted): Promise<void> {
  await db.owner.query(
    `INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text, status, send_before, next_attempt_at, created_at)
     VALUES ($1, $2, $3::uuid, 'Subject', '<p>Body</p>', 'Body', $4, $5, $6, $6)`,
    [key, event, engineerId, status, sendBefore, PLANTED_AT],
  );
}

interface Row {
  readonly status: string;
  readonly last_error: string | null;
  readonly send_before: Date | null;
}

const rowOf = async (key: string): Promise<Row | undefined> => (await db.owner.query<Row>('SELECT status, last_error, send_before FROM email_outbox WHERE idempotency_key = $1', [key])).rows[0];
const everyRow = async (): Promise<Record<string, Row>> => {
  const { rows } = await db.owner.query<Row & { idempotency_key: string }>('SELECT idempotency_key, status, last_error, send_before FROM email_outbox');
  return Object.fromEntries(rows.map((row) => [row.idempotency_key, row]));
};

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createEmailOutboxRepository(db.prisma);
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Invented Engineer', 'engineer.migration@example.com', 'invented-hash', 'ENGINEER', true) RETURNING id::text");
  engineerId = rows[0]?.id ?? '';
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.owner.query('DELETE FROM email_outbox');
  await db.owner.query('UPDATE settings SET alerts_enabled = true WHERE id = 1');
});

describe('the migration that expires the assignment e-mails queued before the fix', () => {
  it('gives a pending task-assigned row with no send_before one of now, and the claim then skips it as EXPIRED and sends nothing', async () => {
    await plant({ key: 'task-assigned:t1:1', event: 'task-assigned', status: 'pending', sendBefore: null });
    const before = Date.now();
    await db.owner.query(migration);
    const after = Date.now();
    const migrated = await rowOf('task-assigned:t1:1');
    expect(migrated?.send_before?.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    expect(migrated?.send_before?.getTime()).toBeLessThanOrEqual(after + 5_000);

    // The worker's claim, a minute later: the row is skipped and never claimed for sending.
    const claim = await repository.claimDue(new Date(Date.now() + 60_000), 25, new Date(Date.now() + 5 * 60_000));
    expect(claim.claimed).toEqual([]);
    expect(claim.skipped).toMatchObject([{ code: 'EXPIRED' }]);
    expect(await rowOf('task-assigned:t1:1')).toMatchObject({ status: 'skipped', last_error: 'EXPIRED' });
  });

  it('leaves alone a row of another event, a row that is sent, sending, failed or skipped, and a row that already has a send_before, earlier or later', async () => {
    const untouched: ReadonlyArray<Planted> = [
      { key: 'task-overdue:t1:2026-11-10T10:00:00.000Z', event: 'task-overdue', status: 'pending', sendBefore: null },
      { key: 'digest:e1:2026-11-10', event: 'daily-digest', status: 'pending', sendBefore: null },
      { key: 'backup-missed:2026-11-10', event: 'backup-missed', status: 'pending', sendBefore: null },
      { key: 'password-reset:tok-1', event: 'password-reset', status: 'pending', sendBefore: null },
      { key: 'task-assigned:t2:1', event: 'task-assigned', status: 'sent', sendBefore: null },
      { key: 'task-assigned:t3:1', event: 'task-assigned', status: 'sending', sendBefore: null },
      { key: 'task-assigned:t4:1', event: 'task-assigned', status: 'failed', sendBefore: null },
      { key: 'task-assigned:t5:1', event: 'task-assigned', status: 'skipped', sendBefore: null },
      { key: 'task-assigned:t6:1', event: 'task-assigned', status: 'pending', sendBefore: FUTURE },
      { key: 'task-assigned:t7:1', event: 'task-assigned', status: 'pending', sendBefore: PAST },
    ];
    for (const row of untouched) await plant(row);
    const before = await everyRow();
    await db.owner.query(migration);
    expect(await everyRow()).toEqual(before);
    for (const row of untouched) expect((await rowOf(row.key))?.send_before ?? null).toEqual(row.sendBefore);
  });

  it('expires only the pending task-assigned rows with no send_before, among rows of every kind', async () => {
    await plant({ key: 'task-assigned:a:1', event: 'task-assigned', status: 'pending', sendBefore: null });
    await plant({ key: 'task-assigned:a:2', event: 'task-assigned', status: 'pending', sendBefore: null });
    await plant({ key: 'task-assigned:b:1', event: 'task-assigned', status: 'sent', sendBefore: null });
    await plant({ key: 'digest:e2:2026-11-10', event: 'daily-digest', status: 'pending', sendBefore: null });
    await db.owner.query(migration);
    const rows = await everyRow();
    expect(rows['task-assigned:a:1']?.send_before).not.toBeNull();
    expect(rows['task-assigned:a:2']?.send_before).not.toBeNull();
    expect(rows['task-assigned:b:1']?.send_before).toBeNull();
    expect(rows['digest:e2:2026-11-10']?.send_before).toBeNull();
  });

  it('is safe to run again: a second run changes nothing, and a row written by the fixed code (24 hours) is not touched by either run', async () => {
    const fresh = new Date(Date.now() + 24 * MILLISECONDS_PER_HOUR);
    await plant({ key: 'task-assigned:fresh:1', event: 'task-assigned', status: 'pending', sendBefore: fresh });
    await plant({ key: 'task-assigned:old:1', event: 'task-assigned', status: 'pending', sendBefore: null });
    await db.owner.query(migration);
    const once = await everyRow();
    await db.owner.query(migration);
    expect(await everyRow()).toEqual(once);
    expect(once['task-assigned:fresh:1']?.send_before).toEqual(fresh);
  });

  it('runs over an empty outbox (a new install) and changes nothing', async () => {
    await db.owner.query(migration);
    expect(await everyRow()).toEqual({});
  });

  it('is data only: it holds one UPDATE of email_outbox and no schema statement', () => {
    const statements = migration
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement !== '');
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^UPDATE email_outbox\s+SET send_before = now\(\)\s+WHERE event = 'task-assigned' AND status = 'pending' AND send_before IS NULL$/);
  });
});
