import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeChangedCoverage,
  describeJoinFailure,
  filesMissingFromReport,
  parseAddedLines,
  parseLcov,
} from '../../scripts/lib/changed-coverage';

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
    expect(parseLcov(LCOV, 'C:\\work\\repo').has('src/lib/logger.ts')).toBe(true);
  });

  it('QLT-06: drops a leading ./ so a reporter format change cannot hide every file', () => {
    expect(parseLcov('SF:./src/lib/env.ts\nDA:1,1\nend_of_record').has('src/lib/env.ts')).toBe(true);
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
    expect(parseAddedLines('--- a/a.ts\n+++ b/a.ts\n@@ -3,2 +2,0 @@').get('a.ts')).toEqual([]);
  });

  it('QLT-07: an added line whose content starts "++ " is content, not a file header', () => {
    const diff = [
      '--- a/src/lib/a.ts',
      '+++ b/src/lib/a.ts',
      '@@ -0,0 +1,2 @@',
      '+first',
      '+++ looks like a header',
      '@@ -10,0 +5,2 @@',
      '+fifth',
      '+sixth',
    ].join('\n');
    expect(parseAddedLines(diff).get('src/lib/a.ts')).toEqual([1, 2, 5, 6]);
  });

  it('QLT-07: a path with a space loses the trailing tab that git adds', () => {
    const diff = ['--- a/src/lib/my file.ts\t', '+++ b/src/lib/my file.ts\t', '@@ -0,0 +1 @@', '+x'].join('\n');
    expect([...parseAddedLines(diff).keys()]).toEqual(['src/lib/my file.ts']);
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
    const diff = '--- a/docs/a.md\n+++ b/docs/a.md\n@@ -1 +1 @@';
    const result = computeChangedCoverage(parseAddedLines(diff), parseLcov(LCOV));
    expect(result).toMatchObject({ covered: 0, total: 0, percent: 100 });
  });
});

describe('filesMissingFromReport (QLT-18)', () => {
  const added = (...files: string[]) => new Map(files.map((file) => [file, [1]]));

  it('names measured changed files that the report has no entry for', () => {
    const coverage = parseLcov('SF:src/lib/a.ts\nDA:1,1\nend_of_record');
    expect(filesMissingFromReport(added('src/lib/a.ts', 'src/lib/b.ts', 'src/server/c.tsx'), coverage)).toEqual([
      'src/lib/b.ts',
      'src/server/c.tsx',
    ]);
  });

  it('leaves out excluded, unmeasured and non-code files', () => {
    const files = added('src/app/page.tsx', 'src/components/ui/button.tsx', 'tests/unit/a.test.ts', 'docs/a.md', 'src/lib/data.json');
    expect(filesMissingFromReport(files, parseLcov(''))).toEqual([]);
  });
});

describe('describeJoinFailure (QLT-06)', () => {
  const added = (...files: string[]) => new Map(files.map((file) => [file, [1]]));

  it('reports a join failure when code in scope was added and the report holds no recognisable path', () => {
    const elsewhere = parseLcov('SF:/other/place/src/lib/env.ts\nDA:1,1\nend_of_record');
    expect(describeJoinFailure(added('src/lib/env.ts'), elsewhere)).toMatch(/matched none/);
    expect(describeJoinFailure(added('src/lib/env.ts'), parseLcov(''))).toMatch(/matched none/);
  });

  it('passes when the report holds in-scope paths, even for a file with no executable line', () => {
    const coverage = parseLcov('SF:src/lib/other.ts\nDA:1,1\nend_of_record\nSF:src/lib/types.ts\nend_of_record');
    expect(describeJoinFailure(added('src/lib/types.ts'), coverage)).toBeUndefined();
    expect(describeJoinFailure(added('src/lib/brand-new-types-only.ts'), coverage)).toBeUndefined();
  });

  it('passes a change that touches only excluded or out-of-scope code', () => {
    const empty = parseLcov('');
    expect(describeJoinFailure(added('src/app/page.tsx', 'src/components/ui/button.tsx', 'docs/a.md'), empty)).toBeUndefined();
  });
});

describe('check-changed-coverage script (QLT-06, STD-07)', { timeout: 60_000 }, () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  /** A throwaway repository: commit "base", then a branch commit that adds the given files. */
  function repositoryWith(added: Record<string, string>): string {
    const directory = mkdtempSync(join(tmpdir(), 'aqp-changed-coverage-'));
    directories.push(directory);
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], { cwd: directory, stdio: 'ignore' });
    git('init', '--quiet', '--initial-branch=base');
    writeFileSync(join(directory, 'README.md'), 'base\n');
    git('add', '--all');
    git('commit', '--quiet', '-m', 'base');
    git('checkout', '--quiet', '-b', 'change');
    for (const [path, content] of Object.entries(added)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    git('add', '--all');
    git('commit', '--quiet', '-m', 'change');
    return directory;
  }

  function run(root: string, lcov: string, ...extra: string[]): { status: number | null; output: string } {
    writeFileSync(join(root, 'lcov.info'), lcov);
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/check-changed-coverage.ts', '--base', 'base', '--root', root, '--lcov', join(root, 'lcov.info'), ...extra],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  const source = 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n';
  const lcov = (path: string, hits: number) => `SF:${path}\nDA:1,${hits}\nDA:2,${hits}\nDA:3,${hits}\nend_of_record\n`;

  it('passes when the added lines are covered', () => {
    const root = repositoryWith({ 'src/lib/a.ts': source });
    expect(run(root, lcov('src/lib/a.ts', 1))).toMatchObject({ status: 0 });
  });

  it('QLT-06: fails when every added line has zero hits', () => {
    const root = repositoryWith({ 'src/lib/a.ts': source });
    const { status, output } = run(root, lcov('src/lib/a.ts', 0));
    expect(status).toBe(1);
    expect(output).toContain('0.0%');
  });

  it('QLT-06: fails when the report paths do not match the changed files', () => {
    const root = repositoryWith({ 'src/lib/a.ts': source });
    const { status, output } = run(root, lcov('/somewhere/else/src/lib/a.ts', 1));
    expect(status).toBe(1);
    expect(output).toMatch(/matched none/);
  });

  it('QLT-06: still matches a report that writes paths with ./', () => {
    const root = repositoryWith({ 'src/lib/a.ts': source });
    expect(run(root, lcov('./src/lib/a.ts', 1))).toMatchObject({ status: 0 });
  });

  it('QLT-06: passes a change that touches only excluded code, with no report entry', () => {
    const root = repositoryWith({ 'src/app/page.tsx': source, 'src/components/ui/button.tsx': source });
    expect(run(root, '')).toMatchObject({ status: 0 });
  });

  it('QLT-06: passes a new file that holds only types', () => {
    const root = repositoryWith({ 'src/lib/types.ts': 'export type A = string;\n' });
    expect(run(root, 'SF:src/lib/types.ts\nend_of_record\n')).toMatchObject({ status: 0 });
    expect(run(root, lcov('src/lib/other.ts', 1))).toMatchObject({ status: 0 });
  });

  it('QLT-18: names a changed file that has no entry in the report, and still passes (a notice, not a failure)', () => {
    const root = repositoryWith({ 'src/lib/a.ts': source, 'src/lib/b.ts': source });
    const { status, output } = run(root, lcov('src/lib/a.ts', 1));
    expect(status).toBe(0);
    expect(output).toMatch(/src\/lib\/b\.ts/);
    expect(output).toMatch(/no entry in the coverage report/i);
    expect(output).not.toMatch(/src\/lib\/a\.ts.*no entry/i);
  });

  it('QLT-18: prints no notice when every measured changed file is in the report', () => {
    const root = repositoryWith({ 'src/lib/a.ts': source, 'src/app/page.tsx': source });
    expect(run(root, lcov('src/lib/a.ts', 1)).output).not.toMatch(/no entry in the coverage report/i);
  });

  it.each(['abc', '-1', '101', ''])('STD-07: fails closed on --threshold "%s"', (value) => {
    const root = repositoryWith({ 'src/lib/a.ts': source });
    const { status, output } = run(root, lcov('src/lib/a.ts', 0), '--threshold', value);
    expect(status).toBe(2);
    expect(output).toMatch(/threshold/i);
  });

  it('fails with usage when --base is missing', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-changed-coverage.ts'], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status).toBe(2);
  });
});
