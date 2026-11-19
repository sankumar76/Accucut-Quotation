import { describe, expect, it, vi } from 'vitest';

import { runJob, type FailedJobRun, type JobLogFields, type JobLogLevel } from '@/server/jobs/run-job';

/**
 * STORY-10.09a AC-3 (one job wrapper, NFR-024) and AC-8 (no secret in any log, NFR-006): `runJob` logs the start and the outcome of a run with the job name and the duration,
 * and when the job throws it logs one `error` line with the job name and the class of the error, writes a `failed` row for a job that records its runs, and never throws.
 * The clock and the logger are stubs, so no timer or stream is involved.
 */

interface Line {
  readonly message: string;
  readonly level: JobLogLevel | undefined;
  readonly fields: JobLogFields | undefined;
}

const START = new Date('2026-11-19T10:00:00.000Z');

/** A clock that answers the given instants in turn, then the last one again. */
function clockOf(...instants: ReadonlyArray<Date>): () => Date {
  let index = 0;
  return () => instants[Math.min(index++, instants.length - 1)] ?? START;
}

const SECRET = 'invented-secret-hunter2-sk_live_0123456789';

function harness(...instants: ReadonlyArray<Date>) {
  const lines: Line[] = [];
  const log = (message: string, level?: JobLogLevel, fields?: JobLogFields): void => void lines.push({ message, level, fields });
  return { lines, log, now: clockOf(...(instants.length === 0 ? [START] : instants)) };
}

describe('runJob: a clean run (AC-3)', () => {
  it('[AC-3] logs a start line and one outcome line with the job name and the duration in milliseconds', async () => {
    const { lines, log, now } = harness(START, new Date(START.getTime() + 1_250));
    await runJob({ name: 'backup-watch', log, now }, () => Promise.resolve());
    expect(lines).toEqual([
      { message: 'backup-watch started', level: 'info', fields: { job: 'backup-watch' } },
      { message: 'backup-watch finished in 1250 ms', level: 'info', fields: { job: 'backup-watch', durationMs: 1250 } },
    ]);
  });

  it('[AC-3] adds the summary the job returns, and takes the level the job asks for', async () => {
    const { lines, log, now } = harness();
    await runJob({ name: 'outbox-send', log, now }, () => Promise.resolve({ summary: 'claimed 2, sent 1, failed 1', level: 'error' }));
    expect(lines[1]).toEqual({ message: 'outbox-send finished in 0 ms', level: 'error', fields: { job: 'outbox-send', durationMs: 0, summary: 'claimed 2, sent 1, failed 1' } });
  });

  it('[AC-3] writes a start line at debug for a job that runs every minute, so the log does not double', async () => {
    const { lines, log, now } = harness();
    await runJob({ name: 'heartbeat', log, now, frequent: true }, () => Promise.resolve({}));
    expect(lines.map((line) => [line.message, line.level])).toEqual([
      ['heartbeat started', 'debug'],
      ['heartbeat finished in 0 ms', 'info'],
    ]);
  });

  it('[AC-3] never reports a negative duration when the clock steps back during a run', async () => {
    const { lines, log, now } = harness(START, new Date(START.getTime() - 5_000));
    await runJob({ name: 'log-prune', log, now }, () => Promise.resolve());
    expect(lines[1]?.fields).toEqual({ job: 'log-prune', durationMs: 0 });
  });

  it('[AC-3] writes no row for a run that succeeds', async () => {
    const { log, now } = harness();
    const recordFailure = vi.fn<(run: FailedJobRun) => Promise<void>>().mockResolvedValue(undefined);
    await runJob({ name: 'backup-watch', log, now, recordFailure }, () => Promise.resolve());
    expect(recordFailure).not.toHaveBeenCalled();
  });
});

describe('runJob: a job that throws (AC-3, AC-8)', () => {
  it('[AC-3] resolves, logs one error line with the job name, the duration and the class of the error, and no more', async () => {
    const { lines, log, now } = harness(START, new Date(START.getTime() + 40));
    class DriverError extends Error {
      override name = 'DriverError';
    }
    await expect(runJob({ name: 'log-prune', log, now }, () => Promise.reject(new DriverError(`connect failed for postgresql://app:${SECRET}@10.1.2.3/db`)))).resolves.toBeUndefined();
    const errors = lines.filter((line) => line.level === 'error');
    expect(errors).toEqual([{ message: 'log-prune failed after 40 ms', level: 'error', fields: { job: 'log-prune', durationMs: 40, errorName: 'DriverError' } }]);
  });

  it('[AC-3] says NonError for something that is not an Error, and still resolves', async () => {
    const { lines, log, now } = harness();
    await expect(runJob({ name: 'log-prune', log, now }, () => Promise.reject(`token=${SECRET}`))).resolves.toBeUndefined();
    expect(lines.at(-1)?.fields).toMatchObject({ errorName: 'NonError' });
  });

  it('[AC-3] writes a failed row for a job that records its runs: both times, a status and a fixed sentence, never the reason', async () => {
    const { log, now } = harness(START, new Date(START.getTime() + 9_000));
    const rows: FailedJobRun[] = [];
    await runJob({ name: 'backup-watch', log, now, recordFailure: (run) => Promise.resolve(void rows.push(run)) }, () => Promise.reject(new Error(`password ${SECRET}`)));
    expect(rows).toEqual([{ job: 'backup-watch', startedAt: START, finishedAt: new Date(START.getTime() + 9_000), result: { status: 'failed', message: 'the run failed' } }]);
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });

  it('[AC-3] writes no failed row for a job that has no way to record one (the heartbeat, log-prune)', async () => {
    const { lines, log, now } = harness();
    await runJob({ name: 'heartbeat', log, now }, () => Promise.reject(new Error('down')));
    expect(lines.filter((line) => line.level === 'error')).toHaveLength(1);
  });

  it('[AC-3] logs, and does not throw, when the failed row cannot be written either, and does not repeat the database error', async () => {
    const { lines, log, now } = harness();
    const recordFailure = (): Promise<void> => Promise.reject(new TypeError(`permission denied for table job_runs, ${SECRET}`));
    await expect(runJob({ name: 'backup-watch', log, now, recordFailure }, () => Promise.reject(new Error('first')))).resolves.toBeUndefined();
    const errors = lines.filter((line) => line.level === 'error');
    expect(errors.map((line) => line.message)).toEqual(['backup-watch failed after 0 ms', 'backup-watch could not record its failed run']);
    expect(errors[1]?.fields).toEqual({ job: 'backup-watch', errorName: 'TypeError' });
  });

  it('[AC-3] never throws when the logger itself throws (a closed stream)', async () => {
    const log = (): void => {
      throw new Error('write EPIPE');
    };
    await expect(runJob({ name: 'x', log, now: () => START }, () => Promise.resolve())).resolves.toBeUndefined();
    await expect(runJob({ name: 'x', log, now: () => START }, () => Promise.reject(new Error('boom')))).resolves.toBeUndefined();
  });

  it('[AC-8] a planted secret in the message of a thrown error reaches no line and no row', async () => {
    const { lines, log, now } = harness();
    const rows: FailedJobRun[] = [];
    await runJob({ name: 'backup-watch', log, now, recordFailure: (run) => Promise.resolve(void rows.push(run)) }, () => {
      const error = new Error(`token ${SECRET}`, { cause: new Error(SECRET) });
      error.stack = `Error: ${SECRET}\n    at secret (${SECRET}.ts:1:1)`;
      return Promise.reject(error);
    });
    expect(JSON.stringify(lines)).not.toContain(SECRET);
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });
});
