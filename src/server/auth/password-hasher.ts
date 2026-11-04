import { hash, verify } from '@node-rs/argon2';

import { logger } from '../../lib/logger';

/**
 * Password hashing with argon2id (ADR-009, architecture section 8). It does not import `server-only`, because
 * `scripts/bootstrap-admin.ts` runs it under plain `npx tsx` (AC-7). The hash string carries its own salt and
 * parameters (PHC format), so a later change of cost still verifies the old hashes.
 *
 * The cost is meant to take about 250 ms on the host (architecture section 8). These numbers are the OWASP
 * argon2id guidance raised for a login-only workload: memory 64 MiB, 3 passes, 1 lane. They were timed on the
 * development machine only; the production host sets the final figure when it is known (follow-up recorded in the
 * story's Dev Record), by changing these two constants. Existing hashes keep working.
 */
export const ARGON2_COST = { memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;

export interface HashCost {
  readonly memoryCost: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

export interface PasswordHasher {
  /** An argon2id hash of the password, with a fresh random salt. */
  hash(password: string): Promise<string>;
  /**
   * True if `password` matches `passwordHash`. A hash that cannot be read gives false, never an error that
   * would tell the caller which part of a sign-in was wrong.
   */
  verify(passwordHash: string, password: string): Promise<boolean>;
}

/** A hasher with a given cost. Tests pass a small one so a suite does not spend seconds hashing. */
export function createPasswordHasher(cost: HashCost = ARGON2_COST): PasswordHasher {
  return {
    hash: (password) => hash(password, { ...cost }),
    async verify(passwordHash, password) {
      try {
        return await verify(passwordHash, password);
      } catch {
        // A stored hash that the library cannot parse is a data fault, not a wrong password. Say so in the log
        // (no hash, no password) and answer "no match", so the sign-in answer is the same as for any wrong password.
        logger.error('A stored password hash could not be read.');
        return false;
      }
    },
  };
}

/** The hasher the application uses. */
export const passwordHasher: PasswordHasher = createPasswordHasher();
