import { schedule, type ScheduledTask } from 'node-cron';

import type { OutboxErrorCode, SendFailureCode, SendResult, SkipCode } from '../../lib/mail/codes';
import { type Clock, MILLISECONDS_PER_MINUTE } from '../../lib/time';
import type { Mailer, MailSender } from '../mail/send';

import { runJob, type JobLogger, type JobOutcome } from './run-job';

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

/** The job's name in the log and in the worker's schedule. It writes no `job_runs` row: its record is the `email_outbox` rows themselves. */
export const OUTBOX_SEND_JOB = 'outbox-send';

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
  /** Messages the mail server accepted (counted in `sent`) whose `sent` mark could not be written: the row stays `sending`, never `failed` (code `NOT_RECORDED` in the log). */
  readonly notRecorded: number;
}

function sender(settings: { readonly senderName: string; readonly senderMailbox: string }): MailSender {
  return { name: settings.senderName, mailbox: settings.senderMailbox };
}

/**
 * One run. A problem with one row before or during the send (a database error while resolving its recipients, say) marks that row `failed` with `UNKNOWN` and the run goes on with the
 * next; a message the mail server accepted is `sent` even if the mark cannot be saved (the row then stays `sending`, never `failed`). It throws only when the claim itself fails, and then no row has been touched.
 */
export async function runOutboxSend(dependencies: OutboxSendDependencies): Promise<OutboxSendSummary> {
  const { store, mailer, clock } = dependencies;
  const now = clock.now();
  const { claimed, skipped } = await store.claimDue(now, OUTBOX_CLAIM_LIMIT, new Date(now.getTime() + OUTBOX_LOCK_MILLISECONDS));

  let sent = 0;
  let skippedAfterClaim = 0;
  let failed = 0;
  let notRecorded = 0;
  const failures: Partial<Record<SendFailureCode, number>> = {};
  const fail = async (id: string, code: SendFailureCode): Promise<void> => {
    failed += 1;
    failures[code] = (failures[code] ?? 0) + 1;
    await store.markFailed(id, code);
  };

  for (const row of claimed) {
    // Step 1: everything up to and including the send. A failure here means the message did not leave (or we cannot tell what to send), so the row is marked `failed`.
    let result: SendResult;
    try {
      const recipients = await store.resolveRecipients(row.toUserId, row.ccUserIds);
      if (recipients.to === null) {
        skippedAfterClaim += 1;
        await store.markSkipped(row.id, 'NO_RECIPIENT');
        continue;
      }
      // The From is read from `settings` for each message, at send time: a change made while a run is going applies to the next message.
      const from = sender(await store.readMailSettings());
      result = await mailer.send({ to: recipients.to, cc: recipients.cc, subject: row.subject, html: row.bodyHtml, text: row.bodyText }, from);
    } catch {
      // Not logged and not kept: a database error can carry a connection detail. If even the mark fails, the row stays `sending` for 09.06's recovery.
      await fail(row.id, 'UNKNOWN').catch(() => undefined);
      continue;
    }
    if (!result.ok) {
      await fail(row.id, result.code).catch(() => undefined);
      continue;
    }
    // Step 2: the message was accepted by the mail server, so it counts as sent whatever happens to the mark. If the database cannot record it, the row stays `sending` ("may have
    // left") and is never marked `failed`: a failed row is one that 09.06 may retry, and a retry would send this message twice (NFR-014). The run says so with a count and a code.
    sent += 1;
    const recorded = await store.markSent(row.id, clock.now()).catch(() => false);
    if (!recorded) notRecorded += 1;
  }

  return { claimed: claimed.length, sent, skipped: skipped.length + skippedAfterClaim, failed, failures, notRecorded };
}

/** One line for the worker's log: counts and codes only. */
export function describeOutboxSend(summary: OutboxSendSummary): string {
  const codes = Object.entries(summary.failures).map(([code, count]) => `${code} ${count}`);
  const failureText = codes.length === 0 ? '' : ` (${codes.join(', ')})`;
  const unrecordedText = summary.notRecorded === 0 ? '' : `; NOT_RECORDED ${summary.notRecorded} (sent, but the result could not be saved, so the row stays sending)`;
  return `outbox-send: claimed ${summary.claimed}, sent ${summary.sent}, skipped ${summary.skipped}, failed ${summary.failed}${failureText}${unrecordedText}`;
}

/**
 * One scheduled run, for the wrapper's log line (`run-job.ts`). A run that did nothing is a `debug` line, so an empty outbox every minute does not fill the log. It throws only when the claim
 * fails (`runOutboxSend`); the wrapper then logs the failure by the class of the error only (a database error can carry a connection detail).
 */
export async function performOutboxSend(dependencies: OutboxSendDependencies): Promise<JobOutcome> {
  const summary = await runOutboxSend(dependencies);
  if (summary.claimed + summary.skipped === 0) return { level: 'debug' };
  return { summary: describeOutboxSend(summary), level: summary.failed > 0 || summary.notRecorded > 0 ? 'error' : 'info' };
}

/**
 * Schedules the mail jobs, or none (AC-6). With `FEATURE_EMAIL` off the mail jobs are not scheduled at all and one info line says so; the Settings test e-mail (STORY-09.02) does not
 * depend on the flag, because it is how Accucut IT proves the mailbox before the flag is turned on. The overdue scan and the digest (09.04, 09.05) are added to this list by those stories.
 */
/** `dependencies` is a function so that nothing (no database client, no mail transport) is built when the flag is off. */
export function scheduleMailJobs(enabled: boolean, dependencies: () => OutboxSendDependencies, log: JobLogger): ScheduledTask[] {
  if (!enabled) {
    log('mail jobs are off: FEATURE_EMAIL is not on, so outbox-send is not scheduled');
    return [];
  }
  const built = dependencies();
  const outboxSend = schedule(
    OUTBOX_SEND_CRON,
    () => runJob({ name: OUTBOX_SEND_JOB, log, now: () => built.clock.now(), frequent: true }, () => performOutboxSend(built)),
    { name: OUTBOX_SEND_JOB, timezone: OUTBOX_SEND_TIMEZONE, noOverlap: true },
  );
  log('outbox-send scheduled every minute');
  return [outboxSend];
}
