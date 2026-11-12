import { describe, expect, it } from 'vitest';

import { ATTEMPT_START_UNKNOWN, cacheState, fetchAttemptStart, isCarriedOver, pathSeconds, renderSummary, slowestShard, summariseRun } from '../../scripts/lib/ci-run-summary';
import { iso } from '../support/ci-feedback-records';
import { apiJobsOf, installSteps, job, runOf, shardJob } from '../support/ci-run-jobs';

/**
 * AQP-243 round 2 (G6 findings QLT-01 and QLT-03), the parts of the run-summary guard that `ci-run-summary.test.ts` (near its
 * line limit) does not carry: a step that RAN and failed still decides the cache state, and a job that was not run again by
 * "Re-run failed jobs" is left out of the path and the slowest shard.
 */

const NOW = Date.parse(iso(900));
/** The second this attempt began: jobs that started before it are from an earlier attempt. */
const ATTEMPT_START = Date.parse(iso(0));

/** The install steps of a hit, with one named step given another conclusion. */
function withConclusion(state: 'hit' | 'miss' | 'fallback', part: string, conclusion: string) {
  return installSteps('Shard', state, 0).steps.map((entry) => (entry.name.endsWith(`install, ${part}`) ? { ...entry, conclusion } : entry));
}

describe('QLT-01: a step that ran decides the cache state, whether it succeeded or not', () => {
  it.each(['failure', 'cancelled'])('a fallback npm ci that ended as %s is still a fallback, not a hit', (conclusion) => {
    expect(cacheState(withConclusion('fallback', 'npm ci (cache fallback)', conclusion))).toBe('fallback');
  });

  it.each(['failure', 'cancelled'])('a miss npm ci that ended as %s is still a miss, not n/a', (conclusion) => {
    expect(cacheState(withConclusion('miss', 'npm ci (cache miss)', conclusion))).toBe('miss');
  });

  it('keeps hit for a check that passed with both installs skipped, and n/a for a step that has not finished', () => {
    expect(cacheState(installSteps('Shard', 'hit', 0).steps)).toBe('hit');
    expect(cacheState(withConclusion('hit', 'check node_modules', 'failure'))).toBe('n/a');
    const running = installSteps('Shard', 'hit', 0).steps.map((entry) => (entry.name.endsWith('npm ci (cache miss)') ? { ...entry, conclusion: null } : entry));
    expect(cacheState(running)).toBe('hit');
  });
});

/** A run in which `Stages 1 to 11b` and shards 1 and 2 ran in this attempt, and shard 3 (the longest) is from attempt 4 before it. */
function rerunOfFailed() {
  const current = runOf({ shardTests: [100, 120, 1], verifyEnd: 200 }).filter((entry) => !entry.name.includes('shard 3'));
  const carried = shardJob(3, -900, 'hit', 400);
  return [...current, carried];
}

describe('QLT-03: jobs from an earlier attempt are left out of the path and the slowest shard', () => {
  it('knows a job that started before this attempt, and treats all jobs as current when the attempt start is unknown', () => {
    const carried = shardJob(3, -900, 'hit', 400);
    expect(isCarriedOver(carried, ATTEMPT_START)).toBe(true);
    expect(isCarriedOver(shardJob(1, 2, 'hit', 100), ATTEMPT_START)).toBe(false);
    expect(isCarriedOver(carried, undefined)).toBe(false);
    expect(isCarriedOver(job('x', 0, 0, { missingTimes: true }), ATTEMPT_START)).toBe(false);
  });

  it('names the slowest shard of this attempt, not the longer one carried over, and starts the path at this attempt', () => {
    const jobs = rerunOfFailed();
    const text = renderSummary(jobs, NOW, ATTEMPT_START);
    expect(text).toContain('**Slowest shard:** shard 2,');
    expect(text).not.toContain('**Slowest shard:** shard 3');
    // First start of this attempt is `Stages 1 to 11b` at second 1; the summary is made at second 900.
    expect(text).toContain('**Path so far:** 14 m 59 s');
    expect(text).toContain('| Stage 12: E2E (shard 3 of 3) (earlier attempt) |');
    expect(text).toContain('left out of the path and the slowest shard');
    expect(text).not.toContain('(shard 1 of 3) (earlier');
  });

  it('without the attempt start it counts every job, as before (so a failed read of the start only costs accuracy)', () => {
    const jobs = rerunOfFailed();
    expect(slowestShard(jobs)?.index).toBe(3);
    expect(pathSeconds(jobs, NOW)).toBe(900 + 900);
    const text = renderSummary(jobs, NOW);
    expect(text).toContain('**Slowest shard:** shard 3,');
    expect(text).not.toContain('earlier attempt');
  });

  it('shows n/a, not an old shard, when no shard ran in this attempt', () => {
    const onlyVerify = [runOf({ shardTests: [1, 1, 1] })[0], shardJob(1, -900, 'hit', 400), shardJob(2, -900, 'hit', 400)].filter((entry) => entry !== undefined);
    expect(renderSummary(onlyVerify, NOW, ATTEMPT_START)).toContain('**Slowest shard:** n/a');
  });
});

describe('STD-12: a failed read of the attempt start is said, on a later attempt', () => {
  const base = { GITHUB_REPOSITORY: 'owner/name', GITHUB_RUN_ID: '5', GITHUB_TOKEN: 'invented-token-value', GITHUB_API_URL: 'https://api.example.test' };
  /** The jobs answer; the attempt endpoint answers `status`. */
  const withAttemptStatus = (status: number): typeof fetch => (input) => {
    const isJobs = String(input).includes('/jobs?');
    return Promise.resolve(new Response(JSON.stringify(isJobs ? apiJobsOf(rerunOfFailed()) : { run_started_at: iso(0) }), { status: isJobs ? 200 : status }));
  };

  it('adds one fixed line when attempt 2 could not read its start (HTTP 500), and nothing else from the error', async () => {
    const text = await summariseRun({ ...base, GITHUB_RUN_ATTEMPT: '2' }, NOW, withAttemptStatus(500));
    expect(text.split('\n').filter((line) => line === ATTEMPT_START_UNKNOWN)).toHaveLength(1);
    expect(text.endsWith(`${ATTEMPT_START_UNKNOWN}\n`)).toBe(true);
    expect(text).not.toContain('500');
    expect(text).not.toContain('invented-token-value');
  });

  it('adds no line on attempt 1 (no earlier attempt), or when the start was read', async () => {
    expect(await summariseRun({ ...base, GITHUB_RUN_ATTEMPT: '1' }, NOW, withAttemptStatus(500))).not.toContain(ATTEMPT_START_UNKNOWN);
    expect(await summariseRun({ ...base, GITHUB_RUN_ATTEMPT: '2' }, NOW, withAttemptStatus(200))).not.toContain(ATTEMPT_START_UNKNOWN);
  });
});

describe('QLT-03: reading the start of this attempt', () => {
  const location = { repository: 'owner/name', runId: '5', attempt: '5', token: 'invented-token-value', apiOrigin: 'https://api.example.test' };
  const answer = (status: number, body: unknown): typeof fetch => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

  it('reads run_started_at of the attempt, and asks for that attempt', async () => {
    const urls: string[] = [];
    const fake: typeof fetch = (input) => {
      urls.push(String(input));
      return Promise.resolve(new Response(JSON.stringify({ run_started_at: iso(0) }), { status: 200 }));
    };
    expect(await fetchAttemptStart(location, fake)).toBe(ATTEMPT_START);
    expect(urls).toEqual(['https://api.example.test/repos/owner/name/actions/runs/5/attempts/5']);
  });

  it('gives undefined, and never throws, for an error status, a body of another shape, a bad time, or a network error', async () => {
    expect(await fetchAttemptStart(location, answer(404, {}))).toBeUndefined();
    expect(await fetchAttemptStart(location, answer(200, ['x']))).toBeUndefined();
    expect(await fetchAttemptStart(location, answer(200, { run_started_at: 'not a time' }))).toBeUndefined();
    expect(await fetchAttemptStart(location, answer(200, { run_started_at: 5 }))).toBeUndefined();
    expect(await fetchAttemptStart(location, () => Promise.reject(new Error('connection refused')))).toBeUndefined();
  });

  const env = { GITHUB_REPOSITORY: 'owner/name', GITHUB_RUN_ID: '5', GITHUB_RUN_ATTEMPT: '5', GITHUB_TOKEN: 'invented-token-value', GITHUB_API_URL: 'https://api.example.test' };
  const routed = (attemptBody: unknown): typeof fetch => (input) => {
    const body = String(input).includes('/jobs?') ? apiJobsOf(rerunOfFailed()) : attemptBody;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };

  it('marks the carried-over shard when the attempt start is known, and counts every job when it is not', async () => {
    const known = await summariseRun(env, NOW, routed({ run_started_at: iso(0) }));
    expect(known).toContain('(earlier attempt)');
    expect(known).toContain('**Slowest shard:** shard 2,');
    const unknown = await summariseRun(env, NOW, routed({}));
    expect(unknown).not.toContain('(earlier attempt)');
    expect(unknown).toContain(ATTEMPT_START_UNKNOWN);
    expect(unknown).toContain('**Slowest shard:** shard 3,');
  });
});
