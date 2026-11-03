import { describe, expect, it } from 'vitest';

import { computeChangedCoverage, parseAddedLines, parseLcov } from '../../scripts/lib/changed-coverage';

/** AC-8: changed code must be covered at least 80 percent (coding standards section 6). */

const LCOV = [
  'TN:',
  'SF:src/lib/env.ts',
  'DA:1,1',
  'DA:2,1',
  'DA:3,0',
  'DA:4,1',
  'end_of_record',
  'SF:C:\\work\\repo\\src\\lib\\logger.ts',
  'DA:10,0',
  'end_of_record',
].join('\n');

const DIFF = [
  'diff --git a/src/lib/env.ts b/src/lib/env.ts',
  '--- a/src/lib/env.ts',
  '+++ b/src/lib/env.ts',
  '@@ -0,0 +1,4 @@',
  '+line',
  'diff --git a/docs/readme.md b/docs/readme.md',
  '--- a/docs/readme.md',
  '+++ b/docs/readme.md',
  '@@ -5 +5 @@',
  '+text',
  'diff --git a/src/lib/old.ts b/src/lib/old.ts',
  '--- a/src/lib/old.ts',
  '+++ /dev/null',
  '@@ -1,3 +0,0 @@',
  '-gone',
  'diff --git a/src/lib/logger.ts b/src/lib/logger.ts',
  '--- a/src/lib/logger.ts',
  '+++ b/src/lib/logger.ts',
  '@@ -9,0 +10,2 @@',
  '+a',
  '+b',
].join('\n');

describe('parseLcov', () => {
  it('reads hit counts per file and line', () => {
    const coverage = parseLcov(LCOV);
    expect(coverage.get('src/lib/env.ts')?.get(3)).toBe(0);
    expect(coverage.get('src/lib/env.ts')?.get(4)).toBe(1);
  });

  it('makes absolute Windows paths relative to the working directory', () => {
    const coverage = parseLcov(LCOV, 'C:\\work\\repo');
    expect(coverage.has('src/lib/logger.ts')).toBe(true);
  });
});

describe('parseAddedLines', () => {
  it('lists added line numbers per file and skips deleted files', () => {
    const added = parseAddedLines(DIFF);
    expect(added.get('src/lib/env.ts')).toEqual([1, 2, 3, 4]);
    expect(added.get('docs/readme.md')).toEqual([5]);
    expect(added.has('src/lib/old.ts')).toBe(false);
    expect(added.get('src/lib/logger.ts')).toEqual([10, 11]);
  });

  it('ignores a pure deletion hunk', () => {
    expect(parseAddedLines('+++ b/a.ts\n@@ -3,2 +2,0 @@').get('a.ts')).toEqual([]);
  });
});

describe('computeChangedCoverage', () => {
  it('counts only executable added lines in files the report covers', () => {
    const result = computeChangedCoverage(parseAddedLines(DIFF), parseLcov(LCOV, 'C:\\work\\repo'));
    // env.ts: lines 1, 2, 4 covered and 3 not; logger.ts line 10 not covered; line 11 has no entry.
    expect(result).toMatchObject({ covered: 3, total: 5 });
    expect(result.percent).toBeCloseTo(60);
    expect(result.uncovered).toEqual(['src/lib/env.ts:3', 'src/lib/logger.ts:10']);
  });

  it('is 100 percent when nothing executable changed', () => {
    const result = computeChangedCoverage(parseAddedLines('+++ b/docs/a.md\n@@ -1 +1 @@'), parseLcov(LCOV));
    expect(result).toMatchObject({ covered: 0, total: 0, percent: 100 });
  });
});
