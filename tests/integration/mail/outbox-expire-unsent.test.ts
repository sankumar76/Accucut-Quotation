import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { idempotencyKeys, taskAssignedKeyPrefix } from '@/lib/mail/events';
import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { createEmailOutboxRepository, type EmailOutboxRepository, type OutboxMessage } from '@/server/repositories/email-outbox-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';

/**
 * DEF-055 (AQP-385): `expireUnsent` against real PostgreSQL, as the runtime role. It gives the unsent rows (pending, or sending: SQR-02) of one event whose key starts with a prefix a `send_before`
 * of now, so the claim skips them as `EXPIRED` with the mechanism every other expiry uses. It never touches a row that is sent, failed or skipped, a row of another task or event, or a `send_before`
 * that is already earlier; the prefix is compared as text, not as a pattern; and it is undone with the caller's transaction. Every name and address is invented.
 */

const NOW = new Date('2026-11-18T10:00:00.000Z');
const LOCK = new Date(NOW.getTime() + 5 * MILLISECONDS_PER_MINUTE);
const IN_A_DAY = new Date(NOW.getTime() + 24 * MILLISECONDS_PER_HOUR);
const TASK = '5a1c0e2e-0b8f-4a3e-9f57-1d6b2c3a4e01';
const OTHER_TASK = '5a1c0e2e-0b8f-4a3e-9f57-1d6b2c3a4e02';

let db: AuthDatabase;
let repository: EmailOutboxRepository;
let transactions: TransactionRunner;
let engineerId = '';

interface OutboxRow {
  readonly status: string;
  readonly last_error: string | null;
  readonly send_before: Date | null;
}

const rowOf = async (key: string): Promise<OutboxRow | undefined> =>
  (await db.owner.query<OutboxRow>('SELECT status, last_error, send_before FROM email_outbox WHERE idempotency_key = $1', [key])).rows[0];

async function assigned(task: string, revision: number, sendBefore: Date | null = IN_A_DAY, event: OutboxMessage['event'] = 'task-assigned'): Promise<string> {
  const key = idempotencyKeys.taskAssigned(task, revision);
  await transactions.run((tx) => repository.enqueue(tx, { idempotencyKey: key, event, toUserId: engineerId, ccUserIds: [], subject: 'Subject', bodyHtml: '<p>Body</p>', bodyText: 'Body', sendBefore }, NOW));
  return key;
}

const expireTask = (task: string, at = NOW): Promise<number> => transactions.run((tx) => repository.expireUnsent(tx, 'task-assigned', taskAssignedKeyPrefix(task), at));

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createEmailOutboxRepository(db.prisma);
  transactions = createTransactionRunner(db.prisma);
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Invented Engineer', 'engineer.expire@example.com', 'invented-hash', 'ENGINEER', true) RETURNING id::text");
  engineerId = rows[0]?.id ?? '';
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.owner.query('DELETE FROM email_outbox');
  await db.owner.query('UPDATE settings SET alerts_enabled = true WHERE id = 1');
});

describe('expireUnsent', () => {
  it('sets send_before to now on the unsent rows of the task, whatever their revision, and the claim skips them as EXPIRED and never sends them', async () => {
    const first = await assigned(TASK, 1);
    const second = await assigned(TASK, 2, null);
    expect(await expireTask(TASK)).toBe(2);
    expect((await rowOf(first))?.send_before).toEqual(NOW);
    expect((await rowOf(second))?.send_before).toEqual(NOW);
    const claim = await repository.claimDue(NOW, 25, LOCK);
    expect(claim.claimed).toEqual([]);
    expect(claim.skipped.map((skipped) => skipped.code)).toEqual(['EXPIRED', 'EXPIRED']);
    expect(await rowOf(first)).toMatchObject({ status: 'skipped', last_error: 'EXPIRED' });
  });

  it('leaves alone a row of another task, a row of another event, and a row that is sent, failed or skipped', async () => {
    const other = await assigned(OTHER_TASK, 1);
    const otherEvent = await assigned(TASK, 7, IN_A_DAY, 'backup-missed');
    const sent = await assigned(TASK, 3);
    const failed = await assigned(TASK, 5);
    const skipped = await assigned(TASK, 6);
    for (const [key, status] of [
      [sent, 'sent'],
      [failed, 'failed'],
      [skipped, 'skipped'],
    ] as const) {
      await db.owner.query('UPDATE email_outbox SET status = $2 WHERE idempotency_key = $1', [key, status]);
    }
    expect(await expireTask(TASK)).toBe(0);
    for (const key of [other, otherEvent, sent, failed, skipped]) expect((await rowOf(key))?.send_before).toEqual(IN_A_DAY);
  });

  it('SQR-02: a row the worker has claimed and not yet sent (sending) is expired too, and keeps its status for the worker\'s own marks', async () => {
    const sending = await assigned(TASK, 4);
    await db.owner.query("UPDATE email_outbox SET status = 'sending', attempts = 1, locked_until = $2 WHERE idempotency_key = $1", [sending, LOCK]);
    expect(await expireTask(TASK)).toBe(1);
    expect(await rowOf(sending)).toMatchObject({ status: 'sending', send_before: NOW });
  });

  it('does not move an earlier send_before later', async () => {
    const key = await assigned(TASK, 1, new Date(NOW.getTime() - MILLISECONDS_PER_MINUTE));
    expect(await expireTask(TASK)).toBe(0);
    expect((await rowOf(key))?.send_before).toEqual(new Date(NOW.getTime() - MILLISECONDS_PER_MINUTE));
  });

  it('reads the prefix as text: a percent sign or an underscore matches only itself', async () => {
    const key = await assigned(TASK, 1);
    for (const prefix of ['task-assigned:%', 'task-assigned:_____', '%']) {
      expect(await transactions.run((tx) => repository.expireUnsent(tx, 'task-assigned', prefix, NOW))).toBe(0);
    }
    expect((await rowOf(key))?.send_before).toEqual(IN_A_DAY);
  });

  it('is undone with the caller\'s transaction', async () => {
    const key = await assigned(TASK, 1);
    await expect(
      transactions.run(async (tx) => {
        await repository.expireUnsent(tx, 'task-assigned', taskAssignedKeyPrefix(TASK), NOW);
        throw new Error('The change after it failed.');
      }),
    ).rejects.toThrow('The change after it failed.');
    expect((await rowOf(key))?.send_before).toEqual(IN_A_DAY);
  });
});
