import type { DiskReadingRow } from '../../src/lib/settings/backup-status';
import type { JobRunRepository } from '../../src/server/repositories/job-run-repository';

/**
 * An in-memory `job_runs` for the tests that run a route or the page without a database (the role matrix, the refusal-before-lookup scan, the page tests of STORY-02.09). It holds rows in
 * the shape of the contract (`job`, `finishedAt`, `result`) and answers the two questions the repository answers, with the same rules as its SQL: a good backup is `job = 'backup'` with
 * `result.status = 'ok'`; a reading is the newest row of either job whose `freeBytes` and `totalBytes` are numbers within a disk. `tests/integration/settings/settings.test.ts` runs the
 * real SQL, so the two cannot drift without a failing test. Members are plain functions, so a test can spy on each one. Every figure is invented.
 */

export interface FakeJobRun {
  readonly job: string;
  readonly finishedAt: Date;
  readonly result: Readonly<Record<string, unknown>>;
}

export interface FakeJobRunRepository extends JobRunRepository {
  readonly rows: FakeJobRun[];
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function createFakeJobRunRepository(initial: ReadonlyArray<FakeJobRun> = []): FakeJobRunRepository {
  const rows: FakeJobRun[] = [...initial];
  const newestFirst = (a: FakeJobRun, b: FakeJobRun): number => b.finishedAt.getTime() - a.finishedAt.getTime();
  return {
    rows,
    latestGoodBackupAt: () => Promise.resolve([...rows].filter((row) => row.job === 'backup' && row.result['status'] === 'ok').sort(newestFirst)[0]?.finishedAt ?? null),
    latestDiskReading: () => {
      const readings: DiskReadingRow[] = [];
      for (const row of [...rows].filter((candidate) => candidate.job === 'backup' || candidate.job === 'backup-watch').sort(newestFirst)) {
        const { freeBytes, totalBytes } = row.result;
        if (isNumber(freeBytes) && isNumber(totalBytes) && totalBytes > 0 && freeBytes >= 0 && freeBytes <= totalBytes) readings.push({ readAt: row.finishedAt, freeBytes, totalBytes });
      }
      return Promise.resolve(readings[0] ?? null);
    },
  };
}
