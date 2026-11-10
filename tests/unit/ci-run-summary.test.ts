import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cacheState,
  fetchRunJobs,
  formatDuration,
  installSeconds,
  parseJobs,
  pathSeconds,
  renderSummary,
  slowestShard,
  summariseRun,
  type JobData,
} from '../../scripts/lib/ci-run-summary';
import { iso } from '../support/ci-feedback-records';
import { installSteps, job, runOf, step } from '../support/ci-run-jobs';

/**
 * AQP-243 (STORY-10.19) AC-5, PRF-04 of AQP-227: the per-run summary written by the fan-in job. The cases are fabricated runs:
 * no clock is read and no API is called, except a local server for the one test that runs the script as the workflow does.
 * Plants: the slowest shard is named by its time and not by a fixed number, a missing time shows "n/a" and never a zero, and
 * the script never fails the job.
 */

const NOW = Date.parse(iso(400));
const SCRIPT = fileURLToPath(new URL('../../scripts/lib/ci-run-summary.ts', import.meta.url));

/** One summary line of the table that starts with `label`. */
const rowOf = (text: string, label: string): string => text.split('\n').find((line) => line.startsWith(`| ${label}`)) ?? '';

describe('AC-5: the slowest shard', () => {
  it('names shard 2 when shard 2 is the slowest, with its set-up and test split and its gap to Stages 1 to 11b', () => {
    // Tests of 150, 230 and 170 s: shard 2 is the longest. `Stages 1 to 11b` ends at second 250.
    const jobs = runOf({ shardTests: [150, 230, 170], verifyEnd: 250 });
    const slowest = slowestShard(jobs);
    expect(slowest?.index).toBe(2);
    expect(slowest?.testSeconds).toBe(230);
    // Set-up is the time before the test step: 5 s before the install, 15 s of install steps (a hit), 60 s of other set-up.
    expect(slowest?.setupSeconds).toBe(5 + 15 + 60);
    const text = renderSummary(jobs, NOW);
    expect(text).toContain('**Slowest shard:** shard 2,');
    expect(text).toContain('tests 3 m 50 s');
    expect(text).toMatch(/it ended \d+ m \d\d s after Stages 1 to 11b\./);
  });

  it('names the shard by its time: shard 3 when shard 3 is the slowest, and the lower index on a tie', () => {
    expect(slowestShard(runOf({ shardTests: [100, 120, 300] }))?.index).toBe(3);
    expect(slowestShard(runOf({ shardTests: [200, 200, 200] }))?.index).toBe(1);
  });

  it('says "before" when the shard ended before Stages 1 to 11b, and "after" when it ended after', () => {
    expect(renderSummary(runOf({ shardTests: [100, 100, 100], verifyEnd: 400 }), NOW)).toMatch(/it ended \d+ m \d\d s before Stages 1 to 11b\./);
    expect(renderSummary(runOf({ shardTests: [300, 100, 100], verifyEnd: 100 }), NOW)).toMatch(/it ended \d+ m \d\d s after Stages 1 to 11b\./);
  });

  it('shows n/a for the gap and for the split when the data is missing, and never a zero', () => {
    const jobs = runOf({ shardTests: [100, 100, 300] });
    const noVerifyTimes = jobs.map((entry) => (entry.name === 'Stages 1 to 11b' ? { ...entry, completedAt: null } : entry));
    expect(renderSummary(noVerifyTimes, NOW)).toMatch(/it n\/a\./);
    const noSteps = jobs.map((entry) => (entry.name.startsWith('Stage 12') ? { ...entry, steps: [] } : entry));
    const text = renderSummary(noSteps, NOW);
    expect(text).toContain('set-up n/a, tests n/a');
    expect(text).not.toContain('0 m 00 s');
  });

  it('shows n/a, not a shard, when no shard job has a start and an end', () => {
    const noShards = runOf({ shardTests: [1, 1, 1] }).filter((entry) => !entry.name.startsWith('Stage 12'));
    expect(slowestShard(noShards)).toBeUndefined();
    expect(renderSummary(noShards, NOW)).toContain('**Slowest shard:** n/a');
  });
});

describe('AC-5: the table', () => {
  it('lists each job with its duration and queue wait, in the order verify, shards, fan-in', () => {
    const text = renderSummary(runOf({ shardTests: [150, 230, 170] }), NOW);
    const names = text.split('\n').filter((line) => line.startsWith('| Stage')).map((line) => line.split('|')[1]?.trim());
    expect(names).toEqual(['Stages 1 to 11b', 'Stage 12: E2E (shard 1 of 3)', 'Stage 12: E2E (shard 2 of 3)', 'Stage 12: E2E (shard 3 of 3)', 'Stages 1 to 11 (this job, so far)']);
    expect(rowOf(text, 'Stages 1 to 11b')).toContain('| 4 m 09 s | 0 m 03 s |');
    expect(rowOf(text, 'Stage 12: E2E (shard 1 of 3)')).toContain('| 0 m 04 s |');
  });

  it('marks the cache state of each job: hit, miss, and fallback', () => {
    for (const state of ['hit', 'miss', 'fallback'] as const) {
      const text = renderSummary(runOf({ shardTests: [100, 100, 100], state }), NOW);
      expect(rowOf(text, 'Stages 1 to 11b').endsWith(`| ${state} |`), state).toBe(true);
      expect(rowOf(text, 'Stage 12: E2E (shard 2 of 3)').endsWith(`| ${state} |`), state).toBe(true);
    }
  });

  it('says the path is a few seconds short, queue wait excluded, and counts it from the first job start', () => {
    const jobs = runOf({ shardTests: [150, 230, 170], verifyEnd: 250 });
    const text = renderSummary(jobs, NOW);
    expect(text).toContain('cannot read its own end');
    expect(text).toContain('queue wait excluded');
    // First start is second 1 (`Stages 1 to 11b`); the summary is made at second 400.
    expect(pathSeconds(jobs, NOW)).toBe(399);
    expect(text).toContain('**Path so far:** 6 m 39 s');
  });

  it('uses the end of the fan-in job for the path when that job has ended', () => {
    const jobs = runOf({ shardTests: [150, 230, 170] }).map((entry) => (entry.name === 'Stages 1 to 11' ? job(entry.name, 340, 352) : entry));
    expect(pathSeconds(jobs, NOW)).toBe(351);
    expect(renderSummary(jobs, NOW)).toContain('| Stages 1 to 11 | 0 m 12 s |');
  });

  it('shows n/a, never a zero, for a job with no start or end, and for a run with no time at all', () => {
    const jobs = runOf({ shardTests: [100, 100, 100] }).map((entry) => (entry.name === 'Stage 12: E2E (shard 3 of 3)' ? job(entry.name, 0, 0, { missingTimes: true }) : entry));
    const row = rowOf(renderSummary(jobs, NOW), 'Stage 12: E2E (shard 3 of 3)');
    expect(row).toBe('| Stage 12: E2E (shard 3 of 3) | n/a | n/a | n/a | n/a |');
    const empty = [job('Stages 1 to 11b', 0, 0, { missingTimes: true }), job('Stages 1 to 11', 0, 0, { missingTimes: true })];
    expect(renderSummary(empty, NOW)).toContain('**Path so far:** n/a');
    expect(formatDuration(undefined)).toBe('n/a');
  });

  it('keeps a pipe in a job name from breaking the table', () => {
    expect(rowOf(renderSummary([job('a | b', 0, 10)], NOW), 'a')).toContain('a \\| b');
  });
});

describe('AC-2 / AC-5: install plus generate and the cache state, read from the steps that ran', () => {
  it('counts the key, restore, check and prisma generate on a hit (the skipped steps are not part of it)', () => {
    // 1 + 6 + 2 + 6 = 15 s; the skipped miss, fallback and save steps add nothing.
    expect(installSeconds(installSteps('Shard', 'hit', 0).steps)).toBe(15);
  });

  it('counts the npm ci and the save on a miss, and the npm ci on a fallback', () => {
    expect(installSeconds(installSteps('Shard', 'miss', 0).steps)).toBe(1 + 6 + 40 + 5 + 6);
    expect(installSeconds(installSteps('Stage 1', 'fallback', 0).steps)).toBe(1 + 6 + 2 + 40 + 6);
  });

  it('reads hit, miss and fallback from the steps, and n/a when the restore did not run or the steps are missing', () => {
    expect(cacheState(installSteps('Shard', 'hit', 0).steps)).toBe('hit');
    expect(cacheState(installSteps('Shard', 'miss', 0).steps)).toBe('miss');
    expect(cacheState(installSteps('Stage 1', 'fallback', 0).steps)).toBe('fallback');
    expect(cacheState([])).toBe('n/a');
    const restoreFailed = installSteps('Shard', 'hit', 0).steps.map((entry) => (entry.name.endsWith('restore node_modules') ? { ...entry, conclusion: 'failure' } : entry));
    expect(cacheState(restoreFailed)).toBe('n/a');
  });

  it('gives n/a, not 0, when no install step ran or a time is missing', () => {
    expect(installSeconds([])).toBeUndefined();
    expect(installSeconds([step('Stage 1: install, restore node_modules', 0, 5, { missingTimes: true })])).toBeUndefined();
    expect(installSeconds([step('Stage 1: install, restore node_modules', 5, 0)])).toBeUndefined();
  });

  it('does not count the other steps of a job (the pinned npm, the build, the tests)', () => {
    const steps = [step('Use the pinned npm', 0, 30), ...installSteps('Shard', 'hit', 30).steps, step('Shard: build (next build)', 45, 120)];
    expect(installSeconds(steps)).toBe(15);
  });
});

describe('AC-5: reading the jobs API', () => {
  it('turns the API shape into jobs and steps, and leaves out an entry of another shape', () => {
    const jobs = parseJobs({
      jobs: [
        { name: 'Stages 1 to 11b', conclusion: 'success', created_at: iso(0), started_at: iso(2), completed_at: iso(9), steps: [{ name: 'a', conclusion: 'success', started_at: iso(3), completed_at: iso(4) }, 7] },
        { conclusion: 'success' },
        'text',
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.steps).toEqual([{ name: 'a', conclusion: 'success', startedAt: iso(3), completedAt: iso(4) }]);
    expect(parseJobs(null)).toEqual([]);
    expect(parseJobs({ jobs: 'x' })).toEqual([]);
  });

  const location = { repository: 'owner/name', runId: '123', attempt: '2', token: 'invented-token-value', apiOrigin: 'https://api.example.test' };

  it('asks for the jobs of this run and attempt with the token, and reports only the status of a failure', async () => {
    const seen: Array<{ url: string; authorization: string }> = [];
    const fake: typeof fetch = (input, init) => {
      seen.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') ?? '' });
      return Promise.resolve(new Response(JSON.stringify({ jobs: [{ name: 'x' }] }), { status: 200 }));
    };
    expect(await fetchRunJobs(location, fake)).toHaveLength(1);
    expect(seen).toEqual([{ url: 'https://api.example.test/repos/owner/name/actions/runs/123/attempts/2/jobs?per_page=100', authorization: 'Bearer invented-token-value' }]);
    const refused: typeof fetch = () => Promise.resolve(new Response('secret body', { status: 403 }));
    await expect(fetchRunJobs(location, refused)).rejects.toThrow(/^the GitHub API answered HTTP 403$/);
  });

  it('refuses a repository or run that is not in the expected form', async () => {
    await expect(fetchRunJobs({ ...location, repository: 'owner/name/../x' })).rejects.toThrow(/owner\/name/);
    await expect(fetchRunJobs({ ...location, runId: '1;rm' })).rejects.toThrow(/number/);
  });

  it('gives the n/a text, and never throws or shows the token, when the API fails, answers nothing, or the environment is missing', async () => {
    const env = { GITHUB_REPOSITORY: 'owner/name', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_TOKEN: 'invented-token-value', GITHUB_API_URL: 'https://api.example.test' };
    const down: typeof fetch = () => Promise.reject(new Error('connection refused'));
    const error500: typeof fetch = () => Promise.resolve(new Response('x', { status: 500 }));
    const empty: typeof fetch = () => Promise.resolve(new Response('{"jobs":[]}', { status: 200 }));
    for (const fake of [down, error500, empty]) {
      const text = await summariseRun(env, NOW, fake);
      expect(text).toContain('**Path so far:** n/a');
      expect(text).not.toContain('invented-token-value');
    }
    expect(await summariseRun({}, NOW, error500)).toContain('n/a');
  });
});

describe('AC-5: the script, run as the workflow runs it (Node type stripping, no install)', () => {
  let server: Server;
  let origin = '';
  let status = 200;
  let directory = '';

  /** The API shape of a fabricated run. */
  const apiJobs = (jobs: ReadonlyArray<JobData>): unknown => ({
    jobs: jobs.map((entry) => ({
      name: entry.name,
      conclusion: entry.conclusion,
      created_at: entry.createdAt,
      started_at: entry.startedAt,
      completed_at: entry.completedAt,
      steps: entry.steps.map((s) => ({ name: s.name, conclusion: s.conclusion, started_at: s.startedAt, completed_at: s.completedAt })),
    })),
  });

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'ci-run-summary-'));
    server = createServer((_request, response) => {
      response.statusCode = status;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(apiJobs(runOf({ shardTests: [150, 230, 170] }))));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('the test server has no port');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  });

  function runScript(extra: Record<string, string>): Promise<{ code: number | null; stdout: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', SCRIPT], {
        env: { NODE_ENV: 'test', PATH: process.env['PATH'] ?? '', ...extra },
      });
      let stdout = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout }));
    });
  }

  const environment = (summaryFile: string): Record<string, string> => ({
    GITHUB_REPOSITORY: 'owner/name',
    GITHUB_RUN_ID: '42',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_TOKEN: 'invented-token-value',
    GITHUB_API_URL: origin,
    GITHUB_STEP_SUMMARY: summaryFile,
  });

  it('writes the summary to standard output and to the job summary file, names shard 2, and exits 0', async () => {
    status = 200;
    const file = join(directory, 'summary-ok.md');
    writeFileSync(file, '');
    const { code, stdout } = await runScript(environment(file));
    expect(code).toBe(0);
    expect(stdout).toContain('**Slowest shard:** shard 2,');
    expect(readFileSync(file, 'utf8')).toBe(stdout);
  }, 30_000);

  it('exits 0 and writes n/a when the API answers an error, or when the environment is not set', async () => {
    status = 500;
    const file = join(directory, 'summary-error.md');
    writeFileSync(file, '');
    const failed = await runScript(environment(file));
    expect(failed.code).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('**Path so far:** n/a');
    const bare = await runScript({});
    expect(bare.code).toBe(0);
    expect(bare.stdout).toContain('n/a');
  }, 30_000);
});
