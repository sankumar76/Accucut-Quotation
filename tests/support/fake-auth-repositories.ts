import type { PasswordHasher } from '../../src/server/auth/password-hasher';
import type { ThrottleRecord, ThrottleRepository } from '../../src/server/repositories/throttle-repository';
import {
  normaliseEmail,
  type NewUser,
  type UserAccount,
  type UserCredentials,
  type UserRepository,
  type UserRole,
} from '../../src/server/repositories/user-repository';

/**
 * In-memory stand-ins for the two auth repositories, for unit tests of the rules (no database). They keep the
 * behaviour the service relies on: lower-case e-mail, counters per key. The real repositories are tested against
 * PostgreSQL in `tests/integration/auth`.
 */

export interface FakeUserRecord extends Omit<NewUser, 'role'> {
  readonly id: string;
  /** Mutable, so a test can change a role the way an Admin would. */
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
}

export interface FakeUserRepository extends UserRepository {
  readonly records: FakeUserRecord[];
  /** Every e-mail looked up for sign-in, in order. */
  readonly lookups: string[];
}

export function createFakeUserRepository(initial: ReadonlyArray<NewUser> = []): FakeUserRepository {
  const records: FakeUserRecord[] = [];
  const lookups: string[] = [];
  let nextId = 1;
  const add = (user: NewUser): string => {
    const id = `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`;
    nextId += 1;
    records.push({ ...user, email: normaliseEmail(user.email), id, isActive: true, sessionVersion: 0 });
    return id;
  };
  initial.forEach(add);

  return {
    records,
    lookups,
    findCredentialsByEmail(email): Promise<UserCredentials | null> {
      lookups.push(email);
      const found = records.find((record) => record.email === normaliseEmail(email));
      return Promise.resolve(
        found === undefined
          ? null
          : { id: found.id, passwordHash: found.passwordHash, isActive: found.isActive, sessionVersion: found.sessionVersion },
      );
    },
    findAccountById(id): Promise<UserAccount | null> {
      const found = records.find((record) => record.id === id);
      return Promise.resolve(
        found === undefined
          ? null
          : {
              id: found.id,
              name: found.name,
              email: found.email,
              role: found.role,
              isActive: found.isActive,
              sessionVersion: found.sessionVersion,
              mustChangePassword: found.mustChangePassword,
            },
      );
    },
    hasAnyAdmin: () => Promise.resolve(records.some((record) => record.role === 'ADMIN')),
    create: (user) => Promise.resolve(add(user)),
    raiseSessionVersion(id) {
      const found = records.find((record) => record.id === id);
      if (found !== undefined) found.sessionVersion += 1;
      return Promise.resolve();
    },
  };
}

export interface FakeThrottleRepository extends ThrottleRepository {
  readonly rows: Map<string, { failures: number; windowStartedAt: Date; blockedUntil: Date | null }>;
}

export function createFakeThrottleRepository(): FakeThrottleRepository {
  const rows = new Map<string, { failures: number; windowStartedAt: Date; blockedUntil: Date | null }>();
  const snapshot = (key: string): ThrottleRecord => {
    const row = rows.get(key);
    if (row === undefined) throw new Error('No such throttle row.');
    return { ...row };
  };
  return {
    rows,
    find: (key) => Promise.resolve(rows.has(key) ? snapshot(key) : null),
    addFailure(key, now) {
      const row = rows.get(key);
      if (row === undefined) rows.set(key, { failures: 1, windowStartedAt: now, blockedUntil: null });
      else row.failures += 1;
      return Promise.resolve(snapshot(key));
    },
    restartWindow(key, now) {
      rows.set(key, { failures: 1, windowStartedAt: now, blockedUntil: null });
      return Promise.resolve();
    },
    block(key, until) {
      const row = rows.get(key);
      if (row !== undefined) row.blockedUntil = until;
      return Promise.resolve();
    },
    clear(key) {
      const row = rows.get(key);
      if (row !== undefined) {
        row.failures = 0;
        row.blockedUntil = null;
      }
      return Promise.resolve();
    },
  };
}

/** A hasher that counts the hashes it verified and what each was verified against. Matches when the stored hash is `hash:<password>`. */
export interface CountingHasher extends PasswordHasher {
  readonly verified: Array<{ readonly passwordHash: string; readonly matched: boolean }>;
  readonly hashed: string[];
}

export function createCountingHasher(): CountingHasher {
  const verified: Array<{ passwordHash: string; matched: boolean }> = [];
  const hashed: string[] = [];
  return {
    verified,
    hashed,
    hash(password) {
      hashed.push(password);
      return Promise.resolve(`hash:${password}`);
    },
    verify(passwordHash, password) {
      const matched = passwordHash === `hash:${password}`;
      verified.push({ passwordHash, matched });
      return Promise.resolve(matched);
    },
  };
}
