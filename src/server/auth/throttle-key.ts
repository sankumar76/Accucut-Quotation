import { createHmac } from 'node:crypto';

import { normaliseEmail } from '../repositories/user-repository';

/**
 * The keys of `login_throttles` (architecture section 6, "How the sign-in throttle behaves"). A key is a keyed hash, so a
 * leaked table does not reveal e-mails or addresses and cannot be rebuilt without the secret (`AUTH_SECRET`). They are made
 * here, once, because two places must agree on the account key: the sign-in check, which counts attempts on it, and the
 * Admin's password reset (STORY-01.04 AC-5), which clears the block on it.
 */

export type ThrottleKind = 'account' | 'ip';

export function throttleKey(secret: string, kind: ThrottleKind, value: string): string {
  return createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}

/** The account key of an e-mail address, spelled as the database stores it (lower case, no surrounding spaces). */
export function accountThrottleKey(secret: string, email: string): string {
  return throttleKey(secret, 'account', normaliseEmail(email));
}
