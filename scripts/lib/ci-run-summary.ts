/**
 * The per-run time summary of the CI workflow (AQP-243, STORY-10.19, AC-5; PRF-04 of AQP-227; test strategy 10.5 item 7).
 *
 * The fan-in job `Stages 1 to 11` runs this file as its last step and writes the result to the run's job summary: the path,
 * each job's duration and queue wait, its install-plus-generate time and its `node_modules` cache state, and the slowest shard
 * with its set-up and test split and its gap to `Stages 1 to 11b`. The trigger of RISK-023 can then be read from the run page
 * and not from the job logs. The data is the jobs API of the run's own attempt (`actions: read`).
 *
 * It is a script that runs WITHOUT an install, so it follows three rules that the other files in this folder do not:
 *   - it imports nothing but `node:` modules (no `zod`, no sibling file), and
 *   - it uses only syntax that Node's type stripping erases (no enum, namespace or parameter property), so the workflow runs
 *     it as `node --experimental-strip-types scripts/lib/ci-run-summary.ts` (tests/unit/ci-run-summary.test.ts does the same), and
 *   - it ends the run by itself only when this file is the entry point, so a test can import it.
 *
 * It never fails the job. Any API or data problem prints "n/a" for what is missing and the script exits 0 (a missing value is
 * never shown as zero). The job's result is decided by the verdict step before it, and this step runs with `continue-on-error`.
 * The fan-in job cannot read its own end, so the path is the time up to this summary, a few seconds short; the summary says so.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const FAN_IN_JOB_NAME = 'Stages 1 to 11';
export const VERIFY_JOB_NAME = 'Stages 1 to 11b';
const SHARD_JOB_PATTERN = /^Stage 12: E2E \(shard (\d+) of \d+\)$/;
/** The step that runs a shard's tests. A shard's set-up is the time before it and its tests are the time inside it. */
const TEST_STEP_PATTERN = /^Stage 12: E2E \(/;
/** The install steps of `verify` (`Stage 1: install, ...`) and of a shard (`Shard: install, ...`); the capture is the part after the comma. */
const INSTALL_STEP_PATTERN = /^(?:Stage 1|Shard): install, (.+)$/;
const KEY_STEP = 'name the node_modules cache key';
const RESTORE_STEP = 'restore node_modules';
const CHECK_STEP = 'check node_modules';
const MISS_STEP = 'npm ci (cache miss)';
const FALLBACK_STEP = 'npm ci (cache fallback)';
/** Every install step that counts towards "install plus generate" (AC-2): the key, the restore, the check, any `npm ci`, any save, `prisma generate`. */
const INSTALL_WINDOW_STEPS: ReadonlyArray<string> = [KEY_STEP, RESTORE_STEP, CHECK_STEP, MISS_STEP, FALLBACK_STEP, 'save node_modules', 'prisma generate'];

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1_000;
const REQUEST_TIMEOUT_MILLISECONDS = 15_000;
const API_VERSION = '2022-11-28';
const DEFAULT_API_ORIGIN = 'https://api.github.com';
const NOT_AVAILABLE = 'n/a';

export interface StepData {
  readonly name: string;
  readonly conclusion: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

/** One job of the run as the summary needs it. `createdAt` is when the job was queued, `startedAt` when a runner picked it up. */
export interface JobData {
  readonly name: string;
  readonly conclusion: string | null;
  readonly createdAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly steps: ReadonlyArray<StepData>;
}

export type CacheState = 'hit' | 'miss' | 'fallback' | typeof NOT_AVAILABLE;

// ---- Time ------------------------------------------------------------------------------------------------------------

function timeOf(value: string | null): number | undefined {
  if (value === null) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

/** Seconds from `from` to `to`, or undefined when either is missing or the end is before the start (never a false zero). */
function secondsBetween(from: string | null, to: string | null): number | undefined {
  const start = timeOf(from);
  const end = timeOf(to);
  if (start === undefined || end === undefined || end < start) return undefined;
  return (end - start) / MILLISECONDS_PER_SECOND;
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) return NOT_AVAILABLE;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / SECONDS_PER_MINUTE)} m ${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')} s`;
}

// ---- Steps of the install window -------------------------------------------------------------------------------------

const installPart = (step: StepData): string | undefined => INSTALL_STEP_PATTERN.exec(step.name)?.[1];

function installStep(steps: ReadonlyArray<StepData>, part: string): StepData | undefined {
  return steps.find((step) => installPart(step) === part);
}

/**
 * "Install plus generate" (AC-2): from the start of the first to the end of the last install step that ran, so the small
 * gaps between steps count too. A skipped step (the install on a hit, the check on a miss) is not part of it. Undefined when no
 * install step ran or a time is missing.
 */
export function installSeconds(steps: ReadonlyArray<StepData>): number | undefined {
  const ran = steps.filter((step) => {
    const part = installPart(step);
    return part !== undefined && INSTALL_WINDOW_STEPS.includes(part) && step.conclusion !== 'skipped';
  });
  const starts = ran.map((step) => timeOf(step.startedAt));
  const ends = ran.map((step) => timeOf(step.completedAt));
  if (ran.length === 0 || starts.includes(undefined) || ends.includes(undefined)) return undefined;
  const first = Math.min(...starts.filter((time): time is number => time !== undefined));
  const last = Math.max(...ends.filter((time): time is number => time !== undefined));
  return last < first ? undefined : (last - first) / MILLISECONDS_PER_SECOND;
}

/**
 * The cache state of a job, read from which install steps ran (the API does not expose step outputs): a hit ran the check and
 * neither `npm ci`; a miss ran `npm ci (cache miss)`; a fallback ran `npm ci (cache fallback)` after a failed check.
 */
export function cacheState(steps: ReadonlyArray<StepData>): CacheState {
  if (installStep(steps, RESTORE_STEP)?.conclusion !== 'success') return NOT_AVAILABLE;
  if (installStep(steps, FALLBACK_STEP)?.conclusion === 'success') return 'fallback';
  if (installStep(steps, MISS_STEP)?.conclusion === 'success') return 'miss';
  return installStep(steps, CHECK_STEP)?.conclusion === 'success' ? 'hit' : NOT_AVAILABLE;
}

// ---- Jobs ------------------------------------------------------------------------------------------------------------

const shardIndex = (job: JobData): number | undefined => {
  const index = SHARD_JOB_PATTERN.exec(job.name)?.[1];
  return index === undefined ? undefined : Number(index);
};

const durationOf = (job: JobData, now: number): number | undefined =>
  job.completedAt === null ? secondsBetween(job.startedAt, new Date(now).toISOString()) : secondsBetween(job.startedAt, job.completedAt);

/** The fan-in job first reads the run while it is itself in progress, so the order is verify, the shards by index, the fan-in job, the rest. */
function jobOrder(job: JobData): number {
  if (job.name === VERIFY_JOB_NAME) return 0;
  const index = shardIndex(job);
  if (index !== undefined) return index;
  return job.name === FAN_IN_JOB_NAME ? 1_000 : 2_000;
}

interface ShardSplit {
  readonly index: number;
  readonly durationSeconds: number;
  readonly setupSeconds: number | undefined;
  readonly testSeconds: number | undefined;
  /** Positive when the shard ended after `Stages 1 to 11b`, negative when before; undefined when either end is missing. */
  readonly gapSeconds: number | undefined;
}

function shardSplit(job: JobData, index: number, durationSeconds: number, verify: JobData | undefined): ShardSplit {
  const tests = job.steps.find((step) => TEST_STEP_PATTERN.test(step.name));
  const verifyEnd = timeOf(verify?.completedAt ?? null);
  const shardEnd = timeOf(job.completedAt);
  return {
    index,
    durationSeconds,
    setupSeconds: secondsBetween(job.startedAt, tests?.startedAt ?? null),
    testSeconds: tests === undefined ? undefined : secondsBetween(tests.startedAt, tests.completedAt),
    gapSeconds: verifyEnd === undefined || shardEnd === undefined ? undefined : (shardEnd - verifyEnd) / MILLISECONDS_PER_SECOND,
  };
}

/** The shard with the longest duration (the lower index on a tie), or undefined when no shard has a duration. */
export function slowestShard(jobs: ReadonlyArray<JobData>): ShardSplit | undefined {
  const verify = jobs.find((job) => job.name === VERIFY_JOB_NAME);
  let slowest: ShardSplit | undefined;
  for (const job of jobs) {
    const index = shardIndex(job);
    const duration = secondsBetween(job.startedAt, job.completedAt);
    if (index === undefined || duration === undefined) continue;
    if (slowest === undefined || duration > slowest.durationSeconds || (duration === slowest.durationSeconds && index < slowest.index)) {
      slowest = shardSplit(job, index, duration, verify);
    }
  }
  return slowest;
}

/** The path: the earliest job start to the end of the fan-in job, or to `now` while it runs. Queue wait is excluded. */
export function pathSeconds(jobs: ReadonlyArray<JobData>, now: number): number | undefined {
  const starts = jobs.map((job) => timeOf(job.startedAt)).filter((time): time is number => time !== undefined);
  if (starts.length === 0) return undefined;
  const fanIn = jobs.find((job) => job.name === FAN_IN_JOB_NAME);
  const end = timeOf(fanIn?.completedAt ?? null) ?? now;
  const first = Math.min(...starts);
  return end < first ? undefined : (end - first) / MILLISECONDS_PER_SECOND;
}

// ---- The summary -----------------------------------------------------------------------------------------------------

const cell = (text: string): string => text.replaceAll('|', '\\|');

function jobLine(job: JobData, now: number): string {
  const running = job.name === FAN_IN_JOB_NAME && job.completedAt === null;
  const duration = formatDuration(durationOf(job, now));
  const label = running ? `${job.name} (this job, so far)` : job.name;
  const isInstallJob = job.name === VERIFY_JOB_NAME || shardIndex(job) !== undefined;
  const install = isInstallJob ? formatDuration(installSeconds(job.steps)) : '-';
  const cache = isInstallJob ? cacheState(job.steps) : '-';
  return `| ${cell(label)} | ${duration} | ${formatDuration(secondsBetween(job.createdAt, job.startedAt))} | ${install} | ${cache} |`;
}

function gapText(gap: number | undefined): string {
  if (gap === undefined) return NOT_AVAILABLE;
  const whole = Math.round(Math.abs(gap));
  if (whole === 0) return `ended with ${VERIFY_JOB_NAME}`;
  return `ended ${formatDuration(whole)} ${gap > 0 ? 'after' : 'before'} ${VERIFY_JOB_NAME}`;
}

function shardLine(split: ShardSplit | undefined): string {
  if (split === undefined) return `**Slowest shard:** ${NOT_AVAILABLE} (no shard job has a start and an end).`;
  return (
    `**Slowest shard:** shard ${split.index}, ${formatDuration(split.durationSeconds)} in all: set-up ${formatDuration(split.setupSeconds)}, ` +
    `tests ${formatDuration(split.testSeconds)}; it ${gapText(split.gapSeconds)}.`
  );
}

/** The run summary as Markdown. `now` is the time of the summary, in milliseconds. */
export function renderSummary(jobs: ReadonlyArray<JobData>, now: number): string {
  const ordered = [...jobs].sort((a, b) => jobOrder(a) - jobOrder(b));
  const lines = [
    '### CI run time (AQP-243, test strategy 10.5)',
    '',
    `**Path so far:** ${formatDuration(pathSeconds(jobs, now))}, from the first job start to this summary, queue wait excluded. ` +
      `\`${FAN_IN_JOB_NAME}\` cannot read its own end, so the path is a few seconds short of the NFR-009 figure.`,
    '',
    '| Job | Duration | Queue wait | Install plus generate | node_modules cache |',
    '| --- | --- | --- | --- | --- |',
    ...ordered.map((job) => jobLine(job, now)),
    '',
    shardLine(slowestShard(jobs)),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

/** What the summary says when the jobs could not be read at all. Nothing is shown as zero. */
export function renderUnavailable(reason: string): string {
  return `### CI run time (AQP-243, test strategy 10.5)\n\n**Path so far:** ${NOT_AVAILABLE}. The jobs of this run could not be read (${reason}); no figure is shown.\n`;
}

// ---- Reading the jobs API --------------------------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function parseStep(value: unknown): StepData | undefined {
  if (!isRecord(value) || typeof value['name'] !== 'string') return undefined;
  return { name: value['name'], conclusion: textOrNull(value['conclusion']), startedAt: textOrNull(value['started_at']), completedAt: textOrNull(value['completed_at']) };
}

function parseJob(value: unknown): JobData | undefined {
  if (!isRecord(value) || typeof value['name'] !== 'string') return undefined;
  const rawSteps = Array.isArray(value['steps']) ? value['steps'] : [];
  return {
    name: value['name'],
    conclusion: textOrNull(value['conclusion']),
    createdAt: textOrNull(value['created_at']),
    startedAt: textOrNull(value['started_at']),
    completedAt: textOrNull(value['completed_at']),
    steps: rawSteps.map(parseStep).filter((step): step is StepData => step !== undefined),
  };
}

/** The jobs of a response body; a body of another shape gives an empty list, and an entry of another shape is left out. */
export function parseJobs(body: unknown): JobData[] {
  const list = isRecord(body) && Array.isArray(body['jobs']) ? body['jobs'] : [];
  return list.map(parseJob).filter((job): job is JobData => job !== undefined);
}

export interface RunLocation {
  /** `owner/name`. */
  readonly repository: string;
  readonly runId: string;
  readonly attempt: string;
  readonly token: string;
  readonly apiOrigin: string;
}

/** The jobs of one attempt of one run. Only the HTTP status is reported on a failure, never the body or the token. */
export async function fetchRunJobs(location: RunLocation, fetchImpl: typeof fetch = fetch): Promise<JobData[]> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(location.repository)) throw new Error('the repository name is not in the form owner/name');
  if (!/^\d+$/.test(location.runId) || !/^\d+$/.test(location.attempt)) throw new Error('the run id or the attempt is not a number');
  const path = `/repos/${location.repository}/actions/runs/${location.runId}/attempts/${location.attempt}/jobs?per_page=100`;
  const response = await fetchImpl(`${location.apiOrigin}${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${location.token}`, 'x-github-api-version': API_VERSION },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  });
  if (response.status !== 200) throw new Error(`the GitHub API answered HTTP ${response.status}`);
  return parseJobs(await response.json());
}

/** The summary for the run named by the environment. Never throws: a problem gives the "n/a" text. */
export async function summariseRun(env: Readonly<Record<string, string | undefined>>, now: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  try {
    const jobs = await fetchRunJobs(
      {
        repository: env['GITHUB_REPOSITORY'] ?? '',
        runId: env['GITHUB_RUN_ID'] ?? '',
        attempt: env['GITHUB_RUN_ATTEMPT'] ?? '',
        token: env['GITHUB_TOKEN'] ?? '',
        apiOrigin: env['GITHUB_API_URL'] ?? DEFAULT_API_ORIGIN,
      },
      fetchImpl,
    );
    return jobs.length === 0 ? renderUnavailable('the API listed no job') : renderSummary(jobs, now);
  } catch (error) {
    return renderUnavailable(error instanceof Error ? error.message : 'unexpected error');
  }
}

async function main(): Promise<void> {
  const text = await summariseRun(process.env, Date.now());
  process.stdout.write(text);
  const file = process.env['GITHUB_STEP_SUMMARY'];
  if (file !== undefined && file !== '') appendFileSync(file, text);
}

// Runs only as the entry point, so the tests can import the functions above.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().then(
    () => {
      process.exitCode = 0;
    },
    () => {
      // The summary must never fail the job: a failed write is the only thing that gets here.
      process.exitCode = 0;
    },
  );
}
