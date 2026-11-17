import { setTimeout as pause } from 'node:timers/promises';

import { connectToTestDatabase } from './auth';

/**
 * The one turn at the export that the specs take (AQP-340, DEF-037).
 *
 * The server builds at most two workbooks at once and answers a third with 503 `EXPORT_BUSY` and `Retry-After`, never queuing it (`src/server/export/thread-runner.ts`, review QS-01: each
 * build holds a workbook in memory). That is the product's rule and it stays. In a run, though, `export.spec.ts` builds in three tests at three screen sizes, and `fullyParallel` with four
 * workers put three of them on the one server at the same moment: the traces of the red runs show the 503 on the route (`export.spec.ts:63` and `:80`, and `:39` on a retry). A test that
 * is refused for the server's own safety limit says nothing about the export, so each build in the spec takes this turn first.
 *
 * The turn is a PostgreSQL advisory lock, because the workers are separate processes and the database is the one thing they all share; each shard job has its own database and its own server,
 * which is exactly the scope of the server's counter. It is taken with `pg_try_advisory_lock` in a loop and not by blocking, so a test that is stopped by its timeout never leaves a query waiting.
 * The lock is held only for the build itself (the click and the download, or the fetch), a second or two, so a test waits for the others' builds and no more. Held by one session, it is released when
 * the session ends, even if the worker dies. One turn at a time leaves the second place of the server for `canary-scan.spec.ts`, which also asks for the file once.
 */
const EXPORT_TURN_KEY = '340037';
/** How often a test that is waiting for its turn asks again. */
const ASK_AGAIN_MS = 100;

export async function withExportTurn<T>(job: () => Promise<T>): Promise<T> {
  const client = await connectToTestDatabase();
  try {
    for (;;) {
      const { rows } = await client.query<{ readonly taken: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS taken', [EXPORT_TURN_KEY]);
      if (rows[0]?.taken === true) break;
      await pause(ASK_AGAIN_MS);
    }
    return await job();
  } finally {
    // Ending the session releases the lock whether or not it was taken.
    await client.end();
  }
}
