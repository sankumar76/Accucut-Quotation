import { parentPort, workerData } from 'node:worker_threads';

import { runExportThread } from '../server/export/thread-protocol';

/**
 * The entry of the export thread (ADR-012, STORY-07.01 AC-5): bundled by `scripts/build-export-worker.ts` into `.next/export-worker.mjs` and started by `src/server/export/thread-runner.ts`.
 * It holds **no logic**: everything it does is `runExportThread`, which the unit tests call in process. Code run by `new Worker()` is invisible to the coverage tool, so this file is out of its scope
 * (`scripts/lib/coverage-scope.ts`, test strategy section 11).
 */
if (parentPort !== null) void runExportThread(parentPort, workerData);
