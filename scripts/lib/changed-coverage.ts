/**
 * Coverage of changed code (coding standards section 6: at least 80 percent of the lines a pull
 * request adds). Vitest measures files, not diffs, so this joins the lcov report with the added
 * lines of `git diff`. Only executable lines count: a line the report has no entry for (a comment,
 * a type, a blank line) is ignored.
 *
 * The join can fail without anyone noticing (a reporter that writes paths differently matches no
 * file, and "nothing to measure" then looks like 100 percent). `describeJoinFailure` makes that fail
 * closed (QLT-06).
 */
import { isCoverageScoped } from './coverage-scope';

/** File path -> line number -> hit count. */
export type LineCoverage = ReadonlyMap<string, ReadonlyMap<number, number>>;

/** File path -> line numbers added by the change. */
export type AddedLines = ReadonlyMap<string, ReadonlyArray<number>>;

export interface ChangedCoverageResult {
  readonly covered: number;
  readonly total: number;
  /** 100 when there is nothing executable to cover. */
  readonly percent: number;
  readonly uncovered: ReadonlyArray<string>;
}

function normalisePath(path: string, workingDirectory: string): string {
  const slashed = path.replaceAll('\\', '/');
  const base = workingDirectory.replaceAll('\\', '/').replace(/\/$/, '');
  const relative = base !== '' && slashed.startsWith(`${base}/`) ? slashed.slice(base.length + 1) : slashed;
  return relative.replace(/^\.\//, '');
}

export function parseLcov(text: string, workingDirectory = ''): LineCoverage {
  const files = new Map<string, Map<number, number>>();
  let current: Map<number, number> | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      current = new Map();
      files.set(normalisePath(line.slice(3), workingDirectory), current);
    } else if (line.startsWith('DA:') && current !== undefined) {
      const [lineNumber, hits] = line.slice(3).split(',');
      if (lineNumber !== undefined && hits !== undefined) current.set(Number(lineNumber), Number(hits));
    } else if (line === 'end_of_record') {
      current = undefined;
    }
  }
  return files;
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const OLD_FILE_HEADER = '--- ';
const NEW_FILE_HEADER = '+++ ';

/** Git appends a tab to a path that contains a space; the path ends at the first tab. */
function pathFromHeader(header: string): string | undefined {
  const path = header.slice(NEW_FILE_HEADER.length).split('\t')[0] ?? '';
  return path.startsWith('b/') ? path.slice(2) : undefined;
}

/**
 * Reads `git diff -U0` output and returns the added line numbers per file. A line starting `+++ ` is a
 * file header only straight after a `--- ` line; anywhere else it is added content that happens to
 * start with `++ ` (QLT-07).
 */
export function parseAddedLines(diff: string): AddedLines {
  const added = new Map<string, number[]>();
  let file: string | undefined;
  let previous = '';
  for (const line of diff.split(/\r?\n/)) {
    const isHeader = line.startsWith(NEW_FILE_HEADER) && previous.startsWith(OLD_FILE_HEADER);
    previous = line;
    if (isHeader) {
      file = pathFromHeader(line);
      continue;
    }
    const hunk = HUNK_HEADER.exec(line);
    if (hunk === null || file === undefined) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = Array.from({ length: count }, (_, offset) => start + offset);
    added.set(file, [...(added.get(file) ?? []), ...lines]);
  }
  return added;
}

export function computeChangedCoverage(added: AddedLines, coverage: LineCoverage): ChangedCoverageResult {
  let covered = 0;
  let total = 0;
  const uncovered: string[] = [];
  for (const [file, lines] of added) {
    const fileCoverage = coverage.get(file);
    if (fileCoverage === undefined) continue;
    for (const line of lines) {
      const hits = fileCoverage.get(line);
      if (hits === undefined) continue;
      total += 1;
      if (hits > 0) covered += 1;
      else uncovered.push(`${file}:${line}`);
    }
  }
  return { covered, total, percent: total === 0 ? 100 : (covered / total) * 100, uncovered };
}

/**
 * Changed files that coverage measures but the report has no entry for. They are not a failure (a file
 * that holds only types has none), but their added lines were not measured, so the check names them
 * instead of skipping them silently (QLT-18).
 */
export function filesMissingFromReport(added: AddedLines, coverage: LineCoverage): string[] {
  return [...added.keys()].filter((file) => /\.tsx?$/.test(file) && isCoverageScoped(file) && !coverage.has(file));
}

/**
 * Returns a message when the diff and the report cannot have been joined, and undefined when they can.
 * Code that coverage measures was added, but the report holds no path that coverage measures: the
 * report was written in a form this check does not read, so 100 percent would mean nothing. A change
 * that touches only excluded or unmeasured files is fine, and so is a file with no executable line.
 */
export function describeJoinFailure(added: AddedLines, coverage: LineCoverage): string | undefined {
  const measuredAdded = [...added.keys()].filter((file) => /\.tsx?$/.test(file) && isCoverageScoped(file));
  if (measuredAdded.length === 0) return undefined;
  const recognised = [...coverage.keys()].some((file) => isCoverageScoped(file));
  if (recognised) return undefined;
  return `The coverage report matched none of the ${measuredAdded.length} changed file(s) that coverage measures (for example ${measuredAdded[0] ?? ''}). The report's file paths may have changed form; the check cannot tell, so it fails.`;
}
