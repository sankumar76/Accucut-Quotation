import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';

/**
 * STORY-01.10 AC-1 (a), (c), (d) (AQP-428; architecture section 8 "Emergency Admin password reset"): the real `scripts/bootstrap-admin.ts`, started as a
 * program the way `bootstrap-admin.mjs` is on the server, with its input and output as pipes (no console). A reset started with `--reset-admin-password`
 * from a pipe, and any other argument, exit 4 **before any settings or database work**, and change nothing. (A real console, and the settings and
 * database failure of case (e), are covered by the runner's unit tests and by the install rehearsal, AC-13.)
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface RunResult {
  readonly code: number | null;
  readonly output: string;
}

/** What the TypeScript runner needs from the machine to start (the program path, the temp folder); nothing else. */
function passedThrough(): Record<string, string> {
  const names = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];
  return Object.fromEntries(names.flatMap((name) => (process.env[name] === undefined ? [] : [[name, process.env[name]]])));
}

function runScript(args: ReadonlyArray<string>, environment: Record<string, string>): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/bootstrap-admin.ts', ...args], {
      cwd: ROOT,
      env: { NODE_ENV: 'test', ...passedThrough(), ...environment },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
    // A pipe, not a console; closing it also stops the script if it ever waited for input.
    child.stdin.end();
  });
}

const SELECT_USERS = 'SELECT id, email, role, is_active, must_change_password, session_version, password_hash FROM users ORDER BY email';
let db: AuditDatabase;
let rowsBefore: ReadonlyArray<Record<string, unknown>>;
let nonInteractive: RunResult;
let nonInteractiveWithoutSettings: RunResult;
let unknownArgument: RunResult;
let resetPlusExtra: RunResult;
let wrongCase: RunResult;

beforeAll(async () => {
  db = await openAuditDatabase();
  await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  rowsBefore = (await db.owner.query(SELECT_USERS)).rows;
  const settings = { DATABASE_URL: db.database.runtimeUrl };
  nonInteractive = await runScript(['--reset-admin-password'], settings);
  // No settings at all: the refusal comes first, so it is still exit 4 and not exit 1.
  nonInteractiveWithoutSettings = await runScript(['--reset-admin-password'], {});
  unknownArgument = await runScript(['--unknown'], {});
  resetPlusExtra = await runScript(['--reset-admin-password', '--again'], settings);
  wrongCase = await runScript(['--RESET-ADMIN-PASSWORD'], settings);
});

afterAll(async () => {
  await db?.close();
});

describe('AC-1 (c): --reset-admin-password without a console', () => {
  it('exits 4, says it needs an interactive console, and changes nothing', async () => {
    expect(nonInteractive.code).toBe(4);
    expect(nonInteractive.output).toContain('needs an interactive console');
    expect(nonInteractive.output).toContain('Nothing was changed.');
    expect((await db.owner.query(SELECT_USERS)).rows).toEqual(rowsBefore);
  });

  it('exits 4 before the settings are read: with no settings at all it is still 4, not 1', () => {
    expect(nonInteractiveWithoutSettings.code).toBe(4);
    expect(nonInteractiveWithoutSettings.output).not.toContain('Invalid environment');
  });
});

describe('AC-1 (d): any other argument', () => {
  it.each([
    ['an unknown argument', () => unknownArgument],
    ['the right one with another beside it', () => resetPlusExtra],
    ['the right one in capitals', () => wrongCase],
  ])('%s exits 4, names the one argument there is, and changes nothing', async (_name, result) => {
    expect(result().code).toBe(4);
    expect(result().output).toContain('--reset-admin-password');
    expect(result().output).toContain('Nothing was changed.');
    expect((await db.owner.query(SELECT_USERS)).rows).toEqual(rowsBefore);
  });
});
