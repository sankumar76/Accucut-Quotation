import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * Storage of the sign-in attempt counters (`login_throttles`, architecture sections 5.1 and 6). The service decides
 * what a count means; this file makes the counting itself safe when requests arrive at once (G6 QLT-32).
 *
 * An attempt is **reserved before** its password is checked. `reserveAttempt` adds one to the key's count and returns
 * the new count from the same SQL statement, so two requests can never both be told "you are number 5": the database
 * hands out 1, 2, 3 ... in order, whatever the concurrency. The caller allows the attempt only if the number it got is
 * within the limit. The statement also starts a new count when a block has ended or a window has run out, and sets the
 * block when the limit is reached, so there is no read-then-write gap anywhere (this closes QLT-35's lost count).
 *
 * A key is already a hash (`auth-service.ts`), so the table never holds an e-mail or an address in clear.
 */

export interface AttemptPolicy {
  /** The attempt with this number is the last one allowed; the next one is refused. */
  readonly limit: number;
  /** For a per-address key: attempts count within a window this long, which restarts when it has run out. Null for a run of attempts that only a block's end or a success restarts. */
  readonly windowMilliseconds: number | null;
  /** How long the key is blocked once `limit` is reached. */
  readonly blockMilliseconds: number;
}

export interface ReservedAttempt {
  /** The number of this attempt in the current run or window: 1 for the first. Allowed when it is within the limit. */
  readonly attempts: number;
  /** The key is blocked until this instant, once the limit has been reached; null before. */
  readonly blockedUntil: Date | null;
}

export interface ThrottleRepository {
  /** Reserves the next attempt for the key in one atomic statement and returns its number. */
  reserveAttempt(keyHash: string, policy: AttemptPolicy, now: Date): Promise<ReservedAttempt>;
  /** Gives one reservation back (a correct password from a shared address, or an attempt that never got checked). Never below 0. */
  releaseAttempt(keyHash: string): Promise<void>;
  /** Forgets the key's attempts and block (a correct password). A key with nothing to forget is not written. */
  clear(keyHash: string): Promise<void>;
}

interface ReservedRow {
  readonly attempts: number;
  readonly blocked_until: Date | null;
}

/**
 * The reservation. `restart` is true when this attempt begins a new count:
 *   - a block has ended (its time is past), or
 *   - the key is not blocked and a windowed key's window has run out.
 * While a block is still in force nothing restarts, so a flood cannot shorten or extend it. The block is set by the
 * attempt that reaches the limit, from the clock passed in (a test controls it); `updated_at` follows the same clock.
 */
function reserveStatement(db: PrismaClient, keyHash: string, policy: AttemptPolicy, now: Date) {
  const windowed = policy.windowMilliseconds !== null;
  const windowMilliseconds = policy.windowMilliseconds ?? 0;
  return db.$queryRaw<ReservedRow[]>`
    INSERT INTO login_throttles AS t (key_hash, failures, window_started_at, blocked_until, updated_at)
    VALUES (${keyHash}, 1, ${now}::timestamptz, NULL, ${now}::timestamptz)
    ON CONFLICT (key_hash) DO UPDATE SET
      failures = CASE
        WHEN (t.blocked_until IS NOT NULL AND t.blocked_until <= ${now}::timestamptz)
          OR (t.blocked_until IS NULL AND ${windowed}::boolean
              AND t.window_started_at + ${windowMilliseconds}::double precision * interval '1 millisecond' <= ${now}::timestamptz)
        THEN 1 ELSE t.failures + 1 END,
      window_started_at = CASE
        WHEN (t.blocked_until IS NOT NULL AND t.blocked_until <= ${now}::timestamptz)
          OR (t.blocked_until IS NULL AND ${windowed}::boolean
              AND t.window_started_at + ${windowMilliseconds}::double precision * interval '1 millisecond' <= ${now}::timestamptz)
        THEN ${now}::timestamptz ELSE t.window_started_at END,
      blocked_until = CASE
        WHEN t.blocked_until IS NOT NULL AND t.blocked_until <= ${now}::timestamptz THEN NULL
        WHEN t.blocked_until IS NULL AND ${windowed}::boolean
             AND t.window_started_at + ${windowMilliseconds}::double precision * interval '1 millisecond' <= ${now}::timestamptz THEN NULL
        WHEN t.blocked_until IS NULL AND t.failures + 1 >= ${policy.limit}::integer
          THEN ${now}::timestamptz + ${policy.blockMilliseconds}::double precision * interval '1 millisecond'
        ELSE t.blocked_until END,
      updated_at = ${now}::timestamptz
    RETURNING failures AS attempts, blocked_until`;
}

export function createThrottleRepository(db: PrismaClient): ThrottleRepository {
  return {
    reserveAttempt(keyHash, policy, now) {
      return withDatabaseErrors(async () => {
        const [row] = await reserveStatement(db, keyHash, policy, now);
        if (row === undefined) throw new Error('The reservation returned no row.');
        return { attempts: row.attempts, blockedUntil: row.blocked_until };
      });
    },

    releaseAttempt(keyHash) {
      return withDatabaseErrors(async () => {
        await db.$executeRaw`UPDATE login_throttles SET failures = GREATEST(failures - 1, 0) WHERE key_hash = ${keyHash}`;
      });
    },

    clear(keyHash) {
      return withDatabaseErrors(async () => {
        await db.loginThrottle.updateMany({
          where: { keyHash, OR: [{ failures: { gt: 0 } }, { blockedUntil: { not: null } }] },
          data: { failures: 0, blockedUntil: null },
        });
      });
    },
  };
}
