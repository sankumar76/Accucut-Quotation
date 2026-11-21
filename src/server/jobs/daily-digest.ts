import { schedule, type ScheduledTask } from 'node-cron';

import { idempotencyKeys } from '../../lib/mail/events';
import { bellHrefFor, isOverdue } from '../../lib/tasks/overdue';
import { estimatePathOf } from '../../lib/tasks/task-link';
import { type Clock, istIsoDateOf, MILLISECONDS_PER_HOUR, startOfIstDay } from '../../lib/time';
import { renderDailyDigest } from '../mail/templates/daily-digest';

import { runJob, type FailedJobRun, type JobLogger, type JobOutcome } from './run-job';

/**
 * The worker job `daily-digest` (STORY-09.05; FR-083; BR-043, BR-044; NFR-014, NFR-024; architecture section 4.7; ADR-011; decisions D-b, D-a2, D-e).
 *
 * At 11:00 Asia/Kolkata, and only when `FEATURE_EMAIL=on`, it writes one `email_outbox` row for each active Engineer who has at least one open overdue task, listing those tasks. `outbox-send`
 * (09.01) sends it at its next minute. The job decides nothing about sending: it only queues.
 *
 *   - **One row per Engineer and IST date.** The key is `digest:<engineerId>:<istDate>` (`idempotencyKeys.dailyDigest`) and the outbox's unique index enforces it, so the cron and the catch-up,
 *     or a restarted worker, queue one row between them. The date is computed in `Asia/Kolkata` from the clock (never from the server's zone), so 23:59 IST and 00:01 IST are two days.
 *     The store's read leaves out an Engineer who already has the row, so a repeat run reads cheaply; the unique key is still what makes it happen once.
 *   - **Who gets it, and who is copied.** The To is the Engineer of the tasks: nobody else sees the list (architecture section 4.7). The Cc is the distinct *active* assigners of the listed
 *     tasks, a Lead or the Admin, each once (decision D-b: FR-083 says "assigning Leads", BR-041 and BR-042 say "Lead/Admin"). Active status is judged when the row is written, and again
 *     by `outbox-send` when it sends. An Engineer who is not active is not read at all; a deactivated assigner is only left off the Cc.
 *   - **"Overdue" is the queue's rule**: the deadline strictly before the instant judged (`isOverdue`; the store's SQL says the same as `tabFilter` in `task-repository.ts`), for a task whose estimate is
 *     not APPROVED. The store returns every such task, however old (the digest, unlike the overdue e-mail, is not limited to the last 24 hours), and none for an Engineer with nothing overdue (AC-3).
 *   - **Recipients are user IDs, never addresses** (NFR-028, ruling DL-262, architecture section 4.7). No address is ever read from a request.
 *   - **The alerts switch** (BR-040) is read first; with it OFF no task is read and no row is queued, but the run is recorded with the status `skipped` (decision D-a2: switching it ON in the
 *     middle of the day does not send that day's digest, because today's run is recorded and the catch-up runs only at worker start-up; the next 11:00 does).
 *   - **Catch-up** (AC-5): at start-up, when it is 11:00 IST or later and `job_runs` has no `daily-digest` row for today's IST date with a status other than `failed`, the job runs once.
 *     A row of a run that failed (the wrapper's, or one in which an Engineer's message could not be queued) does not count, so the next start-up repeats it: the unique key keeps that safe.
 *   - **NFR-024** (decision D-e): a run writes a `job_runs` row **every time**, one a day, including one that queued nothing (the catch-up reads it; the "rows only for work" rule is the per-minute
 *     jobs'). One Engineer's failure to queue is counted and does not stop the others; the row of such a run says `failed` and the outcome line is `error`. A run that throws is the wrapper's:
 *     one `error` line with the class of the error and a `failed` row.
 *
 * The log lines and the row hold the job name, the IST date and counts only: no name, address, path, task code or message text. The job imports no repository, service or driver
 * (`tests/security/engineer-import-rule.test.ts` classes it): the worker passes the store and the clock in, and every time comes from the clock.
 */

export const DAILY_DIGEST_JOB = 'daily-digest';

/** 11:00 every day in Indian Standard Time (architecture section 4.7). India has no daylight saving time, so this is always 05:30 UTC. */
export const DAILY_DIGEST_CRON = '0 11 * * *';
export const DAILY_DIGEST_TIMEZONE = 'Asia/Kolkata';
/** The hour the cron names, for the catch-up: the digest is due from this hour of the IST day. Keep it the same as `DAILY_DIGEST_CRON`. */
const DIGEST_HOUR_IST = 11;

/** The most Cc users one digest names: the outbox's own limit (`MAX_CC_USERS`, which a test holds equal), so a busy Engineer's digest is queued rather than refused. */
export const MAX_DIGEST_CC = 10;

/** An open overdue task as the store hands it over: plain fields, and the people by ID. */
export interface DigestTask {
  readonly taskId: string;
  readonly code: string;
  readonly title: string | null;
  readonly deadlineAt: Date;
  /** The active Engineer the task is assigned to: the To of the digest. */
  readonly engineerId: string;
  /** The Lead or the Admin who assigned it: in the Cc if active now. */
  readonly assigner: { readonly id: string; readonly name: string; readonly isActive: boolean };
}

/** A message for the outbox: a fixed shape of strings, recipients by ID. `createEmailOutboxRepository(...).enqueue` takes exactly this. */
export interface DigestMail {
  readonly idempotencyKey: string;
  readonly event: 'daily-digest';
  readonly toUserId: string;
  readonly ccUserIds: ReadonlyArray<string>;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}

export interface DailyDigestOutcome {
  /** `ok`; `skipped` when alerts are off; `failed` when a message could not be queued for an Engineer (the next start-up repeats the run). */
  readonly status: 'ok' | 'skipped' | 'failed';
  /** The IST date the run is for, `YYYY-MM-DD`: what the catch-up looks for. */
  readonly istDate: string;
  /** Messages that were new. */
  readonly queued: number;
  /** Engineers whose message could not be queued. */
  readonly failed: number;
}

/** The `job_runs` row of a run. A status, the IST date and counts, nothing about a task or a person. */
export interface DailyDigestRun {
  readonly job: typeof DAILY_DIGEST_JOB;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: DailyDigestOutcome;
}

/** What the job needs from the database. `createDailyDigestStore` in `src/server/repositories/overdue-repository.ts` fits it, and the worker passes it in. */
export interface DailyDigestStore {
  /** `settings.alerts_enabled`. */
  alertsEnabled(): Promise<boolean>;
  /** The open tasks (the estimate is not APPROVED) with a deadline before `now`, of active Engineers who have no message for `istDate` yet, the oldest deadline first and then by code: one read. */
  findOverdue(now: Date, istDate: string): Promise<ReadonlyArray<DigestTask>>;
  /** Queues one message (a key already queued is not queued again). */
  enqueue(message: DigestMail, now: Date): Promise<'queued' | 'already-queued'>;
  /** Is a `daily-digest` run recorded in `job_runs` for this IST date with a status other than `failed`? */
  hasRunFor(istDate: string): Promise<boolean>;
  /** Writes a `job_runs` row. The wrapper (`run-job.ts`) also uses it for the `failed` row of a run that threw. */
  recordRun(run: DailyDigestRun | FailedJobRun): Promise<void>;
}

export interface DailyDigestDependencies {
  readonly store: DailyDigestStore;
  readonly clock: Clock;
  /** The validated `APP_ORIGIN` (scheme, host and port, no trailing slash), for the links. */
  readonly appOrigin: () => string;
}

function toMail(engineerId: string, tasks: ReadonlyArray<DigestTask>, istDate: string, now: Date, origin: string): DigestMail {
  const rendered = renderDailyDigest({
    tasks: tasks.map((task) => ({ code: task.code, title: task.title, assignerName: task.assigner.name, deadlineAt: task.deadlineAt, taskLink: `${origin}${estimatePathOf(task.code)}` })),
    now,
    myTasksLink: `${origin}${bellHrefFor('ENGINEER')}`,
  });
  // The distinct active assigners, each once, in the order of the oldest task that names them.
  const cc: string[] = [];
  for (const task of tasks) {
    if (task.assigner.isActive && !cc.includes(task.assigner.id)) cc.push(task.assigner.id);
  }
  return {
    idempotencyKey: idempotencyKeys.dailyDigest(engineerId, istDate),
    event: 'daily-digest',
    toUserId: engineerId,
    ccUserIds: cc.slice(0, MAX_DIGEST_CC),
    subject: rendered.subject,
    bodyHtml: rendered.html,
    bodyText: rendered.text,
  };
}

/** The tasks of each Engineer, the Engineers in the order of their oldest task. */
function groupByEngineer(tasks: ReadonlyArray<DigestTask>): Map<string, DigestTask[]> {
  const groups = new Map<string, DigestTask[]>();
  for (const task of tasks) {
    const group = groups.get(task.engineerId);
    if (group === undefined) groups.set(task.engineerId, [task]);
    else group.push(task);
  }
  return groups;
}

/**
 * One digest run at the instant `now`: queues what is due and writes no `job_runs` row (`performDailyDigest` does). It throws only when the store cannot answer (the caller logs that by the class
 * of the error); a message that cannot be queued for one Engineer is counted and the others go on.
 */
export async function runDailyDigest(dependencies: DailyDigestDependencies, now: Date): Promise<DailyDigestOutcome> {
  const { store, appOrigin } = dependencies;
  const istDate = istIsoDateOf(now);
  if (!(await store.alertsEnabled())) return { status: 'skipped', istDate, queued: 0, failed: 0 };

  const candidates = await store.findOverdue(now, istDate);
  // The store applies the same rule in SQL; this keeps "overdue" one rule in the code as well, so a store that returned a task due now or later could not list it early.
  const due = candidates.filter((task) => isOverdue(task.deadlineAt, now));
  if (due.length === 0) return { status: 'ok', istDate, queued: 0, failed: 0 };

  const origin = appOrigin();
  let queued = 0;
  let failed = 0;
  for (const [engineerId, tasks] of groupByEngineer(due)) {
    try {
      if ((await store.enqueue(toMail(engineerId, tasks, istDate, now, origin), now)) === 'queued') queued += 1;
    } catch {
      // Counted, and the run's outcome line says how many; the error's text can hold an address or a value, so it is not kept (coding standards section 4).
      failed += 1;
    }
  }
  return { status: failed === 0 ? 'ok' : 'failed', istDate, queued, failed };
}

/** One scheduled run, for the wrapper's log line (`run-job.ts`): always writes its `job_runs` row (AC-9), and says the counts. A run in which a message could not be queued is an `error` line. */
export async function performDailyDigest(dependencies: DailyDigestDependencies): Promise<JobOutcome> {
  const { store, clock } = dependencies;
  const startedAt = clock.now();
  const outcome = await runDailyDigest(dependencies, startedAt);
  await store.recordRun({ job: DAILY_DIGEST_JOB, startedAt, finishedAt: clock.now(), result: outcome });
  if (outcome.status === 'skipped') return { summary: `${DAILY_DIGEST_JOB} ${outcome.istDate} skipped: alerts are off`, level: 'info' };
  return { summary: `${DAILY_DIGEST_JOB} ${outcome.istDate}: queued ${outcome.queued}, failed ${outcome.failed}`, level: outcome.failed === 0 ? 'info' : 'error' };
}

/** The instant the digest is due on an IST date: 11:00 IST. */
function digestDueAt(istDate: string): Date {
  return new Date(startOfIstDay(istDate).getTime() + DIGEST_HOUR_IST * MILLISECONDS_PER_HOUR);
}

/**
 * Does the worker, starting at `now`, owe today's digest (AC-5)? Only from 11:00 IST on, and only when no `daily-digest` run is recorded for today's IST date other than a failed one. The cron
 * does the rest: a start before 11:00 does nothing here and the cron fires at 11:00.
 */
export async function catchUpNeeded(dependencies: DailyDigestDependencies, now: Date): Promise<boolean> {
  const istDate = istIsoDateOf(now);
  if (now.getTime() < digestDueAt(istDate).getTime()) return false;
  return !(await dependencies.store.hasRunFor(istDate));
}

export interface ScheduledDailyDigest {
  readonly task: ScheduledTask;
  /** Settles when the start-up catch-up has been decided and, if needed, run. It never rejects (the wrapper logs a failure). The worker does not wait for it. */
  readonly catchUp: Promise<void>;
}

/**
 * Schedules the digest at 11:00 IST and starts the catch-up (AC-1, AC-5), or neither. With `FEATURE_EMAIL` off it is not scheduled at all and one line says so. `dependencies` is a function so that
 * nothing (no database client) is built when the flag is off. A run that throws is the wrapper's to log and record; the next day's run still happens.
 */
export function scheduleDailyDigest(enabled: boolean, dependencies: () => DailyDigestDependencies, log: JobLogger): ScheduledDailyDigest | undefined {
  if (!enabled) {
    log(`${DAILY_DIGEST_JOB} is off: FEATURE_EMAIL is not on, so it is not scheduled`);
    return undefined;
  }
  const built = dependencies();
  const run = (work: () => Promise<JobOutcome>): Promise<void> =>
    runJob({ name: DAILY_DIGEST_JOB, log, now: () => built.clock.now(), recordFailure: (failedRun) => built.store.recordRun(failedRun) }, work);
  const task = schedule(DAILY_DIGEST_CRON, () => run(() => performDailyDigest(built)), { name: DAILY_DIGEST_JOB, timezone: DAILY_DIGEST_TIMEZONE, noOverlap: true });
  log(`${DAILY_DIGEST_JOB} scheduled at 11:00 ${DAILY_DIGEST_TIMEZONE}`);
  const catchUp = run(async () => {
    if (!(await catchUpNeeded(built, built.clock.now()))) return { summary: `${DAILY_DIGEST_JOB} catch-up: not needed` };
    return performDailyDigest(built);
  });
  return { task, catchUp };
}
