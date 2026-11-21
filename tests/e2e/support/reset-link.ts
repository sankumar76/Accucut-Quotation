import { createHash, randomBytes } from 'node:crypto';

import { connectToTestDatabase } from './auth';

/**
 * A reset link made directly in the database the servers use, for the E2E of the reset by e-mailed link (STORY-09.07). The servers run with `FEATURE_EMAIL` off and no worker, so no e-mail is
 * ever sent here (that path is the integration test's, against Mailpit); this makes what an e-mail would have carried. The token is 32 random bytes in base64url and only its SHA-256 is stored,
 * exactly as the server does (`src/server/auth/reset-token.ts`: a Playwright process cannot load server code). The URL is judged by the same guard as every test run. Repeatable: every call makes a
 * new token. Every person is invented.
 */

const HOUR_MINUTES = 60;

export interface ResetLinkOptions {
  /** Minutes until the link stops working. Negative: it has already expired. Default one hour, as the server makes it. */
  readonly expiresInMinutes?: number;
}

/** The raw token of a new link for the person, as the person's mailbox would show it. */
export async function insertResetToken(userId: string, { expiresInMinutes = HOUR_MINUTES }: ResetLinkOptions = {}): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  const client = await connectToTestDatabase();
  try {
    await client.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, now() + $3 * interval '1 minute')", [hash, userId, expiresInMinutes]);
    return token;
  } finally {
    await client.end();
  }
}

/** How many links the person has, used or not: a request that must make none checks it. */
export async function countResetTokens(userId: string): Promise<number> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM password_reset_tokens WHERE user_id = $1::uuid', [userId]);
    return Number(rows[0]?.count ?? '0');
  } finally {
    await client.end();
  }
}
