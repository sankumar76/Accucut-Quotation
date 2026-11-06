import { describe, expect, it } from 'vitest';

import {
  MEDIAN_LIMIT_SECONDS,
  NINE_MINUTE_NOTICE,
  NOTICE_LIMIT_SECONDS,
  P95_LIMIT_SECONDS,
  REQUIRED_JOB_NAME,
  ciTimeLines,
  ciTimeReport,
  ciTimeSummary,
  fetchJobRecords,
  formatDuration,
  median,
  nearestRank,
  type JobRecord,
} from '../../scripts/lib/ci-feedback-time';
import { iso, job, runsOf, shaOf } from '../support/ci-feedback-records';

/**
 * STORY-10.10 AC-8: the CI feedback time is a pure function of job records. Invented durations only; no clock is read
 * and no API is called (the API reader is tested with a fake `fetch`). The cases for a run with several jobs (AQP-208
 * AC-7) are in ci-feedback-time-sharded.test.ts.
 */

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
    expect(report).toEqual({
      runs: 0,
      p95Seconds: undefined,
      medianSeconds: undefined,
      breaches: [],
      notices: [],
      oldest: undefined,
      newest: undefined,
    });
    expect(ciTimeLines(report)).toEqual(['CI feedback time: no successful first-attempt run of the required job was found, so there is no figure yet.']);
  });

  it('writes the figures, the runs used, each breach on its own line, and then the 9-minute line', () => {
    const lines = ciTimeLines(ciTimeReport(runsOf(...Array.from({ length: 20 }, () => 700))));
    expect(lines[0]).toBe('CI feedback time of "Stages 1 to 11" (20 runs): p95 11 m 40 s (target at most 10 m), median 11 m 40 s (early warning over 6 m).');
    expect(lines[1]).toContain('Runs used: 20.');
    expect(lines.slice(2, 4)).toEqual([
      'CI feedback time: the p95 of "Stages 1 to 11" is 11 m 40 s, over the 10-minute target (20 runs).',
      'CI feedback time: the median of "Stages 1 to 11" is 11 m 40 s, over the 6-minute early warning (20 runs).',
    ]);
    expect(lines[4]).toBe(NINE_MINUTE_NOTICE);
    expect(lines).toHaveLength(5);
  });
});

describe('the 9-minute line (STORY-10.14 AC-7; DL-095)', () => {
  const twenty = (seconds: number): JobRecord[] => runsOf(...Array.from({ length: 20 }, () => seconds));
  /** 20 runs whose p95 is `seconds` and whose median is 300 s, under the 6-minute early warning, so only the p95 is in play. */
  const withP95 = (seconds: number): JobRecord[] => runsOf(...Array.from({ length: 18 }, () => 300), seconds, seconds);

  it('is the sentence master ruled (DL-103), word for word, and the limit is 540 seconds (AQP-208 AC-7)', () => {
    expect(NOTICE_LIMIT_SECONDS).toBe(540);
    expect(NINE_MINUTE_NOTICE).toBe(
      'p95 over 9 minutes (DL-095, DL-102): CI feedback is too slow; the next step is named in test strategy 10.5.',
    );
  });

  it('is written to the job summary as exactly that text at 541 seconds, and nothing of it at 540 (AQP-208 AC-7)', () => {
    const exactLine = 'p95 over 9 minutes (DL-095, DL-102): CI feedback is too slow; the next step is named in test strategy 10.5.';
    expect(ciTimeSummary(ciTimeReport(withP95(541)))).toContain(`\n\n${exactLine}\n`);
    expect(ciTimeLines(ciTimeReport(withP95(541)))).toContain(exactLine);
    const atLimit = ciTimeSummary(ciTimeReport(withP95(540)));
    expect(atLimit).not.toContain('p95 over 9 minutes');
    expect(atLimit).not.toContain('test strategy 10.5');
    // The text of the AQP-199 line is gone: it named a merge that has happened.
    expect(ciTimeSummary(ciTimeReport(withP95(541)))).not.toMatch(/before AQP-199 merges|the shard step of test strategy 10\.5 is due/);
  });

  it('is not written at exactly 540 seconds', () => {
    const report = ciTimeReport(withP95(540));
    expect(report.p95Seconds).toBe(540);
    expect(report.notices).toEqual([]);
    expect(ciTimeLines(report)).not.toContain(NINE_MINUTE_NOTICE);
    expect(ciTimeSummary(report)).not.toContain('DL-095');
  });

  it('is written at 541 seconds, as its own line in the report and its own paragraph in the summary, and fails nothing', () => {
    const report = ciTimeReport(withP95(541));
    expect(report.p95Seconds).toBe(541);
    expect(report.notices).toEqual([NINE_MINUTE_NOTICE]);
    expect(report.breaches).toEqual([]);
    expect(ciTimeLines(report)).toContain(NINE_MINUTE_NOTICE);
    expect(ciTimeSummary(report)).toContain(`\n\n${NINE_MINUTE_NOTICE}\n`);
    expect(ciTimeSummary(report)).not.toContain(`- ${NINE_MINUTE_NOTICE}`);
  });

  it('keeps the failures as they were: 541 s fails nothing, 601 s fails the 10-minute target and still carries the line', () => {
    expect(ciTimeReport(withP95(541)).breaches).toEqual([]);
    const slow = ciTimeReport(twenty(P95_LIMIT_SECONDS + 1));
    expect(slow.breaches).toHaveLength(2);
    expect(slow.notices).toEqual([NINE_MINUTE_NOTICE]);
    // The 6-minute early warning is unchanged and independent of the 9-minute line.
    expect(ciTimeReport(twenty(MEDIAN_LIMIT_SECONDS + 1)).notices).toEqual([]);
  });

  it('is judged on the p95 only: one slow run in 20 does not write it, two do', () => {
    expect(ciTimeReport(runsOf(...Array.from({ length: 19 }, () => 300), 900)).notices).toEqual([]);
    expect(ciTimeReport(runsOf(...Array.from({ length: 18 }, () => 300), 541, 900)).notices).toEqual([NINE_MINUTE_NOTICE]);
  });

  it('is written from fewer than 20 runs too, and the count is stated', () => {
    const report = ciTimeReport(runsOf(541, 541, 541));
    expect(report.runs).toBe(3);
    expect(report.notices).toEqual([NINE_MINUTE_NOTICE]);
    expect(ciTimeLines(report)[0]).toContain('only 3 runs, fewer than the 20 asked for');
    expect(ciTimeLines(report)[1]).toContain('Runs used: 3.');
    expect(ciTimeReport(runsOf(540, 540, 540)).notices).toEqual([]);
  });

  it('leaves out a re-run attempt: a slow second attempt neither writes the line nor counts as a run', () => {
    const jobs = [...twenty(300), job(50, 5_000, { runAttempt: 2 }), job(51, 5_000, { runAttempt: 3 })];
    const report = ciTimeReport(jobs);
    expect(report.runs).toBe(20);
    expect(report.p95Seconds).toBe(300);
    expect(report.notices).toEqual([]);
    // Nor can a re-run be the oldest or the newest run named in the report.
    expect([report.oldest?.headSha, report.newest?.headSha]).toEqual([shaOf(0), shaOf(19)]);
  });
});

describe('the runs a report used (STORY-10.14 AC-7)', () => {
  it('names the start time and head commit of the oldest and the newest run, and the count', () => {
    const report = ciTimeReport(runsOf(150, 160, 170));
    expect(report.oldest).toEqual({ runId: 1_000, startedAt: iso(0), headSha: shaOf(0) });
    expect(report.newest).toEqual({ runId: 1_002, startedAt: iso(20_000), headSha: shaOf(2) });
    const line = ciTimeLines(report)[1];
    expect(line).toBe(
      `Runs used: 3. Oldest run 1000 started ${iso(0)}, head commit ${shaOf(0)}. Newest run 1002 started ${iso(20_000)}, head commit ${shaOf(2)}.`,
    );
  });

  it('is the start on a runner, not the creation of the run, so queue wait does not move it', () => {
    const report = ciTimeReport([job(0, 120, {}, 3_000)]);
    expect(report.oldest?.startedAt).toBe(iso(3_000));
    expect(report.newest).toEqual(report.oldest);
  });

  it('is over the newest 20 runs only: older runs are not named, whatever order they arrive in', () => {
    const old = Array.from({ length: 5 }, (_, index) => job(index, 5_000));
    const recent = Array.from({ length: 20 }, (_, index) => job(100 + index, 150));
    const report = ciTimeReport([...recent.reverse(), ...old]);
    expect(report.oldest?.headSha).toBe(shaOf(100));
    expect(report.newest?.headSha).toBe(shaOf(119));
  });

  it('names no run when none qualifies, and the summary says so without a runs line', () => {
    const report = ciTimeReport([job(0, 100, { conclusion: 'failure' })]);
    expect(report.oldest).toBeUndefined();
    expect(report.newest).toBeUndefined();
    expect(ciTimeSummary(report)).toBe(
      '### CI feedback time (NFR-009)\n\n- CI feedback time: no successful first-attempt run of the required job was found, so there is no figure yet.\n',
    );
  });

  it('writes the summary as a list of the report lines under a heading', () => {
    const summary = ciTimeSummary(ciTimeReport(runsOf(150, 160, 170)));
    expect(summary.startsWith('### CI feedback time (NFR-009)\n\n- CI feedback time of "Stages 1 to 11" (only 3 runs')).toBe(true);
    expect(summary).toContain('\n- Runs used: 3. Oldest run 1000');
    expect(summary.endsWith('\n')).toBe(true);
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
        ? {
            status: 200,
            body: { workflow_runs: [{ id: 11, created_at: iso(100), head_sha: shaOf(11) }, { id: 12, created_at: iso(200), head_sha: shaOf(12) }] },
          }
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
    // The head commit of each run comes from the run list, so the report can name it.
    expect(records.map((record) => record.headSha)).toEqual([shaOf(11), shaOf(12)]);
    expect(ciTimeReport(records).newest?.headSha).toBe(shaOf(12));
  });

  it('refuses a head commit that is not 40 hexadecimal digits, because the report writes it into the job summary', async () => {
    const body = (headSha: string) => ({ workflow_runs: [{ id: 11, created_at: iso(100), head_sha: headSha }] });
    for (const bad of ['', 'abc123', `${shaOf(1)}\n- injected`, shaOf(1).toUpperCase()]) {
      await expect(fetchJobRecords('owner/repo', TOKEN, api(() => ({ status: 200, body: body(bad) })).fetchImpl)).rejects.toThrow();
    }
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
