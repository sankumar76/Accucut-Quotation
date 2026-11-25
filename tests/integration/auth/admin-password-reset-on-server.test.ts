import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, PASSWORD_RULE_CODE } from '@/lib/errors';
import { accountThrottleKey, passwordChangeThrottleKey, stepUpThrottleKey } from '@/server/auth/throttle-key';
import type { ThrottleRepository } from '@/server/repositories/throttle-repository';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import { createUserService, type UserService } from '@/server/services/user-service';

import { SERVER_COMMAND_LABEL_PREFIX, serverCommandActorLabel } from '../../../scripts/lib/admin-password-reset-cli';
import { entriesFor, entryCount, insertPersonAsOwner, KEY_SECRET, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';

/**
 * STORY-01.10 AC-2, AC-5, AC-6 and AC-7 (AQP-428; DL-381; architecture section 8 "Emergency Admin password reset") against real PostgreSQL in throwaway
 * databases: the service method the server command calls, over the real repositories, the runtime role and the real transaction runner. It proves what
 * only the database can: one transaction for the hash, the flag, the session version, the three throttle rows and the audit entry; a failure after
 * `setPassword` rolls all of it back; a refusal writes nothing; the Admin rows are locked in the transaction. Names, addresses and passwords are invented.
 */

const hasher = createTestHasher();
const OLD_PASSWORD = 'Invented-Old-Pass-1!';
const NEW_PASSWORD = 'Invented-Temp-Pass-7!';
const ACCOUNT = 'ACCUCUT\\it.person';
/** The Admin the operator confirmed is the one the reset is bound to (QLT-715-01). */
const context = (expectedAdminId: string = adminId) => ({ actorLabel: serverCommandActorLabel(ACCOUNT), requestId: 'request-aqp-428', expectedAdminId }) as const;
const BLOCK_POLICY = { limit: 2, windowMilliseconds: null, blockMilliseconds: 900_000 } as const;
const NOW = new Date('2026-11-30T09:00:00.000Z');

interface UserState {
  readonly password_hash: string;
  readonly must_change_password: boolean;
  readonly session_version: number;
  readonly is_active: boolean;
}

interface ThrottleState {
  readonly failures: number;
  readonly blocked_until: Date | null;
}

let db: AuditDatabase;
let adminId: string;
let adminEmail: string;
let oldHash: string;
let service: UserService;

async function userState(database: AuditDatabase, id: string): Promise<UserState> {
  const { rows } = await database.owner.query<UserState>('SELECT password_hash, must_change_password, session_version, is_active FROM users WHERE id = $1', [id]);
  return defined(rows[0], 'user row');
}

async function throttleState(database: AuditDatabase, keyHash: string): Promise<ThrottleState | null> {
  const { rows } = await database.owner.query<ThrottleState>('SELECT failures, blocked_until FROM login_throttles WHERE key_hash = $1', [keyHash]);
  return rows[0] ?? null;
}

function keysOf(id: string, email: string): ReadonlyArray<string> {
  return [accountThrottleKey(KEY_SECRET, email), passwordChangeThrottleKey(KEY_SECRET, id), stepUpThrottleKey(KEY_SECRET, id)];
}

/** Blocks the three keys of the Admin, as three runs of wrong passwords would. */
async function blockTheThreeKeys(): Promise<void> {
  for (const key of keysOf(adminId, adminEmail)) {
    for (let attempt = 0; attempt < BLOCK_POLICY.limit; attempt += 1) await db.throttles.reserveAttempt(key, BLOCK_POLICY, NOW);
  }
}

async function expectBlocked(): Promise<void> {
  for (const key of keysOf(adminId, adminEmail)) {
    const state = defined(await throttleState(db, key), 'throttle row');
    expect(state.blocked_until).not.toBeNull();
    expect(state.failures).toBeGreaterThan(0);
  }
}

function buildService(overrides: { readonly throttles?: ThrottleRepository; readonly transactions?: AuditDatabase['transactions']; readonly audit?: AuditDatabase['audit'] }): UserService {
  return createUserService({
    users: db.users,
    throttles: overrides.throttles ?? db.throttles,
    hasher,
    transactions: overrides.transactions ?? db.transactions,
    audit: overrides.audit ?? db.audit,
    keySecret: KEY_SECRET,
  });
}

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  adminEmail = 'admin@example.test';
  oldHash = await hasher.hash(OLD_PASSWORD);
  await db.owner.query('UPDATE users SET password_hash = $2 WHERE id = $1', [adminId, oldHash]);
  service = buildService({});
});

afterAll(async () => {
  await db?.close();
});

describe('AC-2: the Admin is looked at', () => {
  it('finds the one active Admin with the name and e-mail the operator is shown', async () => {
    expect(await service.findAdminForServerReset()).toEqual({ status: 'ready', id: adminId, name: 'Invented Admin', email: adminEmail });
  });

  it('lists the Admin rows in ascending ID order and locks them for the transaction (FOR UPDATE)', async () => {
    const other = new Client({ connectionString: db.database.runtimeUrl });
    await other.connect();
    try {
      await db.transactions.run(async (tx) => {
        const locked = await db.users.listAdminAccounts(tx);
        expect(locked.map((account) => account.id)).toEqual([adminId]);
        expect(locked[0]).toMatchObject({ name: 'Invented Admin', email: adminEmail, isActive: true, mustChangePassword: false });
        // Another connection cannot take the same row while this transaction holds it.
        await expect(other.query(`SELECT id FROM users WHERE role = 'ADMIN' FOR UPDATE NOWAIT`)).rejects.toMatchObject({ code: '55P03' });
      });
      // Without a transaction nothing is locked.
      expect((await db.users.listAdminAccounts()).map((account) => account.id)).toEqual([adminId]);
      await expect(other.query(`SELECT id FROM users WHERE role = 'ADMIN' FOR UPDATE NOWAIT`)).resolves.toBeDefined();
    } finally {
      await other.end();
    }
  });
});

describe('AC-5, AC-6, AC-7: a valid run', () => {
  it('sets the new hash and the flag, raises the session version, lifts the three blocks and writes one audit entry', async () => {
    await blockTheThreeKeys();
    await expectBlocked();
    const before = await userState(db, adminId);
    const auditBefore = await entryCount(db);

    const result = await service.resetAdminPasswordOnServer(context(), NEW_PASSWORD);

    expect(result).toEqual({ status: 'reset', id: adminId, name: 'Invented Admin' });
    const after = await userState(db, adminId);
    expect(await hasher.verify(after.password_hash, NEW_PASSWORD)).toBe(true);
    expect(await hasher.verify(after.password_hash, OLD_PASSWORD)).toBe(false);
    expect(after.password_hash).not.toContain(NEW_PASSWORD);
    expect(after.must_change_password).toBe(true);
    expect(after.session_version).toBe(before.session_version + 1);
    for (const key of keysOf(adminId, adminEmail)) {
      expect(await throttleState(db, key)).toEqual({ failures: 0, blocked_until: null });
    }

    const entries = (await entriesFor(db, adminId)).filter((entry) => entry.event === 'user.password_reset');
    expect(entries).toHaveLength(1);
    expect(await entryCount(db)).toBe(auditBefore + 1);
    const entry = defined(entries[0], 'audit entry');
    // AC-6, DL-381 (3)(a): the label prefix and the actor are pinned.
    expect(SERVER_COMMAND_LABEL_PREFIX).toBe('System: server command (Windows account ');
    expect(entry.actor_id).toBe(adminId);
    expect(entry.actor_label.startsWith('System: server command (Windows account ')).toBe(true);
    expect(entry.actor_label).toBe(`System: server command (Windows account ${ACCOUNT})`);
    expect(entry.object_type).toBe('user');
    expect(entry.object_id).toBe(adminId);
    expect(entry.object_label).toBe('Invented Admin');
    expect(entry.before).toEqual({ mustChangePassword: false });
    expect(entry.after).toEqual({ mustChangePassword: true });
    expect(entry.request_id).toBe('request-aqp-428');
    // No password, hash, secret or reason anywhere in it.
    const text = JSON.stringify(entry);
    for (const forbidden of [NEW_PASSWORD, OLD_PASSWORD, after.password_hash, oldHash, KEY_SECRET, 'reason']) expect(text).not.toContain(forbidden);
  });

  it('a second run is a new reset: a newer password, one more audit entry, the session version raised again', async () => {
    const before = await userState(db, adminId);
    const second = 'Invented-Second-Pass-8#';
    expect(await service.resetAdminPasswordOnServer(context(), second)).toEqual({ status: 'reset', id: adminId, name: 'Invented Admin' });
    const after = await userState(db, adminId);
    expect(await hasher.verify(after.password_hash, second)).toBe(true);
    expect(await hasher.verify(after.password_hash, NEW_PASSWORD)).toBe(false);
    expect(after.session_version).toBe(before.session_version + 1);
    expect((await entriesFor(db, adminId)).filter((entry) => entry.event === 'user.password_reset')).toHaveLength(2);
  });
});

describe('QLT-715-01: the reset is bound to the Admin the operator confirmed', () => {
  it('another Admin ID than the one in the database is refused as ADMIN_CHANGED and writes nothing', async () => {
    await blockTheThreeKeys();
    const before = await userState(db, adminId);
    const auditBefore = await entryCount(db);
    const result = await service.resetAdminPasswordOnServer(context('00000000-0000-4000-8000-00000000dead'), NEW_PASSWORD);
    expect(result).toEqual({ status: 'refused', refusal: 'ADMIN_CHANGED' });
    expect(await userState(db, adminId)).toEqual(before);
    expect(await entryCount(db)).toBe(auditBefore);
    await expectBlocked();
  });
});

describe('AC-3, AC-5: a refusal writes nothing', () => {
  it.each([
    ['too short', 'Ab1!'],
    ['no number', 'Invented-Pass-Word!'],
    ['the e-mail address', 'admin@example.test'],
    ['a common password', 'Welcome@123456'],
  ])('the rule (FR-098, with the Admin\'s e-mail) refuses %s before any change, hash or audit entry', async (_name, password) => {
    await blockTheThreeKeys();
    const before = await userState(db, adminId);
    const auditBefore = await entryCount(db);
    const error: unknown = await service.resetAdminPasswordOnServer(context(), password).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FieldValidationError);
    expect((error as FieldValidationError).code).toBe(PASSWORD_RULE_CODE);
    expect(await userState(db, adminId)).toEqual(before);
    expect(await entryCount(db)).toBe(auditBefore);
    await expectBlocked();
  });

  it('no Admin, and a deactivated Admin, are refused with their own word and change nothing', async () => {
    const none = await openAuditDatabase();
    const inactive = await openAuditDatabase();
    try {
      await insertPersonAsOwner(none, 'Lead', 'LEAD');
      const sleepingId = await insertPersonAsOwner(inactive, 'Sleeping Admin', 'ADMIN', false);
      const sleepingBefore = await userState(inactive, sleepingId);
      const noneAudit = await entryCount(none);
      const inactiveAudit = await entryCount(inactive);
      const withDb = (database: AuditDatabase) =>
        createUserService({ users: database.users, throttles: database.throttles, hasher, transactions: database.transactions, audit: database.audit, keySecret: KEY_SECRET });

      expect(await withDb(none).findAdminForServerReset()).toEqual({ status: 'refused', refusal: 'NO_ADMIN' });
      expect(await withDb(none).resetAdminPasswordOnServer(context(), NEW_PASSWORD)).toEqual({ status: 'refused', refusal: 'NO_ADMIN' });
      expect(await withDb(inactive).findAdminForServerReset()).toEqual({ status: 'refused', refusal: 'ADMIN_INACTIVE' });
      expect(await withDb(inactive).resetAdminPasswordOnServer(context(), NEW_PASSWORD)).toEqual({ status: 'refused', refusal: 'ADMIN_INACTIVE' });

      expect(await userState(inactive, sleepingId)).toEqual(sleepingBefore);
      expect(sleepingBefore.is_active).toBe(false);
      expect(await entryCount(none)).toBe(noneAudit);
      expect(await entryCount(inactive)).toBe(inactiveAudit);
    } finally {
      await Promise.all([none.close(), inactive.close()]);
    }
  });
});

describe('AC-5: any failure rolls back the hash, the flag, the session version, the throttles and the audit entry together', () => {
  async function expectNothingChanged(before: UserState, auditBefore: number): Promise<void> {
    expect(await userState(db, adminId)).toEqual(before);
    expect(await entryCount(db)).toBe(auditBefore);
    await expectBlocked();
  }

  it('a throttle that cannot be cleared after setPassword (the third key) undoes everything, including the two keys already cleared', async () => {
    await blockTheThreeKeys();
    const before = await userState(db, adminId);
    const auditBefore = await entryCount(db);
    const failure = new Error('the third throttle failed');
    let calls = 0;
    const throttles: ThrottleRepository = {
      ...db.throttles,
      clear: (keyHash, tx) => {
        calls += 1;
        return calls === 3 ? Promise.reject(failure) : db.throttles.clear(keyHash, tx);
      },
    };
    await expect(buildService({ throttles }).resetAdminPasswordOnServer(context(), NEW_PASSWORD)).rejects.toBe(failure);
    expect(calls).toBe(3);
    await expectNothingChanged(before, auditBefore);
  });

  it('an audit entry that is refused undoes the hash, the flag, the session version and the throttles', async () => {
    await blockTheThreeKeys();
    const before = await userState(db, adminId);
    const auditBefore = await entryCount(db);
    const audit: AuditDatabase['audit'] = { ...db.audit, record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')) };
    await expect(buildService({ audit }).resetAdminPasswordOnServer(context(), NEW_PASSWORD)).rejects.toBeInstanceOf(AuditEntryRefusedError);
    await expectNothingChanged(before, auditBefore);
  });

  it('a failure after the last step, just before the commit, leaves the entry and the change both undone (one transaction, no second one)', async () => {
    await blockTheThreeKeys();
    const before = await userState(db, adminId);
    const auditBefore = await entryCount(db);
    const late = new Error('failed after the last step');
    const transactions = createLateFailingRunner(db.transactions, late);
    await expect(buildService({ transactions }).resetAdminPasswordOnServer(context(), NEW_PASSWORD)).rejects.toBe(late);
    await expectNothingChanged(before, auditBefore);
  });
});
