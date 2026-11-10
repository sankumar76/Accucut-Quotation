import type { CacheState, JobData, StepData } from '../../scripts/lib/ci-run-summary';

import { iso } from './ci-feedback-records';

/**
 * Invented jobs of one CI run for the run-summary tests (`ci-run-summary.test.ts`). No clock is read and no API is called:
 * every time is an offset in seconds from the instant that `ci-feedback-records.ts` fixes. Job and step names are the ones
 * `ci.yml` gives (tests/unit/ci-setup-cut.test.ts checks that the install steps below exist there under these names).
 */

/** The jobs API shape (snake_case) of fabricated jobs, as the summary script reads it. */
export function apiJobsOf(jobs: ReadonlyArray<JobData>): unknown {
  return {
    jobs: jobs.map((entry) => ({
      name: entry.name,
      conclusion: entry.conclusion,
      created_at: entry.createdAt,
      started_at: entry.startedAt,
      completed_at: entry.completedAt,
      steps: entry.steps.map((s) => ({ name: s.name, conclusion: s.conclusion, started_at: s.startedAt, completed_at: s.completedAt })),
    })),
  };
}

export interface StepOptions {
  readonly conclusion?: string | null;
  readonly missingTimes?: boolean;
}

export function step(name: string, start: number, end: number, options: StepOptions = {}): StepData {
  return {
    name,
    conclusion: options.conclusion === undefined ? 'success' : options.conclusion,
    startedAt: options.missingTimes === true ? null : iso(start),
    completedAt: options.missingTimes === true ? null : iso(end),
  };
}

const SKIPPED = { conclusion: 'skipped' } as const;

/**
 * The install steps of one job, from `start`, for a cache `hit`, `miss` or `fallback`, as `ci.yml` orders them. Returns the
 * steps and the second the last one ended. `prefix` is `Stage 1` (`verify`) or `Shard` (a shard).
 */
export function installSteps(prefix: 'Stage 1' | 'Shard', state: Exclude<CacheState, 'n/a'>, start: number, seconds = { restore: 6, check: 2, npmCi: 40, save: 5, generate: 6 }): { steps: StepData[]; end: number } {
  const name = (part: string): string => `${prefix}: install, ${part}`;
  let clock = start;
  const run = (part: string, duration: number, options: StepOptions = {}): StepData => {
    const made = step(name(part), clock, clock + duration, options);
    clock += duration;
    return made;
  };
  const key = run('name the node_modules cache key', 1);
  const restore = run('restore node_modules', seconds.restore);
  const check = state === 'miss' ? run('check node_modules', 0, SKIPPED) : run('check node_modules', seconds.check);
  const miss = state === 'miss' ? run('npm ci (cache miss)', seconds.npmCi) : run('npm ci (cache miss)', 0, SKIPPED);
  const fallback = state === 'fallback' ? run('npm ci (cache fallback)', seconds.npmCi) : run('npm ci (cache fallback)', 0, SKIPPED);
  const save = state === 'miss' ? run('save node_modules', seconds.save) : run('save node_modules', 0, SKIPPED);
  const generate = run('prisma generate', seconds.generate);
  return { steps: [key, restore, check, miss, fallback, save, generate], end: clock };
}

export interface JobOptions {
  readonly queue?: number;
  readonly steps?: ReadonlyArray<StepData>;
  readonly conclusion?: string | null;
  readonly missingTimes?: boolean;
  /** The job is still running: it has a start and no end. */
  readonly open?: boolean;
}

/** A job that waited `queue` seconds after `created`, then ran from `start` to `end`. */
export function job(name: string, start: number, end: number, options: JobOptions = {}): JobData {
  const queue = options.queue ?? 0;
  return {
    name,
    conclusion: options.conclusion === undefined ? 'success' : options.conclusion,
    createdAt: iso(start - queue),
    startedAt: options.missingTimes === true ? null : iso(start),
    completedAt: options.missingTimes === true || options.open === true ? null : iso(end),
    steps: options.steps ?? [],
  };
}

const SHARD_TEST_STEP = "Stage 12: E2E (Chromium at three widths, axe; this shard's share)";

/**
 * A shard job that starts at `start`: its install steps for `state`, then a test step of `testSeconds`, after `otherSeconds`
 * of other set-up (build, migrations, stage 12a).
 */
export function shardJob(index: number, start: number, state: Exclude<CacheState, 'n/a'>, testSeconds: number, otherSeconds = 60, queue = 0): JobData {
  const install = installSteps('Shard', state, start + 5);
  const testStart = install.end + otherSeconds;
  const testEnd = testStart + testSeconds;
  const tests = step(SHARD_TEST_STEP, testStart, testEnd);
  return job(`Stage 12: E2E (shard ${index} of 3)`, start, testEnd + 3, { queue, steps: [...install.steps, tests] });
}

/** A whole run: `Stages 1 to 11b` (ends at `verifyEnd`), three shards that each start at second 2, and the fan-in job. */
export function runOf(options: { readonly shardTests: readonly [number, number, number]; readonly verifyEnd?: number; readonly state?: Exclude<CacheState, 'n/a'> }): JobData[] {
  const state = options.state ?? 'hit';
  const verifyInstall = installSteps('Stage 1', state, 5);
  const verify = job('Stages 1 to 11b', 1, options.verifyEnd ?? 250, { queue: 3, steps: verifyInstall.steps });
  const shards = options.shardTests.map((testSeconds, position) => shardJob(position + 1, 2, state, testSeconds, 60, 4));
  const offsetOf = (job: JobData): number => (Date.parse(job.completedAt ?? '') - Date.parse(iso(0))) / 1_000;
  const lastEnd = Math.max(options.verifyEnd ?? 250, ...shards.map(offsetOf));
  // The fan-in job is still running when it writes the summary.
  const fanIn = job('Stages 1 to 11', lastEnd + 2, lastEnd + 12, { queue: 1, open: true });
  return [verify, ...shards, fanIn];
}
