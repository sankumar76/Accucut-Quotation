import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * Storage of the failed sign-in counters (`login_throttles`, architecture sections 5.1 and 6). The rules
 * (how many failures, how long a block lasts) belong to the auth service; this only reads and writes rows.
 *
 * A key is already a hash (`auth-service.ts`), so the table never holds an e-mail or an address in clear.
 */

export interface ThrottleRecord {
  readonly failures: number;
  /** Start of the window the per-IP rule counts in. The per-account rule ignores it. */
  readonly windowStartedAt: Date;
  /** The key is refused until this instant; null or in the past means not blocked. */
  readonly blockedUntil: Date | null;
}

export interface ThrottleRepository {
  find(keyHash: string): Promise<ThrottleRecord | null>;
  /**
   * Adds one failure in a single statement (so two failures at once both count) and returns the row after it.
   * A key with no row gets one, with its window starting at `now`.
   */
  addFailure(keyHash: string, now: Date): Promise<ThrottleRecord>;
  /** Starts a new window for the key with one failure in it (the old window has run out). */
  restartWindow(keyHash: string, now: Date): Promise<void>;
  /** Refuses the key until `until`. */
  block(keyHash: string, until: Date): Promise<void>;
  /** Forgets the failures of the key (a correct password). A key with no row is left alone. */
  clear(keyHash: string): Promise<void>;
}

const RECORD = { failures: true, windowStartedAt: true, blockedUntil: true } as const;

export function createThrottleRepository(db: PrismaClient): ThrottleRepository {
  return {
    find(keyHash) {
      return withDatabaseErrors(() => db.loginThrottle.findUnique({ where: { keyHash }, select: RECORD }));
    },

    addFailure(keyHash, now) {
      // One upsert: with a unique key and a plain increment Prisma sends INSERT ... ON CONFLICT DO UPDATE, so two
      // failures in the same instant cannot overwrite each other's count.
      return withDatabaseErrors(() =>
        db.loginThrottle.upsert({
          where: { keyHash },
          create: { keyHash, failures: 1, windowStartedAt: now },
          update: { failures: { increment: 1 } },
          select: RECORD,
        }),
      );
    },

    restartWindow(keyHash, now) {
      return withDatabaseErrors(async () => {
        await db.loginThrottle.update({
          where: { keyHash },
          data: { failures: 1, windowStartedAt: now, blockedUntil: null },
        });
      });
    },

    block(keyHash, until) {
      return withDatabaseErrors(async () => {
        await db.loginThrottle.update({ where: { keyHash }, data: { blockedUntil: until } });
      });
    },

    clear(keyHash) {
      return withDatabaseErrors(async () => {
        await db.loginThrottle.updateMany({ where: { keyHash }, data: { failures: 0, blockedUntil: null } });
      });
    },
  };
}
