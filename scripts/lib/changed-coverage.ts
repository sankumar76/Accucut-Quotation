/**
 * Coverage of changed code (coding standards section 6: at least 80 percent of the lines a pull
 * request adds). Vitest measures files, not diffs, so this joins the lcov report with the added
 * lines of `git diff`. Only executable lines count: a line the report has no entry for (a comment,
 * a type, a blank line) is ignored, and so is a file the report does not cover.
 */

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
  return slashed.startsWith(`${base}/`) ? slashed.slice(base.length + 1) : slashed;
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

/** Reads `git diff -U0` output and returns the added line numbers per file. */
export function parseAddedLines(diff: string): AddedLines {
  const added = new Map<string, number[]>();
  let file: string | undefined;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? line.slice(6) : undefined;
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
