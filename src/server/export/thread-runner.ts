import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker, type TransferListItem, type WorkerOptions } from 'node:worker_threads';

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
 * **Bounded** (review QS-01; STORY-07.02, GitHub issue 440): a build takes a **place** before anything is read for it (`admit`) and gives it back when it is done (`release`). At most `maxThreads` places
 * are taken at once, and at most `maxLarge` of them by a **large** estimate (more than `largeAboveParts` parts, counted by the caller from the stored rows before any picture is read), because a large
 * file with its pictures is what the memory is spent on (architecture section 4.6). A request for a place that is not free is refused 503 `EXPORT_BUSY` with `Retry-After`, never queued: that one refusal
 * is the whole of the gate. Each thread also has a ceiling on its heap (`resourceLimits`), so a build that outgrows it ends only its own thread and the portal goes on. The counters belong to the builder;
 * the composition makes one, so they are one for the process.
 *
 * What passes to the thread is the plain `ExportModel` (structured clone), and the bytes of its pictures are **moved** to it, not copied, where the model owns them whole (`transferablesOf`). What
 * comes back is the file's bytes, or the kind of a failure and nothing else (`thread-protocol.ts`).
 */

/** The place of one build: the build itself, and the way to give the place back. The caller always releases, in a `finally`, so a refusal, a failure and a file all free it. */
export interface ExportPlace {
  /** Builds the file in a thread. Call it once. */
  build(model: ExportModel): Promise<Uint8Array<ArrayBuffer>>;
  /** Gives the place back. Safe to call more than once. */
  release(): void;
}

/** Takes places for builds (see above). `partCount` is the number of parts of the estimate, counted before any picture is read. Throws `ExportBusyError` when no place is free. */
export interface ExportBuilder {
  admit(partCount: number): ExportPlace;
}

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
/** The heap a thread may grow to before it is ended (Node's default for a thread is the process's). STORY-07.02 measured it again with pictures in the file (see the pull request). */
const DEFAULT_HEAP_LIMIT_MB = 512;
/** An estimate with more parts than this is "large" (architecture section 4.6: an estimate over 100 nodes). */
export const LARGE_EXPORT_PARTS = 100;
/** Large builds at once: one at a time. */
const DEFAULT_MAX_LARGE = 1;

/** Starts a thread. The real one is `new Worker`; a test passes its own to see the options a thread is started with. */
export type StartThread = (entry: string, options: WorkerOptions) => Worker;

const startWorker: StartThread = (entry, options) => new Worker(entry, options);

export interface ThreadBuilderOptions {
  /** The bundle to run. */
  readonly entry: string;
  readonly timeoutMs?: number;
  readonly maxThreads?: number;
  /** How many of the places a large estimate may hold at once. */
  readonly maxLarge?: number;
  /** An estimate with more parts than this is large. */
  readonly largeAboveParts?: number;
  readonly heapLimitMb?: number;
  readonly startThread?: StartThread;
}

/**
 * The buffers of the model's pictures that can be moved to the thread: a buffer is moved only when the picture's bytes are the whole of it (a picture that is a view into a larger buffer would take its
 * neighbours with it, so it is copied as usual), and once however many pictures share it.
 */
export function transferablesOf(model: ExportModel): TransferListItem[] {
  const buffers = new Set<ArrayBuffer>();
  for (const { bytes } of model.pictures ?? []) {
    if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) buffers.add(bytes.buffer);
  }
  return [...buffers];
}

export function createThreadBuilder({
  entry,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxThreads = DEFAULT_MAX_THREADS,
  maxLarge = DEFAULT_MAX_LARGE,
  largeAboveParts = LARGE_EXPORT_PARTS,
  heapLimitMb = DEFAULT_HEAP_LIMIT_MB,
  startThread = startWorker,
}: ThreadBuilderOptions): ExportBuilder {
  let taken = 0;
  let takenByLarge = 0;

  const run = (model: ExportModel): Promise<Uint8Array<ArrayBuffer>> =>
    new Promise((resolve, reject) => {
      if (!existsSync(entry)) {
        reject(new ExportThreadError('missing'));
        return;
      }
      let thread: Worker;
      try {
        thread = startThread(entry, { workerData: model, transferList: transferablesOf(model), resourceLimits: { maxOldGenerationSizeMb: heapLimitMb } });
      } catch {
        // The constructor can throw at once (a model that cannot be cloned, or no memory or handle for a thread). No thread was started (review QS-12).
        reject(new ExportThreadError('failed'));
        return;
      }
      let settled = false;
      const settle = (finish: () => void): void => {
        if (settled) return;
        settled = true;
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

  return {
    admit(partCount) {
      const large = partCount > largeAboveParts;
      if (taken >= maxThreads || (large && takenByLarge >= maxLarge)) throw new ExportBusyError();
      taken += 1;
      if (large) takenByLarge += 1;
      let released = false;
      let built = false;
      return {
        // A place is for one build, while it is held (review SQR-02 of AQP-332): a build after the release, or a second one in the same place, would start a thread outside the count.
        build: (model) => {
          if (released || built) return Promise.reject(new Error('This place has been released or already used.'));
          built = true;
          return run(model);
        },
        release() {
          if (released) return;
          released = true;
          taken -= 1;
          if (large) takenByLarge -= 1;
        },
      };
    },
  };
}
