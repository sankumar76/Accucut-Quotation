import { schedule, type ScheduledTask } from 'node-cron';

import type { OutboxErrorCode, SendFailureCode, SkipCode } from '../../lib/mail/codes';
import { type Clock, MILLISECONDS_PER_MINUTE } from '../../lib/time';
import type { Mailer, MailSender } from '../mail/send';

/**
 * The worker job `outbox-send` (STORY-09.01 AC-4, AC-5, AC-6; architecture section 4.7; ADR-011; FR-084, NFR-014).
 *
 * Every minute it claims up to 25 due rows of `email_outbox` in ONE short statement (`FOR UPDATE SKIP LOCKED`, status `sending`, locked for 5 minutes), so no row is held in an open
 * transaction while SMTP runs (`idle_in_transaction_session_timeout` is 30 s, architecture section 3), and two runs at once send each row once. The same statement marks as
 * `skipped`, and never sends, a row past its `send_before` and an alert event while the alerts switch is off (a skipped row is final). Then, for each claimed row, it reads the
 * sender from `settings`, resolves the To and Cc addresses from `users` (active people only, NFR-028), sends an HTML and a plain-text body, and records `sent`, or `failed` with
 * one class code, or `skipped` with `NO_RECIPIENT`. Retry and backoff are STORY-09.06's: here a failure is final, with `attempts` = 1.
 *
 * What the job writes to the log: counts and class codes, never an address, a subject, a body, a user ID or a message from the mail server, so a secret or a person's detail cannot
 * reach a log line (AC-7, NFR-024).
 *
 * It imports no repository, service, driver or cost module (`tests/security/engineer-import-rule.test.ts` classes it): the worker passes the store, the mailer and the clock in, and the
 * only mail modules it names are types. The clock is a parameter, so a test controls time.
 */

/** Every minute, in Indian Standard Time (architecture section 4.7). */
export const OUTBOX_SEND_CRON = '* * * * *';
export const OUTBOX_SEND_TIMEZONE = 'Asia/Kolkata';

/** At most 25 rows a run, so the job stays under Microsoft's 30 messages a minute (architecture section 4.7). */
export const OUTBOX_CLAIM_LIMIT = 25;

/** How long a claim holds a row: longer than any send can take (the transport's timeouts are 15 s and 30 s). */
export const OUTBOX_LOCK_MILLISECONDS = 5 * MILLISECONDS_PER_MINUTE;

/** A row the job holds, as the store hands it over. */
export interface OutboxJobMessage {
  readonly id: string;
  readonly toUserId: string;
  readonly ccUserIds: ReadonlyArray<string>;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}

/** What the job needs from the database. `createEmailOutboxRepository` in `src/server/repositories` fits it, and the worker passes it in. */
export interface OutboxSendStore {
  claimDue(now: Date, limit: number, lockedUntil: Date): Promise<{ readonly claimed: ReadonlyArray<OutboxJobMessage>; readonly skipped: ReadonlyArray<{ readonly id: string; readonly code: SkipCode }> }>;
  resolveRecipients(toUserId: string, ccUserIds: ReadonlyArray<string>): Promise<{ readonly to: string | null; readonly cc: ReadonlyArray<string> }>;
  readMailSettings(): Promise<{ readonly senderName: string; readonly senderMailbox: string }>;
  markSent(id: string, now: Date): Promise<boolean>;
  markFailed(id: string, code: OutboxErrorCode): Promise<boolean>;
  markSkipped(id: string, code: SkipCode): Promise<boolean>;
}

export interface OutboxSendDependencies {
  readonly store: OutboxSendStore;
  readonly mailer: Mailer;
  readonly clock: Clock;
}

export interface OutboxSendSummary {
  readonly claimed: number;
  readonly sent: number;
  /** Rows marked `skipped`: by the claim (expired, alerts off) or after it (no recipient). */
  readonly skipped: number;
  readonly failed: number;
  /** The failed rows by class code. */
  readonly failures: Readonly<Partial<Record<SendFailureCode, number>>>;
}

export type OutboxLogger = (message: string, level?: 'info' | 'error') => void;

function sender(settings: { readonly senderName: string; readonly senderMailbox: string }): MailSender {
  return { name: settings.senderName, mailbox: settings.senderMailbox };
}

/**
 * One run. A problem with one row (a database error while resolving its recipients, say) marks that row `failed` with `UNKNOWN` and the run goes on with the next; it throws only
 * when the claim itself fails, and then no row has been touched.
 */
export async function runOutboxSend(dependencies: OutboxSendDependencies): Promise<OutboxSendSummary> {
  const { store, mailer, clock } = dependencies;
  const now = clock.now();
  const { claimed, skipped } = await store.claimDue(now, OUTBOX_CLAIM_LIMIT, new Date(now.getTime() + OUTBOX_LOCK_MILLISECONDS));

  let sent = 0;
  let skippedAfterClaim = 0;
  let failed = 0;
  const failures: Partial<Record<SendFailureCode, number>> = {};
  const fail = async (id: string, code: SendFailureCode): Promise<void> => {
    failed += 1;
    failures[code] = (failures[code] ?? 0) + 1;
    await store.markFailed(id, code);
  };

  for (const row of claimed) {
    try {
      const recipients = await store.resolveRecipients(row.toUserId, row.ccUserIds);
      if (recipients.to === null) {
        skippedAfterClaim += 1;
        await store.markSkipped(row.id, 'NO_RECIPIENT');
        continue;
      }
      // The From is read from `settings` for each message, at send time: a change made while a run is going applies to the next message.
      const from = sender(await store.readMailSettings());
      const result = await mailer.send({ to: recipients.to, cc: recipients.cc, subject: row.subject, html: row.bodyHtml, text: row.bodyText }, from);
      if (result.ok) {
        sent += 1;
        await store.markSent(row.id, clock.now());
      } else {
        await fail(row.id, result.code);
      }
    } catch {
      // Not logged and not kept: a database error can carry a connection detail. If even the mark fails, the row stays `sending` and 09.06's lock expiry picks it up.
      try {
        await fail(row.id, 'UNKNOWN');
      } catch {
        // Nothing more can be done for this row in this run.
      }
    }
  }

  return { claimed: claimed.length, sent, skipped: skipped.length + skippedAfterClaim, failed, failures };
}

/** One line for the worker's log: counts and codes only. */
export function describeOutboxSend(summary: OutboxSendSummary): string {
  const codes = Object.entries(summary.failures).map(([code, count]) => `${code} ${count}`);
  const failureText = codes.length === 0 ? '' : ` (${codes.join(', ')})`;
  return `outbox-send: claimed ${summary.claimed}, sent ${summary.sent}, skipped ${summary.skipped}, failed ${summary.failed}${failureText}`;
}

/** One scheduled run, never throwing: the cron callback must survive a database problem. A run that did nothing writes no line. */
export async function performOutboxSend(dependencies: OutboxSendDependencies, log: OutboxLogger): Promise<void> {
  try {
    const summary = await runOutboxSend(dependencies);
    if (summary.claimed + summary.skipped === 0) return;
    log(describeOutboxSend(summary), summary.failed > 0 ? 'error' : 'info');
  } catch {
    // The reason is not logged: a database error can carry a connection detail.
    log('outbox-send could not read or write the outbox', 'error');
  }
}

/**
 * Schedules the mail jobs, or none (AC-6). With `FEATURE_EMAIL` off the mail jobs are not scheduled at all and one info line says so; the Settings test e-mail (STORY-09.02) does not
 * depend on the flag, because it is how Accucut IT proves the mailbox before the flag is turned on. The overdue scan and the digest (09.04, 09.05) are added to this list by those stories.
 */
/** `dependencies` is a function so that nothing (no database client, no mail transport) is built when the flag is off. */
export function scheduleMailJobs(enabled: boolean, dependencies: () => OutboxSendDependencies, log: OutboxLogger): ScheduledTask[] {
  if (!enabled) {
    log('mail jobs are off: FEATURE_EMAIL is not on, so outbox-send is not scheduled');
    return [];
  }
  const built = dependencies();
  const outboxSend = schedule(
    OUTBOX_SEND_CRON,
    async () => {
      await performOutboxSend(built, log);
    },
    { name: 'outbox-send', timezone: OUTBOX_SEND_TIMEZONE, noOverlap: true },
  );
  log('outbox-send scheduled every minute');
  return [outboxSend];
}
