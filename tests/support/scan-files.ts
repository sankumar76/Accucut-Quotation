import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProcess } from './process';

/**
 * The shared file listing for the repository-scan tests (STORY-10.12: privacy and English-only checks, no deletion of personal
 * data). The list comes from `git ls-files`, so an ignored file (a local `.env`, `node_modules`, a build folder) is never read,
 * and what CI scans is what is committed.
 */

export const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The most `git ls-files` may write: the list of a repository of this size is well under 1 MB. */
const LISTING_BUFFER_BYTES = 64 * 1024 * 1024;

/** Extensions read as text. Fonts, pictures, workbooks and the like are tracked too but hold no text to scan. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.md',
  '.txt',
  '.diff',
  '.sql',
  '.prisma',
  '.yml',
  '.yaml',
  '.toml',
  '.sh',
  '.ps1',
]);

/** Text files with no extension that are still scanned: the environment template. */
const TEXT_FILE_NAMES: ReadonlySet<string> = new Set(['.env.example']);

/** The tracked paths of `root`, with forward slashes, in git's order. A path that is tracked but missing on disk is left out. */
export function trackedFiles(root: string = REPOSITORY_ROOT): string[] {
  const result = runProcess('git', ['ls-files', '-z'], { cwd: root, what: 'git ls-files', maxBuffer: LISTING_BUFFER_BYTES });
  if (result.status !== 0) throw new Error(`git ls-files failed with exit code ${result.status}: ${result.stderr.trim()}`);
  return result.stdout
    .split('\0')
    .filter((path) => path !== '')
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => existsSync(join(root, path)));
}

export function isTextFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (TEXT_FILE_NAMES.has(name)) return true;
  const dot = name.lastIndexOf('.');
  return dot > 0 && TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/** True when `path` is one of `scope`: an entry ending in `/` is a folder, any other entry is that exact file. */
export function isInScope(path: string, scope: ReadonlyArray<string>): boolean {
  return scope.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry));
}

/** The text files among `paths` that are in `scope`. */
export function textFilesIn(paths: ReadonlyArray<string>, scope: ReadonlyArray<string>): string[] {
  return paths.filter((path) => isTextFile(path) && isInScope(path, scope));
}

/** The lines of a file, split on LF, CRLF or CR, so a line number is the one an editor shows. */
export function readLines(root: string, path: string): string[] {
  return readFileSync(join(root, path), 'utf8').split(/\r\n|\r|\n/);
}
