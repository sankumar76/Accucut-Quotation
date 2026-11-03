import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { assertSafeDatabaseTarget, DatabaseGuardError } from '../support/db-guard';
import { loadDotEnvFile, prepareTestEnvironment } from '../support/dotenv';

/**
 * STD-06: the guard and the tests see the same settings as `.env`, which is what Prisma reads. Without
 * loading it, the guard would judge the shell's environment while the migrations used another database.
 * All values are invented and the files are temporary.
 */

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function envFile(content: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'aqp-dotenv-'));
  directories.push(directory);
  const path = join(directory, '.env');
  writeFileSync(path, content);
  return path;
}

describe('loadDotEnvFile (STD-06)', () => {
  it('adds the variables of the file to the environment', () => {
    const target: Record<string, string | undefined> = {};
    loadDotEnvFile(envFile('FIRST=one\nSECOND="two words"\n# comment\n'), target);
    expect(target).toEqual({ FIRST: 'one', SECOND: 'two words' });
  });

  it('never overrides a variable that is already set, so CI and the shell win', () => {
    const target: Record<string, string | undefined> = { FIRST: 'from the shell' };
    loadDotEnvFile(envFile('FIRST=one\nSECOND=two\n'), target);
    expect(target).toEqual({ FIRST: 'from the shell', SECOND: 'two' });
  });

  it('does nothing when there is no file', () => {
    const target: Record<string, string | undefined> = { KEEP: 'yes' };
    loadDotEnvFile(join(tmpdir(), 'aqp-no-such-directory', '.env'), target);
    expect(target).toEqual({ KEEP: 'yes' });
  });
});

describe('prepareTestEnvironment (STD-06, AC-10)', () => {
  it('refuses a remote database that only the file names', () => {
    const file = envFile('DATABASE_URL=postgresql://app_user:invented@db.invented-remote.example:5432/accucut\n');
    expect(() => prepareTestEnvironment({}, file)).toThrow(DatabaseGuardError);
  });

  it('accepts a local database named in the file', () => {
    const file = envFile('DATABASE_URL=postgresql://app_user:invented@localhost:55432/accucut\n');
    const env: Record<string, string | undefined> = {};
    expect(() => prepareTestEnvironment(env, file)).not.toThrow();
    expect(() => assertSafeDatabaseTarget(env)).not.toThrow();
  });

  it('lets a real variable beat the file, so a remote file entry cannot override a local shell value', () => {
    const file = envFile('DATABASE_URL=postgresql://app_user:invented@db.invented-remote.example:5432/accucut\n');
    const env = { DATABASE_URL: 'postgresql://app_user:invented@localhost:55432/accucut' };
    expect(() => prepareTestEnvironment(env, file)).not.toThrow();
  });
});
