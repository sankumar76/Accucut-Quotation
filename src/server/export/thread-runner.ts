import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

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
 * What passes to the thread is the plain `ExportModel` (structured clone). What comes back is the file's bytes, or the kind of a failure and nothing else (`thread-protocol.ts`).
 */

/** The file a model is built into: the thread in production, the build function itself in a test. */
export type BuildFile = (model: ExportModel) => Promise<Uint8Array<ArrayBuffer>>;

/** A thread that could not give a file: the kind of failure is the only thing kept, never a message that could hold what a person typed. */
export class ExportThreadError extends Error {
  constructor(readonly reason: 'missing' | 'failed' | 'exited' | 'timeout') {
    super(`The export thread did not give a file (${reason}).`);
    this.name = 'ExportThreadError';
  }
}

/** Where the bundle is, for the server running in `folder`. */
export function exportThreadFile(folder: string): string {
  return join(folder, '.next', 'export-worker.mjs');
}

/** A build that takes longer than the proxy's read timeout (architecture section 4.6: at least 120 s) has nobody left to receive the file. */
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ThreadBuilderOptions {
  /** The bundle to run. */
  readonly entry: string;
  readonly timeoutMs?: number;
}

export function createThreadBuilder({ entry, timeoutMs = DEFAULT_TIMEOUT_MS }: ThreadBuilderOptions): BuildFile {
  return (model) =>
    new Promise((resolve, reject) => {
      if (!existsSync(entry)) {
        reject(new ExportThreadError('missing'));
        return;
      }
      const thread = new Worker(entry, { workerData: model });
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
}
