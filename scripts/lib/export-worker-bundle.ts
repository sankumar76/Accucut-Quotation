import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Bundles the export thread's entry (`src/worker/export-thread.ts`) into one ES module file (ADR-012; STORY-07.01 AC-5). A `worker_threads` thread cannot load TypeScript, and Next.js does not
 * bundle a thread's entry, so the file is made by esbuild, the same tool and the same flags as the worker bundle of `scripts/package-windows.ps1` (`New-EsbuildBundle`). ExcelJS goes **inside** the file, so the
 * thread needs nothing from `node_modules` and the packaged install (whose standalone folder holds only what Next.js traced) runs it as it is.
 */

const ENTRY = 'src/worker/export-thread.ts';
/** Where the server looks for it, under the folder it runs in (`src/server/export/thread-runner.ts`, `exportThreadFile`). */
export const EXPORT_WORKER_OUTPUT = '.next/export-worker.mjs';

/** A bundle of CommonJS packages inside an ES module needs `require`: this line gives it one (the same banner as `New-EsbuildBundle`). */
const BANNER = "import { createRequire as accucutCreateRequire } from 'node:module'; const require = accucutCreateRequire(import.meta.url);";

/** Makes the bundle at `outFile` (default: under `root`) and returns its path. Throws, naming the entry and nothing of the output, when esbuild fails or writes no file. */
export function bundleExportWorker(root: string = process.cwd(), outFile: string = resolve(root, EXPORT_WORKER_OUTPUT)): string {
  const esbuild = resolve(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
  mkdirSync(dirname(outFile), { recursive: true });
  const args = [esbuild, resolve(root, ENTRY), '--bundle', '--platform=node', '--format=esm', '--target=node22', `--outfile=${outFile}`, `--banner:js=${BANNER}`, '--log-level=warning'];
  try {
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  } catch {
    throw new Error(`esbuild failed for '${ENTRY}'.`);
  }
  if (!existsSync(outFile)) throw new Error(`esbuild wrote no file for '${ENTRY}'.`);
  return outFile;
}
