import { schedule, type ScheduledTask } from 'node-cron';

import { idempotencyKeys } from '../../lib/mail/events';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import { isOverdue } from '../../lib/tasks/overdue';
import { estimatePathOf } from '../../lib/tasks/task-link';
import { type Clock, MILLISECONDS_PER_HOUR } from '../../lib/time';
import { renderTaskOverdue } from '../mail/templates/task-overdue';

import { runJob, type FailedJobRun, type JobLogger, type JobOutcome } from './run-job';

/**
 * The worker job `overdue-scan` (STORY-09.04; FR-082; BR-040, BR-042, BR-044; NFR-010, NFR-014, NFR-024; architecture section 4.7; ADR-011; assumption A-09).
 *
 * Every minute, and only when `FEATURE_EMAIL=on`, it finds the open tasks whose deadline passed in the last 24 hours and writes one `email_outbox` row for each that has none yet. `outbox-send`
 * sends it at its next minute (so a message is in the mailbox within 2 minutes of the deadline, the target being 5, NFR-014). The job decides nothing about sending: it only queues.
 *
 *   - **One row per task and deadline.** The key is `task-overdue:<taskId>:<deadlineAtUtc>` (`idempotencyKeys.taskOverdue`) and the outbox's unique index enforces it, so ten scans, a restarted
 *     worker and two scans at once queue one row. A changed deadline is a new key, so a task that becomes overdue again is reported again (A-09). The key has no Engineer in it, so a task
 *     reassigned after its overdue e-mail went gets no second one for the same deadline: the new Engineer is told by the assignment e-mail and the digest.
 *   - **"Overdue" is the queue's rule**: the deadline strictly before the instant judged (`isOverdue`; the store's SQL says the same as `tabFilter` in `task-repository.ts`). The store returns only
 *     open tasks (the estimate is not APPROVED) of an active Engineer, and only those with no row for this deadline yet, so a steady state is one cheap read and no write.
 *   - **Recipients are user IDs, never addresses** (NFR-028, ruling DL-262, architecture section 4.7): the Engineer is the To, the assigner (a Lead or the Admin) the Cc, and only if they are
 *     active when the row is written. `outbox-send` reads `users.email` again when it sends, for active users only. No address is ever read from a request.
 *   - **The alerts switch** (BR-040) is read first; with it OFF nothing is asked of the database and no row is written. The 24-hour window (`OVERDUE_SCAN_WINDOW_MS`, decision D-c) means a switch-on
 *     or a worker outage cannot flood: a task that went overdue less than 24 hours before is reported once, an older one never by this e-mail (the daily digest lists it).
 *   - **NFR-010**: one read for the candidates, one transaction for the batch (the store's), however many tasks there are.
 *   - **NFR-024** (decision D-e): every run goes through `runJob`, which logs its start and its outcome (at `debug` for a run that did nothing, as `outbox-send` does, so the worker's log does not
 *     fill with a line a minute) and, for a failure, one `error` line with the class of the error and a `failed` `job_runs` row. A run that queued messages writes an `ok` row with the counts.
 *     A run that found nothing writes no row: that would be 1,440 rows a day in an append-only table.
 *
 * The log lines and the row hold counts and a status only: no name, address, path, task code or message text. The job imports no repository, service or driver
 * (`tests/security/engineer-import-rule.test.ts` classes it): the worker passes the store and the clock in, and every time comes from the clock.
 */

export const OVERDUE_SCAN_JOB = 'overdue-scan';

/** Every minute, in Indian Standard Time (architecture section 4.7). */
export const OVERDUE_SCAN_CRON = '* * * * *';
export const OVERDUE_SCAN_TIMEZONE = 'Asia/Kolkata';

/** How far back a deadline may lie and still be reported (decision D-c): the one constant of the window. */
export const OVERDUE_SCAN_WINDOW_MS = 24 * MILLISECONDS_PER_HOUR;

/** An open task that is overdue and has no message yet, as the store hands it over: plain fields, and the people by ID. */
export interface OverdueCandidate {
  readonly taskId: string;
  readonly code: string;
  readonly title: string | null;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  /** The active Engineer the task is assigned to: the To. */
  readonly engineerId: string;
  /** The Lead or the Admin who assigned it: the Cc, if active now (decision D-5). */
  readonly assigner: { readonly id: string; readonly name: string; readonly isActive: boolean };
}

/** A message for the outbox: a fixed shape of strings, recipients by ID. `createEmailOutboxRepository(...).enqueue` takes exactly this. */
export interface OverdueMail {
  readonly idempotencyKey: string;
  readonly event: 'task-overdue';
  readonly toUserId: string;
  readonly ccUserIds: ReadonlyArray<string>;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}

/** The `job_runs` row of a run that queued messages. Counts and a status, nothing about a task or a person. */
export interface OverdueScanRun {
  readonly job: typeof OVERDUE_SCAN_JOB;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: { readonly status: 'ok'; readonly found: number; readonly queued: number };
}

/** What the job needs from the database. `createOverdueScanStore` in `src/server/repositories/overdue-repository.ts` fits it, and the worker passes it in. */
export interface OverdueScanStore {
  /** `settings.alerts_enabled`. */
  alertsEnabled(): Promise<boolean>;
  /** The open tasks of active Engineers with a deadline in `[since, now)` and no outbox row for that deadline yet: one read. */
  findCandidates(now: Date, since: Date): Promise<ReadonlyArray<OverdueCandidate>>;
  /** Queues the messages in ONE transaction (a key already queued is not queued again) and says how many were new. */
  enqueueAll(messages: ReadonlyArray<OverdueMail>, now: Date): Promise<{ readonly queued: number }>;
  /** Writes a `job_runs` row. The wrapper (`run-job.ts`) also uses it for the `failed` row of a run that threw. */
  recordRun(run: OverdueScanRun | FailedJobRun): Promise<void>;
}

export interface OverdueScanDependencies {
  readonly store: OverdueScanStore;
  readonly clock: Clock;
  /** The validated `APP_ORIGIN` (scheme, host and port, no trailing slash), for the link of "Open the task". */
  readonly appOrigin: () => string;
}

export type OverdueScanOutcome =
  | { readonly status: 'skipped'; readonly reason: 'alerts-off' }
  | { readonly status: 'ok'; readonly found: number; readonly queued: number };

function toMail(task: OverdueCandidate, now: Date, origin: string): OverdueMail {
  const rendered = renderTaskOverdue({
    code: task.code,
    title: task.title,
    assignerName: task.assigner.name,
    folderPath: task.folderPath,
    folderUrl: folderUrlOf(task.folderPath),
    deadlineAt: task.deadlineAt,
    now,
    taskLink: `${origin}${estimatePathOf(task.code)}`,
  });
  return {
    idempotencyKey: idempotencyKeys.taskOverdue(task.taskId, task.deadlineAt),
    event: 'task-overdue',
    toUserId: task.engineerId,
    ccUserIds: task.assigner.isActive ? [task.assigner.id] : [],
    subject: rendered.subject,
    bodyHtml: rendered.html,
    bodyText: rendered.text,
  };
}

/**
 * One scan at the instant `now`: queues what is due and writes no `job_runs` row (`performOverdueScan` does). It throws only when the store cannot answer; the caller logs that by the class
 * of the error.
 */
export async function runOverdueScan(dependencies: OverdueScanDependencies, now: Date): Promise<OverdueScanOutcome> {
  const { store, appOrigin } = dependencies;
  if (!(await store.alertsEnabled())) return { status: 'skipped', reason: 'alerts-off' };

  const candidates = await store.findCandidates(now, new Date(now.getTime() - OVERDUE_SCAN_WINDOW_MS));
  // The store applies the same rule in SQL; this keeps "overdue" one rule in the code as well, so a store that returned a task due now or later could not send it early.
  const due = candidates.filter((task) => isOverdue(task.deadlineAt, now));
  if (due.length === 0) return { status: 'ok', found: 0, queued: 0 };

  const origin = appOrigin();
  const { queued } = await store.enqueueAll(
    due.map((task) => toMail(task, now, origin)),
    now,
  );
  return { status: 'ok', found: due.length, queued };
}

/**
 * One scheduled run, for the wrapper's log line (`run-job.ts`): a run that queued messages writes its row and is an `info` line; a run that did nothing (alerts off, nothing overdue, rows another
 * run queued first) writes no row and is a `debug` line.
 */
export async function performOverdueScan(dependencies: OverdueScanDependencies): Promise<JobOutcome> {
  const { store, clock } = dependencies;
  const startedAt = clock.now();
  const outcome = await runOverdueScan(dependencies, startedAt);
  if (outcome.status === 'skipped') return { summary: `${OVERDUE_SCAN_JOB} skipped: alerts are off`, level: 'debug' };
  const summary = `${OVERDUE_SCAN_JOB}: found ${outcome.found}, queued ${outcome.queued}`;
  if (outcome.queued === 0) return { summary, level: 'debug' };
  await store.recordRun({ job: OVERDUE_SCAN_JOB, startedAt, finishedAt: clock.now(), result: { status: 'ok', found: outcome.found, queued: outcome.queued } });
  return { summary, level: 'info' };
}

/**
 * Schedules the scan every minute, or none (AC-1). With `FEATURE_EMAIL` off it is not scheduled at all and one line says so. `dependencies` is a function so that nothing (no database client)
 * is built when the flag is off. A scan that throws is the wrapper's to log and record; the next minute's run still happens.
 */
export function scheduleOverdueScan(enabled: boolean, dependencies: () => OverdueScanDependencies, log: JobLogger): ScheduledTask | undefined {
  if (!enabled) {
    log(`${OVERDUE_SCAN_JOB} is off: FEATURE_EMAIL is not on, so it is not scheduled`);
    return undefined;
  }
  const built = dependencies();
  const task = schedule(
    OVERDUE_SCAN_CRON,
    () => runJob({ name: OVERDUE_SCAN_JOB, log, now: () => built.clock.now(), frequent: true, recordFailure: (run) => built.store.recordRun(run) }, () => performOverdueScan(built)),
    { name: OVERDUE_SCAN_JOB, timezone: OVERDUE_SCAN_TIMEZONE, noOverlap: true },
  );
  log(`${OVERDUE_SCAN_JOB} scheduled every minute`);
  return task;
}
