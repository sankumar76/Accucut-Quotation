import { createHash, randomBytes } from 'node:crypto';

/**
 * The token of a reset link (STORY-09.07 AC-2, AC-9; architecture section 8). 32 bytes from the operating system's random source (`crypto.randomBytes`), written as 43 characters of
 * base64url, so it is safe in a link. Only its SHA-256 is stored (`password_reset_tokens.token_hash`): a copy of the table cannot be turned into a working link, and because the token has
 * 256 bits of entropy a plain fast hash is enough (a slow one is for passwords people choose). The raw token exists in the e-mail and the link and nowhere else; no log line, row or
 * answer holds it.
 *
 * No secret is compared here. The claim finds its row by the hash in the database (`WHERE token_hash = $1` on a unique index): a caller cannot choose a hash, because that would need a
 * token that hashes to it, so how long a lookup takes tells nothing about a token that was not issued.
 */

export const RESET_TOKEN_BYTES = 32;

/** 32 bytes as base64url without padding: always 43 characters of the URL-safe alphabet. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export interface NewResetToken {
  /** The raw token, for the e-mail only. */
  readonly token: string;
  /** Its SHA-256 as 64 lower-case hex digits, the only thing stored. */
  readonly tokenHash: string;
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Could this text be a token this server issued? A cheap check on the shape, so a request with anything else never reaches the database. */
export function isWellFormedResetToken(value: string): boolean {
  return TOKEN_FORMAT.test(value);
}

export function generateResetToken(): NewResetToken {
  const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}
