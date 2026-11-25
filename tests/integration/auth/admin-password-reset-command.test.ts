import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { systemClock } from '@/lib/time';
import { passwordHasher } from '@/server/auth/password-hasher';
import { resolveSession } from '@/server/auth/resolve-session-user';
import { accountThrottleKey, passwordChangeThrottleKey, stepUpThrottleKey } from '@/server/auth/throttle-key';
import { createAuthService } from '@/server/services/auth-service';

import {
  EXIT_DONE,
  EXIT_FAILED,
  EXIT_NOT_ONE_ADMIN,
  EXIT_PASSWORD,
  runAdminPasswordReset,
  windowsAccountName,
  type AdminPasswordResetDependencies,
} from '../../../scripts/lib/admin-password-reset-cli';
import { openAdminPasswordReset } from '../../../scripts/lib/admin-password-reset-wiring';
import { entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

/**
 * STORY-01.10 AC-1 (e), AC-3 to AC-7 (AQP-428; DL-381): the whole command, with the **real wiring** (`openAdminPasswordReset`: the settings, the runtime role, the real user service, audit
 * service, throttle repository and hasher) over a throwaway database, and only the console faked: the prompts are answered from a script and the output is captured. It proves what the unit
 * tests of the runner and of the service cannot: that the pieces fit, that the Admin can then sign in only with the temporary password and must change it, that the old password and every old session are
 * refused, that no block remains, and that the password is in nothing the command printed or stored. Names, addresses and passwords are invented.
 */

const AUTH_SECRET = 'invented-auth-secret-for-aqp-428-0123456789';
const OLD_PASSWORD = 'Invented-Old-Pass-1!';
const TEMPORARY_PASSWORD = 'Invented-Temp-Pass-7!';
const BLOCK_POLICY = { limit: 2, windowMilliseconds: null, blockMilliseconds: 900_000 } as const;

let db: AuditDatabase;
let adminId: string;
const adminEmail = 'admin@example.test';
let environment: Record<string, string>;

interface Console {
  readonly code: number;
  readonly all: string;
  readonly out: string;
  readonly err: string;
}

/** Runs the command as the operator would, answering the prompts in order. */
async function runCommand(answers: ReadonlyArray<string>, open: AdminPasswordResetDependencies['open'] = () => openAdminPasswordReset(environment)): Promise<Console> {
  const out: string[] = [];
  const err: string[] = [];
  const remaining = [...answers];
  const next = (prompt: string): Promise<string> => {
    out.push(prompt);
    return Promise.resolve(remaining.shift() ?? '');
  };
  const code = await runAdminPasswordReset({
    interactive: true,
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    ask: next,
    askHidden: next,
    open,
    windowsAccount: windowsAccountName({ USERDOMAIN: 'ACCUCUT' }, 'it.person'),
    newRequestId: () => 'request-command-428',
  });
  return { code, out: out.join(''), err: err.join(''), all: out.join('') + err.join('') };
}

async function state() {
  const { rows } = await db.owner.query<{ password_hash: string; must_change_password: boolean; session_version: number }>(
    'SELECT password_hash, must_change_password, session_version FROM users WHERE id = $1',
    [adminId],
  );
  return defined(rows[0], 'admin row');
}

async function blockTheThreeKeys(): Promise<void> {
  const keys = [accountThrottleKey(AUTH_SECRET, adminEmail), passwordChangeThrottleKey(AUTH_SECRET, adminId), stepUpThrottleKey(AUTH_SECRET, adminId)];
  for (const key of keys) for (let attempt = 0; attempt < BLOCK_POLICY.limit; attempt += 1) await db.throttles.reserveAttempt(key, BLOCK_POLICY, new Date());
}

async function blockedCount(): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM login_throttles WHERE blocked_until IS NOT NULL');
  return Number(rows[0]?.count);
}

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.owner.query('UPDATE users SET password_hash = $2 WHERE id = $1', [adminId, await passwordHasher.hash(OLD_PASSWORD)]);
  environment = { DATABASE_URL: db.database.runtimeUrl, AUTH_SECRET };
});

afterAll(async () => {
  await db?.close();
});

describe('AC-1 (e): settings and database', () => {
  it('missing settings exit 1, name the variables and print no value, and change nothing', async () => {
    const before = await state();
    const result = await runCommand(['RESET', TEMPORARY_PASSWORD, TEMPORARY_PASSWORD], () => openAdminPasswordReset({ DATABASE_URL: 'not-a-url' }));
    expect(result.code).toBe(EXIT_FAILED);
    expect(result.err).toContain('DATABASE_URL (invalid)');
    expect(result.err).toContain('AUTH_SECRET (missing)');
    expect(result.all).not.toContain('not-a-url');
    expect(await state()).toEqual(before);
  });

  it('a database that cannot be reached exits 1 and prints no database text', async () => {
    const before = await state();
    const unreachable = db.database.runtimeUrl.replace(/:\d+\//, ':1/');
    const result = await runCommand(['RESET', TEMPORARY_PASSWORD, TEMPORARY_PASSWORD], () => openAdminPasswordReset({ DATABASE_URL: unreachable, AUTH_SECRET }));
    expect(result.code).toBe(EXIT_FAILED);
    expect(result.err).toContain('bootstrap-admin failed:');
    expect(result.all).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|password/i);
    expect(await state()).toEqual(before);
  });
});

describe('AC-3: what is asked, what is refused', () => {
  it('shows the Admin and asks for RESET first: anything else stops with nothing changed', async () => {
    const before = await state();
    const auditBefore = await entryCount(db);
    const result = await runCommand(['no']);
    expect(result.out).toContain('Invented Admin');
    expect(result.out).toContain(adminEmail);
    expect(result.code).toBe(4);
    expect(await state()).toEqual(before);
    expect(await entryCount(db)).toBe(auditBefore);
  });

  it('a password that breaks the rule exits 3 with only the failed part, and changes nothing, not even the blocks', async () => {
    await blockTheThreeKeys();
    const before = await state();
    const auditBefore = await entryCount(db);
    const result = await runCommand(['RESET', 'Short-7!', 'Short-7!']);
    expect(result.code).toBe(EXIT_PASSWORD);
    expect(result.err).toContain('The new password must be at least 10 characters. Nothing was changed.');
    expect(result.all).not.toContain('Short-7!');
    expect(await state()).toEqual(before);
    expect(await entryCount(db)).toBe(auditBefore);
    expect(await blockedCount()).toBe(3);
  });
});

describe('AC-4 to AC-7: a valid run', () => {
  it('resets the password, ends every session, lifts the blocks, writes one entry, and says nothing of the password', async () => {
    // The blocks the earlier test left are lifted first, so the Admin can sign in with the old password.
    await db.owner.query('UPDATE login_throttles SET failures = 0, blocked_until = NULL');
    const auth = createAuthService({ users: db.users, throttles: db.throttles, hasher: passwordHasher, clock: systemClock, keySecret: AUTH_SECRET });
    const signedIn = await auth.authenticate({ email: adminEmail, password: OLD_PASSWORD, ipAddress: null });
    expect(signedIn.status).toBe('signed-in');
    const claims = { userId: adminId, sessionVersion: (await state()).session_version, signedAt: Math.floor(Date.now() / 1000) };
    expect((await resolveSession(claims, db.users, new Date())).status).toBe('active');
    await blockTheThreeKeys();
    expect(await blockedCount()).toBe(3);
    const auditBefore = await entryCount(db);

    const result = await runCommand(['RESET', TEMPORARY_PASSWORD, TEMPORARY_PASSWORD]);

    expect(result.code).toBe(EXIT_DONE);
    expect(result.out).toContain('Done. The password of Invented Admin was reset.');
    expect(result.all).not.toContain(TEMPORARY_PASSWORD);
    expect(result.all).not.toContain(OLD_PASSWORD);

    // AC-7: the temporary password signs in and the Admin must choose their own; the old one is refused; the old session has ended; no block remains.
    const after = await state();
    expect(after.must_change_password).toBe(true);
    expect(await blockedCount()).toBe(0);
    expect(await auth.authenticate({ email: adminEmail, password: OLD_PASSWORD, ipAddress: null })).toMatchObject({ status: 'refused', reason: 'invalid' });
    expect(await auth.authenticate({ email: adminEmail, password: TEMPORARY_PASSWORD, ipAddress: null })).toMatchObject({ status: 'signed-in' });
    expect((await resolveSession(claims, db.users, new Date())).status).toBe('refused');
    const account = defined(await db.users.findAccountById(adminId), 'admin account');
    expect(account.mustChangePassword).toBe(true);

    // AC-4, AC-6: the hash only in the database; one entry, the Admin as actor, the system label, the Windows account, no password.
    expect(after.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(after.password_hash).not.toContain(TEMPORARY_PASSWORD);
    const entries = (await entriesFor(db, adminId)).filter((entry) => entry.event === 'user.password_reset');
    expect(entries).toHaveLength(1);
    expect(await entryCount(db)).toBe(auditBefore + 1);
    const entry = defined(entries[0], 'audit entry');
    expect(entry.actor_id).toBe(adminId);
    expect(entry.actor_label).toBe('System: server command (Windows account ACCUCUT\\it.person)');
    expect(entry.request_id).toBe('request-command-428');
    expect(JSON.stringify(entry)).not.toContain(TEMPORARY_PASSWORD);
    expect(JSON.stringify(entry)).not.toContain(after.password_hash);
  });

  it('a second run is a new reset with one more audit entry', async () => {
    const result = await runCommand(['RESET', 'Invented-Second-Pass-8#', 'Invented-Second-Pass-8#']);
    expect(result.code).toBe(EXIT_DONE);
    expect((await entriesFor(db, adminId)).filter((entry) => entry.event === 'user.password_reset')).toHaveLength(2);
  });
});

describe('AC-2: not exactly one active Admin', () => {
  it('a database with no active Admin exits 2 with its words and changes nothing', async () => {
    const empty = await openAuditDatabase();
    try {
      const result = await runCommand(['RESET', TEMPORARY_PASSWORD, TEMPORARY_PASSWORD], () => openAdminPasswordReset({ DATABASE_URL: empty.database.runtimeUrl, AUTH_SECRET }));
      expect(result.code).toBe(EXIT_NOT_ONE_ADMIN);
      expect(result.err).toContain('No Admin account exists. Nothing was changed.');
      expect(await entryCount(empty)).toBe(0);
    } finally {
      await empty.close();
    }
  });
});
