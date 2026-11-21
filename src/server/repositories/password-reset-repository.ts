import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the reset links (`password_reset_tokens`, STORY-09.07; architecture sections 5.1, 6 and 8). It holds the SHA-256 of a token, never the token. The statements that decide
 * whether a link still works are raw SQL here and nowhere else, as tagged templates, and every row that comes back is parsed (coding standards section 10, "SQL"):
 *
 *   `claim`              the single use. ONE statement: it marks the row used only while `used_at IS NULL`, `expires_at` is still ahead and the person is active, and returns the person.
 *                        Two requests with the same token at once: the second waits for the first's row lock, finds `used_at` set and matches nothing, so exactly one of them gets the person.
 *   `invalidateOthers`   marks the person's other unused links used, in the same transaction as the claim, so an older link cannot be used after a newer one.
 *   `findUsable`         a read, for the page and for the password rule (which needs the person's e-mail): nothing is claimed and nothing is changed.
 *   `issue`, `simulateIssue`   the write of a new link in the caller's transaction, and the same number of statements for an address nobody has (no enumeration by timing).
 *
 * A row is never deleted. `created_at` and `used_at` are the record that a reset by link happened (decision A-2: no audit entry).
 */

/** The person a link was made for, as a request for one needs them: the ID and the name the message greets. Active people only. */
export interface ResetRequester {
  readonly id: string;
  readonly name: string;
}

/** A link that can still be used, and whose e-mail address the new password must not equal. */
export interface UsableLink {
  readonly userId: string;
  readonly email: string;
}

export interface NewResetLink {
  readonly userId: string;
  /** The SHA-256 of the token as 64 lower-case hex digits. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly now: Date;
}

export interface PasswordResetRepository {
  /** The active person with this e-mail address (already in the form the database stores), or null for no one, or someone deactivated. */
  findRequester(email: string): Promise<ResetRequester | null>;
  /** Writes a new link in `tx` and returns its ID (the outbox key is made from it). */
  issue(tx: Transaction, link: NewResetLink): Promise<string>;
  /** The statements of a request for an address nobody has: two reads in `tx`, so the round trips match `issue` and the outbox insert. Writes nothing. */
  simulateIssue(tx: Transaction): Promise<void>;
  /** The link with this hash if it is unused, not expired and the person is active; null otherwise. Changes nothing. */
  findUsable(tokenHash: string, now: Date): Promise<UsableLink | null>;
  /** Claims the link in `tx`: its person, or null when it is used, expired, unknown or the person is not active. */
  claim(tx: Transaction, tokenHash: string, now: Date): Promise<string | null>;
  /** Marks the person's other unused links used, in `tx`. Returns how many it marked. */
  invalidateOthers(tx: Transaction, userId: string, now: Date): Promise<number>;
}

const claimedRowSchema = z.array(z.object({ user_id: z.string() }));

export function createPasswordResetRepository(db: PrismaClient): PasswordResetRepository {
  return {
    findRequester(email) {
      return withDatabaseErrors(() => db.user.findFirst({ where: { email, isActive: true }, select: { id: true, name: true } }));
    },

    issue(tx, { userId, tokenHash, expiresAt, now }) {
      return withDatabaseErrors(async () => {
        const created = await clientFor(db, tx).passwordResetToken.create({ data: { userId, tokenHash, expiresAt, createdAt: now }, select: { id: true } });
        return created.id;
      });
    },

    simulateIssue(tx) {
      return withDatabaseErrors(async () => {
        const client = clientFor(db, tx);
        await client.$queryRaw`SELECT 1 AS decoy`;
        await client.$queryRaw`SELECT 1 AS decoy`;
      });
    },

    findUsable(tokenHash, now) {
      return withDatabaseErrors(async () => {
        const link = await db.passwordResetToken.findFirst({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now }, user: { isActive: true } },
          select: { userId: true, user: { select: { email: true } } },
        });
        return link === null ? null : { userId: link.userId, email: link.user.email };
      });
    },

    claim(tx, tokenHash, now) {
      return withDatabaseErrors(async () => {
        const rows = await clientFor(db, tx).$queryRaw`
          UPDATE password_reset_tokens AS t SET used_at = ${now}::timestamptz
          FROM users AS u
          WHERE t.token_hash = ${tokenHash} AND t.used_at IS NULL AND t.expires_at > ${now}::timestamptz AND u.id = t.user_id AND u.is_active
          RETURNING t.user_id::text AS user_id`;
        return claimedRowSchema.parse(rows)[0]?.user_id ?? null;
      });
    },

    invalidateOthers(tx, userId, now) {
      return withDatabaseErrors(() =>
        clientFor(db, tx).$executeRaw`UPDATE password_reset_tokens SET used_at = ${now}::timestamptz WHERE user_id = ${userId}::uuid AND used_at IS NULL`,
      );
    },
  };
}
