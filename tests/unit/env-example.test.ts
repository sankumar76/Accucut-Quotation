import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { ENV_VARIABLE_NAMES } from '@/lib/env';

import { unsafeExampleEntries } from '../support/env-example';
import { checkIgnore } from '../support/git-ignore';

/**
 * AC-3 (TD-05): `.env.example` is committed, complete and holds no real value; `.env` stays ignored.
 * STD-09: key and certificate files are ignored too. All values below are invented.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const ENV_FILES_IGNORED = ['.env', '.env.local', '.env.production'];
const KEYS_AND_LOGS_IGNORED = ['server.pem', 'private.key', 'certificate.p12', 'certificate.pfx', 'debug.log', 'nested/deeper/npm.log', '.DS_Store'];
const NOT_IGNORED = ['.env.example', 'README.md', 'src/lib/env.ts', '.gitignore'];

/**
 * Every git verdict this file checks, asked once before the tests. Starting git is set-up, so it runs in the hook,
 * under the hook limit, and the tests' own limit covers only the assertions (test strategy section 10; DEF-007).
 * If git cannot start, the hook fails with that reason rather than a test reporting "not ignored".
 */
const ignored = new Map<string, boolean>();

beforeAll(() => {
  for (const path of [...ENV_FILES_IGNORED, ...KEYS_AND_LOGS_IGNORED, ...NOT_IGNORED]) ignored.set(path, checkIgnore(path).ignored);
});

function isIgnored(path: string): boolean | undefined {
  return ignored.get(path);
}

function exampleValues(): Map<string, string> {
  const text = readFileSync(`${ROOT}.env.example`, 'utf8');
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] !== undefined) values.set(match[1], match[2] ?? '');
  }
  return values;
}

describe('.gitignore and .env.example (AC-3, TD-05)', () => {
  it('AC-3: git does not ignore .env.example', () => {
    expect(isIgnored('.env.example')).toBe(false);
  });

  it.each(ENV_FILES_IGNORED)('AC-3: git still ignores %s', (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  it('AC-3: lists every variable of architecture section 8 "Secrets"', () => {
    const values = exampleValues();
    for (const name of ENV_VARIABLE_NAMES) expect(values.has(name), `${name} is missing`).toBe(true);
  });

  it('AC-3: holds placeholders only, so no real value is committed (every variable is checked)', () => {
    expect(unsafeExampleEntries(exampleValues())).toEqual([]);
  });

  it('AC-3, QLT-19: the database URLs have a localhost host and a password that starts with CHANGE_ME', () => {
    for (const name of ['DATABASE_URL', 'MIGRATE_DATABASE_URL']) {
      const url = new URL(exampleValues().get(name) ?? '');
      expect(url.hostname, `${name} host`).toBe('localhost');
      expect(decodeURIComponent(url.password).startsWith('CHANGE_ME'), `${name} password`).toBe(true);
    }
  });
});

describe('unsafeExampleEntries (STD-05, negative control)', () => {
  const template = new Map([
    ['SMTP_HOST', 'localhost'],
    ['SMTP_PORT', '1025'],
    ['SMTP_AUTH_MODE', 'none'],
    ['APP_ORIGIN', 'http://localhost:3000'],
    ['ADMIN_EMAIL', 'admin@example.test'],
    ['SMTP_USER', ''],
    ['SMTP_OAUTH_TENANT_ID', ''],
    ['AUTH_SECRET', 'CHANGE_ME_AUTH_SECRET'],
    ['DATABASE_URL', 'postgresql://accucut_app:CHANGE_ME_APP_PASSWORD@localhost:55432/accucut'],
  ]);

  it('accepts a template made of placeholders, empty values and the named literals', () => {
    expect(unsafeExampleEntries(template)).toEqual([]);
  });

  it.each([
    ['a real tenant ID', 'SMTP_OAUTH_TENANT_ID', '00000000-aaaa-bbbb-cccc-111111111111'],
    ['a real client ID', 'SMTP_OAUTH_CLIENT_ID', 'invented-client-id'],
    ['a real mail host', 'SMTP_HOST', 'smtp.invented-company.example'],
    ['a real mailbox user', 'SMTP_USER', 'someone'],
    ['a personal e-mail address', 'ADMIN_EMAIL', 'someone@invented-company.example'],
    ['a different origin', 'APP_ORIGIN', 'https://portal.invented-company.example'],
    ['a different port', 'SMTP_PORT', '587'],
    ['a different mail mode', 'SMTP_AUTH_MODE', 'password'],
    ['a real secret', 'AUTH_SECRET', 'invented-real-looking-secret-0123456789'],
    ['a real database password', 'DATABASE_URL', 'postgresql://accucut_app:invented-real-password@localhost:55432/accucut'],
    [
      'a real host beside a placeholder password (QLT-19)',
      'DATABASE_URL',
      'postgresql://accucut_app:CHANGE_ME_X@db.invented-company.example:5432/accucut',
    ],
    [
      'a real host beside a placeholder password in the migration URL',
      'MIGRATE_DATABASE_URL',
      'postgresql://accucut_owner:CHANGE_ME_X@db.invented-company.example:5432/accucut',
    ],
    ['a placeholder password that is only part of the URL text', 'DATABASE_URL', 'postgresql://accucut_app:real@localhost:55432/CHANGE_ME'],
    ['a database value that is not a URL', 'DATABASE_URL', 'CHANGE_ME_NOT_A_URL'],
    ['a real mail host beside a placeholder (STD-21)', 'SMTP_HOST', 'smtp.invented-company.example/CHANGE_ME'],
    ['a real mailbox user that only contains the placeholder', 'SMTP_USER', 'someone-CHANGE_ME'],
  ])('fails for %s', (_name, variable, value) => {
    const planted = new Map(template).set(variable, value);
    expect(unsafeExampleEntries(planted)).toEqual([variable]);
  });
});

describe('.gitignore keys and logs (STD-09)', () => {
  it.each(KEYS_AND_LOGS_IGNORED)('ignores %s', (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  it.each(NOT_IGNORED.filter((path) => path !== '.env.example'))('does not ignore %s', (path) => {
    expect(isIgnored(path)).toBe(false);
  });
});
