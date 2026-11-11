import { ActiveAdminExistsError, ConflictError, FieldValidationError, NotFoundError } from '../../lib/errors';
import type { PasswordHasher } from '../auth/password-hasher';
import { accountThrottleKey } from '../auth/throttle-key';
import type { ThrottleRepository } from '../repositories/throttle-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';
import {
  normaliseEmail,
  UserConstraintError,
  type UserChanges,
  type UserRepository,
  type UserRole,
  type UserSummary,
} from '../repositories/user-repository';

import type { AuditContext, AuditService } from './audit-service';

/**
 * User management by the Admin (STORY-01.04; FR-004, FR-005; architecture sections 5.1, 6 and 8): add, edit, deactivate,
 * activate and reset the password of a person. Who may call it is decided before it is reached (`withRoute`, the manifest);
 * this file holds the rules that stay true whoever asks:
 *
 *   - **One active Admin** (AC-3, CONSTRAINT-04). The service looks first, so the answer can name the current Admin, but the
 *     partial unique index decides: a write the index refuses, because another request won the race, gives the same answer.
 *   - **The Admin cannot lock themself out** (AC-4, architecture section 8 "Admin guards"): not their own deactivation, not
 *     their own role. A server rule; a disabled button is not enough.
 *   - **A password the Admin sets is temporary** (AC-1, AC-5, FR-004): it is stored as an argon2id hash only, `must_change_password`
 *     is set (the forced page is story 01.05), a reset ends the person's open sessions and lifts their sign-in block.
 *     The password rule (FR-098) is story 01.05's; until then a non-empty password is accepted (assumption A-1).
 *
 * Each change is one method here, and **one transaction** (STORY-01.07 AC-2, AC-3): the change and its audit entry are written
 * together, so the entry exists exactly when the change does. A change that is refused for a rule, or whose entry is refused
 * (`AuditEntryRefusedError`), is rolled back whole. The state an entry calls "before" is read in the transaction with the
 * person's row locked, so it is the state the change really replaced even if a second request arrives at the same time. The
 * password is hashed before the transaction opens, for a new person and for a reset (PRF-03), so no lock is held while argon2id
 * works. Nothing in a result, an error or an entry carries a password or its hash (AC-4).
 *
 * What is audited, six events (AC-3): a person added (`user.created`), a name changed (`user.renamed`), a role changed, a person
 * deactivated or activated, a password reset. Each attribute that changes on one save raises its own event, in one transaction;
 * a save that changes nothing writes none. Every entry carries the actor's name at the time (`actorLabel`, from the signed-in
 * user of the request) and the object's name after the change.
 */

export const EMAIL_TAKEN_CODE = 'EMAIL_TAKEN';
export const EMAIL_TAKEN_MESSAGE = 'A user with this e-mail already exists.';
export const CANNOT_CHANGE_OWN_ROLE_CODE = 'CANNOT_CHANGE_OWN_ROLE';
export const CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE = 'CANNOT_DEACTIVATE_OWN_ACCOUNT';
export const CANNOT_RESET_OWN_PASSWORD_CODE = 'CANNOT_RESET_OWN_PASSWORD';
const USER_NOT_FOUND_MESSAGE = 'User not found.';

export interface NewUserInput {
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  /** The first password, in clear. Hashed here and never kept, logged or returned. */
  readonly password: string;
}

export interface UserServiceDependencies {
  readonly users: UserRepository;
  readonly throttles: ThrottleRepository;
  readonly hasher: PasswordHasher;
  /** Opens the transaction that a change and its audit entry share. */
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  /** The key that makes the throttle hashes unguessable (`AUTH_SECRET`); a reset clears the person's account key with it. */
  readonly keySecret: string;
}

/**
 * Every change takes the `AuditContext` first: `actorId` is the Admin making the change and `requestId` the request it came in
 * on. Both go into the audit entry.
 */
export interface UserService {
  list(): Promise<ReadonlyArray<UserSummary>>;
  create(context: AuditContext, input: NewUserInput): Promise<UserSummary>;
  /** `changes` has at least one field (the route's schema sees to that). */
  update(context: AuditContext, targetId: string, changes: UserChanges): Promise<UserSummary>;
  /** Resetting one's own password is refused (409). */
  resetPassword(context: AuditContext, targetId: string, password: string): Promise<void>;
}

/**
 * Is the row the database returned the caller? Compared by the row's own ID and ignoring letter case, because PostgreSQL's uuid
 * type does: an address written in capitals finds the same row, and a plain string comparison of the address with the caller's
 * ID would let the Admin past their own-account rules (found by the automated security review of AQP-65).
 */
function isSamePerson(actorId: string, rowId: string): boolean {
  return actorId.toLowerCase() === rowId.toLowerCase();
}

/** Would the person be an active Admin after the change? */
function isActiveAdmin(state: { readonly role: UserRole; readonly isActive: boolean }): boolean {
  return state.role === 'ADMIN' && state.isActive;
}

export function createUserService({ users, throttles, hasher, transactions, audit, keySecret }: UserServiceDependencies): UserService {
  /** The refusal for a second Admin, naming whoever holds the place now (nobody is named if they cannot be read back). */
  async function activeAdminExists(): Promise<ActiveAdminExistsError> {
    return new ActiveAdminExistsError(await users.findActiveAdmin());
  }

  /** Runs a write and gives the two rules of the database their words. Any other failure passes on untouched. */
  async function withUserRules<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof UserConstraintError)) throw error;
      if (error.constraint === 'email') {
        throw new FieldValidationError([{ field: 'email', message: EMAIL_TAKEN_MESSAGE }], { code: EMAIL_TAKEN_CODE, cause: error });
      }
      throw await activeAdminExists();
    }
  }

  return {
    list() {
      return users.list();
    },

    async create(context, { name, email, role, password }) {
      if (role === 'ADMIN' && (await users.findActiveAdmin()) !== null) throw await activeAdminExists();
      const passwordHash = await hasher.hash(password);
      const normalisedEmail = normaliseEmail(email);
      const id = await withUserRules(() =>
        transactions.run(async (tx) => {
          const createdId = await users.create({ name, email: normalisedEmail, passwordHash, role, mustChangePassword: true }, tx);
          await audit.record(tx, {
            event: 'user.created',
            ...context,
            object: { id: createdId, label: name },
            before: null,
            after: { role, isActive: true },
          });
          return createdId;
        }),
      );
      return { id, name, email: normalisedEmail, role, isActive: true };
    },

    update(context, targetId, changes) {
      return withUserRules(() =>
        transactions.run(async (tx) => {
          const target = await users.findAccountForUpdate(targetId, tx);
          if (target === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);

          if (isSamePerson(context.actorId, target.id)) {
            if (changes.role !== undefined && changes.role !== target.role) {
              throw new ConflictError('You cannot change your own role.', { code: CANNOT_CHANGE_OWN_ROLE_CODE });
            }
            if (changes.isActive === false && target.isActive) {
              throw new ConflictError('You cannot deactivate your own account.', { code: CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE });
            }
          }

          const after = { role: changes.role ?? target.role, isActive: changes.isActive ?? target.isActive };
          if (isActiveAdmin(after) && !isActiveAdmin(target) && (await users.findActiveAdmin()) !== null) throw await activeAdminExists();

          const updated = await users.update(target.id, changes, tx);
          if (updated === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);

          // One entry for each attribute that really changed (AC-3), in the order name, role, active flag, all under the name the
          // person has now (so a rename and a role change on one save both say the new name). A request that sets a value to
          // what it already is changes nothing and records nothing.
          const object = { id: updated.id, label: updated.name };
          if (changes.name !== undefined && changes.name !== target.name) {
            await audit.record(tx, { event: 'user.renamed', ...context, object, before: { name: target.name }, after: { name: updated.name } });
          }
          if (changes.role !== undefined && changes.role !== target.role) {
            await audit.record(tx, { event: 'user.role_changed', ...context, object, before: { role: target.role }, after: { role: updated.role } });
          }
          if (changes.isActive === true && !target.isActive) {
            await audit.record(tx, { event: 'user.activated', ...context, object, before: { isActive: false }, after: { isActive: true } });
          } else if (changes.isActive === false && target.isActive) {
            await audit.record(tx, { event: 'user.deactivated', ...context, object, before: { isActive: true }, after: { isActive: false } });
          }
          return updated;
        }),
      );
    },

    async resetPassword(context, targetId, password) {
      // The Admin's own password is changed with the current one, on the account page (story 01.05), not by a reset that
      // needs no proof: a stolen session could otherwise take the account over (STD-01). Looked at first, outside the
      // transaction, so a refused reset costs no hash.
      const asked = await users.findAccountById(targetId);
      if (asked === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
      if (isSamePerson(context.actorId, asked.id)) {
        throw new ConflictError('You cannot reset your own password here.', { code: CANNOT_RESET_OWN_PASSWORD_CODE });
      }
      // Hashed before the transaction opens (PRF-03): argon2id takes about 350 ms, and the row lock and a pool connection
      // must not be held for that.
      const passwordHash = await hasher.hash(password);
      const email = await transactions.run(async (tx) => {
        const target = await users.findAccountForUpdate(asked.id, tx);
        if (target === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
        const resetEmail = await users.setPassword(target.id, passwordHash, tx);
        if (resetEmail === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
        await audit.record(tx, {
          event: 'user.password_reset',
          ...context,
          object: { id: target.id, label: target.name },
          before: { mustChangePassword: target.mustChangePassword },
          after: { mustChangePassword: true },
        });
        return resetEmail;
      });
      // The sign-in page tells a blocked person to ask the Admin for a reset (architecture section 6, "Rate limits").
      // Done once the reset is committed, so a reset that was rolled back does not lift anyone's block.
      await throttles.clear(accountThrottleKey(keySecret, email));
    },
  };
}

// Reviewer plants (QLT, AQP-237): never merged.
type PlantEntry = Parameters<AuditService['record']>[1];
const plantEntry = (context: AuditContext): PlantEntry => ({ event: 'user.deactivated', ...context, object: { id: 'planted', label: 'planted' }, before: { isActive: true }, after: { isActive: false } });

/** Q1: a floating record (`void`) inside the callback; the callback returns before the entry is written. */
export async function plantedQ1(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  await transactions.run(async (tx) => {
    await users.update('planted', { isActive: false }, tx);
    void audit.record(tx, plantEntry(context));
  });
}

/** Q1b: the same with a forgotten `await` (no `void`). */
export async function plantedQ1b(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  await transactions.run(async (tx) => {
    await users.update('planted', { isActive: false }, tx);
    audit.record(tx, plantEntry(context));
  });
}

/** Q2: an async forEach in the callback: nothing waits for the records. */
export async function plantedQ2(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  await transactions.run(async (tx) => {
    await users.update('planted', { isActive: false }, tx);
    ['a', 'b'].forEach(async () => {
      await audit.record(tx, plantEntry(context));
    });
  });
}

/** Q3: P2 (handle kept, entry after the callback returned) written as `record.call`. */
export async function plantedQ3(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  let kept: Transaction | undefined;
  await transactions.run(async (tx) => {
    kept = tx;
    await users.update('planted', { isActive: false }, tx);
  });
  if (kept !== undefined) await audit.record.call(audit, kept, plantEntry(context));
}

/** Q3b: P2 through an alias made with `bind`. */
export async function plantedQ3b(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  let kept: Transaction | undefined;
  await transactions.run(async (tx) => {
    kept = tx;
    await users.update('planted', { isActive: false }, tx);
  });
  const write = audit.record.bind(audit);
  if (kept !== undefined) await write(kept, plantEntry(context));
}

/** Q4: an exported helper, used correctly here, and with a kept handle from exchange-rate-service.ts. */
export async function plantedQ4Helper(users: UserRepository, audit: AuditService, context: AuditContext, tx: Transaction): Promise<void> {
  await users.update('planted', { isActive: false }, tx);
  await audit.record(tx, plantEntry(context));
}
export async function plantedQ4(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  await transactions.run((tx) => plantedQ4Helper(users, audit, context, tx));
}

/** Q5: P3 (the change outside the transaction) where (b) is met by a closure that never runs. */
export async function plantedQ5(transactions: TransactionRunner, users: UserRepository, audit: AuditService, context: AuditContext): Promise<void> {
  await transactions.run(async (tx) => {
    const never = (): Promise<unknown> => users.update('planted', { isActive: false }, tx);
    await users.update('planted', { isActive: false });
    await audit.record(tx, plantEntry(context));
    return never;
  });
}
