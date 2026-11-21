import { z } from 'zod';

import { SEND_FAILURE_CODES, SKIP_CODES, type OutboxErrorCode, type SendFailureCode, type SkipCode } from '../../lib/mail/codes';
import { ALERT_EVENTS, isMailEvent, type MailEvent, SECRET_BEARING_EVENTS } from '../../lib/mail/events';
import { MAX_SEND_ATTEMPTS } from '../../lib/mail/retry';

import type { BackupMissedAlert, BackupMissedQueued } from '../jobs/backup-watch';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, createTransactionRunner, type Transaction } from './transaction';

/**
 * The e-mail outbox and the mail settings (STORY-09.01, FR-081 to FR-084, FR-003; STORY-09.06; architecture sections 4.7 and 5.1; ADR-011). Raw SQL lives only here, as tagged templates, and
 * every row that comes back is parsed (coding standards section 10, "SQL"). This file is the whole write API of the outbox, and the contract that STORY-09.02 to 09.07 build on:
 *
 *   `enqueue(tx, message, now)`   one row in the caller's own transaction. The idempotency key is UNIQUE and the insert is `ON CONFLICT DO NOTHING`, so a repeated event queues
 *                                 nothing and says `already-queued`; if the caller's transaction rolls back, no row exists (AC-2).
 *   `claimDue(...)`               one short statement, never a held transaction: it takes at most `limit` due rows (`pending` and due, or `sending` with its lock run out: a dead worker's row)
 *                                 with `FOR UPDATE SKIP LOCKED`, marks them `sending` with a lock time and raises `attempts`, and in the same statement marks as `skipped` the rows that must
 *                                 not be sent (past `send_before`, or an alert event while the switch is off) and as `failed` a taken-back row that has used its four attempts.
 *                                 Two runs at once never get the same row (STORY-09.01 AC-4, AC-5; STORY-09.06 AC-3, AC-4, AC-9).
 *   `beginSend`                   renews the lease of one claimed row just before its send, or says that the row is past its `send_before` (now `skipped`) or that another run took it.
 *   `markSent`, `markRetry`, `markFailed`, `markSkipped`   record the result of one attempt. Each changes the row only while it is still `sending` AND its `attempts` is the number the claim gave
 *                                 this run (the fence), so a late or repeated call, or a run that lost its lease, cannot undo or overwrite another run's outcome.
 *   `failedSince`                 how many rows are `failed` since a date, and the newest one's class code and time, for the Settings notice (STORY-09.06 AC-8).
 *   `resolveRecipients`           the addresses of the To and Cc users at send time, active users only (NFR-028: the outbox holds no address).
 *   `readMailSettings`            `alerts_enabled` and the sender, read when a message is sent (AC-5).
 *
 * A row whose event holds a secret (the reset link) has its two bodies emptied as it is sent, finally failed or skipped, in the same statement that records the outcome, so a live
 * link never outlasts the row's chance to be sent. `last_error` is only ever one of the class codes of `src/lib/mail/codes.ts`.
 *
 * Retry (STORY-09.06): a failed attempt puts the row back to `pending` with the class code and the next due time (`markRetry`); the 4th failed attempt is `failed`, final. A row left
 * `sending` by a worker that died is taken back by the claim once its lock has run out (at least once: `src/server/jobs/outbox-send.ts` says which one window remains). The time a row
 * failed for good is kept in `next_attempt_at` (a failed row is never due again, so the column then says when its last attempt was made).
 */

/** What a caller puts in the outbox. A fixed shape of strings: nothing here can carry a cost, a rate or a formula (TB-4, AC-10). */
export interface OutboxMessage {
  /** `src/lib/mail/events.ts` builds these (`idempotencyKeys`). */
  readonly idempotencyKey: string;
  readonly event: MailEvent;
  /** The recipient, by user ID. The address is read from `users.email` when the row is sent. */
  readonly toUserId: string;
  readonly ccUserIds: ReadonlyArray<string>;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
  /** A row past this at claim time is skipped as `EXPIRED` (a reset row's is its token's expiry). Null or absent: no deadline. */
  readonly sendBefore?: Date | null;
}

export type EnqueueResult = 'queued' | 'already-queued';

/** A row the job now holds: marked `sending`, with its body, ready to send. */
export interface ClaimedMessage {
  readonly id: string;
  readonly event: string;
  readonly toUserId: string;
  readonly ccUserIds: ReadonlyArray<string>;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
  /** The number of this attempt, counting from 1: the claim raised it, and it is the fence of every write about the row. */
  readonly attempts: number;
}

/** A row the claim marked `skipped` without sending, and why. */
export interface SkippedMessage {
  readonly id: string;
  readonly event: string;
  readonly attempts: number;
  readonly code: SkipCode;
}

/** A row the claim marked `failed`: a taken-back row that had no attempt left. */
export interface GivenUpMessage {
  readonly id: string;
  readonly event: string;
  readonly attempts: number;
  readonly code: SendFailureCode;
}

export interface ClaimResult {
  readonly claimed: ReadonlyArray<ClaimedMessage>;
  readonly skipped: ReadonlyArray<SkippedMessage>;
  readonly failed: ReadonlyArray<GivenUpMessage>;
}

/** A claimed row as the marks name it: its ID and the attempt number the claim gave it (the fence of every write). */
export interface OutboxRowRef {
  readonly id: string;
  readonly attempts: number;
}

/** What `beginSend` says: send (the lease is renewed), the row is past its `send_before` (it is now `skipped`), or another run took the row. */
export type SendLease = 'go' | 'expired' | 'lost';

/** The rows that failed for good since a date: how many, and the newest one's class code and time. Never an address, a subject or an ID. */
export interface MailFailureSummary {
  readonly count: number;
  readonly lastCode: SendFailureCode;
  readonly lastAt: Date;
}

export interface MailSettingsRow {
  readonly alertsEnabled: boolean;
  readonly senderName: string;
  readonly senderMailbox: string;
}

/** The addresses to send to, from active users only. `to` is null when the To user is inactive or missing. */
export interface ResolvedRecipients {
  readonly to: string | null;
  readonly cc: ReadonlyArray<string>;
}

export interface EmailOutboxRepository {
  enqueue(tx: Transaction, message: OutboxMessage, now: Date): Promise<EnqueueResult>;
  /**
   * Gives the **unsent** rows of one event whose key starts with `keyPrefix` a `send_before` of `now` (never a later one than they have), in the caller's transaction, so the claim skips them as
   * `EXPIRED` with the one mechanism every expiry uses (DEF-055). Unsent is `pending` **or `sending`** (SQR-02): a row the worker has claimed but not yet sent is stopped at its `beginSend`
   * (`expired`), and one whose attempt fails and goes back to `pending` is skipped at the next claim. The worker's marks check only `status` and `attempts`, never `send_before`, so a row that
   * was sent a moment earlier is still recorded as sent. A row that is sent, failed or skipped is not touched. Answers how many rows it expired.
   */
  expireUnsent(tx: Transaction, event: MailEvent, keyPrefix: string, now: Date): Promise<number>;
  claimDue(now: Date, limit: number, lockedUntil: Date): Promise<ClaimResult>;
  beginSend(row: OutboxRowRef, now: Date, lockedUntil: Date): Promise<SendLease>;
  markSent(row: OutboxRowRef, now: Date): Promise<boolean>;
  markRetry(row: OutboxRowRef, code: SendFailureCode, nextAttemptAt: Date): Promise<boolean>;
  markFailed(row: OutboxRowRef, code: SendFailureCode, now: Date): Promise<boolean>;
  markSkipped(row: OutboxRowRef, code: SkipCode): Promise<boolean>;
  failedSince(since: Date): Promise<MailFailureSummary | null>;
  resolveRecipients(toUserId: string, ccUserIds: ReadonlyArray<string>): Promise<ResolvedRecipients>;
  readMailSettings(): Promise<MailSettingsRow>;
}

/** The most Cc users a row may name: a task alert has one or two, and the limit keeps a bad caller from queueing a broadcast. */
export const MAX_CC_USERS = 10;

const MAX_KEY_LENGTH = 200;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 200_000;

/**
 * A message is checked at the repository, the one door into the table, so no caller can queue a malformed row or a header-injecting subject. The shape is strict: a field that is
 * not in the list is refused, not dropped, so nothing (a cost, a rate) can ride along in a message object unnoticed (TB-4, AC-10).
 */
const outboxMessageSchema = z.strictObject({
  idempotencyKey: z.string().min(1).max(MAX_KEY_LENGTH),
  event: z.string().refine(isMailEvent),
  toUserId: z.uuid(),
  ccUserIds: z.array(z.uuid()).max(MAX_CC_USERS),
  subject: z
    .string()
    .min(1)
    .max(MAX_SUBJECT_LENGTH)
    .regex(/^[^\r\n]*$/),
  bodyHtml: z.string().min(1).max(MAX_BODY_LENGTH),
  bodyText: z.string().min(1).max(MAX_BODY_LENGTH),
  sendBefore: z.date().nullish(),
});

const SKIP_REASON_EXPIRED = 'EXPIRED';
const SKIP_REASON_ALERTS_OFF = 'ALERTS_OFF';
/** The code of a row the claim gives up on: nothing is known of how its last attempt ended. */
const GIVE_UP_CODE = 'UNKNOWN';

const skipCodeSchema = z.enum(SKIP_CODES);
// A value outside the class codes (the column is free text; a CHECK on it is follow-up SQR-04) is shown as UNKNOWN, never as itself.
const failureCodeSchema = z.string().transform((value): SendFailureCode => SEND_FAILURE_CODES.find((code) => code === value) ?? 'UNKNOWN');
const failedRowSchema = z.object({ total: z.coerce.number().int().min(1), last_error: failureCodeSchema, next_attempt_at: z.date() });

const claimedRowSchema = z.object({
  id: z.string(),
  event: z.string(),
  to_user_id: z.string(),
  cc_user_ids: z.array(z.string()).nullable(),
  subject: z.string(),
  body_html: z.string(),
  body_text: z.string(),
  attempts: z.number(),
  status: z.enum(['sending', 'skipped', 'failed']),
  // Read as text and checked against the class codes only for a row the claim skipped.
  last_error: z.string().nullable(),
  created_at: z.date(),
  next_attempt_at: z.date(),
});

const recipientRowSchema = z.object({ id: z.string(), email: z.string() });
const settingsRowSchema = z.object({ alerts_enabled: z.boolean(), sender_name: z.string(), sender_mailbox: z.string() });

export function createEmailOutboxRepository(db: PrismaClient): EmailOutboxRepository {
  // Arrays go to the statements as parameters, never spliced into the text.
  const alertEvents = [...ALERT_EVENTS];
  const secretEvents = [...SECRET_BEARING_EVENTS];

  return {
    enqueue: (tx, message, now) =>
      withDatabaseErrors(async () => {
        const parsed = outboxMessageSchema.parse(message);
        const written = await clientFor(db, tx).$executeRaw`
          INSERT INTO email_outbox (idempotency_key, event, to_user_id, cc_user_ids, subject, body_html, body_text, send_before, next_attempt_at, created_at)
          VALUES (${parsed.idempotencyKey}, ${parsed.event}, ${parsed.toUserId}::uuid, ${parsed.ccUserIds}::uuid[], ${parsed.subject}, ${parsed.bodyHtml}, ${parsed.bodyText},
                  ${parsed.sendBefore ?? null}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
          ON CONFLICT (idempotency_key) DO NOTHING`;
        return written === 1 ? 'queued' : 'already-queued';
      }),

    expireUnsent: (tx, event, keyPrefix, now) =>
      withDatabaseErrors(() =>
        // `starts_with` compares text, so a `%` or `_` in the prefix is only itself. The prefix is a bound parameter like every other value.
        clientFor(db, tx).$executeRaw`
          UPDATE email_outbox SET send_before = ${now}::timestamptz
          WHERE status IN ('pending', 'sending') AND event = ${event} AND starts_with(idempotency_key, ${keyPrefix})
            AND (send_before IS NULL OR send_before > ${now}::timestamptz)`,
      ),

    claimDue: (now, limit, lockedUntil) =>
      withDatabaseErrors(async () => {
        // One statement, so no row is held in an open transaction while SMTP runs. `decided` reads the alerts switch in the same snapshot as the claim, so a switch turned off
        // after the claim cannot unsend a row and one turned off before it cannot be missed. A skipped secret-bearing row has its bodies emptied here. A `sending` row whose lock has run
        // out is a dead worker's: it is taken again (attempts + 1) unless it has used its attempts, when it is final.
        const rows = await db.$queryRaw`
          WITH due AS (
            SELECT id
            FROM email_outbox
            WHERE (status = 'pending' AND next_attempt_at <= ${now}::timestamptz)
               OR (status = 'sending' AND locked_until <= ${now}::timestamptz)
            ORDER BY next_attempt_at, created_at, id
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          ), decided AS (
            SELECT o.id,
              CASE
                WHEN o.send_before IS NOT NULL AND o.send_before <= ${now}::timestamptz THEN ${SKIP_REASON_EXPIRED}
                WHEN o.event = ANY(${alertEvents}::text[]) AND NOT COALESCE((SELECT alerts_enabled FROM settings WHERE id = 1), false) THEN ${SKIP_REASON_ALERTS_OFF}
              END AS skip_reason,
              (o.status = 'sending' AND o.attempts >= ${MAX_SEND_ATTEMPTS}) AS give_up
            FROM email_outbox o
            JOIN due ON due.id = o.id
          )
          UPDATE email_outbox AS o SET
            status = CASE WHEN d.skip_reason IS NOT NULL THEN 'skipped' WHEN d.give_up THEN 'failed' ELSE 'sending' END,
            attempts = CASE WHEN d.skip_reason IS NULL AND NOT d.give_up THEN o.attempts + 1 ELSE o.attempts END,
            locked_until = CASE WHEN d.skip_reason IS NULL AND NOT d.give_up THEN ${lockedUntil}::timestamptz ELSE NULL END,
            last_error = CASE WHEN d.skip_reason IS NOT NULL THEN d.skip_reason WHEN d.give_up THEN ${GIVE_UP_CODE} ELSE o.last_error END,
            next_attempt_at = CASE WHEN d.skip_reason IS NULL AND d.give_up THEN ${now}::timestamptz ELSE o.next_attempt_at END,
            body_html = CASE WHEN (d.skip_reason IS NOT NULL OR d.give_up) AND o.event = ANY(${secretEvents}::text[]) THEN '' ELSE o.body_html END,
            body_text = CASE WHEN (d.skip_reason IS NOT NULL OR d.give_up) AND o.event = ANY(${secretEvents}::text[]) THEN '' ELSE o.body_text END
          FROM decided d
          WHERE o.id = d.id
          RETURNING o.id, o.event, o.to_user_id, o.cc_user_ids, o.subject, o.body_html, o.body_text, o.attempts, o.status, o.last_error, o.created_at, o.next_attempt_at`;
        const parsed = z.array(claimedRowSchema).parse(rows);
        // RETURNING has no order, so the oldest due row is sent first, as the claim chose it.
        const ordered = [...parsed].sort((a, b) => a.next_attempt_at.getTime() - b.next_attempt_at.getTime() || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));
        const claimed: ClaimedMessage[] = [];
        const skipped: SkippedMessage[] = [];
        const failed: GivenUpMessage[] = [];
        for (const row of ordered) {
          if (row.status === 'sending') {
            claimed.push({ id: row.id, event: row.event, toUserId: row.to_user_id, ccUserIds: row.cc_user_ids ?? [], subject: row.subject, bodyHtml: row.body_html, bodyText: row.body_text, attempts: row.attempts });
          } else if (row.status === 'failed') {
            failed.push({ id: row.id, event: row.event, attempts: row.attempts, code: GIVE_UP_CODE });
          } else {
            const code = skipCodeSchema.safeParse(row.last_error);
            if (code.success) skipped.push({ id: row.id, event: row.event, attempts: row.attempts, code: code.data });
          }
        }
        return { claimed, skipped, failed };
      }),

    beginSend: (row, now, lockedUntil) =>
      withDatabaseErrors(async () => {
        // The lease is renewed only for the run that holds the attempt number, and only while the row can still be sent. Two statements, no transaction: the first decides "go", the
        // second tells "expired" (and skips the row, blanking a secret body) from "lost" (another run took it, or it is no longer `sending`).
        const renewed = await db.$executeRaw`
          UPDATE email_outbox SET locked_until = ${lockedUntil}::timestamptz
          WHERE id = ${row.id}::uuid AND status = 'sending' AND attempts = ${row.attempts} AND (send_before IS NULL OR send_before > ${now}::timestamptz)`;
        if (renewed === 1) return 'go';
        const expired = await db.$executeRaw`
          UPDATE email_outbox SET
            status = 'skipped', last_error = ${SKIP_REASON_EXPIRED}, locked_until = NULL,
            body_html = CASE WHEN event = ANY(${secretEvents}::text[]) THEN '' ELSE body_html END,
            body_text = CASE WHEN event = ANY(${secretEvents}::text[]) THEN '' ELSE body_text END
          WHERE id = ${row.id}::uuid AND status = 'sending' AND attempts = ${row.attempts} AND send_before <= ${now}::timestamptz`;
        return expired === 1 ? 'expired' : 'lost';
      }),

    markSent: (row, now) => finish(db, secretEvents, row, 'sent', null, { sentAt: now }),
    markRetry: (row, code, nextAttemptAt) =>
      withDatabaseErrors(async () => {
        // Back to `pending`: the row is not held, and not due until `nextAttemptAt`. The body stays (the row will be sent again).
        const changed = await db.$executeRaw`
          UPDATE email_outbox SET status = 'pending', last_error = ${code}, next_attempt_at = ${nextAttemptAt}::timestamptz, locked_until = NULL
          WHERE id = ${row.id}::uuid AND status = 'sending' AND attempts = ${row.attempts}`;
        return changed === 1;
      }),
    markFailed: (row, code, now) => finish(db, secretEvents, row, 'failed', code, { failedAt: now }),
    markSkipped: (row, code) => finish(db, secretEvents, row, 'skipped', code, {}),

    failedSince: (since) =>
      withDatabaseErrors(async () => {
        // One read: the window function counts every matching row before LIMIT 1 keeps the newest. The index on (status, next_attempt_at) serves it.
        const rows = await db.$queryRaw`
          SELECT count(*) OVER () AS total, last_error, next_attempt_at
          FROM email_outbox
          WHERE status = 'failed' AND next_attempt_at >= ${since}::timestamptz
          ORDER BY next_attempt_at DESC, id DESC
          LIMIT 1`;
        const row = z.array(failedRowSchema).parse(rows)[0];
        return row === undefined ? null : { count: row.total, lastCode: row.last_error, lastAt: row.next_attempt_at };
      }),

    resolveRecipients: (toUserId, ccUserIds) =>
      withDatabaseErrors(async () => {
        const wanted = [toUserId, ...ccUserIds];
        const rows = await db.$queryRaw`SELECT id, email FROM users WHERE id = ANY(${wanted}::uuid[]) AND is_active`;
        const addresses = new Map(z.array(recipientRowSchema).parse(rows).map((row) => [row.id, row.email]));
        const to = addresses.get(toUserId) ?? null;
        // An inactive Cc user is left out; so is a person named twice, and the To address is never repeated in Cc.
        const cc = [...new Set(ccUserIds.filter((id) => id !== toUserId).flatMap((id) => addresses.get(id) ?? []))];
        return { to, cc };
      }),

    readMailSettings: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`SELECT alerts_enabled, sender_name, sender_mailbox FROM settings WHERE id = 1`;
        const row = z.array(settingsRowSchema).parse(rows)[0];
        // The migration seeds the row and the runtime role cannot delete it; if it is somehow absent, nothing is sent (an empty sender is `NO_SENDER`) and alerts are off.
        return row === undefined ? { alertsEnabled: false, senderName: '', senderMailbox: '' } : { alertsEnabled: row.alerts_enabled, senderName: row.sender_name, senderMailbox: row.sender_mailbox };
      }),
  };
}

/**
 * Records the end of one attempt, only while the row is still `sending` AND carries the attempt number the claim gave this run. Returns whether a row changed. A `failed` row keeps the time
 * of its last attempt in `next_attempt_at` (it is never due again, so the column is free to say so): the Settings notice reads "in the last 7 days" from it.
 */
function finish(
  db: PrismaClient,
  secretEvents: string[],
  row: OutboxRowRef,
  status: 'sent' | 'failed' | 'skipped',
  code: OutboxErrorCode | null,
  times: { readonly sentAt?: Date; readonly failedAt?: Date },
): Promise<boolean> {
  return withDatabaseErrors(async () => {
    const changed = await db.$executeRaw`
      UPDATE email_outbox SET
        status = ${status},
        last_error = ${code},
        sent_at = ${times.sentAt ?? null}::timestamptz,
        next_attempt_at = COALESCE(${times.failedAt ?? null}::timestamptz, next_attempt_at),
        locked_until = NULL,
        body_html = CASE WHEN event = ANY(${secretEvents}::text[]) THEN '' ELSE body_html END,
        body_text = CASE WHEN event = ANY(${secretEvents}::text[]) THEN '' ELSE body_text END
      WHERE id = ${row.id}::uuid AND status = 'sending' AND attempts = ${row.attempts}`;
    return changed === 1;
  });
}

const adminRowSchema = z.object({ id: z.string() });

/**
 * The way `backup-watch` queues its e-mail to the Admin (STORY-09.06 AC-10, decision D-a; `BackupMissedAlert` in `src/server/jobs/backup-watch.ts`). In ONE transaction it reads the alerts
 * switch, finds the one active Admin by role in `users` (the table's unique index allows only one) and writes the row with the Admin's ID as the To and no Cc: the outbox holds a user ID, never an
 * address (NFR-028, DL-262), and `outbox-send` reads the address again, active only, when it sends. With the switch OFF, or with no active Admin, nothing is written. The key is the caller's
 * (`backup-missed:<IST date>`), so a second run on the same date queues nothing. No address is taken from anywhere but `users`.
 */
export function createBackupMissedQueue(db: PrismaClient): BackupMissedAlert {
  const outbox = createEmailOutboxRepository(db);
  const transactions = createTransactionRunner(db);
  return {
    queue: (mail, now) =>
      transactions.run(async (tx): Promise<BackupMissedQueued> => {
        const client = clientFor(db, tx);
        const settings = z.array(settingsRowSchema).parse(await client.$queryRaw`SELECT alerts_enabled, sender_name, sender_mailbox FROM settings WHERE id = 1`)[0];
        if (settings?.alerts_enabled !== true) return 'alerts-off';
        const admin = z.array(adminRowSchema).parse(await client.$queryRaw`SELECT id::text AS id FROM users WHERE role = 'ADMIN'::user_role AND is_active ORDER BY created_at, id LIMIT 1`)[0];
        if (admin === undefined) return 'no-admin';
        return outbox.enqueue(tx, { ...mail, toUserId: admin.id, ccUserIds: [] }, now);
      }),
  };
}
