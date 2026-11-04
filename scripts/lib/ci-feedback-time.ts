/**
 * CI feedback time (NFR-009 row of the PRD; test strategy section 10.3; STORY-10.10 AC-8).
 *
 * How long the required job, `Stages 1 to 11`, takes from start to finish, excluding queue wait, over the first attempts
 * of the last 20 pull-request runs. The target is a p95 of at most 10 minutes, with an early warning when the median
 * passes 6 minutes. Both figures are PROPOSED (test strategy 10.3). The calculation is pure; the GitHub API is read
 * through an injected `fetch`. A breach never blocks a merge: the nightly step reports it.
 *
 * Choices the PROPOSED figures leave open, recorded here and in the pull request:
 *   - the p95 is the nearest-rank value (STORY-10.10 A-1): the value at rank ceil(0.95 * n) of the sorted durations;
 *   - only a job that finished with `success` counts: a failed job stops early and a cancelled one is not a full run,
 *     so either would make the feedback time look shorter than it is;
 *   - the median of an even number of runs is the mean of the two middle values.
 */
import { z } from 'zod';

export const REQUIRED_JOB_NAME = 'Stages 1 to 11';
export const WORKFLOW_FILE = 'ci.yml';
export const RUNS_COUNTED = 20;
const SECONDS_PER_MINUTE = 60;
export const P95_LIMIT_SECONDS = 10 * SECONDS_PER_MINUTE;
export const MEDIAN_LIMIT_SECONDS = 6 * SECONDS_PER_MINUTE;
const P95 = 0.95;
const MILLISECONDS_PER_SECOND = 1_000;
const API_VERSION = '2022-11-28';
const API_ORIGIN = 'https://api.github.com';

/** One job of one attempt of one workflow run, as the report needs it. */
export interface JobRecord {
  readonly runId: number;
  readonly runAttempt: number;
  readonly name: string;
  readonly conclusion: string | null;
  /** When the run was created; orders the runs. */
  readonly runCreatedAt: string;
  /** When a runner picked the job up. Queue wait ends here, so the duration starts here. */
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface CiTimeReport {
  /** How many runs the figures are over (at most 20). */
  readonly runs: number;
  readonly p95Seconds: number | undefined;
  readonly medianSeconds: number | undefined;
  /** One message per breached figure; each names the figure. */
  readonly breaches: ReadonlyArray<string>;
}

interface Timed {
  readonly runId: number;
  readonly runCreatedAt: number;
  readonly seconds: number;
}

function timeOf(value: string | null): number | undefined {
  if (value === null) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

/** First attempts of the required job that ran to success, newest run first, at most 20 runs. */
function qualifying(jobs: ReadonlyArray<JobRecord>): Timed[] {
  const timed: Timed[] = [];
  for (const job of jobs) {
    if (job.runAttempt !== 1 || job.name !== REQUIRED_JOB_NAME || job.conclusion !== 'success') continue;
    const started = timeOf(job.startedAt);
    const completed = timeOf(job.completedAt);
    const created = timeOf(job.runCreatedAt);
    if (started === undefined || completed === undefined || created === undefined || completed < started) continue;
    timed.push({ runId: job.runId, runCreatedAt: created, seconds: (completed - started) / MILLISECONDS_PER_SECOND });
  }
  return timed.sort((a, b) => b.runCreatedAt - a.runCreatedAt || b.runId - a.runId).slice(0, RUNS_COUNTED);
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
  const durations = qualifying(jobs).map((entry) => entry.seconds).sort((a, b) => a - b);
  const p95Seconds = nearestRank(durations, P95);
  const medianSeconds = median(durations);
  const breaches: string[] = [];
  if (p95Seconds !== undefined && p95Seconds > P95_LIMIT_SECONDS) {
    breaches.push(`CI feedback time: the p95 of "${REQUIRED_JOB_NAME}" is ${formatDuration(p95Seconds)}, over the ${P95_LIMIT_SECONDS / SECONDS_PER_MINUTE}-minute target (${durations.length} runs).`);
  }
  if (medianSeconds !== undefined && medianSeconds > MEDIAN_LIMIT_SECONDS) {
    breaches.push(`CI feedback time: the median of "${REQUIRED_JOB_NAME}" is ${formatDuration(medianSeconds)}, over the ${MEDIAN_LIMIT_SECONDS / SECONDS_PER_MINUTE}-minute early warning (${durations.length} runs).`);
  }
  return { runs: durations.length, p95Seconds, medianSeconds, breaches };
}

/** The report as lines for the log and the job summary. Says how many runs it covers when that is fewer than 20. */
export function ciTimeLines(report: CiTimeReport): string[] {
  if (report.p95Seconds === undefined || report.medianSeconds === undefined) {
    return ['CI feedback time: no successful first-attempt run of the required job was found, so there is no figure yet.'];
  }
  const fewer = report.runs < RUNS_COUNTED ? ` (only ${report.runs} runs, fewer than the ${RUNS_COUNTED} asked for)` : ` (${report.runs} runs)`;
  return [
    `CI feedback time of "${REQUIRED_JOB_NAME}"${fewer}: p95 ${formatDuration(report.p95Seconds)} (target at most ${P95_LIMIT_SECONDS / SECONDS_PER_MINUTE} m), median ${formatDuration(report.medianSeconds)} (early warning over ${MEDIAN_LIMIT_SECONDS / SECONDS_PER_MINUTE} m).`,
    ...report.breaches,
  ];
}

const runsSchema = z.object({ workflow_runs: z.array(z.object({ id: z.number(), created_at: z.string() })) });
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
