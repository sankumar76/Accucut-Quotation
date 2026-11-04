import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * Storage of the people who sign in (architecture section 5.1). A user is deactivated and never deleted, so
 * there is no delete here and the runtime role has no grant for one.
 *
 * E-mail addresses are stored lower-case and the database refuses any other spelling, so every method
 * lower-cases what it is given (`normaliseEmail`), and a case-different address finds the same user.
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

export interface UserRepository {
  /** The sign-in view of the user with this e-mail, or null. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  /** The account with this ID, or null. */
  findAccountById(id: string): Promise<UserAccount | null>;
  /** True if any user at all has the Admin role, active or not. */
  hasAnyAdmin(): Promise<boolean>;
  /** Adds a user and returns its ID. A second active Admin or a used e-mail is refused by the database. */
  create(user: NewUser): Promise<string>;
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

    hasAnyAdmin() {
      return withDatabaseErrors(async () => (await db.user.count({ where: { role: 'ADMIN' }, take: 1 })) > 0);
    },

    create(user) {
      return withDatabaseErrors(async () => {
        const created = await db.user.create({
          data: { ...user, email: normaliseEmail(user.email) },
          select: { id: true },
        });
        return created.id;
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
