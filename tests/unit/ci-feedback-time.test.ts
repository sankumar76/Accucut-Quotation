import { describe, expect, it } from 'vitest';

import {
  MEDIAN_LIMIT_SECONDS,
  P95_LIMIT_SECONDS,
  REQUIRED_JOB_NAME,
  ciTimeLines,
  ciTimeReport,
  fetchJobRecords,
  formatDuration,
  median,
  nearestRank,
  type JobRecord,
} from '../../scripts/lib/ci-feedback-time';

/**
 * STORY-10.10 AC-8: the CI feedback time is a pure function of job records. Invented durations only; no clock is read
 * and no API is called (the API reader is tested with a fake `fetch`).
 */

const BASE = Date.parse('2026-11-01T10:00:00Z');
const iso = (seconds: number): string => new Date(BASE + seconds * 1_000).toISOString();

/** A job that waited `queue` seconds, then ran for `run` seconds. `index` orders the runs (a higher index is newer). */
function job(index: number, run: number, overrides: Partial<JobRecord> = {}, queue = 0): JobRecord {
  const created = index * 10_000;
  return {
    runId: 1_000 + index,
    runAttempt: 1,
    name: REQUIRED_JOB_NAME,
    conclusion: 'success',
    runCreatedAt: iso(created),
    startedAt: iso(created + queue),
    completedAt: iso(created + queue + run),
    ...overrides,
  };
}

const runsOf = (...durations: number[]): JobRecord[] => durations.map((seconds, index) => job(index, seconds));

describe('nearest-rank p95 and median', () => {
  it('takes the value at rank ceil(0.95 n): the 19th of 20, the 1st of 1, the 10th of 10', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(nearestRank(twenty, 0.95)).toBe(19);
    expect(nearestRank([42], 0.95)).toBe(42);
    expect(nearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(nearestRank([], 0.95)).toBeUndefined();
  });

  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBeUndefined();
  });

  it('writes a duration as minutes and seconds', () => {
    expect(formatDuration(154)).toBe('2 m 34 s');
    expect(formatDuration(600)).toBe('10 m 00 s');
    expect(formatDuration(59.6)).toBe('1 m 00 s');
  });
});

describe('ciTimeReport (AC-8)', () => {
  it('passes with the p95 and the median of 20 runs under the targets', () => {
    const report = ciTimeReport(runsOf(...Array.from({ length: 20 }, (_, index) => 150 + index)));
    expect(report.runs).toBe(20);
    expect(report.p95Seconds).toBe(168);
    expect(report.medianSeconds).toBe(159.5);
    expect(report.breaches).toEqual([]);
  });

  it('fails on a p95 over 10 minutes and names the figure', () => {
    // 19 runs of 2.5 minutes and one of 12 minutes: the 19th value of 20 is still 150 s, so the p95 is 150 s ...
    expect(ciTimeReport(runsOf(...Array.from({ length: 19 }, () => 150), 720)).breaches).toEqual([]);
    // ... and two slow runs put the 19th value over the limit.
    const report = ciTimeReport(runsOf(...Array.from({ length: 18 }, () => 150), 700, 720));
    expect(report.p95Seconds).toBe(700);
    expect(report.breaches).toEqual(['CI feedback time: the p95 of "Stages 1 to 11" is 11 m 40 s, over the 10-minute target (20 runs).']);
  });

  it('fails on a median over 6 minutes and names the figure, with the p95 inside its limit', () => {
    const report = ciTimeReport(runsOf(...Array.from({ length: 20 }, () => 400)));
    expect(report.p95Seconds).toBe(400);
    expect(report.breaches).toEqual(['CI feedback time: the median of "Stages 1 to 11" is 6 m 40 s, over the 6-minute early warning (20 runs).']);
  });

  it('is strictly over: exactly 10 minutes at the p95 and exactly 6 at the median pass, one second more fails', () => {
    expect(ciTimeReport(runsOf(...Array.from({ length: 20 }, () => 360))).breaches).toEqual([]);
    expect(ciTimeReport(runsOf(...Array.from({ length: 20 }, () => 361))).breaches).toHaveLength(1);
    expect(ciTimeReport(runsOf(...Array.from({ length: 18 }, () => 100), P95_LIMIT_SECONDS, P95_LIMIT_SECONDS)).breaches).toEqual([]);
    expect(ciTimeReport(runsOf(...Array.from({ length: 18 }, () => 100), P95_LIMIT_SECONDS + 1, P95_LIMIT_SECONDS + 1)).breaches).toHaveLength(1);
    expect(MEDIAN_LIMIT_SECONDS).toBe(360);
  });

  it('reports the number of runs when there are fewer than 20, and still computes the figures', () => {
    const report = ciTimeReport(runsOf(100, 200, 300));
    expect(report.runs).toBe(3);
    expect(report.medianSeconds).toBe(200);
    expect(ciTimeLines(report)[0]).toContain('only 3 runs, fewer than the 20 asked for');
  });

  it('leaves out a re-run attempt, even a slow one, and counts the first attempt', () => {
    const jobs = [...runsOf(150, 160), job(5, 5_000, { runAttempt: 2 })];
    expect(ciTimeReport(jobs).runs).toBe(2);
    expect(ciTimeReport(jobs).breaches).toEqual([]);
  });

  it('leaves out queue wait: the duration runs from the start on a runner, not from creation', () => {
    const report = ciTimeReport([job(0, 120, {}, 3_000)]);
    expect(report.p95Seconds).toBe(120);
  });

  it('counts only the required job, and only when it succeeded and has both times', () => {
    const jobs = [
      job(0, 100),
      job(1, 9_000, { name: 'Another job' }),
      job(2, 9_000, { conclusion: 'failure' }),
      job(3, 9_000, { conclusion: 'cancelled' }),
      job(4, 9_000, { conclusion: null }),
      job(5, 9_000, { startedAt: null }),
      job(6, 9_000, { completedAt: null }),
      job(7, 9_000, { completedAt: 'not a date' }),
      job(8, 9_000, { completedAt: iso(0) }),
    ];
    const report = ciTimeReport(jobs);
    expect(report.runs).toBe(1);
    expect(report.p95Seconds).toBe(100);
  });

  it('uses the newest 20 runs when it is given more', () => {
    const old = Array.from({ length: 5 }, (_, index) => job(index, 5_000));
    const recent = Array.from({ length: 20 }, (_, index) => job(100 + index, 150));
    const report = ciTimeReport([...old, ...recent]);
    expect(report.runs).toBe(20);
    expect(report.p95Seconds).toBe(150);
  });

  it('has no figure and no breach when no run qualifies', () => {
    const report = ciTimeReport([]);
    expect(report).toEqual({ runs: 0, p95Seconds: undefined, medianSeconds: undefined, breaches: [] });
    expect(ciTimeLines(report)).toEqual(['CI feedback time: no successful first-attempt run of the required job was found, so there is no figure yet.']);
  });

  it('writes the figures, and each breach on its own line', () => {
    const lines = ciTimeLines(ciTimeReport(runsOf(...Array.from({ length: 20 }, () => 700))));
    expect(lines[0]).toBe('CI feedback time of "Stages 1 to 11" (20 runs): p95 11 m 40 s (target at most 10 m), median 11 m 40 s (early warning over 6 m).');
    expect(lines).toHaveLength(3);
  });
});

describe('fetchJobRecords', () => {
  const TOKEN = 'invented-token-value';

  function api(handler: (path: string) => { status: number; body: unknown }): { fetchImpl: typeof fetch; paths: string[]; headers: Headers[] } {
    const paths: string[] = [];
    const headers: Headers[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      paths.push(`${url.pathname}${url.search}`);
      headers.push(new Headers(init?.headers));
      const { status, body } = handler(url.pathname);
      return new Response(JSON.stringify(body), { status });
    };
    return { fetchImpl, paths, headers };
  }

  it('reads the newest pull-request runs of ci.yml, then the jobs of attempt 1 of each', async () => {
    const { fetchImpl, paths, headers } = api((path) =>
      path.endsWith('/runs')
        ? { status: 200, body: { workflow_runs: [{ id: 11, created_at: iso(100) }, { id: 12, created_at: iso(200) }] } }
        : { status: 200, body: { jobs: [{ name: REQUIRED_JOB_NAME, conclusion: 'success', started_at: iso(0), completed_at: iso(150) }] } },
    );
    const records = await fetchJobRecords('owner/repo', TOKEN, fetchImpl);
    expect(paths).toEqual([
      '/repos/owner/repo/actions/workflows/ci.yml/runs?event=pull_request&status=completed&per_page=20',
      '/repos/owner/repo/actions/runs/11/attempts/1/jobs?per_page=100',
      '/repos/owner/repo/actions/runs/12/attempts/1/jobs?per_page=100',
    ]);
    expect(headers[0]?.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(records.map((record) => [record.runId, record.runAttempt, record.name])).toEqual([[11, 1, REQUIRED_JOB_NAME], [12, 1, REQUIRED_JOB_NAME]]);
    expect(ciTimeReport(records).runs).toBe(2);
  });

  it('reports the status, and neither the token nor the response, when the API refuses', async () => {
    const { fetchImpl } = api(() => ({ status: 403, body: { message: `secret detail ${TOKEN}` } }));
    const error = await fetchJobRecords('owner/repo', TOKEN, fetchImpl).catch((caught: unknown) => caught);
    const message = error instanceof Error ? error.message : '(not an error)';
    expect(message).toBe('the GitHub API answered HTTP 403 for /repos/owner/repo/actions/workflows/ci.yml/runs');
    expect(message).not.toContain(TOKEN);
  });

  it('refuses a repository name that is not owner/name, and a response that is not what the API documents', async () => {
    await expect(fetchJobRecords('not a repo', TOKEN, api(() => ({ status: 200, body: {} })).fetchImpl)).rejects.toThrow('owner/name');
    await expect(fetchJobRecords('owner/repo', TOKEN, api(() => ({ status: 200, body: { unexpected: true } })).fetchImpl)).rejects.toThrow();
  });
});
