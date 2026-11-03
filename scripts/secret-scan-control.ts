/**
 * Negative control for CI stage 2 (principle 5 of the test strategy: a check that can pass for the
 * wrong reason needs a control). Builds a throwaway repository, then proves the project's Gitleaks
 * configuration passes a clean commit and fails a commit holding a planted fake secret.
 *
 * The fake secret is assembled at run time in a temporary directory and is never committed to this
 * repository, so nothing here can be mistaken for a real credential.
 *
 * Usage: GITLEAKS_BIN=<path to gitleaks> npx tsx scripts/secret-scan-control.ts
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GITLEAKS = process.env['GITLEAKS_BIN'] ?? 'gitleaks';
const CONFIG = resolve('.gitleaks.toml');
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TOKEN_BODY_LENGTH = 36;

/** A GitHub-token-shaped string with a random body. The prefix is split so this file never contains one. */
function plantedToken(): string {
  const body = Array.from(randomBytes(TOKEN_BODY_LENGTH), (byte) => ALPHANUMERIC[byte % ALPHANUMERIC.length]).join('');
  return ['gh', 'p_', body].join('');
}

function git(directory: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=control', '-c', 'user.email=control@example.test', ...args], {
    cwd: directory,
    stdio: 'ignore',
  });
}

function scan(directory: string): number | null {
  const result = spawnSync(GITLEAKS, ['git', '--redact', '--no-banner', '--config', CONFIG, directory], {
    stdio: 'ignore',
  });
  return result.status;
}

const directory = mkdtempSync(join(tmpdir(), 'aqp-secret-scan-'));
try {
  git(directory, 'init', '--quiet');
  writeFileSync(join(directory, 'clean.txt'), 'nothing secret here\n');
  git(directory, 'add', '--all');
  git(directory, 'commit', '--quiet', '-m', 'clean');
  const cleanStatus = scan(directory);

  writeFileSync(join(directory, 'config.txt'), `token = ${plantedToken()}\n`);
  git(directory, 'add', '--all');
  git(directory, 'commit', '--quiet', '-m', 'planted');
  const plantedStatus = scan(directory);

  if (cleanStatus !== 0 || plantedStatus !== 1) {
    process.stderr.write(
      `Secret-scan control FAILED: clean repository exit ${String(cleanStatus)} (want 0), planted secret exit ${String(plantedStatus)} (want 1).\n`,
    );
    process.exit(1);
  }
  process.stdout.write('Secret-scan control passed: a clean commit passes and a planted fake secret fails.\n');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
