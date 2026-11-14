import { EnvValidationError, loadAppEnv } from '../lib/env';

/**
 * The worker process (ADR-011, architecture sections 4.7 and 9.9): the entry point of the Windows service `AccucutWorker`.
 *
 * Scope note (STORY-10.04): this is the start-up shell only. It checks the settings exactly as the web process does, stays
 * running and stops cleanly on a stop request, so the service can be installed, started and supervised. The cron jobs (outbox,
 * backup-watch, heartbeat) are the worker story's, which adds them here; nothing below changes how the service is installed.
 * It takes no part in coverage: it is a start-up file and the job logic belongs in `src/server/jobs` (test strategy section 11).
 */

/** A timer that never fires but keeps the event loop alive, as the cron timers will. The largest delay a timer accepts. */
const KEEP_ALIVE_MILLISECONDS = 2_147_483_647;

function log(message: string): void {
  process.stdout.write(`${JSON.stringify({ level: 'info', time: new Date().toISOString(), process: 'worker', msg: message })}\n`);
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

  const keepAlive = setInterval(() => undefined, KEEP_ALIVE_MILLISECONDS);
  const stop = (signal: string): void => {
    log(`worker stopping (${signal})`);
    clearInterval(keepAlive);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
  log('worker started');
}

start();
