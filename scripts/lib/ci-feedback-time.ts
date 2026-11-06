/**
 * CI feedback time (NFR-009 row of the PRD; test strategy section 10.3; STORY-10.10 AC-8).
 *
 * How long a run of the CI workflow takes, from the start of its first job to the end of the job named `Stages 1 to 11`,
 * excluding queue wait, over the first attempts of the last 20 pull-request runs (AQP-208 AC-7; test strategy 10.3). Since
 * AQP-208 a run has several jobs: `Stages 1 to 11b` and the E2E shards start together, and `Stages 1 to 11` is the fan-in
 * job that ends last. Before it, `Stages 1 to 11` was the one job, so for such a run the start of the first job is the
 * start of that job and runs from before and after are measured alike. The target is a p95 of at most 10 minutes, with an
 * early warning when the median passes 6 minutes. Both figures are PROPOSED (test strategy 10.3). The calculation is pure;
 * the GitHub API is read through an injected `fetch`. A breach never blocks a merge: the nightly step reports it.
 *
 * Choices the PROPOSED figures leave open, recorded here and in the pull request:
 *   - the p95 is the nearest-rank value (STORY-10.10 A-1): the value at rank ceil(0.95 * n) of the sorted durations;
 *   - only a run whose `Stages 1 to 11` job finished with `success` counts: a failed job stops early and a cancelled or
 *     skipped one is not a full run, so any of them would make the feedback time look shorter than it is. The fan-in job
 *     succeeds only when every job it needs succeeded, so this also leaves out a run in which a shard failed;
 *   - queue wait is left out by starting at the first `started_at` (when a runner picked a job up), not at run creation;
 *   - the median of an even number of runs is the mean of the two middle values.
 *
 * The 9-minute line (DL-095, DL-102, DL-103; STORY-10.14 AC-7, AQP-208 AC-7; test strategy section 10.3): when the p95 is
 * over 540 seconds the report carries one fixed notice, whatever has been merged. At exactly 540 seconds there is none. It
 * is not a breach and fails nothing. The report also says which runs it used: the count, and the start time and head
 * commit of the oldest and the newest, so a reader can see whether it covers only runs made after a given merge
 * (STORY-10.14 AC-1).
 */
import { z } from 'zod';

export const REQUIRED_JOB_NAME = 'Stages 1 to 11';
export const WORKFLOW_FILE = 'ci.yml';
export const RUNS_COUNTED = 20;
const SECONDS_PER_MINUTE = 60;
export const P95_LIMIT_SECONDS = 10 * SECONDS_PER_MINUTE;
export const MEDIAN_LIMIT_SECONDS = 6 * SECONDS_PER_MINUTE;
/** The p95 over which master's 9-minute notice is written (DL-095). Strictly over: at exactly 540 s there is no notice. */
export const NOTICE_LIMIT_SECONDS = 9 * SECONDS_PER_MINUTE;
/**
 * The notice, word for word (master, DL-103; AQP-208 AC-7; test strategy section 10.3). It states the fact and points to
 * test strategy 10.5, which names the current next step, so it does not go stale when a step is taken. It replaces the
 * AQP-199 wording ("before AQP-199 merges ...").
 */
export const NINE_MINUTE_NOTICE =
  'p95 over 9 minutes (DL-095, DL-102): CI feedback is too slow; the next step is named in test strategy 10.5.';
const P95 = 0.95;
const MILLISECONDS_PER_SECOND = 1_000;
const API_VERSION = '2022-11-28';
const API_ORIGIN = 'https://api.github.com';

/** One job of one attempt of one workflow run, as the report needs it. */
export interface JobRecord {
  readonly runId: number;
  readonly runAttempt: number;
  /** The commit the run was made for: the head of the pull request. */
  readonly headSha: string;
  readonly name: string;
  readonly conclusion: string | null;
  /** When the run was created; orders the runs. */
  readonly runCreatedAt: string;
  /** When a runner picked the job up. Queue wait ends here, so the duration starts here. */
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

/** One of the runs a report used, named by when its required job started and by the commit it ran. */
export interface RunUsed {
  readonly runId: number;
  /** ISO 8601, UTC. */
  readonly startedAt: string;
  readonly headSha: string;
}

export interface CiTimeReport {
  /** How many runs the figures are over (at most 20). */
  readonly runs: number;
  readonly p95Seconds: number | undefined;
  readonly medianSeconds: number | undefined;
  /** One message per breached figure; each names the figure. */
  readonly breaches: ReadonlyArray<string>;
  /** Notices that are not breaches and fail nothing: master's 9-minute line when the p95 is over 540 s. */
  readonly notices: ReadonlyArray<string>;
  /** The oldest and the newest run the figures are over (by run creation), or undefined when no run qualified. */
  readonly oldest: RunUsed | undefined;
  readonly newest: RunUsed | undefined;
}

interface Timed {
  readonly runId: number;
  readonly runCreatedAt: number;
  readonly startedAt: number;
  readonly headSha: string;
  readonly seconds: number;
}

function timeOf(value: string | null): number | undefined {
  if (value === null) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

/**
 * First attempts of runs whose required job (the fan-in job, or the one job of an older run) ran to success, newest run
 * first, at most 20 runs. A run lasts from the earliest start of any of its jobs to the end of the required job, so the
 * shape of the run (one job or several) does not matter.
 */
function qualifying(jobs: ReadonlyArray<JobRecord>): Timed[] {
  const firstAttemptByRun = new Map<number, JobRecord[]>();
  for (const job of jobs) {
    if (job.runAttempt !== 1) continue;
    firstAttemptByRun.set(job.runId, [...(firstAttemptByRun.get(job.runId) ?? []), job]);
  }
  const timed: Timed[] = [];
  for (const [runId, runJobs] of firstAttemptByRun) {
    const required = runJobs.find((job) => job.name === REQUIRED_JOB_NAME && job.conclusion === 'success');
    if (required === undefined) continue;
    const requiredStarted = timeOf(required.startedAt);
    const completed = timeOf(required.completedAt);
    const created = timeOf(required.runCreatedAt);
    if (requiredStarted === undefined || completed === undefined || created === undefined) continue;
    // A job that never started has no `started_at` and does not move the start; one that did start can only move it earlier.
    const started = Math.min(requiredStarted, ...runJobs.map((job) => timeOf(job.startedAt) ?? requiredStarted));
    if (completed < started) continue;
    timed.push({ runId, runCreatedAt: created, startedAt: started, headSha: required.headSha, seconds: (completed - started) / MILLISECONDS_PER_SECOND });
  }
  return timed.sort((a, b) => b.runCreatedAt - a.runCreatedAt || b.runId - a.runId).slice(0, RUNS_COUNTED);
}

function runUsed(entry: Timed | undefined): RunUsed | undefined {
  if (entry === undefined) return undefined;
  return { runId: entry.runId, startedAt: new Date(entry.startedAt).toISOString(), headSha: entry.headSha };
}

/** The value at rank ceil(p * n) of ascending `sorted` (nearest rank). */
export function nearestRank(sorted: ReadonlyArray<number>, fraction: number): number | undefined {
  if (sorted.length === 0) return undefined;
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

export function median(sorted: ReadonlyArray<number>): number | undefined {
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower === undefined || upper === undefined ? undefined : (lower + upper) / 2;
}

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / SECONDS_PER_MINUTE)} m ${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')} s`;
}

/** The figures and the breaches. A p95 over 10 minutes or a median over 6 minutes is a breach (strictly over). */
export function ciTimeReport(jobs: ReadonlyArray<JobRecord>): CiTimeReport {
  const used = qualifying(jobs);
  const durations = used.map((entry) => entry.seconds).sort((a, b) => a - b);
  const p95Seconds = nearestRank(durations, P95);
  const medianSeconds = median(durations);
  const breaches: string[] = [];
  if (p95Seconds !== undefined && p95Seconds > P95_LIMIT_SECONDS) {
    breaches.push(`CI feedback time: the p95 of "${REQUIRED_JOB_NAME}" is ${formatDuration(p95Seconds)}, over the ${P95_LIMIT_SECONDS / SECONDS_PER_MINUTE}-minute target (${durations.length} runs).`);
  }
  if (medianSeconds !== undefined && medianSeconds > MEDIAN_LIMIT_SECONDS) {
    breaches.push(`CI feedback time: the median of "${REQUIRED_JOB_NAME}" is ${formatDuration(medianSeconds)}, over the ${MEDIAN_LIMIT_SECONDS / SECONDS_PER_MINUTE}-minute early warning (${durations.length} runs).`);
  }
  // Master's 9-minute line is written whenever the p95 is over 540 s, even over 600 s (when the breach above is also written).
  const notices = p95Seconds !== undefined && p95Seconds > NOTICE_LIMIT_SECONDS ? [NINE_MINUTE_NOTICE] : [];
  // `used` is newest first.
  return { runs: durations.length, p95Seconds, medianSeconds, breaches, notices, oldest: runUsed(used.at(-1)), newest: runUsed(used[0]) };
}

const describeRun = (label: string, run: RunUsed): string => `${label} run ${run.runId} started ${run.startedAt}, head commit ${run.headSha}`;

/**
 * The report as lines for the log. Says how many runs it covers (and when that is fewer than 20), which runs they are (the
 * oldest and the newest, by start time and head commit), the breaches, and then master's 9-minute notice when it applies.
 */
export function ciTimeLines(report: CiTimeReport): string[] {
  if (report.p95Seconds === undefined || report.medianSeconds === undefined) {
    return ['CI feedback time: no successful first-attempt run of the required job was found, so there is no figure yet.'];
  }
  const fewer = report.runs < RUNS_COUNTED ? ` (only ${report.runs} runs, fewer than the ${RUNS_COUNTED} asked for)` : ` (${report.runs} runs)`;
  const lines = [
    `CI feedback time of "${REQUIRED_JOB_NAME}"${fewer}: p95 ${formatDuration(report.p95Seconds)} (target at most ${P95_LIMIT_SECONDS / SECONDS_PER_MINUTE} m), median ${formatDuration(report.medianSeconds)} (early warning over ${MEDIAN_LIMIT_SECONDS / SECONDS_PER_MINUTE} m).`,
  ];
  if (report.oldest !== undefined && report.newest !== undefined) {
    lines.push(`Runs used: ${report.runs}. ${describeRun('Oldest', report.oldest)}. ${describeRun('Newest', report.newest)}.`);
  }
  return [...lines, ...report.breaches, ...report.notices];
}

/**
 * The job summary: the lines of the report as a list, except master's 9-minute notice, which is its own paragraph so the
 * sentence is written exactly as ruled and not as a list item (STORY-10.14 AC-7).
 */
export function ciTimeSummary(report: CiTimeReport): string {
  const lines = ciTimeLines(report).filter((line) => !report.notices.includes(line));
  const notices = report.notices.map((notice) => `${notice}\n`).join('\n');
  return `### CI feedback time (NFR-009)\n\n${lines.map((line) => `- ${line}`).join('\n')}\n${notices === '' ? '' : `\n${notices}`}`;
}

const runsSchema = z.object({
  workflow_runs: z.array(z.object({ id: z.number(), created_at: z.string(), head_sha: z.string().regex(/^[0-9a-f]{40}$/) })),
});
const jobsSchema = z.object({
  jobs: z.array(z.object({ name: z.string(), conclusion: z.string().nullable(), started_at: z.string().nullable(), completed_at: z.string().nullable() })),
});

async function getJson(fetchImpl: typeof fetch, path: string, token: string): Promise<unknown> {
  const response = await fetchImpl(`${API_ORIGIN}${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': API_VERSION },
  });
  // The status is reported, never the response body or the token.
  if (response.status !== 200) throw new Error(`the GitHub API answered HTTP ${response.status} for ${path.split('?')[0] ?? path}`);
  return response.json();
}

/**
 * The first-attempt jobs of the newest pull-request runs of the CI workflow. `repository` is `owner/name`. Needs a token
 * with `actions: read`.
 */
export async function fetchJobRecords(repository: string, token: string, fetchImpl: typeof fetch = fetch): Promise<JobRecord[]> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('the repository name is not in the form owner/name');
  const base = `/repos/${repository}/actions`;
  const runs = runsSchema.parse(
    await getJson(fetchImpl, `${base}/workflows/${WORKFLOW_FILE}/runs?event=pull_request&status=completed&per_page=${RUNS_COUNTED}`, token),
  );
  const records: JobRecord[] = [];
  for (const run of runs.workflow_runs) {
    const jobs = jobsSchema.parse(await getJson(fetchImpl, `${base}/runs/${run.id}/attempts/1/jobs?per_page=100`, token));
    for (const job of jobs.jobs) {
      records.push({
        runId: run.id,
        runAttempt: 1,
        headSha: run.head_sha,
        name: job.name,
        conclusion: job.conclusion,
        runCreatedAt: run.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      });
    }
  }
  return records;
}
