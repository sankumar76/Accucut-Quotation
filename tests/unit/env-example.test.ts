import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ENV_VARIABLE_NAMES, PLACEHOLDER_PREFIX } from '@/lib/env';

/** AC-3 (TD-05): `.env.example` is committed, complete and holds no real value; `.env` stays ignored. */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * `git check-ignore -v` also reports a path that a negated pattern (`!.env.example`) re-includes, with
 * exit status 0, so the verdict comes from the pattern: a leading `!` means the file is NOT ignored.
 */
function checkIgnore(path: string): { ignored: boolean; output: string } {
  const result = spawnSync('git', ['check-ignore', '-v', path], { cwd: ROOT, encoding: 'utf8' });
  const negated = /^[^:]+:\d+:!/.test(result.stdout);
  return { ignored: result.status === 0 && !negated, output: result.stdout };
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
    expect(checkIgnore('.env.example')).toMatchObject({ ignored: false });
  });

  it.each(['.env', '.env.local', '.env.production'])('AC-3: git still ignores %s', (path) => {
    expect(checkIgnore(path).ignored).toBe(true);
  });

  it('AC-3: lists every variable of architecture section 8 "Secrets"', () => {
    const values = exampleValues();
    for (const name of ENV_VARIABLE_NAMES) expect(values.has(name), `${name} is missing`).toBe(true);
  });

  it('AC-3: holds placeholders only, so no real value is committed', () => {
    const values = exampleValues();
    const secretNames = [
      'AUTH_SECRET',
      'ADMIN_INITIAL_PASSWORD',
      'SMTP_PASSWORD',
      'SMTP_OAUTH_CLIENT_SECRET',
      'DB_OWNER_PASSWORD',
      'DB_APP_PASSWORD',
    ];
    for (const name of secretNames) {
      const value = values.get(name) ?? '';
      expect(value === '' || value.startsWith(PLACEHOLDER_PREFIX), `${name} must be empty or a placeholder`).toBe(true);
    }
    for (const name of ['DATABASE_URL', 'MIGRATE_DATABASE_URL']) {
      expect(values.get(name)).toContain(PLACEHOLDER_PREFIX);
    }
  });
});
