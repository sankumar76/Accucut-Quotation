import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { resolveSession } from '@/server/auth/resolve-session-user';
import { passwordChangeThrottleKey } from '@/server/auth/throttle-key';
import { createAccountService, type AccountService } from '@/server/services/account-service';
import { createAuthService } from '@/server/services/auth-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { insertUser, createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-01.05 AC-3, AC-5 and AC-6 against real PostgreSQL in a throwaway database: the account service over the real repositories, the
 * real hasher (at a small cost), the real throttle statement and the real session check. What only the database can prove: the compare
 * and set on the stored hash (a reset made meanwhile is never overwritten, and two changes at once cannot both win), `session_version`
 * and `must_change_password` changing in the same statement, and the five-attempt block counted on a key of its own. Every name, address
 * and password is invented.
 */

const KEY_SECRET = 'invented-throttle-key-material';
const CURRENT = 'Tn4#vLm8@Qz-current';
const NEW = 'Pr9$kWd3!Rx-fresh';
const hasher = createTestHasher();

let db: AuthDatabase;
let now: Date;
let service: AccountService;

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createAccountService({ users: db.users, throttles: db.throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
});

afterAll(async () => {
  await db.close();
});

/** A person who has to set a new password, as the Admin's add or reset leaves them. */
async function person(label: string, mustChangePassword = true) {
  now = new Date('2026-11-12T10:00:00.000Z');
  return insertUser(db.users, hasher, { email: `${label}@example.test`, password: CURRENT, mustChangePassword });
}

async function row(id: string) {
  const { rows } = await db.owner.query<{ password_hash: string; session_version: number; must_change_password: boolean }>(
    'SELECT password_hash, session_version, must_change_password FROM users WHERE id = $1',
    [id],
  );
  return defined(rows[0], 'user row');
}

async function error(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (reason: unknown) => reason,
  );
}

type ReadCredentials = AuthDatabase['users']['findCredentialsById'];

/**
 * An account service whose read of the stored hash (`findCredentialsById`, account-service.ts:79: the read that decides between 409 and 422) goes through `around`.
 * The test controls the order of two changes by making promises resolve at that read, never by waiting for time.
 */
function serviceReadingThrough(around: (read: ReadCredentials) => ReadCredentials): AccountService {
  return createAccountService({
    users: { ...db.users, findCredentialsById: around(db.users.findCredentialsById.bind(db.users)) },
    throttles: db.throttles,
    hasher,
    clock: { now: () => now },
    keySecret: KEY_SECRET,
  });
}

/** Resolves for every caller once `parties` callers have arrived. */
function barrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return () => {
    arrived += 1;
    if (arrived === parties) open();
    return opened;
  };
}

describe('AC-3, AC-5: the change', () => {
  it('stores an argon2id hash of the new password, clears the flag and raises the version, in one statement; the old password stops working', async () => {
    const { id, email } = await person('changes.password');
    const before = await row(id);
    const result = await service.changePassword(id, { currentPassword: CURRENT, newPassword: NEW });
    const after = await row(id);
    expect(result).toEqual({ sessionVersion: before.session_version + 1 });
    expect(after).toMatchObject({ must_change_password: false, session_version: before.session_version + 1 });
    expect(after.password_hash).not.toBe(before.password_hash);
    expect(after.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(after.password_hash).not.toContain(NEW);

    const auth = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect(await auth.authenticate({ email, password: CURRENT, ipAddress: null })).toEqual({ status: 'refused', reason: 'invalid' });
    expect((await auth.authenticate({ email, password: NEW, ipAddress: null })).status).toBe('signed-in');
  });

  it('refuses a token issued before the change and honours the one issued at the new version', async () => {
    const { id } = await person('old.token');
    const signedAt = Math.floor(now.getTime() / 1000);
    expect((await resolveSession({ userId: id, sessionVersion: 0, signedAt }, db.users, now)).status).toBe('active');
    const { sessionVersion } = await service.changePassword(id, { currentPassword: CURRENT, newPassword: NEW });
    expect(await resolveSession({ userId: id, sessionVersion: 0, signedAt }, db.users, now)).toEqual({ status: 'refused' });
    expect(await resolveSession({ userId: id, sessionVersion, signedAt }, db.users, now)).toMatchObject({ status: 'active', user: { id, mustChangePassword: false } });
  });

  it('a wrong current password changes nothing', async () => {
    const { id } = await person('wrong.current');
    const before = await row(id);
    expect(await error(service.changePassword(id, { currentPassword: 'Not-the-current-1!', newPassword: NEW }))).toMatchObject({ code: 'CURRENT_PASSWORD_WRONG', httpStatus: 422 });
    expect(await row(id)).toEqual(before);
  });

  it('QLT-01: the temporary password typed again as the new one is refused, and the person stays in "Set a new password" with the hash, the flag and the version as they were', async () => {
    const { id } = await person('same.again');
    const before = await row(id);
    expect(before.must_change_password).toBe(true);
    expect(await error(service.changePassword(id, { currentPassword: CURRENT, newPassword: CURRENT }))).toMatchObject({
      code: 'PASSWORD_RULE',
      httpStatus: 422,
      fields: [{ field: 'newPassword', message: 'Choose a new password that is different from your current one.' }],
    });
    expect(await row(id)).toEqual(before);
  });

  it('a weak new password changes nothing and costs no attempt', async () => {
    const { id } = await person('weak.new');
    const before = await row(id);
    expect(await error(service.changePassword(id, { currentPassword: CURRENT, newPassword: 'Welcome@123' }))).toMatchObject({ code: 'PASSWORD_RULE', fields: [{ field: 'newPassword' }] });
    expect(await row(id)).toEqual(before);
    const { rows } = await db.owner.query('SELECT 1 FROM login_throttles WHERE key_hash = $1', [passwordChangeThrottleKey(KEY_SECRET, id)]);
    expect(rows).toHaveLength(0);
  });

  // The loser of two changes made with the same current password is told 409 when both read the stored hash before either wrote (the compare and set then fails),
  // and 422 when it read after the winner committed (the current password no longer matches). Both are specified; the two tests force one order each (DEF-046).
  it('two changes that both read the stored password before either writes cannot both win: exactly one succeeds and the other is 409', async () => {
    const { id } = await person('two.read.first');
    const bothHaveRead = barrier(2);
    const reads = (read: ReadCredentials): ReadCredentials => async (userId) => {
      const stored = await read(userId);
      await bothHaveRead();
      return stored;
    };
    const passwords = [NEW, 'Zx8%mNc4#Tv-other'];
    const outcomes = await Promise.all(passwords.map((newPassword) => error(serviceReadingThrough(reads).changePassword(id, { currentPassword: CURRENT, newPassword }))));
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome !== null)).toMatchObject({ httpStatus: 409, code: 'PASSWORD_CHANGED_ELSEWHERE' });
    const after = await row(id);
    expect(after.session_version).toBe(1);
    expect(await hasher.verify(after.password_hash, defined(passwords[outcomes.indexOf(null)], 'the winner'))).toBe(true);
  });

  it('two changes where the second reads the stored password only after the first has committed: the first wins and the second is 422', async () => {
    const { id } = await person('two.read.late');
    let firstCommitted!: () => void;
    const committed = new Promise<void>((resolve) => {
      firstCommitted = resolve;
    });
    const readsLate = (read: ReadCredentials): ReadCredentials => async (userId) => {
      await committed;
      return read(userId);
    };
    const first = error(service.changePassword(id, { currentPassword: CURRENT, newPassword: NEW })).then((outcome) => {
      firstCommitted();
      return outcome;
    });
    const second = error(serviceReadingThrough(readsLate).changePassword(id, { currentPassword: CURRENT, newPassword: 'Zx8%mNc4#Tv-other' }));
    expect(await first).toBeNull();
    expect(await second).toMatchObject({ httpStatus: 422, code: 'CURRENT_PASSWORD_WRONG' });
    const after = await row(id);
    expect(after.session_version).toBe(1);
    expect(await hasher.verify(after.password_hash, NEW)).toBe(true);
  });

  it('never overwrites a password the Admin reset after the current one was checked', async () => {
    const { id } = await person('reset.meanwhile');
    const stored = defined(await db.users.findCredentialsById(id));
    // The Admin's reset lands between the check and the write.
    await db.users.setPassword(id, await hasher.hash('Admin-set-temporary-1!'));
    expect(await db.users.changeOwnPassword(id, stored.passwordHash, await hasher.hash(NEW))).toBeNull();
    expect(await hasher.verify((await row(id)).password_hash, 'Admin-set-temporary-1!')).toBe(true);
  });

  it('is not found for an ID that is not a UUID, without asking the database to cast it', async () => {
    expect(await db.users.findCredentialsById('not-a-uuid')).toBeNull();
  });
});

describe('AC-6: five wrong current passwords block the form for 15 minutes, on a key of its own', () => {
  it('refuses the sixth with 429, lets sign-in through, and frees the form after 15 minutes', async () => {
    const { id, email } = await person('blocked.form', false);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await error(service.changePassword(id, { currentPassword: 'Not-the-current-1!', newPassword: NEW }))).toMatchObject({ code: 'CURRENT_PASSWORD_WRONG' });
    }
    const blockedKey = passwordChangeThrottleKey(KEY_SECRET, id);
    const stored = await db.owner.query<{ blocked_until: Date | null }>('SELECT blocked_until FROM login_throttles WHERE key_hash = $1', [blockedKey]);
    expect(stored.rows[0]?.blocked_until).not.toBeNull();

    expect(await error(service.changePassword(id, { currentPassword: CURRENT, newPassword: NEW }))).toMatchObject({ httpStatus: 429, code: 'TOO_MANY_ATTEMPTS' });
    const auth = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect((await auth.authenticate({ email, password: CURRENT, ipAddress: null })).status).toBe('signed-in');

    now = new Date(now.getTime() + 15 * MILLISECONDS_PER_MINUTE);
    await expect(service.changePassword(id, { currentPassword: CURRENT, newPassword: NEW })).resolves.toMatchObject({ sessionVersion: 1 });
  });

  it('the right current password ends the run of failures', async () => {
    const { id } = await person('clears.run', false);
    for (let attempt = 0; attempt < 4; attempt += 1) await error(service.changePassword(id, { currentPassword: 'Not-the-current-1!', newPassword: NEW }));
    await service.changePassword(id, { currentPassword: CURRENT, newPassword: NEW });
    const { rows } = await db.owner.query<{ failures: number }>('SELECT failures FROM login_throttles WHERE key_hash = $1', [passwordChangeThrottleKey(KEY_SECRET, id)]);
    expect(rows[0]?.failures).toBe(0);
  });
});
