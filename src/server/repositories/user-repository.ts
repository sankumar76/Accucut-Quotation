import { z } from 'zod';

import { uniqueViolationOf, withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the people who sign in (architecture section 5.1). A user is deactivated and never deleted, so
 * there is no delete here and the runtime role has no grant for one.
 *
 * E-mail addresses are stored lower-case and the database refuses any other spelling, so every method
 * lower-cases what it is given (`normaliseEmail`), and a case-different address finds the same user.
 *
 * Two rules belong to the database and not to the code that calls it (STORY-01.04 AC-3): an e-mail is unique, and at
 * most one Admin is active (`uq_users_single_active_admin`). A write that breaks one fails with `UserConstraintError`
 * naming which, whatever the caller checked first, so two requests that race for the one place cannot both win.
 */

export type UserRole = 'ADMIN' | 'LEAD' | 'ENGINEER';

/** Everything the sign-in check needs, including the password hash. Never send this to a client. */
export interface UserCredentials {
  readonly id: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly sessionVersion: number;
}

/** What a request needs to know about the signed-in person. No password hash. */
export interface UserAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly sessionVersion: number;
  readonly mustChangePassword: boolean;
}

export interface NewUser {
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly mustChangePassword: boolean;
}

/** A row of the Users list (SCR-14): what the Admin sees about a person. No password hash, no session version. */
export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isActive: boolean;
}

/** What the Admin may change about a person. E-mail and password have routes of their own or none. */
export interface UserChanges {
  readonly name?: string | undefined;
  readonly role?: UserRole | undefined;
  readonly isActive?: boolean | undefined;
}

/** Which of the two rules a write broke. */
export type UserConstraint = 'email' | 'single-active-admin';

/** A write that the database refused because it would repeat an e-mail or make a second active Admin. */
export class UserConstraintError extends Error {
  constructor(
    readonly constraint: UserConstraint,
    options: { readonly cause: unknown },
  ) {
    super(`The write broke the ${constraint} rule.`, options);
    this.name = 'UserConstraintError';
  }
}

export interface UserRepository {
  /** The sign-in view of the user with this e-mail, or null. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  /** The account with this ID, or null. */
  findAccountById(id: string): Promise<UserAccount | null>;
  /**
   * The account with this ID, or null, read in the caller's transaction **with its row locked** (`SELECT ... FOR UPDATE`) until
   * the transaction ends. A change that is audited reads the state it replaces this way, so the `before` of its entry is the
   * state the change really found and a second change to the same person waits for the first (STORY-01.07).
   */
  findAccountForUpdate(id: string, tx: Transaction): Promise<UserAccount | null>;
  /** True if any user at all has the Admin role, active or not. */
  hasAnyAdmin(): Promise<boolean>;
  /** Everyone, for the Users list: active people first, then by role (Admin, Lead, Engineer), then by name. */
  list(): Promise<ReadonlyArray<UserSummary>>;
  /** The one active Admin, or null. */
  findActiveAdmin(): Promise<Pick<UserSummary, 'id' | 'name'> | null>;
  /**
   * Adds a user and returns its ID. Throws `UserConstraintError` for a used e-mail or a second active Admin. With `tx` it runs
   * in the caller's transaction (the audit entry is written in the same one).
   */
  create(user: NewUser, tx?: Transaction): Promise<string>;
  /**
   * Changes a person's name, role or active flag and returns them, or null if there is no such user. Deactivating also
   * raises `session_version`, in the same statement, so a person who is activated again must sign in again. Throws
   * `UserConstraintError` for a second active Admin. With `tx` it runs in the caller's transaction.
   */
  update(id: string, changes: UserChanges, tx?: Transaction): Promise<UserSummary | null>;
  /**
   * Sets the password hash, sets `must_change_password` and raises `session_version` (which ends the person's sessions),
   * in one statement. Returns the person's e-mail address, or null if there is no such user. With `tx` it runs in the caller's
   * transaction.
   */
  setPassword(id: string, passwordHash: string, tx?: Transaction): Promise<string | null>;
  /**
   * Raises the user's `session_version` by one, which ends every session they have (ADR-009), **only if it is still
   * `expectedVersion`**: compare and increment in one statement (ADR-009 amendment 1). A token whose version is already
   * out of date therefore changes nothing, and a copied old cookie cannot sign the person out again and again. Returns
   * true if the version was raised.
   */
  raiseSessionVersion(id: string, expectedVersion: number): Promise<boolean>;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Prisma's code for "the record to update does not exist". */
const RECORD_NOT_FOUND = 'P2025';

const SUMMARY_SELECT = { id: true, name: true, email: true, role: true, isActive: true } as const;

/** The rows of the locking read, checked on the way in: a raw statement is not typed by Prisma. */
const LOCKED_ACCOUNT_ROWS = z.array(
  z.strictObject({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.enum(['ADMIN', 'LEAD', 'ENGINEER']),
    isActive: z.boolean(),
    sessionVersion: z.number().int(),
    mustChangePassword: z.boolean(),
  }),
);

function isRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === RECORD_NOT_FOUND;
}

/** The rule a unique violation broke, from the column or the index it names; null for anything else. */
function constraintOf(error: unknown): UserConstraint | null {
  const names = uniqueViolationOf(error);
  if (names === null) return null;
  if (names.some((name) => name === 'email' || name === 'uq_users_email')) return 'email';
  if (names.some((name) => name === 'role' || name === 'uq_users_single_active_admin')) return 'single-active-admin';
  return null;
}

/** Runs a write and turns a refusal by one of the two unique rules into `UserConstraintError`. */
async function enforcingConstraints<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const constraint = constraintOf(error);
    if (constraint === null) throw error;
    throw new UserConstraintError(constraint, { cause: error });
  }
}

export function createUserRepository(db: PrismaClient): UserRepository {
  return {
    findCredentialsByEmail(email) {
      return withDatabaseErrors(() =>
        db.user.findUnique({
          where: { email: normaliseEmail(email) },
          select: { id: true, passwordHash: true, isActive: true, sessionVersion: true },
        }),
      );
    },

    findAccountById(id) {
      return withDatabaseErrors(() =>
        db.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            sessionVersion: true,
            mustChangePassword: true,
          },
        }),
      );
    },

    findAccountForUpdate(id, tx) {
      return withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; a person who asks for one is not found.
        if (!z.uuid().safeParse(id).success) return null;
        // Prisma has no row lock, so this is the one raw statement of the repository: the ID is a bound parameter.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name, email, role::text AS "role", is_active AS "isActive",
                 session_version AS "sessionVersion", must_change_password AS "mustChangePassword"
          FROM users WHERE id = ${id}::uuid FOR UPDATE`;
        const found = LOCKED_ACCOUNT_ROWS.parse(rows)[0];
        return found ?? null;
      });
    },

    hasAnyAdmin() {
      return withDatabaseErrors(async () => (await db.user.count({ where: { role: 'ADMIN' }, take: 1 })) > 0);
    },

    list() {
      return withDatabaseErrors(() =>
        db.user.findMany({
          select: SUMMARY_SELECT,
          orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }, { email: 'asc' }],
        }),
      );
    },

    findActiveAdmin() {
      return withDatabaseErrors(() => db.user.findFirst({ where: { role: 'ADMIN', isActive: true }, select: { id: true, name: true } }));
    },

    create(user, tx) {
      return withDatabaseErrors(() =>
        enforcingConstraints(async () => {
          const created = await clientFor(db, tx).user.create({
            data: { ...user, email: normaliseEmail(user.email) },
            select: { id: true },
          });
          return created.id;
        }),
      );
    },

    update(id, changes, tx) {
      return withDatabaseErrors(() =>
        enforcingConstraints(async () => {
          try {
            return await clientFor(db, tx).user.update({
              where: { id },
              // Only the fields given are written. Deactivating ends the person's sessions for good (see the interface).
              data: {
                ...(changes.name === undefined ? {} : { name: changes.name }),
                ...(changes.role === undefined ? {} : { role: changes.role }),
                ...(changes.isActive === undefined ? {} : { isActive: changes.isActive }),
                ...(changes.isActive === false ? { sessionVersion: { increment: 1 } } : {}),
              },
              select: SUMMARY_SELECT,
            });
          } catch (error) {
            if (isRecordNotFound(error)) return null;
            throw error;
          }
        }),
      );
    },

    setPassword(id, passwordHash, tx) {
      return withDatabaseErrors(async () => {
        try {
          const updated = await clientFor(db, tx).user.update({
            where: { id },
            data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
            select: { email: true },
          });
          return updated.email;
        } catch (error) {
          if (isRecordNotFound(error)) return null;
          throw error;
        }
      });
    },

    raiseSessionVersion(id, expectedVersion) {
      return withDatabaseErrors(async () => {
        const { count } = await db.user.updateMany({
          where: { id, sessionVersion: expectedVersion },
          data: { sessionVersion: { increment: 1 } },
        });
        return count === 1;
      });
    },
  };
}
