import { connectToTestDatabase } from './auth';

/**
 * The `job_runs` rows the Settings spec (STORY-02.09) needs in the database the servers use. The runtime role can only add rows to the table (no UPDATE, no DELETE), so the spec never
 * clears anything: it adds the same state every time, and the page reads the newest row, so a second run, a retry or another width's project adds rows that change nothing. The URL is
 * judged by the same guard as every test run (`connectToTestDatabase`), so this can never write to a live database. Every figure is invented.
 */

const DISK_TOTAL_BYTES = 1_000_000;
/** 10 percent of the invented disk: below the 20 percent line. */
const DISK_FREE_BYTES = 100_000;

/**
 * A weekly backup that finished 9 days ago (more than 8: "Backup late"), and a reading made just now by the daily check that finds 10 % of the disk free ("Disk nearly full", and a
 * fresh reading). Both rows also carry a path and a volume name, which the page must never show.
 */
export async function seedLateBackupAndFullDisk(): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query(
      `INSERT INTO job_runs (job, started_at, finished_at, result) VALUES
         ('backup', now() - interval '9 days 5 minutes', now() - interval '9 days', $1::jsonb),
         ('backup-watch', now() - interval '1 minute', now(), $2::jsonb)`,
      [
        JSON.stringify({ status: 'ok', sizeBytes: 5_000, freeBytes: 900_000, totalBytes: DISK_TOTAL_BYTES, path: 'D:\\InventedBackupFolder\\copy-0001.age' }),
        JSON.stringify({ status: 'ok', freeBytes: DISK_FREE_BYTES, totalBytes: DISK_TOTAL_BYTES, volume: 'InventedVolumeLabel' }),
      ],
    );
  } finally {
    await client.end();
  }
}
