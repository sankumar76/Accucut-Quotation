import { REQUIRED_JOB_NAME, type JobRecord } from '../../scripts/lib/ci-feedback-time';

/**
 * Invented job records for the CI feedback-time tests (`ci-feedback-time.test.ts` and `ci-feedback-time-sharded.test.ts`).
 * No clock is read and no API is called: every time is an offset in seconds from one fixed instant.
 */

const BASE = Date.parse('2026-11-01T10:00:00Z');

/** The time `seconds` after the fixed instant, as the GitHub API writes it. */
export const iso = (seconds: number): string => new Date(BASE + seconds * 1_000).toISOString();

/** An invented commit id for run `index`: 40 hexadecimal digits, so it passes the same check as a real one. */
export const shaOf = (index: number): string => index.toString(16).padStart(40, 'a');

/** A job that waited `queue` seconds, then ran for `run` seconds. `index` orders the runs (a higher index is newer). */
export function job(index: number, run: number, overrides: Partial<JobRecord> = {}, queue = 0): JobRecord {
  const created = index * 10_000;
  return {
    runId: 1_000 + index,
    runAttempt: 1,
    headSha: shaOf(index),
    name: REQUIRED_JOB_NAME,
    conclusion: 'success',
    runCreatedAt: iso(created),
    startedAt: iso(created + queue),
    completedAt: iso(created + queue + run),
    ...overrides,
  };
}

/** One-job runs, one per duration, oldest first. */
export const runsOf = (...durations: number[]): JobRecord[] => durations.map((seconds, index) => job(index, seconds));
