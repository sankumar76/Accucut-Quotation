import {
  RESET_LINK_INVALID_CODE,
  RESET_LINK_INVALID_MESSAGE,
  RESET_LINK_LIFETIME_MINUTES,
  RESET_PASSWORD_PATH,
  RESET_REQUEST_LIMIT,
  RESET_REQUEST_WINDOW_MINUTES,
  RESET_TOKEN_PARAMETER,
  TOO_MANY_RESET_REQUESTS_MESSAGE,
} from '../../lib/auth/password-reset';
import { ResetLinkInvalidError, TooManyAttemptsError } from '../../lib/errors';
import { idempotencyKeys } from '../../lib/mail/events';
import { MILLISECONDS_PER_MINUTE, type Clock } from '../../lib/time';
import type { PasswordHasher } from '../auth/password-hasher';
import { generateResetToken, hashResetToken, isWellFormedResetToken, type NewResetToken } from '../auth/reset-token';
import { accountThrottleKey, passwordChangeThrottleKey, resetAddressThrottleKey, resetRequestThrottleKey, stepUpThrottleKey } from '../auth/throttle-key';
import type { MailService } from '../mail/mail-service';
import { renderPasswordReset } from '../mail/templates/password-reset';
import type { PasswordResetRepository } from '../repositories/password-reset-repository';
import type { AttemptPolicy, ReservedAttempt, ThrottleRepository } from '../repositories/throttle-repository';
import type { TransactionRunner } from '../repositories/transaction';
import { normaliseEmail, type UserRepository } from '../repositories/user-repository';

import { assertPasswordRule } from './password-policy';

/**
 * Reset a password by an e-mailed link (STORY-09.07; FR-003, FR-098, FR-001; architecture sections 4.7, 6 and 8). Two public steps, and neither tells a stranger anything:
 *
 * **`requestReset`** (AC-1 to AC-4). The answer is the same whoever is asked about, so the route always says 202 with one message. What happens behind it:
 *   1. the request is counted before anything is looked up, on the client address and on the typed e-mail (known or not, so a 429 reveals nothing), each key its own kind so a flood of
 *      requests can never block sign-in or the change form;
 *   2. with `FEATURE_EMAIL` off nothing is made at all (decision D-1): no token and no row, for every address, so nothing waits for a worker that is not running;
 *   3. otherwise the work has one shape whether or not the e-mail belongs to an active person: one lookup, one token, one rendered message, and one transaction of two statements. For a
 *      real person the two statements write the token and the outbox row (the To is the person's ID, never an address: NFR-028, DL-262); for anyone else they are two reads. A person who
 *      was deactivated, or never existed, gets no token and no mail.
 *
 * **`resetPassword`** (AC-5 to AC-8). The order is: shape of the token, a read that finds the link and its person's e-mail (nothing claimed), the password rule (so a rule that fails
 * names the part and leaves the link usable, AC-8), then the hash, which is made before any lock is taken (PRF-03), and last ONE transaction that claims the token (a single UPDATE: it works once, AC-6), sets the
 * password of the person THE CLAIM NAMED (never one read earlier), clears the must-change flag, raises `session_version` (every session ends) and marks the person's other links used. If the
 * claim finds nothing, or the person is no longer active, nothing is changed and the answer is the one 400 for a link that does not work (AC-7). The blocks that follow from a forgotten
 * password are lifted after the commit, as the Admin's reset lifts them (FR-004).
 *
 * The token and the password are never logged, returned or put in an error. No audit entry is written (decision A-2): the record is the token row, the outbox row and the raised session version.
 */

const WINDOW_MILLISECONDS = RESET_REQUEST_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE;

/** The same policy for both keys (AC-4): the 5th request in the window blocks, and the window is also the length of the block, so the 6th is refused until it has ended. */
const REQUEST_POLICY: AttemptPolicy = { limit: RESET_REQUEST_LIMIT, windowMilliseconds: WINDOW_MILLISECONDS, blockMilliseconds: WINDOW_MILLISECONDS };

/** The name the message of a request for an address nobody has is rendered with, so that message costs the same work as a real one. It is never stored or sent. */
const PLACEHOLDER_NAME = 'portal user';

export interface ResetRequest {
  readonly email: string;
  /** The client address as the proxy reported it, or null when none was reported. */
  readonly ipAddress: string | null;
}

export interface ResetOutcome {
  /** The person whose password was set: for the one log line (a user ID, never an e-mail). */
  readonly userId: string;
}

export interface PasswordResetServiceDependencies {
  readonly resets: PasswordResetRepository;
  readonly users: Pick<UserRepository, 'setPasswordFromReset'>;
  readonly throttles: ThrottleRepository;
  readonly hasher: PasswordHasher;
  readonly transactions: TransactionRunner;
  readonly mail: Pick<MailService, 'enqueue'>;
  readonly clock: Clock;
  /** The key that makes the throttle hashes unguessable (`AUTH_SECRET`). */
  readonly keySecret: string;
  /** The validated `APP_ORIGIN` (scheme, host and port, no trailing slash), read when a link is built so nothing is loaded at import. */
  readonly appOrigin: () => string;
  /** Is `FEATURE_EMAIL` on right now? Asked each time, so a test can change it. */
  readonly emailEnabled: () => boolean;
  /** Makes a token. Replaced only by a test that needs to know it. */
  readonly newToken?: () => NewResetToken;
}

export interface PasswordResetService {
  /** Handles a request for a link. Resolves with nothing whoever is asked about; throws 429 `TOO_MANY_ATTEMPTS` when the address or the typed e-mail is over the limit. */
  requestReset(request: ResetRequest): Promise<void>;
  /** Can this link still be used? For the page only: it claims nothing and says nothing about why it cannot. */
  isLinkUsable(token: string): Promise<boolean>;
  /** Sets the new password with the link. Throws 400 `RESET_LINK_INVALID` or 422 `PASSWORD_RULE` (under `newPassword`). */
  resetPassword(input: { readonly token: string; readonly newPassword: string }): Promise<ResetOutcome>;
}

function invalidLink(): ResetLinkInvalidError {
  return new ResetLinkInvalidError(RESET_LINK_INVALID_MESSAGE, RESET_LINK_INVALID_CODE);
}

export function createPasswordResetService(dependencies: PasswordResetServiceDependencies): PasswordResetService {
  const { resets, users, throttles, hasher, transactions, mail, clock, keySecret, appOrigin, emailEnabled } = dependencies;
  const newToken = dependencies.newToken ?? generateResetToken;

  async function releaseAll(keys: ReadonlyArray<string>): Promise<void> {
    await Promise.allSettled(keys.map((key) => throttles.releaseAttempt(key)));
  }

  /** The work of one request that the switch lets through: the same steps for a real person and for anyone else. */
  async function issueOrSimulate(email: string, now: Date): Promise<void> {
    const requester = await resets.findRequester(email);
    const { token, tokenHash } = newToken();
    const expiresAt = new Date(now.getTime() + RESET_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE);
    const rendered = renderPasswordReset({
      name: requester?.name ?? PLACEHOLDER_NAME,
      resetLink: `${appOrigin()}${RESET_PASSWORD_PATH}?${RESET_TOKEN_PARAMETER}=${token}`,
    });
    await transactions.run(async (tx) => {
      if (requester === null) return resets.simulateIssue(tx);
      const tokenId = await resets.issue(tx, { userId: requester.id, tokenHash, expiresAt, now });
      await mail.enqueue(tx, {
        idempotencyKey: idempotencyKeys.passwordReset(tokenId),
        event: 'password-reset',
        toUserId: requester.id,
        ccUserIds: [],
        subject: rendered.subject,
        bodyHtml: rendered.html,
        bodyText: rendered.text,
        sendBefore: expiresAt,
      });
    });
  }

  /** The blocks a forgotten password causes, lifted once the new password is stored (the person is by now able to sign in). A failure here changes nothing the person can see: the block ends by itself. */
  async function liftBlocks(userId: string, email: string): Promise<void> {
    await Promise.allSettled([
      throttles.clear(accountThrottleKey(keySecret, email)),
      throttles.clear(passwordChangeThrottleKey(keySecret, userId)),
      throttles.clear(stepUpThrottleKey(keySecret, userId)),
    ]);
  }

  return {
    async requestReset({ email, ipAddress }) {
      const normalised = normaliseEmail(email);
      const now = clock.now();
      const addressKey = resetAddressThrottleKey(keySecret, ipAddress);
      const emailKey = resetRequestThrottleKey(keySecret, normalised);

      // The address first, so a flood from one address never touches any e-mail's count; the typed e-mail second, and if it is over the limit the address gets its place back.
      const address = await throttles.reserveAttempt(addressKey, REQUEST_POLICY, now);
      if (address.attempts > REQUEST_POLICY.limit) throw new TooManyAttemptsError(TOO_MANY_RESET_REQUESTS_MESSAGE);
      let typed: ReservedAttempt;
      try {
        typed = await throttles.reserveAttempt(emailKey, REQUEST_POLICY, now);
      } catch (error) {
        await releaseAll([addressKey]);
        throw error;
      }
      if (typed.attempts > REQUEST_POLICY.limit) {
        await releaseAll([addressKey]);
        throw new TooManyAttemptsError(TOO_MANY_RESET_REQUESTS_MESSAGE);
      }

      if (!emailEnabled()) return;
      try {
        await issueOrSimulate(normalised, now);
      } catch (error) {
        // A fault of ours never counts against anyone.
        await releaseAll([addressKey, emailKey]);
        throw error;
      }
    },

    async isLinkUsable(token) {
      return isWellFormedResetToken(token) && (await resets.findUsable(hashResetToken(token), clock.now())) !== null;
    },

    async resetPassword({ token, newPassword }) {
      if (!isWellFormedResetToken(token)) throw invalidLink();
      const tokenHash = hashResetToken(token);
      const link = await resets.findUsable(tokenHash, clock.now());
      if (link === null) throw invalidLink();
      // A password that breaks the rule names the failing part and leaves the link usable (AC-8). No hash is made for it.
      assertPasswordRule(newPassword, { email: link.email, subject: 'self', field: 'newPassword' });
      const passwordHash = await hasher.hash(newPassword);

      const userId = await transactions.run(async (tx) => {
        const now = clock.now();
        const claimed = await resets.claim(tx, tokenHash, now);
        if (claimed === null) throw invalidLink();
        // The person is the one the claim named, whoever was read before. If they were deactivated meanwhile nothing matches and the whole transaction, the claim too, is rolled back.
        if (!(await users.setPasswordFromReset(claimed, passwordHash, tx))) throw invalidLink();
        await resets.invalidateOthers(tx, claimed, now);
        return claimed;
      });
      await liftBlocks(userId, link.email);
      return { userId };
    },
  };
}
