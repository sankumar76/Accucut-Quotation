import type { PasswordHasher } from '../../src/server/auth/password-hasher';
import type { AttemptPolicy, ReservedAttempt, ThrottleRepository } from '../../src/server/repositories/throttle-repository';
import {
  normaliseEmail,
  UserConstraintError,
  type NewUser,
  type UserAccount,
  type UserChanges,
  type UserCredentials,
  type UserRepository,
  type UserRole,
  type UserSummary,
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

/** PostgreSQL's uuid type ignores letter case, so a lookup by ID does too (the fake must not be stricter than the database). */
function sameUuid(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

const ROLE_ORDER: Readonly<Record<UserRole, number>> = { ADMIN: 0, LEAD: 1, ENGINEER: 2 };

function summaryOf(record: FakeUserRecord): UserSummary {
  return { id: record.id, name: record.name, email: record.email, role: record.role, isActive: record.isActive };
}

export function createFakeUserRepository(initial: ReadonlyArray<NewUser> = []): FakeUserRepository {
  const records: FakeUserRecord[] = [];
  const lookups: string[] = [];
  let nextId = 1;
  const add = (user: NewUser): string => {
    // Hex letters in the ID, so a test can write it in capitals and the case rules mean something.
    const id = `00000000-0000-4000-8000-abcdef${String(nextId).padStart(6, '0')}`;
    nextId += 1;
    records.push({ ...user, email: normaliseEmail(user.email), id, isActive: true, sessionVersion: 0 });
    return id;
  };
  initial.forEach(add);

  /** The two rules the database keeps (`uq_users_email`, `uq_users_single_active_admin`), checked as it checks them. */
  const refuseIfRepeated = (candidate: { readonly id: string | null; readonly email: string; readonly role: UserRole; readonly isActive: boolean }): void => {
    const others = records.filter((record) => record.id !== candidate.id);
    if (others.some((record) => record.email === candidate.email)) throw new UserConstraintError('email', { cause: new Error('fake') });
    if (candidate.role === 'ADMIN' && candidate.isActive && others.some((record) => record.role === 'ADMIN' && record.isActive)) {
      throw new UserConstraintError('single-active-admin', { cause: new Error('fake') });
    }
  };

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
      const found = records.find((record) => sameUuid(record.id, id));
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
    // No lock to take in memory: the fake only has to answer the way the locking read does.
    findAccountForUpdate(id): Promise<UserAccount | null> {
      return this.findAccountById(id);
    },
    hasAnyAdmin: () => Promise.resolve(records.some((record) => record.role === 'ADMIN')),
    list: () =>
      Promise.resolve(
        records
          .map(summaryOf)
          .sort(
            (a, b) =>
              Number(b.isActive) - Number(a.isActive) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
          ),
      ),
    findActiveAdmin() {
      const found = records.find((record) => record.role === 'ADMIN' && record.isActive);
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name });
    },
    create(user) {
      try {
        refuseIfRepeated({ id: null, email: normaliseEmail(user.email), role: user.role, isActive: true });
      } catch (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(add(user));
    },
    update(id, changes: UserChanges) {
      const found = records.find((record) => sameUuid(record.id, id));
      if (found === undefined) return Promise.resolve(null);
      const next = { name: changes.name ?? found.name, role: changes.role ?? found.role, isActive: changes.isActive ?? found.isActive };
      try {
        refuseIfRepeated({ id: found.id, email: found.email, role: next.role, isActive: next.isActive });
      } catch (error) {
        return Promise.reject(error);
      }
      if (changes.isActive === false) found.sessionVersion += 1;
      Object.assign(found, next);
      return Promise.resolve(summaryOf(found));
    },
    setPassword(id, passwordHash) {
      const found = records.find((record) => sameUuid(record.id, id));
      if (found === undefined) return Promise.resolve(null);
      Object.assign(found, { passwordHash, mustChangePassword: true });
      found.sessionVersion += 1;
      return Promise.resolve(found.email);
    },
    raiseSessionVersion(id, expectedVersion) {
      const found = records.find((record) => sameUuid(record.id, id));
      if (found === undefined || found.sessionVersion !== expectedVersion) return Promise.resolve(false);
      found.sessionVersion += 1;
      return Promise.resolve(true);
    },
  };
}

export interface FakeThrottleRow {
  failures: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
}

export interface FakeThrottleRepository extends ThrottleRepository {
  readonly rows: Map<string, FakeThrottleRow>;
}

/**
 * The same arithmetic as the SQL statement of the real repository (`reserveStatement`), written in plain code. A
 * JavaScript function body runs to the end before another starts, so each call is atomic, as the SQL statement is; the
 * real statement is tested against PostgreSQL in `tests/integration/auth/throttle-reservation.test.ts`.
 */
function reserve(row: FakeThrottleRow | undefined, policy: AttemptPolicy, now: Date): FakeThrottleRow {
  if (row === undefined) return { failures: 1, windowStartedAt: now, blockedUntil: null };
  const blockEnded = row.blockedUntil !== null && row.blockedUntil.getTime() <= now.getTime();
  const windowRunOut =
    row.blockedUntil === null &&
    policy.windowMilliseconds !== null &&
    row.windowStartedAt.getTime() + policy.windowMilliseconds <= now.getTime();
  if (blockEnded || windowRunOut) return { failures: 1, windowStartedAt: now, blockedUntil: null };
  const failures = row.failures + 1;
  const blockedUntil =
    row.blockedUntil === null && failures >= policy.limit ? new Date(now.getTime() + policy.blockMilliseconds) : row.blockedUntil;
  return { failures, windowStartedAt: row.windowStartedAt, blockedUntil };
}

export function createFakeThrottleRepository(): FakeThrottleRepository {
  const rows = new Map<string, FakeThrottleRow>();
  return {
    rows,
    reserveAttempt(key, policy, now): Promise<ReservedAttempt> {
      const next = reserve(rows.get(key), policy, now);
      rows.set(key, next);
      return Promise.resolve({ attempts: next.failures, blockedUntil: next.blockedUntil });
    },
    releaseAttempt(key) {
      const row = rows.get(key);
      if (row !== undefined) row.failures = Math.max(row.failures - 1, 0);
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
