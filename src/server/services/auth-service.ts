import { createHmac } from 'node:crypto';

import { MILLISECONDS_PER_MINUTE, type Clock } from '../../lib/time';
import type { PasswordHasher } from '../auth/password-hasher';
import type { AttemptPolicy, ReservedAttempt, ThrottleRepository } from '../repositories/throttle-repository';
import { normaliseEmail, type UserRepository } from '../repositories/user-repository';

/**
 * Sign-in rules (STORY-01.01 AC-2 and AC-3, ADR-009, architecture sections 6 and 8).
 *
 * One answer for every way a sign-in can fail: a wrong password, an e-mail nobody has, and a deactivated account
 * all give `invalid`, after the same work (a hash is always checked, a dummy one for an unknown e-mail). A second
 * answer, `locked`, appears when the account key or the address is blocked, and it appears for unknown e-mails
 * too, so it does not tell a real account from an invented one.
 *
 * **Attempts are counted before the password is checked** (G6 QLT-32). Each attempt first reserves its number on the
 * address and on the account key; the database returns the number from the same statement that adds it, so at most
 * `limit` attempts per key ever get as far as a password check, however many requests arrive at once. A refused
 * attempt checks nothing. A correct password clears the account's count and gives its reservation on the address back
 * (an office shares one address). A failed attempt keeps its reservation.
 *
 * This file holds the rules only. It knows no HTTP and no next-auth; the next-auth `authorize` callback
 * (`src/server/auth/options.ts`) calls `authenticate` and turns the answer into a response.
 */

/** NFR-003, PROPOSED values (owner: Santhosh). Change them here and nowhere else. */
export const THROTTLE_POLICY = {
  /** Consecutive failures for one account key before it is blocked. */
  accountFailureLimit: 5,
  /** Failures from one address within `ipWindowMilliseconds` before it is blocked. */
  ipFailureLimit: 30,
  ipWindowMilliseconds: 15 * MILLISECONDS_PER_MINUTE,
  /** How long a block lasts. The message promises "15 minutes". */
  blockMilliseconds: 15 * MILLISECONDS_PER_MINUTE,
} as const;

/** Shown to a person who types a wrong password; the same text for the three failures (AC-2). Held in the UI. */
export type SignInFailure = 'invalid' | 'locked';

export type SignInResult =
  | { readonly status: 'signed-in'; readonly userId: string; readonly sessionVersion: number }
  | { readonly status: 'refused'; readonly reason: SignInFailure };

export interface SignInAttempt {
  readonly email: string;
  readonly password: string;
  /** The client address as the proxy reported it, or null when none was reported. */
  readonly ipAddress: string | null;
}

export interface AuthServiceDependencies {
  readonly users: UserRepository;
  readonly throttles: ThrottleRepository;
  readonly hasher: PasswordHasher;
  readonly clock: Clock;
  /** The key that makes the throttle hashes unguessable (`AUTH_SECRET`). */
  readonly keySecret: string;
}

export interface AuthService {
  authenticate(attempt: SignInAttempt): Promise<SignInResult>;
  /**
   * Ends every session of the user (sign-out, ADR-009), by raising their `session_version` from `sessionVersion`, the
   * version the signing-out token carries. A token that is already out of date raises nothing. Returns true if it did.
   */
  endAllSessions(userId: string, sessionVersion: number): Promise<boolean>;
}

/** A password no one has, hashed once at the first unknown e-mail, so an unknown e-mail costs the same work. */
const DUMMY_PASSWORD = 'dummy-password-for-unknown-accounts';

/** Used when the proxy gave no address: all such attempts share one counter rather than none. */
const UNKNOWN_ADDRESS = 'unknown';

/** A keyed hash, so a leaked table does not reveal e-mails or addresses and cannot be rebuilt without the secret. */
function throttleKey(secret: string, kind: 'account' | 'ip', value: string): string {
  return createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}

const ACCOUNT_POLICY: AttemptPolicy = {
  limit: THROTTLE_POLICY.accountFailureLimit,
  windowMilliseconds: null,
  blockMilliseconds: THROTTLE_POLICY.blockMilliseconds,
};

const ADDRESS_POLICY: AttemptPolicy = {
  limit: THROTTLE_POLICY.ipFailureLimit,
  windowMilliseconds: THROTTLE_POLICY.ipWindowMilliseconds,
  blockMilliseconds: THROTTLE_POLICY.blockMilliseconds,
};

export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const { users, throttles, hasher, clock, keySecret } = dependencies;
  let dummyHash: Promise<string> | undefined;

  /**
   * The hash an unknown e-mail is checked against, made once. A failed attempt is forgotten, so the next call tries
   * again: a cached rejection would answer "unavailable" for unknown e-mails and "invalid" for known ones, which tells
   * an outsider which e-mails have accounts (G6 QLT-33).
   */
  function dummyPasswordHash(): Promise<string> {
    dummyHash ??= hasher.hash(DUMMY_PASSWORD).catch((error: unknown) => {
      dummyHash = undefined;
      throw error;
    });
    return dummyHash;
  }

  /** Checks the password for the e-mail, or a dummy hash for an unknown one, so the work does not tell the cases apart. */
  async function passwordIsRight(email: string, password: string): Promise<{ readonly userId: string; readonly sessionVersion: number } | null> {
    const credentials = await users.findCredentialsByEmail(email);
    const passwordHash = credentials?.passwordHash ?? (await dummyPasswordHash());
    const matches = await hasher.verify(passwordHash, password);
    return credentials !== null && credentials.isActive && matches
      ? { userId: credentials.id, sessionVersion: credentials.sessionVersion }
      : null;
  }

  /** Gives reservations back after a fault of ours, so a server problem never counts against a person. */
  async function releaseAll(keys: ReadonlyArray<string>): Promise<void> {
    await Promise.allSettled(keys.map((key) => throttles.releaseAttempt(key)));
  }

  return {
    async authenticate({ email, password, ipAddress }) {
      const normalisedEmail = normaliseEmail(email);
      const accountKey = throttleKey(keySecret, 'account', normalisedEmail);
      const ipKey = throttleKey(keySecret, 'ip', ipAddress ?? UNKNOWN_ADDRESS);
      const now = clock.now();

      // The address first: a flood from a blocked address then never touches any account's count, so it cannot lock a
      // person out from outside. The account second; if it is over, the address gets its reservation back.
      const address = await throttles.reserveAttempt(ipKey, ADDRESS_POLICY, now);
      if (address.attempts > ADDRESS_POLICY.limit) return { status: 'refused', reason: 'locked' };
      let account: ReservedAttempt;
      try {
        account = await throttles.reserveAttempt(accountKey, ACCOUNT_POLICY, now);
      } catch (error) {
        await releaseAll([ipKey]);
        throw error;
      }
      if (account.attempts > ACCOUNT_POLICY.limit) {
        await releaseAll([ipKey]);
        return { status: 'refused', reason: 'locked' };
      }

      let signedIn: Awaited<ReturnType<typeof passwordIsRight>>;
      try {
        signedIn = await passwordIsRight(normalisedEmail, password);
      } catch (error) {
        await releaseAll([ipKey, accountKey]);
        throw error;
      }
      if (signedIn === null) return { status: 'refused', reason: 'invalid' };

      // A correct password ends the run of failures on the account and gives back its place on the shared address.
      await Promise.all([throttles.clear(accountKey), throttles.releaseAttempt(ipKey)]);
      return { status: 'signed-in', ...signedIn };
    },

    endAllSessions(userId, sessionVersion) {
      return users.raiseSessionVersion(userId, sessionVersion);
    },
  };
}
