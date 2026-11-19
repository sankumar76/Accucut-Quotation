import { z } from 'zod';

import { ALERT_EVENTS, isMailEvent, type MailEvent, SECRET_BEARING_EVENTS } from '../../lib/mail/events';
import type { OutboxErrorCode, SkipCode } from '../../lib/mail/codes';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * The e-mail outbox and the mail settings (STORY-09.01, FR-081 to FR-084, FR-003; architecture sections 4.7 and 5.1; ADR-011). Raw SQL lives only here, as tagged templates, and
 * every row that comes back is parsed (coding standards section 10, "SQL"). This file is the whole write API of the outbox, and the contract that STORY-09.02 to 09.07 build on:
 *
 *   `enqueue(tx, message, now)`   one row in the caller's own transaction. The idempotency key is UNIQUE and the insert is `ON CONFLICT DO NOTHING`, so a repeated event queues
 *                                 nothing and says `already-queued`; if the caller's transaction rolls back, no row exists (AC-2).
 *   `claimDue(...)`               one short statement, never a held transaction: it takes at most `limit` due `pending` rows with `FOR UPDATE SKIP LOCKED`, marks them `sending` with a
 *                                 lock time, and in the same statement marks as `skipped` the rows that must not be sent (past `send_before`, or an alert event while the switch is off).
 *                                 Two runs at once never get the same row (AC-4, AC-5).
 *   `markSent`, `markFailed`, `markSkipped`   record the result of one claimed row. Each changes the row only while it is still `sending`, so a late or repeated call cannot undo an outcome.
 *   `resolveRecipients`           the addresses of the To and Cc users at send time, active users only (NFR-028: the outbox holds no address).
 *   `readMailSettings`            `alerts_enabled` and the sender, read when a message is sent (AC-5).
 *
 * A row whose event holds a secret (the reset link) has its two bodies emptied as it is sent, finally failed or skipped, in the same statement that records the outcome, so a live
 * link never outlasts the row's chance to be sent. `last_error` is only ever one of the class codes of `src/lib/mail/codes.ts`.
 *
 * Retry and backoff are STORY-09.06's: here a failed send is marked `failed` once, with `attempts` = 1. A row left `sending` by a worker that died stays so until 09.06 reclaims
 * expired locks, which is deliberate: a message that may already have left is never sent a second time (NFR-014, 0 duplicates).
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
  readonly attempts: number;
}

/** A row the claim marked `skipped` without sending, and why. */
export interface SkippedMessage {
  readonly id: string;
  readonly code: SkipCode;
}

export interface ClaimResult {
  readonly claimed: ReadonlyArray<ClaimedMessage>;
  readonly skipped: ReadonlyArray<SkippedMessage>;
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
  claimDue(now: Date, limit: number, lockedUntil: Date): Promise<ClaimResult>;
  markSent(id: string, now: Date): Promise<boolean>;
  markFailed(id: string, code: OutboxErrorCode): Promise<boolean>;
  markSkipped(id: string, code: SkipCode): Promise<boolean>;
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

const claimedRowSchema = z.object({
  id: z.string(),
  event: z.string(),
  to_user_id: z.string(),
  cc_user_ids: z.array(z.string()).nullable(),
  subject: z.string(),
  body_html: z.string(),
  body_text: z.string(),
  attempts: z.number(),
  status: z.enum(['sending', 'skipped']),
  last_error: z.enum([SKIP_REASON_EXPIRED, SKIP_REASON_ALERTS_OFF]).nullable(),
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

    claimDue: (now, limit, lockedUntil) =>
      withDatabaseErrors(async () => {
        // One statement, so no row is held in an open transaction while SMTP runs. `decided` reads the alerts switch in the same snapshot as the claim, so a switch turned off
        // after the claim cannot unsend a row and one turned off before it cannot be missed. A skipped secret-bearing row has its bodies emptied here.
        const rows = await db.$queryRaw`
          WITH due AS (
            SELECT id
            FROM email_outbox
            WHERE status = 'pending' AND next_attempt_at <= ${now}::timestamptz
            ORDER BY next_attempt_at, created_at, id
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          ), decided AS (
            SELECT o.id,
              CASE
                WHEN o.send_before IS NOT NULL AND o.send_before <= ${now}::timestamptz THEN ${SKIP_REASON_EXPIRED}
                WHEN o.event = ANY(${alertEvents}::text[]) AND NOT COALESCE((SELECT alerts_enabled FROM settings WHERE id = 1), false) THEN ${SKIP_REASON_ALERTS_OFF}
              END AS skip_reason
            FROM email_outbox o
            JOIN due ON due.id = o.id
          )
          UPDATE email_outbox AS o SET
            status = CASE WHEN d.skip_reason IS NULL THEN 'sending' ELSE 'skipped' END,
            attempts = CASE WHEN d.skip_reason IS NULL THEN o.attempts + 1 ELSE o.attempts END,
            locked_until = CASE WHEN d.skip_reason IS NULL THEN ${lockedUntil}::timestamptz ELSE NULL END,
            last_error = d.skip_reason,
            body_html = CASE WHEN d.skip_reason IS NOT NULL AND o.event = ANY(${secretEvents}::text[]) THEN '' ELSE o.body_html END,
            body_text = CASE WHEN d.skip_reason IS NOT NULL AND o.event = ANY(${secretEvents}::text[]) THEN '' ELSE o.body_text END
          FROM decided d
          WHERE o.id = d.id
          RETURNING o.id, o.event, o.to_user_id, o.cc_user_ids, o.subject, o.body_html, o.body_text, o.attempts, o.status, o.last_error, o.created_at, o.next_attempt_at`;
        const parsed = z.array(claimedRowSchema).parse(rows);
        // RETURNING has no order, so the oldest due row is sent first, as the claim chose it.
        const ordered = [...parsed].sort((a, b) => a.next_attempt_at.getTime() - b.next_attempt_at.getTime() || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));
        const claimed: ClaimedMessage[] = [];
        const skipped: SkippedMessage[] = [];
        for (const row of ordered) {
          if (row.status === 'sending') {
            claimed.push({ id: row.id, event: row.event, toUserId: row.to_user_id, ccUserIds: row.cc_user_ids ?? [], subject: row.subject, bodyHtml: row.body_html, bodyText: row.body_text, attempts: row.attempts });
          } else if (row.last_error !== null) {
            skipped.push({ id: row.id, code: row.last_error });
          }
        }
        return { claimed, skipped };
      }),

    markSent: (id, now) => finish(db, secretEvents, id, 'sent', null, now),
    markFailed: (id, code) => finish(db, secretEvents, id, 'failed', code, null),
    markSkipped: (id, code) => finish(db, secretEvents, id, 'skipped', code, null),

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

/** Records the end of one claimed row, only while it is still `sending`. Returns whether a row changed. */
function finish(db: PrismaClient, secretEvents: string[], id: string, status: 'sent' | 'failed' | 'skipped', code: OutboxErrorCode | null, sentAt: Date | null): Promise<boolean> {
  return withDatabaseErrors(async () => {
    const changed = await db.$executeRaw`
      UPDATE email_outbox SET
        status = ${status},
        last_error = ${code},
        sent_at = ${sentAt}::timestamptz,
        locked_until = NULL,
        body_html = CASE WHEN event = ANY(${secretEvents}::text[]) THEN '' ELSE body_html END,
        body_text = CASE WHEN event = ANY(${secretEvents}::text[]) THEN '' ELSE body_text END
      WHERE id = ${id}::uuid AND status = 'sending'`;
    return changed === 1;
  });
}
