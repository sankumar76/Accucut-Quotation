import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ALLOWED_DATA_FILES, findDisallowedDataFiles } from '../../scripts/lib/data-files';

/** AC-5: the data-file check passes on the repository as it stands and fails on a planted file. */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function throwawayRepository(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'aqp-data-files-'));
  temporaryDirectories.push(directory);
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(directory, path, '..'), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  execFileSync('git', ['add', '--all'], { cwd: directory });
  return directory;
}

function runCheck(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-data-files.ts', '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('findDisallowedDataFiles (AC-5)', () => {
  it('AC-5: flags a new .csv, .xlsx and .json outside the allow-list', () => {
    const tracked = ['src/lib/env.ts', 'rates.csv', 'prisma/seed/placeholders/rates.json', 'Copy of Rates.XLSX'];
    expect(findDisallowedDataFiles(tracked)).toEqual([
      'rates.csv',
      'prisma/seed/placeholders/rates.json',
      'Copy of Rates.XLSX',
    ]);
  });

  it.each(['.ods', '.xlsb', '.xltx', '.xltm', '.jsonl', '.ndjson', '.parquet', '.dump'])(
    'QLT-16: flags a new %s file, another way for master data to arrive',
    (extension) => {
      expect(findDisallowedDataFiles([`prisma/seed/placeholders/rates${extension}`, `RATES${extension.toUpperCase()}`])).toHaveLength(2);
    },
  );

  it('AC-5: accepts the two documented exceptions and the project configuration files', () => {
    const tracked = ALLOWED_DATA_FILES.map((entry) => entry.path);
    expect(tracked).toContain('AMADA-20261006.xlsx');
    expect(tracked).toContain('Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx');
    expect(findDisallowedDataFiles(tracked)).toEqual([]);
  });

  it('AC-5: an exception is an exact path, not a pattern that lets new files in', () => {
    expect(findDisallowedDataFiles(['AMADA-20261007.xlsx', 'docs/AMADA-20261006.xlsx', 'other/package.json'])).toHaveLength(3);
  });

  it('AC-5: understands Windows separators', () => {
    expect(findDisallowedDataFiles(['prisma\\seed\\rates.csv'])).toEqual(['prisma/seed/rates.csv']);
  });

  it('every allow-list entry carries a reason', () => {
    for (const entry of ALLOWED_DATA_FILES) expect(entry.reason.length).toBeGreaterThan(5);
  });
});

describe('check-data-files script (AC-5)', { timeout: 60_000 }, () => {
  it('AC-5: passes on this repository as it stands', () => {
    const { status, output } = runCheck(ROOT);
    expect(output).toContain('Data-file check passed');
    expect(status).toBe(0);
  });

  it('AC-5 (negative control): fails on a throwaway repository with a new .csv, .xlsx and .json', () => {
    const root = throwawayRepository({
      'src/example.ts': 'export {};\n',
      'masters.csv': 'a,b\n',
      'rates.xlsx': 'not really a workbook',
      'prisma/seed/placeholders/rates.json': '{}',
    });
    const { status, output } = runCheck(root);
    expect(status).toBe(1);
    for (const path of ['masters.csv', 'rates.xlsx', 'prisma/seed/placeholders/rates.json']) expect(output).toContain(path);
    expect(output).not.toContain('src/example.ts');
  });

  it('AC-5: passes on a throwaway repository with source files only', () => {
    const root = throwawayRepository({ 'src/example.ts': 'export {};\n' });
    expect(runCheck(root).status).toBe(0);
  });
});
