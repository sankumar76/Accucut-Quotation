import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { buildSync } from 'esbuild';

/**
 * Bundles the export thread's entry (`src/worker/export-thread.ts`) into one ES module file (ADR-012; STORY-07.01 AC-5). A `worker_threads` thread cannot load TypeScript, and Next.js does not
 * bundle a thread's entry, so the file is made by esbuild, with the same target and the same `require` banner as the worker bundle of `scripts/package-windows.ps1` (`New-EsbuildBundle`). ExcelJS goes
 * **inside** the file, so the thread needs nothing from `node_modules` and the packaged install (whose standalone folder holds only what Next.js traced) runs it as it is.
 *
 * esbuild is used through its JavaScript API, not by running `node_modules/esbuild/bin/esbuild`: on Linux that file is replaced by the native program when esbuild is installed, so it cannot be run
 * with `node` there (the Windows package script can, because on Windows the file stays a script). esbuild is already in the lockfile (a dependency of `tsx` and of Vitest); no dependency is added.
 */

const ENTRY = 'src/worker/export-thread.ts';
/** Where the server looks for it, under the folder it runs in (`src/server/export/thread-runner.ts`, `exportThreadFile`). */
export const EXPORT_WORKER_OUTPUT = '.next/export-worker.mjs';

/** A bundle of CommonJS packages inside an ES module needs `require`: this line gives it one (the same banner as `New-EsbuildBundle`). */
const BANNER = "import { createRequire as accucutCreateRequire } from 'node:module'; const require = accucutCreateRequire(import.meta.url);";

/** Makes the bundle at `outFile` (default: under `root`) and returns its path. Throws, naming the entry and nothing of the output, when esbuild fails or writes no file. */
export function bundleExportWorker(root: string = process.cwd(), outFile: string = resolve(root, EXPORT_WORKER_OUTPUT)): string {
  mkdirSync(dirname(outFile), { recursive: true });
  try {
    buildSync({
      entryPoints: [resolve(root, ENTRY)],
      outfile: outFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      banner: { js: BANNER },
      logLevel: 'warning',
    });
  } catch (error) {
    // The first line of esbuild's own message (a path or a missing file: never a value of the application) says why, in a log that does not show the error output of a test.
    const why = error instanceof Error ? error.message.split('\n')[0] : '';
    throw new Error(`esbuild failed for '${ENTRY}'. ${why}`.trim());
  }
  if (!existsSync(outFile)) throw new Error(`esbuild wrote no file for '${ENTRY}'.`);
  return outFile;
}
