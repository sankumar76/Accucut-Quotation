/**
 * Scanner for pending tests (test strategy section 5.6, control 4).
 *
 * A quantity test that is skipped, pending, conditionally run, expected to fail or focused would let a
 * wrong price reach G7 unseen. This finds those markers in test source text. It is strict on purpose: a
 * comment that mentions one is reported too, and the author rewords it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Where quantity tests live (test strategy section 5.6). A directory that does not exist yet is skipped. */
export const QUANTITY_TEST_DIRECTORIES: ReadonlyArray<string> = ['tests/unit/quantity', 'tests/integration/quantity'];

// `it.skip`, `describe.runIf(...)`, `it.skipIf(...)` and the like. `runIf(false)` is `skipIf` inverted.
const MODIFIER_CALL = /\.(todo|skip|skipIf|runIf|fails|only)\b/;
// `it['skip']`.
const MODIFIER_INDEXED = /\[\s*['"`](todo|skip|skipIf|runIf|fails|only)['"`]\s*\]/;
// `{ skip: true }`, `{ skip: flag }`: any value counts, because a variable can be true on a runner.
const MODIFIER_OPTION = /\b(todo|skip|only|fails)\s*:/;
// `ctx.skip()` is caught by MODIFIER_CALL; this is the destructured form, `({ skip }) => skip()`.
const BARE_SKIP_CALL = /\bskip\s*\(/;

export interface PendingTestFinding {
  readonly line: number;
  readonly text: string;
}

export interface PendingTestFileFinding extends PendingTestFinding {
  readonly file: string;
}

function isPending(text: string): boolean {
  return [MODIFIER_CALL, MODIFIER_INDEXED, MODIFIER_OPTION, BARE_SKIP_CALL].some((pattern) => pattern.test(text));
}

export function findPendingTests(source: string): PendingTestFinding[] {
  return source.split(/\r?\n/).flatMap((text, index) => (isPending(text) ? [{ line: index + 1, text: text.trim() }] : []));
}

function testFilesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return testFilesUnder(path);
    return /\.test\.ts$/.test(name) ? [path] : [];
  });
}

/** Scans every `*.test.ts` under `directory`; a directory that does not exist has no findings. */
export function findPendingTestsInDirectory(directory: string): PendingTestFileFinding[] {
  return testFilesUnder(directory).flatMap((file) =>
    findPendingTests(readFileSync(file, 'utf8')).map((finding) => ({
      file: relative(directory, file).replaceAll('\\', '/'),
      ...finding,
    })),
  );
}
