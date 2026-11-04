import { createHmac } from 'node:crypto';

import { MILLISECONDS_PER_MINUTE, type Clock } from '../../lib/time';
import type { PasswordHasher } from '../auth/password-hasher';
import type { ThrottleRecord, ThrottleRepository } from '../repositories/throttle-repository';
import { normaliseEmail, type UserRepository } from '../repositories/user-repository';

/**
 * Sign-in rules (STORY-01.01 AC-2 and AC-3, ADR-009, architecture sections 6 and 8).
 *
 * One answer for every way a sign-in can fail: a wrong password, an e-mail nobody has, and a deactivated account
 * all give `invalid`, after the same work (a hash is always checked, a dummy one for an unknown e-mail). A second
 * answer, `locked`, appears when the account key or the address is blocked, and it appears for unknown e-mails
 * too, so it does not tell a real account from an invented one.
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
  /** Ends every session of the user (sign-out, ADR-009), by raising their `session_version`. */
  endAllSessions(userId: string): Promise<void>;
}

/** A password no one has, hashed once at the first unknown e-mail, so an unknown e-mail costs the same work. */
const DUMMY_PASSWORD = 'dummy-password-for-unknown-accounts';

/** Used when the proxy gave no address: all such attempts share one counter rather than none. */
const UNKNOWN_ADDRESS = 'unknown';

/** A keyed hash, so a leaked table does not reveal e-mails or addresses and cannot be rebuilt without the secret. */
function throttleKey(secret: string, kind: 'account' | 'ip', value: string): string {
  return createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}

function isBlocked(record: ThrottleRecord | null, now: Date): boolean {
  return record !== null && record.blockedUntil !== null && record.blockedUntil.getTime() > now.getTime();
}

/** A block that has ended. The next failure then starts a new count instead of re-blocking at once. */
function blockHasEnded(record: ThrottleRecord, now: Date): boolean {
  return record.blockedUntil !== null && record.blockedUntil.getTime() <= now.getTime();
}

function windowHasRunOut(record: ThrottleRecord, now: Date): boolean {
  return now.getTime() - record.windowStartedAt.getTime() >= THROTTLE_POLICY.ipWindowMilliseconds;
}

export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const { users, throttles, hasher, clock, keySecret } = dependencies;
  let dummyHash: Promise<string> | undefined;

  function dummyPasswordHash(): Promise<string> {
    dummyHash ??= hasher.hash(DUMMY_PASSWORD);
    return dummyHash;
  }

  /** Adds a failure to the key and blocks it when the limit is reached. `windowed` keys count within a window. */
  async function recordFailure(key: string, limit: number, windowed: boolean): Promise<void> {
    const now = clock.now();
    let record = await throttles.addFailure(key, now);
    if (blockHasEnded(record, now) || (windowed && windowHasRunOut(record, now))) {
      await throttles.restartWindow(key, now);
      record = { failures: 1, windowStartedAt: now, blockedUntil: null };
    }
    if (record.failures >= limit && !isBlocked(record, now)) {
      await throttles.block(key, new Date(now.getTime() + THROTTLE_POLICY.blockMilliseconds));
    }
  }

  return {
    async authenticate({ email, password, ipAddress }) {
      const normalisedEmail = normaliseEmail(email);
      const accountKey = throttleKey(keySecret, 'account', normalisedEmail);
      const ipKey = throttleKey(keySecret, 'ip', ipAddress ?? UNKNOWN_ADDRESS);

      const [accountRecord, ipRecord] = await Promise.all([throttles.find(accountKey), throttles.find(ipKey)]);
      const now = clock.now();
      // A blocked key is refused before the password is looked at, so a correct password during the block is
      // refused too (AC-3).
      if (isBlocked(accountRecord, now) || isBlocked(ipRecord, now)) return { status: 'refused', reason: 'locked' };

      const credentials = await users.findCredentialsByEmail(normalisedEmail);
      // The hash is always checked, a dummy one when there is no user, so the work does not tell the cases apart.
      const passwordHash = credentials?.passwordHash ?? (await dummyPasswordHash());
      const passwordMatches = await hasher.verify(passwordHash, password);

      if (credentials === null || !credentials.isActive || !passwordMatches) {
        await recordFailure(accountKey, THROTTLE_POLICY.accountFailureLimit, false);
        await recordFailure(ipKey, THROTTLE_POLICY.ipFailureLimit, true);
        return { status: 'refused', reason: 'invalid' };
      }

      // A correct password ends the run of failures. The per-IP count is a window, not a run, so it is left alone.
      await throttles.clear(accountKey);
      return { status: 'signed-in', userId: credentials.id, sessionVersion: credentials.sessionVersion };
    },

    endAllSessions(userId) {
      return users.raiseSessionVersion(userId);
    },
  };
}
