import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { verify } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { buildUser, createTestHasher } from '../../support/builders/user';

/**
 * STORY-01.01 AC-7: `scripts/bootstrap-admin.ts` on an empty database creates one active Admin with
 * `must_change_password` and an argon2id hash that is never printed; running it again, or when any Admin exists,
 * refuses and changes nothing. Real script, real PostgreSQL, a throwaway database. The runs happen in hooks (a
 * start-up of the TypeScript runner and one real argon2id hash take seconds on a busy machine), and the tests
 * look at the recorded results (test strategy section 10).
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ADMIN_EMAIL = 'First.Admin@example.test';
const ADMIN_PASSWORD = 'invented-initial-password-for-aqp-38';

interface RunResult {
  readonly code: number | null;
  readonly output: string;
}

/** What the TypeScript runner needs from the machine to start (the program path, the temp folder); nothing else. */
function passedThrough(): Record<string, string> {
  const names = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];
  return Object.fromEntries(names.flatMap((name) => (process.env[name] === undefined ? [] : [[name, process.env[name]]])));
}

function runScript(environment: Record<string, string>): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // The same program as `npx tsx scripts/bootstrap-admin.ts`, started directly. Only the variables below are
    // passed on, so the test cannot pick up a real setting from the machine.
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/bootstrap-admin.ts'], {
      cwd: ROOT,
      env: { NODE_ENV: 'test', ...passedThrough(), ...environment },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

interface Scenario {
  readonly db: AuthDatabase;
  readonly first: RunResult;
  readonly second: RunResult;
  readonly rowsAfterFirst: ReadonlyArray<Record<string, unknown>>;
  readonly rowsAfterSecond: ReadonlyArray<Record<string, unknown>>;
}

let empty: Scenario;
let withLead: { readonly db: AuthDatabase; readonly run: RunResult; readonly rows: ReadonlyArray<Record<string, unknown>> };
let withAdmin: { readonly db: AuthDatabase; readonly run: RunResult; readonly rows: ReadonlyArray<Record<string, unknown>> };
let badSettings: RunResult;
let weakDatabase: AuthDatabase | undefined;
/** STORY-01.05 AC-4: weak initial passwords, each tried against the empty database in turn. */
let weak: ReadonlyArray<{ readonly password: string; readonly message: string; readonly run: RunResult }>;
let weakRows: ReadonlyArray<Record<string, unknown>>;

const SELECT_USERS = `SELECT email, role, is_active, must_change_password, password_hash FROM users ORDER BY email`;
const environmentFor = (db: AuthDatabase): Record<string, string> => ({
  DATABASE_URL: db.database.runtimeUrl,
  ADMIN_EMAIL,
  ADMIN_INITIAL_PASSWORD: ADMIN_PASSWORD,
});

beforeAll(async () => {
  const emptyDb = await openAuthDatabase();
  const first = await runScript(environmentFor(emptyDb));
  const rowsAfterFirst = (await emptyDb.owner.query(SELECT_USERS)).rows;
  const second = await runScript(environmentFor(emptyDb));
  const rowsAfterSecond = (await emptyDb.owner.query(SELECT_USERS)).rows;
  empty = { db: emptyDb, first, second, rowsAfterFirst, rowsAfterSecond };

  const leadDb = await openAuthDatabase();
  await leadDb.users.create(await buildUser(createTestHasher(), { role: 'LEAD', email: 'a.lead@example.test' }));
  withLead = { db: leadDb, run: await runScript(environmentFor(leadDb)), rows: (await leadDb.owner.query(SELECT_USERS)).rows };

  const adminDb = await openAuthDatabase();
  await adminDb.users.create(await buildUser(createTestHasher(), { role: 'ADMIN', email: 'existing.admin@example.test' }));
  withAdmin = { db: adminDb, run: await runScript(environmentFor(adminDb)), rows: (await adminDb.owner.query(SELECT_USERS)).rows };

  badSettings = await runScript({ DATABASE_URL: emptyDb.database.runtimeUrl, ADMIN_EMAIL: 'not-an-address', ADMIN_INITIAL_PASSWORD: 'CHANGE_ME_ADMIN_PASSWORD' });

  const weakDb = await openAuthDatabase();
  const weakCases = [
    { password: 'Short-7!', message: 'The new password must be at least 10 characters.' },
    { password: 'invented-initial-pass', message: 'Add at least one number.' },
    { password: 'Welcome@123456', message: 'That password is too common. Choose a different one.' },
  ];
  weak = await Promise.all(
    weakCases.map(async (entry) => ({ ...entry, run: await runScript({ ...environmentFor(weakDb), ADMIN_INITIAL_PASSWORD: entry.password }) })),
  );
  weakRows = (await weakDb.owner.query(SELECT_USERS)).rows;
  weakDatabase = weakDb;
});

afterAll(async () => {
  await Promise.all([empty?.db.close(), withLead?.db.close(), withAdmin?.db.close(), weakDatabase?.close()]);
});

describe('AC-7: an empty database', () => {
  it('creates one active Admin, with must_change_password set, and the e-mail in lower case', () => {
    // The whole result is compared, so a failure shows what the script printed.
    expect(empty.first).toMatchObject({ code: 0 });
    expect(empty.rowsAfterFirst).toHaveLength(1);
    expect(empty.rowsAfterFirst[0]).toMatchObject({
      email: 'first.admin@example.test',
      role: 'ADMIN',
      is_active: true,
      must_change_password: true,
    });
  });

  it('stores the password as an argon2id hash that matches it, and never prints it', async () => {
    const hash = String(empty.rowsAfterFirst[0]?.['password_hash']);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(ADMIN_PASSWORD);
    expect(await verify(hash, ADMIN_PASSWORD)).toBe(true);
    for (const output of [empty.first.output, empty.second.output, withLead.run.output, withAdmin.run.output, badSettings.output]) {
      expect(output).not.toContain(ADMIN_PASSWORD);
      expect(output).not.toContain(hash);
    }
  });

  it('running it again refuses, says so, and changes nothing', () => {
    expect(empty.second.code).toBe(1);
    expect(empty.second.output).toContain('an Admin already exists; nothing was changed');
    expect(empty.rowsAfterSecond).toEqual(empty.rowsAfterFirst);
  });
});

describe('STORY-01.05 AC-4: a password that does not meet the rule', () => {
  it('exits non-zero, names the failing part, never prints the password, and creates no Admin', () => {
    for (const entry of weak) {
      expect(entry.run.code).toBe(1);
      expect(entry.run.output).toContain('ADMIN_INITIAL_PASSWORD does not meet the password rule.');
      expect(entry.run.output).toContain(entry.message);
      expect(entry.run.output).toContain('Nothing was changed.');
      expect(entry.run.output).not.toContain(entry.password);
    }
    expect(weakRows).toEqual([]);
  });
});

describe('AC-7: other starting points', () => {
  it('refuses when any Admin exists, and changes nothing', () => {
    expect(withAdmin.run.code).toBe(1);
    expect(withAdmin.run.output).toContain('an Admin already exists');
    expect(withAdmin.rows.map((row) => row['email'])).toEqual(['existing.admin@example.test']);
  });

  it('a database that holds only a Lead gets its first Admin', () => {
    expect(withLead.run.code).toBe(0);
    expect(withLead.rows.map((row) => row['role']).sort()).toEqual(['ADMIN', 'LEAD']);
  });

  it('refuses bad settings by naming the variables, never their values', () => {
    expect(badSettings.code).toBe(1);
    expect(badSettings.output).toContain('ADMIN_EMAIL (invalid)');
    expect(badSettings.output).toContain('ADMIN_INITIAL_PASSWORD (invalid)');
    expect(badSettings.output).not.toContain('not-an-address');
    expect(badSettings.output).not.toContain('CHANGE_ME_ADMIN_PASSWORD');
  });
});
