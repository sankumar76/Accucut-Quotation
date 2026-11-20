/**
 * The one wrapper of every worker job (STORY-10.09a AC-3, AC-8, AC-9; NFR-024, NFR-006; architecture sections 4.7 and 9.4).
 *
 * `runJob` runs one scheduled run of a job and is the only place that decides what a run writes to the worker's log: a start line, then one outcome line with the job name and the
 * duration, and, when the job throws, one `error` line and (for a job that records its runs) a `failed` row in `job_runs`. A cron callback is `() => runJob(input, work)`, so a job
 * that fails can never end the worker, and a job added later by the EPIC-09 stories inherits all of it by using this function.
 *
 * What a line may hold, and nothing more: the job's name, the duration in milliseconds and, for a failure, the class name of the error (`TypeError`, `PrismaClientKnownRequestError`).
 * Never the error's message, stack or cause (a message can carry a connection string, an address or a value from a request, coding standards section 4), and never a field the job
 * did not name. The summary a job returns is its own and holds counts and codes only (each job's file says so). The same rule applies to the `failed` row: it says that the run
 * failed, not why.
 *
 * It imports no repository, service or driver (`tests/security/engineer-import-rule.test.ts` classes this folder): the worker passes in the logger, the clock and the way to
 * record a failed run.
 */

export type JobLogLevel = 'debug' | 'info' | 'error';

/** Fields a log line may carry besides its message: scalars only, so a nested object (and whatever it holds) cannot be logged by accident. */
export type JobLogFields = Readonly<Record<string, string | number | boolean>>;

/**
 * The worker's logger (`log` in `src/worker/main.ts`: one JSON line to stdout, or to stderr at `error`). A callback with only a message and a level fits it, so a test may pass a
 * short one.
 */
export type JobLogger = (message: string, level?: JobLogLevel, fields?: JobLogFields) => void;

/** What a job that runs cleanly tells the wrapper. Every part is optional: a job with nothing to say returns nothing. */
export interface JobOutcome {
  /** Added to the outcome line as its `summary` field. Counts and codes only. */
  readonly summary?: string;
  /** The level of the outcome line: `info` by default; `error` for a run that finished but found something that needs action; `debug` for a run that did nothing worth a line (an empty outbox every minute). */
  readonly level?: JobLogLevel;
}

/** A row of `job_runs` that the wrapper writes for a failed run. Structurally the row the worker's repository writes. */
export interface FailedJobRun {
  readonly job: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: Readonly<Record<string, unknown>>;
}

export interface RunJobInput {
  /** The job's name: the log's `job` field and, for a job that records runs, the row's `job`. */
  readonly name: string;
  readonly log: JobLogger;
  readonly now: () => Date;
  /**
   * For a job that records its runs: how a failed run is written. Leave it out for a job that writes no row (`log-prune`) and for the heartbeat: a `failed` heartbeat row would be
   * the newest `heartbeat` row, and the health check would take it for a worker that is alive.
   */
  readonly recordFailure?: (run: FailedJobRun) => Promise<void>;
  /** A job that runs every minute: its start line is `debug`, so it does not double the 43,000 lines a month the heartbeat alone writes (architecture section 9.4). */
  readonly frequent?: true;
}

/** The `result` of the row written for a failed run: a status and a fixed sentence, never the reason. */
const FAILED_RUN_RESULT = { status: 'failed', message: 'the run failed' } as const;

function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : 'NonError';
}

/**
 * Runs `work` once and writes its log lines. Never throws and never rejects: whatever `work` does, and whatever the log or the failed-row write does, the caller (a cron callback)
 * gets a resolved promise.
 */
export async function runJob(input: RunJobInput, work: () => Promise<JobOutcome | void>): Promise<void> {
  const { name, log, now } = input;
  const startedAt = now();
  const finish = (): { readonly finishedAt: Date; readonly durationMs: number } => {
    const finishedAt = now();
    return { finishedAt, durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()) };
  };
  const safely = (message: string, level: JobLogLevel, fields: JobLogFields): void => {
    // A logger that throws (a closed stream) must not turn into an unhandled rejection in the cron callback.
    try {
      log(message, level, fields);
    } catch {
      // Nowhere left to say so.
    }
  };

  safely(`${name} started`, input.frequent === true ? 'debug' : 'info', { job: name });
  try {
    const outcome = await work();
    const level = outcome?.level ?? 'info';
    const summary = outcome?.summary;
    const { durationMs } = finish();
    safely(`${name} finished in ${durationMs} ms`, level, summary === undefined ? { job: name, durationMs } : { job: name, durationMs, summary });
  } catch (error) {
    const { finishedAt, durationMs } = finish();
    safely(`${name} failed after ${durationMs} ms`, 'error', { job: name, durationMs, errorName: errorNameOf(error) });
    if (input.recordFailure === undefined) return;
    try {
      await input.recordFailure({ job: name, startedAt, finishedAt, result: FAILED_RUN_RESULT });
    } catch (recordError) {
      safely(`${name} could not record its failed run`, 'error', { job: name, errorName: errorNameOf(recordError) });
    }
  }
}
