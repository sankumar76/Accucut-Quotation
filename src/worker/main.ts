import { EnvValidationError, loadAppEnv, loadEmailFeature } from '../lib/env';
import { systemClock } from '../lib/time';
import { scheduleBackupWatch, type BackupWatchStore } from '../server/jobs/backup-watch';
import { scheduleLogPrune } from '../server/jobs/log-prune';
import { scheduleMailJobs } from '../server/jobs/outbox-send';
import { createMailer } from '../server/mail/send';
import { createMailTransport } from '../server/mail/transport';
import { createEmailOutboxRepository } from '../server/repositories/email-outbox-repository';
import { getPrismaClient } from '../server/repositories/prisma-client';
import { createJobRunRepository, createJobRunWriter } from '../server/repositories/job-run-repository';

/**
 * The worker process (ADR-011, architecture sections 4.7 and 9.9): the entry point of the Windows service `AccucutWorker`.
 *
 * Scope note (STORY-10.04): this is the start-up shell only. It checks the settings exactly as the web process does, stays
 * running and stops cleanly on a stop request, so the service can be installed, started and supervised. The one job it runs is
 * `log-prune` (`src/server/jobs/log-prune.ts`, daily at 03:30 IST, only when LOG_DIRECTORY is set) and, since STORY-10.05, `backup-watch`
 * (`src/server/jobs/backup-watch.ts`, daily at 09:00 IST, only when PG_DATA_VOLUME or BACKUP_VOLUME is set). Since STORY-09.01, `outbox-send` (every minute, only when FEATURE_EMAIL=on). The other cron jobs (heartbeat, overdue scan, digest) are
 * later stories', which add them here; nothing below changes how the service is installed.
 * It takes no part in coverage: it is a start-up file and the job logic belongs in `src/server/jobs` (test strategy section 11).
 */

/** A timer that never fires but keeps the event loop alive, as the cron timers will. The largest delay a timer accepts. */
const KEEP_ALIVE_MILLISECONDS = 2_147_483_647;

function log(message: string, level: 'info' | 'error' = 'info'): void {
  const line = `${JSON.stringify({ level, time: new Date().toISOString(), process: 'worker', msg: message })}\n`;
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
  const keepAlive = setInterval(() => undefined, KEEP_ALIVE_MILLISECONDS);
  // The daily log-prune job (ADR-015 Amendment 2.1): it runs only when the install has written LOG_DIRECTORY into `.env`.
  const logPrune = scheduleLogPrune(process.env.LOG_DIRECTORY, log);
  // The daily backup-watch job (ADR-015 Amendment 3 point 5): the install writes the two drive roots into `.env`; with neither set it is off.
  const backupWatch = scheduleBackupWatch({ dataVolume: process.env.PG_DATA_VOLUME, backupVolume: process.env.BACKUP_VOLUME }, store, log);
  // The mail jobs (STORY-09.01 AC-6): scheduled only when FEATURE_EMAIL=on. With it off nothing is built, so no mail transport and no extra database client exist.
  const mailJobs = scheduleMailJobs(
    loadEmailFeature(),
    () => {
      const env = loadAppEnv();
      return {
        store: createEmailOutboxRepository(getPrismaClient('worker', env.DATABASE_URL)),
        mailer: createMailer(createMailTransport(env, { clock: systemClock })),
        clock: systemClock,
      };
    },
    log,
  );
  const stop = (signal: string): void => {
    log(`worker stopping (${signal})`);
    void logPrune?.stop();
    void backupWatch?.stop();
    for (const job of mailJobs) void job.stop();
    clearInterval(keepAlive);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
  log('worker started');
}

start();
