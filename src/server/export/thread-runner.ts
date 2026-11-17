import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker, type WorkerOptions } from 'node:worker_threads';

import { AppError, ExportBusyError } from '../../lib/errors';

import type { ExportModel } from './export-model';
import type { ThreadMessage } from './thread-protocol';

/**
 * Runs the workbook build in a `node:worker_threads` thread, so the event loop stays free for the other people using the portal (ADR-012; STORY-07.01 AC-5; NFR-010).
 *
 * The thread's file is a **bundle made by `scripts/build-export-worker.ts`** (esbuild, ExcelJS inside it), because a thread cannot load TypeScript and Next.js does not bundle a thread's entry
 * (architecture section 4.6, ADR-012 "a thread entry file must be built and shipped"). `npm run build`, the Playwright dev server and `scripts/package-windows.ps1` each make it, at `.next/export-worker.mjs`
 * under the folder the server runs in. A missing file is a mistake in the install, not something to work around: the build fails with a plain error (a 500 with fixed words, logged), and the file is
 * **never** built on the main thread instead.
 *
 * **Bounded** (review QS-01): at most `maxThreads` builds run at once (the next is refused 503 `EXPORT_BUSY` with `Retry-After`, never queued), and each thread has a ceiling on its heap
 * (`resourceLimits`), so a build that outgrows it ends only its own thread and the portal goes on. The counter belongs to the builder; the composition makes one, so it is one for the process.
 *
 * What passes to the thread is the plain `ExportModel` (structured clone). What comes back is the file's bytes, or the kind of a failure and nothing else (`thread-protocol.ts`).
 */

/** The file a model is built into: the thread in production, the build function itself in a test. */
export type BuildFile = (model: ExportModel) => Promise<Uint8Array<ArrayBuffer>>;

/** Why a thread did not give a file. It is the code of the error too, so the log tells a missing bundle, a crash and a timeout apart (the body of the answer says none of it). */
export type ExportThreadFailure = 'missing' | 'failed' | 'exited' | 'timeout';

/** A thread that could not give a file: a 500 with fixed words, and a code of `EXPORT_THREAD_<REASON>` for the log. Only the kind of failure is kept, never a message that could hold typed text. */
export class ExportThreadError extends AppError {
  constructor(readonly reason: ExportThreadFailure) {
    super(`EXPORT_THREAD_${reason.toUpperCase()}`, 500, `The export thread did not give a file (${reason}).`);
  }
}

/** Where the bundle is, for the server running in `folder`. */
export function exportThreadFile(folder: string): string {
  return join(folder, '.next', 'export-worker.mjs');
}

/** A build that takes longer than the proxy's read timeout (architecture section 4.6: at least 120 s) has nobody left to receive the file. */
const DEFAULT_TIMEOUT_MS = 120_000;
/** Builds at once. Each holds a workbook in memory: measured +405 MB for ten header-only builds together and +1,037 MB for four of 2,000 rows (review QS-01). */
const DEFAULT_MAX_THREADS = 2;
/** The heap a thread may grow to before it is ended (Node's default for a thread is the process's). STORY-07.02 sets it again with pictures in the file. */
const DEFAULT_HEAP_LIMIT_MB = 512;

/** Starts a thread. The real one is `new Worker`; a test passes its own to see the options a thread is started with. */
export type StartThread = (entry: string, options: WorkerOptions) => Worker;

const startWorker: StartThread = (entry, options) => new Worker(entry, options);

export interface ThreadBuilderOptions {
  /** The bundle to run. */
  readonly entry: string;
  readonly timeoutMs?: number;
  readonly maxThreads?: number;
  readonly heapLimitMb?: number;
  readonly startThread?: StartThread;
}

export function createThreadBuilder({ entry, timeoutMs = DEFAULT_TIMEOUT_MS, maxThreads = DEFAULT_MAX_THREADS, heapLimitMb = DEFAULT_HEAP_LIMIT_MB, startThread = startWorker }: ThreadBuilderOptions): BuildFile {
  let running = 0;
  return (model) =>
    new Promise((resolve, reject) => {
      if (running >= maxThreads) {
        reject(new ExportBusyError());
        return;
      }
      if (!existsSync(entry)) {
        reject(new ExportThreadError('missing'));
        return;
      }
      let thread: Worker;
      try {
        thread = startThread(entry, { workerData: model, resourceLimits: { maxOldGenerationSizeMb: heapLimitMb } });
      } catch {
        // The constructor can throw at once (a model that cannot be cloned, or no memory or handle for a thread). No thread was started, so no place was taken (review QS-12).
        reject(new ExportThreadError('failed'));
        return;
      }
      running += 1;
      let settled = false;
      const settle = (finish: () => void): void => {
        if (settled) return;
        settled = true;
        running -= 1;
        clearTimeout(timer);
        finish();
      };
      const timer = setTimeout(() => {
        settle(() => reject(new ExportThreadError('timeout')));
        void thread.terminate();
      }, timeoutMs);
      thread.once('message', (message: ThreadMessage) => {
        settle(() => (message.ok ? resolve(message.bytes) : reject(new ExportThreadError('failed'))));
        void thread.terminate();
      });
      thread.once('error', () => settle(() => reject(new ExportThreadError('failed'))));
      thread.once('exit', () => settle(() => reject(new ExportThreadError('exited'))));
    });
}
