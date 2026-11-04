import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';

/**
 * Runs a child process for a test and tells "the process never ran" apart from "the process ran and said no"
 * (DEF-007, AQP-182). On a machine that is short of memory, `spawnSync` can fail to start the child: it then sets
 * `error`, or on Windows it returns an NTSTATUS failure code (at or above 0xC0000000, such as 0xC0000017
 * STATUS_NO_MEMORY) as the exit status. Read as a result, that looks like "not ignored" or "the check failed with
 * code 3221225495". Here it is a `ProcessStartError` instead, so the test reports a broken set-up, not a broken rule.
 */

/** The lowest Windows NTSTATUS error value. An exit status at or above it means the process failed to run. */
const WINDOWS_FAILURE_STATUS = 0xc0000000;

export class ProcessStartError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProcessStartError';
  }
}

export interface ProcessOutcome {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error | undefined;
}

/** How long a test's child process may run before it is stopped, unless the call sets its own `timeout` (PRF-01). */
export const DEFAULT_PROCESS_TIMEOUT_MILLISECONDS = 60_000;

/** The `code` Node puts on the error when it stopped the child itself: past `timeout`, or past `maxBuffer`. */
const STOPPED_BY_TIME_LIMIT = 'ETIMEDOUT';
const STOPPED_BY_BUFFER_LIMIT = 'ENOBUFS';

function errorCodeOf(error: Error): unknown {
  return 'code' in error ? error.code : undefined;
}

/** The message for an error `spawnSync` reported: the child was stopped by a limit (QLT-28), or never started. */
function spawnErrorMessage(error: Error, what: string): string {
  switch (errorCodeOf(error)) {
    case STOPPED_BY_TIME_LIMIT:
      return `${what} did not finish within the time limit and was stopped.`;
    case STOPPED_BY_BUFFER_LIMIT:
      return `${what} wrote more output than the buffer holds and was stopped.`;
    default:
      return `${what} did not start: ${error.message}`;
  }
}

/** Throws `ProcessStartError` unless the process ran and exited with an ordinary exit code. `what` names it in the message. */
export function assertProcessStarted(outcome: ProcessOutcome, what: string): void {
  if (outcome.error !== undefined) {
    throw new ProcessStartError(spawnErrorMessage(outcome.error, what), { cause: outcome.error });
  }
  if (outcome.signal !== null) throw new ProcessStartError(`${what} was ended by ${outcome.signal} before it finished.`);
  if (outcome.status === null) throw new ProcessStartError(`${what} did not report an exit status.`);
  if (outcome.status >= WINDOWS_FAILURE_STATUS) {
    throw new ProcessStartError(`${what} failed to run (Windows status 0x${outcome.status.toString(16).toUpperCase()}).`);
  }
}

export interface ProcessResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunOptions extends Omit<SpawnSyncOptionsWithStringEncoding, 'encoding'> {
  /** What is being run, for the message if it does not start, e.g. "git check-ignore". */
  readonly what: string;
}

/**
 * `spawnSync` with text output, that throws `ProcessStartError` if the process did not run, or was stopped by the time
 * or output limit (see above). The time limit is 60 s unless `timeout` is given, so a hung child cannot hang the run.
 */
export function runProcess(command: string, args: ReadonlyArray<string>, { what, ...options }: RunOptions): ProcessResult {
  const result = spawnSync(command, args, { timeout: DEFAULT_PROCESS_TIMEOUT_MILLISECONDS, ...options, encoding: 'utf8' });
  assertProcessStarted(result, what);
  return { status: result.status ?? 0, stdout: result.stdout, stderr: result.stderr };
}
