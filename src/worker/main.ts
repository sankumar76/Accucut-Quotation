import { EnvValidationError, loadAppEnv, loadEmailFeature } from '../lib/env';
import { systemClock } from '../lib/time';
import { scheduleBackupWatch, type BackupWatchStore } from '../server/jobs/backup-watch';
import { scheduleDailyDigest } from '../server/jobs/daily-digest';
import { type HeartbeatStore, scheduleHeartbeat } from '../server/jobs/heartbeat';
import { scheduleLogPrune } from '../server/jobs/log-prune';
import { scheduleOverdueScan } from '../server/jobs/overdue-scan';
import { scheduleMailJobs } from '../server/jobs/outbox-send';
import type { JobLogFields, JobLogLevel } from '../server/jobs/run-job';
import { createMailer } from '../server/mail/send';
import { createMailTransport } from '../server/mail/transport';
import { createEmailOutboxRepository } from '../server/repositories/email-outbox-repository';
import { createDailyDigestStore, createOverdueScanStore } from '../server/repositories/overdue-repository';
import { getPrismaClient } from '../server/repositories/prisma-client';
import { createHeartbeatRepository, createJobRunRepository, createJobRunWriter } from '../server/repositories/job-run-repository';

/**
 * The worker process (ADR-011, architecture sections 4.7 and 9.9): the entry point of the Windows service `AccucutWorker`.
 *
 * Scope note (STORY-10.04): this is the start-up shell only. It checks the settings exactly as the web process does, stays
 * running and stops cleanly on a stop request, so the service can be installed, started and supervised. The one job it runs is
 * `log-prune` (`src/server/jobs/log-prune.ts`, daily at 03:30 IST, only when LOG_DIRECTORY is set) and, since STORY-10.05, `backup-watch`
 * (`src/server/jobs/backup-watch.ts`, daily at 09:00 IST, only when PG_DATA_VOLUME or BACKUP_VOLUME is set). Since STORY-09.01, `outbox-send` (every minute, only when FEATURE_EMAIL=on; STORY-09.06 adds its retries, its per-attempt log lines and its `job_runs` row). Since STORY-09.04, `overdue-scan` (`src/server/jobs/overdue-scan.ts`, every minute, only when FEATURE_EMAIL=on). Since STORY-09.05, `daily-digest` (`src/server/jobs/daily-digest.ts`, 11:00 IST, with a catch-up at start-up, only when FEATURE_EMAIL=on). Since STORY-10.09a, `heartbeat`
 * (`src/server/jobs/heartbeat.ts`, every minute and once at start, always on): `GET /api/health` is red when the worker's newest heartbeat is 3 minutes old. Every job runs through `runJob`
 * (`src/server/jobs/run-job.ts`), which writes its start and outcome lines and, for a job that throws, one `error` line. The jobs that are left (the failure surfacing of STORY-09.06 and 09.07) are later stories',
 * which add them here and run through the same wrapper; nothing below changes how the service is installed.
 * It takes no part in coverage: it is a start-up file and the job logic belongs in `src/server/jobs` (test strategy section 11).
 */

/** A timer that never fires but keeps the event loop alive, as the cron timers will. The largest delay a timer accepts. */
const KEEP_ALIVE_MILLISECONDS = 2_147_483_647;

/**
 * One JSON line to stdout, or to stderr at `error` (the service wrapper writes each stream to its own file). The fields a job passes are scalars (`JobLogFields`) and are written first, so none
 * of them can replace `level`, `time`, `process` or `msg`. `debug` lines (the start line of a job that runs every minute) are dropped: the worker has no debug switch, and the heartbeat
 * is the one line a minute that the log keeps (architecture section 9.4).
 */
function log(message: string, level: JobLogLevel = 'info', fields: JobLogFields = {}): void {
  if (level === 'debug') return;
  const line = `${JSON.stringify({ ...fields, level, time: new Date().toISOString(), process: 'worker', msg: message })}\n`;
  if (level === 'error') process.stderr.write(line);
  else process.stdout.write(line);
}

function start(): void {
  try {
    loadAppEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // Names the variables and never a value (src/lib/env.ts).
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const databaseUrl = loadAppEnv().DATABASE_URL;
  // backup-watch reads and writes job_runs as the runtime role. The client is made on first use, so a worker with no volumes set never opens a connection.
  const store: BackupWatchStore = {
    latestGoodBackupAt: () => createJobRunRepository(getPrismaClient('worker', databaseUrl)).latestGoodBackupAt(),
    recordRun: (run) => createJobRunWriter(getPrismaClient('worker', databaseUrl)).recordRun(run),
  };
  // The heartbeat writes one row a minute and prunes the old ones through the SQL function (STORY-10.09a); the client is made on first use, as above.
  const heartbeatStore: HeartbeatStore = {
    recordRun: (run) => createJobRunWriter(getPrismaClient('worker', databaseUrl)).recordRun(run),
    pruneHeartbeatRuns: () => createHeartbeatRepository(getPrismaClient('worker', databaseUrl)).pruneHeartbeatRuns(),
  };
  const keepAlive = setInterval(() => undefined, KEEP_ALIVE_MILLISECONDS);
  // The heartbeat first: it is always on, and `GET /api/health` is green only while it is.
  const heartbeat = scheduleHeartbeat(heartbeatStore, log);
  // The daily log-prune job (ADR-015 Amendment 2.1): it runs only when the install has written LOG_DIRECTORY into `.env`.
  const logPrune = scheduleLogPrune(process.env.LOG_DIRECTORY, log);
  // The daily backup-watch job (ADR-015 Amendment 3 point 5): the install writes the two drive roots into `.env`; with neither set it is off.
  const backupWatch = scheduleBackupWatch({ dataVolume: process.env.PG_DATA_VOLUME, backupVolume: process.env.BACKUP_VOLUME }, store, log);
  // The mail jobs (STORY-09.01 AC-6): scheduled only when FEATURE_EMAIL=on. With it off nothing is built, so no mail transport and no extra database client exist.
  const emailOn = loadEmailFeature();
  const mailJobs = scheduleMailJobs(
    emailOn,
    () => {
      const env = loadAppEnv();
      const client = getPrismaClient('worker', env.DATABASE_URL);
      return {
        store: createEmailOutboxRepository(client),
        mailer: createMailer(createMailTransport(env, { clock: systemClock })),
        clock: systemClock,
        log,
        jobRuns: createJobRunWriter(client),
      };
    },
    log,
  );
  // The overdue scan (STORY-09.04) queues the overdue e-mail; `outbox-send` above sends it. Same flag, same rule: nothing is built when it is off. The links in the message come from `APP_ORIGIN`.
  const overdueScan = scheduleOverdueScan(
    emailOn,
    () => {
      const env = loadAppEnv();
      return { store: createOverdueScanStore(getPrismaClient('worker', env.DATABASE_URL)), clock: systemClock, appOrigin: () => env.APP_ORIGIN };
    },
    log,
  );
  // The daily digest (STORY-09.05) queues one e-mail a day per Engineer with overdue tasks at 11:00 IST, and at start-up catches up a day whose run is missing. Same flag, same rule.
  const dailyDigest = scheduleDailyDigest(
    emailOn,
    () => {
      const env = loadAppEnv();
      return { store: createDailyDigestStore(getPrismaClient('worker', env.DATABASE_URL)), clock: systemClock, appOrigin: () => env.APP_ORIGIN };
    },
    log,
  );
  const stop = (signal: string): void => {
    log(`worker stopping (${signal})`);
    void heartbeat.stop();
    void logPrune?.stop();
    void backupWatch?.stop();
    for (const job of mailJobs) void job.stop();
    void overdueScan?.stop();
    void dailyDigest?.task.stop();
    clearInterval(keepAlive);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
  log('worker started');
}

start();
