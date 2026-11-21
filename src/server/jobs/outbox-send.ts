import { schedule, type ScheduledTask } from 'node-cron';

import type { SendFailureCode, SendResult, SkipCode } from '../../lib/mail/codes';
import { nextAttempt } from '../../lib/mail/retry';
import { type Clock, MILLISECONDS_PER_MINUTE } from '../../lib/time';
import type { Mailer, MailSender } from '../mail/send';

import { runJob, type FailedJobRun, type JobLogger, type JobOutcome } from './run-job';

/**
 * The worker job `outbox-send` (STORY-09.01 AC-4 to AC-6; STORY-09.06 AC-1 to AC-9; architecture section 4.7; ADR-011; FR-084, NFR-014, NFR-024).
 *
 * Every minute it claims up to 25 due rows of `email_outbox` in ONE short statement (`FOR UPDATE SKIP LOCKED`, status `sending`, locked for 5 minutes), so no row is held in an open
 * transaction while SMTP runs (`idle_in_transaction_session_timeout` is 30 s, architecture section 3), and two runs at once send each row once. The same statement marks as
 * `skipped`, and never sends, a row past its `send_before` and an alert event while the alerts switch is off (a skipped row is final), and it takes back a row that a dead worker left
 * `sending` once its lock has run out. Then, for each claimed row, it reads the sender from `settings`, resolves the To and Cc addresses from `users` (active people only, NFR-028),
 * sends an HTML and a plain-text body, and records the result.
 *
 * Retry (STORY-09.06 AC-1, ADR-011): a send that fails leaves the row `pending` with the class code in `last_error` and `next_attempt_at` 1, 5 and then 15 minutes later
 * (`nextAttempt`, `RETRY_BACKOFF_MINUTES`). The claim counts an attempt each time it takes a row, so the first send and three retries are four attempts; when the fourth fails the row is
 * `failed` and is never claimed again. The Settings page shows how many rows failed (AC-8). `skipped` is final at every attempt: a row waiting for its retry while alerts are switched off
 * is skipped, not sent (AC-7, BR-040).
 *
 * The lease (AC-4, review follow-up SQR-03 of STORY-09.01). A lock of 5 minutes is not enough for a batch of 25 sends against a slow server, so the row's lease is checked and renewed in ONE
 * statement just before its own send (`beginSend`). The statement is fenced by the attempt number the claim gave the row: every claim, including a take-back, raises it, so a run whose
 * lease was lost (it stopped for longer than the lock and another run took the row) finds the number changed, sends nothing and writes nothing, and a row that is still inside its lease is
 * never taken by another run. A row past its `send_before` by then is skipped as `EXPIRED` there.
 *
 * THE ONE WINDOW THAT REMAINS (NFR-014, "at least once"). If the process dies after the mail server accepted a message and before `sent` is written, the row is still `sending`; when its lease
 * has passed it is claimed again and the message is sent a second time. The window is one `UPDATE` wide, and the alternative (never resending a row that may have left) would lose the
 * message instead. A row that has already used its four attempts is not taken back: it is marked `failed` with `UNKNOWN`, so a message that kills the worker cannot be sent for ever.
 *
 * What the job writes to the log: one line per attempt (AC-5) with the row's ID, the event, the attempt number, the result (`sent`, `retry`, `failed`, `skipped`) and a class code, and one
 * summary line per run; never an address, a subject, a body, a user ID or a message from the mail server, so a secret or a person's detail cannot reach a log line (NFR-006, NFR-024). A run that
 * handled at least one row, or that failed, writes one `job_runs` row with counts only (AC-6); a run that found nothing due writes only a `debug` line (decision D-e), because 1,440 empty rows a
 * day would fill an append-only table.
 *
 * It imports no repository, service, driver or cost module (`tests/security/engineer-import-rule.test.ts` classes it): the worker passes the store, the mailer, the logger, the run writer and
 * the clock in, and the only mail modules it names are types. The clock is a parameter, so a test controls time.
 */

/** The job's name in the log and in the worker's schedule, and the `job` of its `job_runs` rows. */
export const OUTBOX_SEND_JOB = 'outbox-send';

/** Every minute, in Indian Standard Time (architecture section 4.7). */
export const OUTBOX_SEND_CRON = '* * * * *';
export const OUTBOX_SEND_TIMEZONE = 'Asia/Kolkata';

/** At most 25 rows a run, so the job stays under Microsoft's 30 messages a minute (architecture section 4.7). */
export const OUTBOX_CLAIM_LIMIT = 25;

/** How long a claim, and each renewal before a send, holds a row: longer than any one send can take (the transport's timeouts are 15 s and 30 s). */
export const OUTBOX_LOCK_MILLISECONDS = 5 * MILLISECONDS_PER_MINUTE;

export { MAX_SEND_ATTEMPTS, nextAttempt, RETRY_BACKOFF_MINUTES } from '../../lib/mail/retry';

/** A claimed row as the marks name it. `attempts` is the number the claim gave it: the fence of every write. */
export interface OutboxRowRef {
  readonly id: string;
  readonly attempts: number;
}

/** A row the job holds, as the store hands it over. */
export interface OutboxJobMessage extends OutboxRowRef {
  readonly event: string;
  readonly toUserId: string;
  readonly ccUserIds: ReadonlyArray<string>;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}

/** A row the claim itself ended: skipped (past `send_before`, alerts off) or given up on (a taken-back row with no attempt left). */
export interface ClaimEnded<Code> extends OutboxRowRef {
  readonly event: string;
  readonly code: Code;
}

/** What `beginSend` says: send (the lease is renewed), the row is past its `send_before` (and is now `skipped`), or another run took the row (send nothing). */
export type SendLease = 'go' | 'expired' | 'lost';

/** What the job needs from the database. `createEmailOutboxRepository` in `src/server/repositories` fits it, and the worker passes it in. */
export interface OutboxSendStore {
  claimDue(
    now: Date,
    limit: number,
    lockedUntil: Date,
  ): Promise<{ readonly claimed: ReadonlyArray<OutboxJobMessage>; readonly skipped: ReadonlyArray<ClaimEnded<SkipCode>>; readonly failed: ReadonlyArray<ClaimEnded<SendFailureCode>> }>;
  beginSend(row: OutboxRowRef, now: Date, lockedUntil: Date): Promise<SendLease>;
  resolveRecipients(toUserId: string, ccUserIds: ReadonlyArray<string>): Promise<{ readonly to: string | null; readonly cc: ReadonlyArray<string> }>;
  readMailSettings(): Promise<{ readonly senderName: string; readonly senderMailbox: string }>;
  markSent(row: OutboxRowRef, now: Date): Promise<boolean>;
  markRetry(row: OutboxRowRef, code: SendFailureCode, nextAttemptAt: Date): Promise<boolean>;
  markFailed(row: OutboxRowRef, code: SendFailureCode, now: Date): Promise<boolean>;
  markSkipped(row: OutboxRowRef, code: SkipCode): Promise<boolean>;
}

/** The `job_runs` row of a run that handled rows: counts and a status, nothing about a message or a person. */
export interface OutboxJobRun {
  readonly job: typeof OUTBOX_SEND_JOB;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: { readonly status: 'ok'; readonly claimed: number; readonly sent: number; readonly retrying: number; readonly failed: number; readonly skipped: number };
}

export interface OutboxSendDependencies {
  readonly store: OutboxSendStore;
  readonly mailer: Mailer;
  readonly clock: Clock;
  /** The worker's logger: one line per attempt goes here (AC-5). */
  readonly log: JobLogger;
  /** Writes a `job_runs` row. The wrapper (`run-job.ts`) also uses it for the `failed` row of a run that threw. */
  readonly jobRuns: { recordRun(run: OutboxJobRun | FailedJobRun): Promise<void> };
}

export interface OutboxSendSummary {
  /** Every row the claim took: those to send, those it skipped and those it gave up on. */
  readonly claimed: number;
  readonly sent: number;
  /** Rows marked `skipped`: by the claim (expired, alerts off), by `beginSend` (expired since the claim) or after it (no recipient). */
  readonly skipped: number;
  /** Rows whose send failed and that wait for their next attempt. */
  readonly retrying: number;
  /** Rows now `failed` for good (the 4th attempt failed, or a taken-back row had none left). */
  readonly failed: number;
  /** The failed rows by class code. */
  readonly failures: Readonly<Partial<Record<SendFailureCode, number>>>;
  /** Rows that another run took before this run reached them (its lease had passed): nothing was sent or written for them here. */
  readonly lost: number;
  /** Messages the mail server accepted (counted in `sent`) whose `sent` mark could not be written: the row stays `sending` (code `NOT_RECORDED` in the log). */
  readonly notRecorded: number;
}

function sender(settings: { readonly senderName: string; readonly senderMailbox: string }): MailSender {
  return { name: settings.senderName, mailbox: settings.senderMailbox };
}

type AttemptResult = 'sent' | 'retry' | 'failed' | 'skipped';

/** The code of a log line: a class code, or the one extra word of an attempt whose mark could not be saved. */
type AttemptCode = SendFailureCode | SkipCode | 'NOT_RECORDED';

/** One line per attempt (AC-5): the row's ID, the event, the attempt number, the result and a code. Scalars only: nothing else can be put in the line. */
function logAttempt(log: JobLogger, row: { readonly id: string; readonly event: string; readonly attempts: number }, result: AttemptResult, code?: AttemptCode): void {
  const level = result === 'failed' || code === 'NOT_RECORDED' ? 'error' : 'info';
  const fields = { job: OUTBOX_SEND_JOB, outboxId: row.id, event: row.event, attempt: row.attempts, result, ...(code === undefined ? {} : { code }) };
  try {
    log(`outbox attempt ${result}`, level, fields);
  } catch {
    // A logger that throws (a closed stream) must not stop the run or change what was sent.
  }
}

/**
 * One run. A problem with one row before or during the send (a database error while resolving its recipients, say) is a failed attempt of that row with `UNKNOWN` (retried like any other) and
 * the run goes on with the next; a message the mail server accepted is `sent` even if the mark cannot be saved (the row then stays `sending`, never `pending` or `failed`). It throws only
 * when the claim itself fails, and then no row has been touched.
 */
export async function runOutboxSend(dependencies: OutboxSendDependencies): Promise<OutboxSendSummary> {
  const { store, mailer, clock, log } = dependencies;
  const startedAt = clock.now();
  const claim = await store.claimDue(startedAt, OUTBOX_CLAIM_LIMIT, new Date(startedAt.getTime() + OUTBOX_LOCK_MILLISECONDS));

  let sent = 0;
  let skipped = claim.skipped.length;
  let retrying = 0;
  let failed = claim.failed.length;
  let lost = 0;
  let notRecorded = 0;
  const failures: Partial<Record<SendFailureCode, number>> = {};
  for (const ended of claim.skipped) logAttempt(log, ended, 'skipped', ended.code);
  for (const ended of claim.failed) {
    failures[ended.code] = (failures[ended.code] ?? 0) + 1;
    logAttempt(log, ended, 'failed', ended.code);
  }

  /** A failed attempt: the next one is due after the backoff, or the row is final. If even the mark fails, the row stays `sending` and is taken back when its lease has passed. */
  const failAttempt = async (row: OutboxJobMessage, ref: OutboxRowRef, code: SendFailureCode): Promise<void> => {
    const now = clock.now();
    const next = nextAttempt(row.attempts, now);
    if (next === null) {
      failed += 1;
      failures[code] = (failures[code] ?? 0) + 1;
      await store.markFailed(ref, code, now).catch(() => false);
      logAttempt(log, row, 'failed', code);
      return;
    }
    retrying += 1;
    await store.markRetry(ref, code, next).catch(() => false);
    logAttempt(log, row, 'retry', code);
  };

  for (const row of claim.claimed) {
    // The store is told the row's ID and its attempt number (the fence) and nothing of its content.
    const ref: OutboxRowRef = { id: row.id, attempts: row.attempts };
    // Step 1: everything up to and including the send. A failure here means the message did not leave (or we cannot tell what to send), so the attempt failed.
    let result: SendResult;
    try {
      const lease = await store.beginSend(ref, clock.now(), new Date(clock.now().getTime() + OUTBOX_LOCK_MILLISECONDS));
      if (lease === 'lost') {
        lost += 1;
        continue;
      }
      if (lease === 'expired') {
        skipped += 1;
        logAttempt(log, row, 'skipped', 'EXPIRED');
        continue;
      }
      const recipients = await store.resolveRecipients(row.toUserId, row.ccUserIds);
      if (recipients.to === null) {
        skipped += 1;
        // If the mark cannot be saved the row stays `sending` and is taken back when its lease has passed; it is not a failed attempt.
        await store.markSkipped(ref, 'NO_RECIPIENT').catch(() => false);
        logAttempt(log, row, 'skipped', 'NO_RECIPIENT');
        continue;
      }
      // The From is read from `settings` for each message, at send time: a change made while a run is going applies to the next message.
      const from = sender(await store.readMailSettings());
      result = await mailer.send({ to: recipients.to, cc: recipients.cc, subject: row.subject, html: row.bodyHtml, text: row.bodyText }, from);
    } catch {
      // Not logged and not kept: a database error can carry a connection detail.
      await failAttempt(row, ref, 'UNKNOWN');
      continue;
    }
    if (!result.ok) {
      await failAttempt(row, ref, result.code);
      continue;
    }
    // Step 2: the message was accepted by the mail server, so it counts as sent whatever happens to the mark. If the database cannot record it, the row stays `sending` ("may have
    // left") and is never marked `pending` or `failed`: a retry would send this message twice (NFR-014). The run says so with a count and a code.
    sent += 1;
    const recorded = await store.markSent(ref, clock.now()).catch(() => false);
    if (!recorded) notRecorded += 1;
    logAttempt(log, row, 'sent', recorded ? undefined : 'NOT_RECORDED');
  }

  return { claimed: claim.claimed.length + claim.skipped.length + claim.failed.length, sent, skipped, retrying, failed, failures, lost, notRecorded };
}

/** One line for the worker's log: counts and codes only. */
export function describeOutboxSend(summary: OutboxSendSummary): string {
  const codes = Object.entries(summary.failures).map(([code, count]) => `${code} ${count}`);
  const failureText = codes.length === 0 ? '' : ` (${codes.join(', ')})`;
  const lostText = summary.lost === 0 ? '' : `; lost ${summary.lost} (taken by another run, not sent here)`;
  const unrecordedText = summary.notRecorded === 0 ? '' : `; NOT_RECORDED ${summary.notRecorded} (sent, but the result could not be saved, so the row stays sending)`;
  return `outbox-send: claimed ${summary.claimed}, sent ${summary.sent}, retrying ${summary.retrying}, skipped ${summary.skipped}, failed ${summary.failed}${failureText}${lostText}${unrecordedText}`;
}

/**
 * One scheduled run, for the wrapper's log line (`run-job.ts`). A run that did nothing is a `debug` line and writes no row, so an empty outbox every minute fills neither the log nor
 * `job_runs` (decision D-e); a run that handled rows writes one `job_runs` row with counts (AC-6). It throws when the claim fails or the row cannot be written; the wrapper then logs the
 * failure by the class of the error only (a database error can carry a connection detail), writes a `failed` row if it can, and the next minute's run still happens.
 */
export async function performOutboxSend(dependencies: OutboxSendDependencies): Promise<JobOutcome> {
  const startedAt = dependencies.clock.now();
  const summary = await runOutboxSend(dependencies);
  if (summary.claimed === 0) return { level: 'debug' };
  await dependencies.jobRuns.recordRun({
    job: OUTBOX_SEND_JOB,
    startedAt,
    finishedAt: dependencies.clock.now(),
    result: { status: 'ok', claimed: summary.claimed, sent: summary.sent, retrying: summary.retrying, failed: summary.failed, skipped: summary.skipped },
  });
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
    () => runJob({ name: OUTBOX_SEND_JOB, log, now: () => built.clock.now(), frequent: true, recordFailure: (run) => built.jobRuns.recordRun(run) }, () => performOutboxSend(built)),
    { name: OUTBOX_SEND_JOB, timezone: OUTBOX_SEND_TIMEZONE, noOverlap: true },
  );
  log('outbox-send scheduled every minute');
  return [outboxSend];
}
