import { describe, expect, it } from 'vitest';

import { REQUIRED_JOB_NAME, ciTimeReport, type JobRecord } from '../../scripts/lib/ci-feedback-time';
import { iso, job, shaOf } from '../support/ci-feedback-records';

/**
 * AQP-208 AC-7: a run with several jobs (`Stages 1 to 11b`, the E2E shards and the fan-in job `Stages 1 to 11`) lasts from
 * the earliest start of any of its jobs to the end of the fan-in job, whichever shape the run has. Invented durations only;
 * the one-job cases, the figures and the 9-minute line are in ci-feedback-time.test.ts.
 */

describe('a run with several jobs (AQP-208 AC-7)', () => {
  const FIRST = 'Stages 1 to 11b';
  const shard = (index: number): string => `Stage 12: E2E (shard ${index} of 2)`;

  /**
   * A sharded run: `Stages 1 to 11b` and both shards start together (after `queue` seconds of waiting), the shards end at
   * `shardEnd`, and the fan-in job `Stages 1 to 11` starts `gap` seconds after the last of them and runs for `fanIn`.
   */
  function sharded(
    index: number,
    options: { queue?: number; firstEnd?: number; shardEnd?: number; gap?: number; fanIn?: number; fanInConclusion?: string | null; shardStarts?: [number, number] } = {},
  ): JobRecord[] {
    const { queue = 0, firstEnd = 170, shardEnd = 280, gap = 4, fanIn = 6, fanInConclusion = 'success', shardStarts = [2, 5] } = options;
    const created = index * 10_000;
    const at = (seconds: number): string => iso(created + seconds);
    const base = { runId: 1_000 + index, runAttempt: 1, headSha: shaOf(index), runCreatedAt: at(0) };
    const fanInStart = queue + shardEnd + gap;
    return [
      { ...base, name: FIRST, conclusion: 'success', startedAt: at(queue + 1), completedAt: at(queue + firstEnd) },
      { ...base, name: shard(1), conclusion: 'success', startedAt: at(queue + shardStarts[0]), completedAt: at(queue + shardEnd) },
      { ...base, name: shard(2), conclusion: 'success', startedAt: at(queue + shardStarts[1]), completedAt: at(queue + shardEnd - 10) },
      {
        ...base,
        name: REQUIRED_JOB_NAME,
        conclusion: fanInConclusion,
        startedAt: fanInConclusion === null ? null : at(fanInStart),
        completedAt: fanInConclusion === null ? null : at(fanInStart + fanIn),
      },
    ];
  }

  it('measures a one-job run from before AQP-208 as it always was: that job from start to end', () => {
    const report = ciTimeReport([job(0, 411)]);
    expect(report.runs).toBe(1);
    expect(report.p95Seconds).toBe(411);
    expect(report.oldest).toEqual({ runId: 1_000, startedAt: iso(0), headSha: shaOf(0) });
  });

  it('measures a sharded run from the start of its first job to the end of the fan-in job', () => {
    // The first job starts at 1 s; the fan-in ends at 280 + 4 + 6 = 290 s. Not the fan-in alone (6 s), not a shard (278 s).
    const report = ciTimeReport(sharded(0));
    expect(report.runs).toBe(1);
    expect(report.p95Seconds).toBe(289);
    expect(report.medianSeconds).toBe(289);
    expect(report.oldest?.startedAt).toBe(iso(1));
  });

  it('starts at whichever job started first, not at the first job in the list and not at the required job', () => {
    const report = ciTimeReport(sharded(0, { shardStarts: [0, 5] }).reverse());
    expect(report.p95Seconds).toBe(290);
    expect(report.oldest?.startedAt).toBe(iso(0));
  });

  it('leaves queue wait out: a run that waited 3000 s for a runner takes as long as one that did not', () => {
    expect(ciTimeReport(sharded(0, { queue: 3_000 })).p95Seconds).toBe(ciTimeReport(sharded(0)).p95Seconds);
  });

  it('leaves out a sharded run whose fan-in job failed, was cancelled or was skipped', () => {
    for (const fanInConclusion of ['failure', 'cancelled', 'skipped', null]) {
      expect(ciTimeReport(sharded(0, { fanInConclusion })).runs, String(fanInConclusion)).toBe(0);
    }
    // And a good run beside them is still counted.
    expect(ciTimeReport([...sharded(0, { fanInConclusion: 'failure' }), ...sharded(1)]).runs).toBe(1);
  });

  it('leaves out a sharded run that has no job named "Stages 1 to 11" at all (a one-job name is not enough)', () => {
    const withoutFanIn = sharded(0).filter((record) => record.name !== REQUIRED_JOB_NAME);
    expect(ciTimeReport(withoutFanIn).runs).toBe(0);
    // `Stages 1 to 11b` is not the required job, whatever its conclusion.
    expect(ciTimeReport(sharded(0).map((record) => (record.name === REQUIRED_JOB_NAME ? { ...record, name: FIRST } : record))).runs).toBe(0);
  });

  it('leaves out a re-run attempt of a sharded run, even a slow one, and does not mix its jobs into attempt 1', () => {
    const rerun = sharded(0, { shardEnd: 5_000 }).map((record) => ({ ...record, runAttempt: 2 }));
    const report = ciTimeReport([...sharded(0), ...rerun]);
    expect(report.runs).toBe(1);
    expect(report.p95Seconds).toBe(289);
    // A run with only attempt-2 jobs is not a run at all.
    expect(ciTimeReport(rerun).runs).toBe(0);
  });

  it('keeps two runs apart: one run\'s early job does not move another run\'s start', () => {
    const report = ciTimeReport([...sharded(0), ...sharded(5, { shardEnd: 400 })]);
    expect(report.runs).toBe(2);
    expect([report.oldest?.runId, report.newest?.runId]).toEqual([1_000, 1_005]);
    expect(report.medianSeconds).toBe((289 + 409) / 2);
  });

  it('counts runs of both shapes together in one report, newest 20 first', () => {
    const oneJob = Array.from({ length: 10 }, (_, index) => job(index, 411));
    const shardedRuns = Array.from({ length: 10 }, (_, index) => sharded(100 + index)).flat();
    const report = ciTimeReport([...oneJob, ...shardedRuns]);
    expect(report.runs).toBe(20);
    expect(report.p95Seconds).toBe(411);
    expect(report.medianSeconds).toBe((289 + 411) / 2);
    expect(report.newest?.runId).toBe(1_109);
  });
});
