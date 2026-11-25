import { ActiveAdminExistsError, ConflictError, FieldValidationError, NotFoundError } from '../../lib/errors';
import { ADMIN_CANNOT_BE_REMOVED_CODE, ADMIN_CANNOT_BE_REMOVED_MESSAGE } from '../../lib/users/hand-over';
import type { PasswordHasher } from '../auth/password-hasher';
import { accountThrottleKey, passwordChangeThrottleKey, stepUpThrottleKey } from '../auth/throttle-key';
import type { ThrottleRepository } from '../repositories/throttle-repository';
import type { TransactionRunner } from '../repositories/transaction';
import {
  normaliseEmail,
  UserConstraintError,
  type AdminAccount,
  type UserChanges,
  type UserRepository,
  type UserRole,
  type UserSummary,
} from '../repositories/user-repository';

import type { AuditContext, AuditService } from './audit-service';
import { assertPasswordRule } from './password-policy';

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
 *     is set (the person is sent to "Set a new password", STORY-01.05), a reset ends the person's open sessions and lifts their
 *     sign-in block. The password meets the rule (FR-098, STORY-01.05 AC-4) or the change is refused with 422 `PASSWORD_RULE`
 *     naming the failing part, before any hash is made.
 *
 * Each change is one method here, and **one transaction** (STORY-01.07 AC-2, AC-3): the change and its audit entry are written
 * together, so the entry exists exactly when the change does. A change that is refused for a rule, or whose entry is refused
 * (`AuditEntryRefusedError`), is rolled back whole. The state an entry calls "before" is read in the transaction with the
 * person's row locked, so it is the state the change really replaced even if a second request arrives at the same time. The
 * password is hashed before the transaction opens, for a new person and for a reset (PRF-03), so no lock is held while argon2id
 * works. Nothing in a result, an error or an entry carries a password or its hash (AC-4).
 *
 * **The server command** (STORY-01.10, DL-380 to DL-382; architecture section 8 "Emergency Admin password reset"): `findAdminForServerReset` and `resetAdminPasswordOnServer` serve the packaged
 * `bootstrap-admin` step with `--reset-admin-password`, run on the server for the one Admin who cannot use the e-mailed link while e-mail is off. They are named by that command's runner and by no
 * page or route (`tests/security/admin-password-reset-no-web-route.test.ts`). The reset is one transaction: the Admin rows are locked in ID order and the rule "exactly one active Admin" is checked again, then the
 * password, the flag and the session version are set, the three throttle keys are cleared, and the audit entry is written; any failure undoes all of it. Its entry names the Admin as actor (the log has no other
 * user to name) and carries the command's label, which says it was a system action and from which Windows account.
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

/** Why the server command refused: there is no Admin, the one Admin is deactivated (the command never reactivates), or more than one is active (the database makes that impossible; it is checked anyway). */
export type ServerResetRefusal = 'NO_ADMIN' | 'ADMIN_INACTIVE' | 'MULTIPLE_ADMINS';

/** The Admin the operator is shown before they confirm, or the reason there is nobody to reset. */
export type ServerResetAdmin =
  | { readonly status: 'ready'; readonly id: string; readonly name: string; readonly email: string }
  | { readonly status: 'refused'; readonly refusal: ServerResetRefusal };

/** The result of the reset: the Admin it was done for, or the refusal (nothing was written). A password that breaks the rule is not a result: it throws the 422 `PASSWORD_RULE`, as the web reset does. */
export type ServerResetResult =
  | { readonly status: 'reset'; readonly id: string; readonly name: string }
  | { readonly status: 'refused'; readonly refusal: ServerResetRefusal };

/** What the audit entry of the server command needs besides the Admin: the label that says it was a system action from a Windows account, and a fresh request ID. */
export interface ServerResetContext {
  readonly actorLabel: string;
  readonly requestId: string;
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
  /** The one active Admin for the server command to show, without locking anything, or why there is none (STORY-01.10 AC-2). */
  findAdminForServerReset(): Promise<ServerResetAdmin>;
  /**
   * Sets a temporary password for the one active Admin, on the server (STORY-01.10 AC-3, AC-5, AC-6): the rule (FR-098, with the Admin's e-mail) before any hash, the hash before the transaction,
   * then one transaction. The password is never kept, logged, returned or put in an entry.
   */
  resetAdminPasswordOnServer(context: ServerResetContext, password: string): Promise<ServerResetResult>;
}

/** Who is there to reset: exactly one active Admin, or the reason it cannot be done. Deactivated Admin rows beside the active one do not matter. */
function judgeAdmins(rows: ReadonlyArray<AdminAccount>): { readonly admin: AdminAccount } | { readonly refusal: ServerResetRefusal } {
  if (rows.length === 0) return { refusal: 'NO_ADMIN' };
  const active = rows.filter((row) => row.isActive);
  if (active.length > 1) return { refusal: 'MULTIPLE_ADMINS' };
  const [admin] = active;
  return admin === undefined ? { refusal: 'ADMIN_INACTIVE' } : { admin };
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
      assertPasswordRule(password, { email, subject: 'other', field: 'password' });
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
          // The Admin role moves by a hand-over only (STORY-01.09 AC-7). The Admin cannot edit themself (above), so before the hand-over no edit could take the role away; now a request of the old Admin that waited for the
          // hand-over's row lock would run afterwards on the new Admin and leave the portal with none.
          if (isActiveAdmin(target) && !isActiveAdmin(after)) {
            throw new ConflictError(ADMIN_CANNOT_BE_REMOVED_MESSAGE, { code: ADMIN_CANNOT_BE_REMOVED_CODE });
          }
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
      assertPasswordRule(password, { email: asked.email, subject: 'other', field: 'password' });
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
      // And the block of the change-password form, so a person blocked there is not refused on "Set a new password", the only page open to them.
      await throttles.clear(passwordChangeThrottleKey(keySecret, asked.id));
      // And the step-up block (STORY-06.14 assumption A-1): the reset lifts every block that follows from a forgotten password.
      await throttles.clear(stepUpThrottleKey(keySecret, asked.id));
    },

    async findAdminForServerReset() {
      const judged = judgeAdmins(await users.listAdminAccounts());
      if ('refusal' in judged) return { status: 'refused', refusal: judged.refusal };
      return { status: 'ready', id: judged.admin.id, name: judged.admin.name, email: judged.admin.email };
    },

    async resetAdminPasswordOnServer({ actorLabel, requestId }, password) {
      const first = judgeAdmins(await users.listAdminAccounts());
      if ('refusal' in first) return { status: 'refused', refusal: first.refusal };
      assertPasswordRule(password, { email: first.admin.email, subject: 'other', field: 'password' });
      // Hashed before the transaction opens (PRF-03), so the row locks are not held while argon2id works.
      const passwordHash = await hasher.hash(password);
      return transactions.run(async (tx): Promise<ServerResetResult> => {
        // The Admin rows are locked in ID order and looked at again: the state may have changed since the first look (AC-2, AC-5).
        const locked = judgeAdmins(await users.listAdminAccounts(tx));
        if ('refusal' in locked) return { status: 'refused', refusal: locked.refusal };
        const { admin } = locked;
        const email = await users.setPassword(admin.id, passwordHash, tx);
        if (email === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
        // The three blocks of a forgotten password, cleared inside the transaction (the web reset clears them after its commit): all of it is one change, or none.
        await throttles.clear(accountThrottleKey(keySecret, email), tx);
        await throttles.clear(passwordChangeThrottleKey(keySecret, admin.id), tx);
        await throttles.clear(stepUpThrottleKey(keySecret, admin.id), tx);
        // The log has no system user: the Admin is the actor the row can name, and the label says what really acted (DL-381 (3)).
        await audit.record(tx, {
          event: 'user.password_reset',
          actorId: admin.id,
          actorLabel,
          requestId,
          object: { id: admin.id, label: admin.name },
          before: { mustChangePassword: admin.mustChangePassword },
          after: { mustChangePassword: true },
        });
        return { status: 'reset', id: admin.id, name: admin.name };
      });
    },
  };
}
