import { MILLISECONDS_PER_MINUTE } from '../time';

/**
 * The retry policy of the outbox (STORY-09.06 AC-1; ADR-011; architecture section 4.7): pure, so the job, the repository's claim and the tests all read one rule.
 *
 * A send that fails is tried again 1, 5 and then 15 minutes after the failure. "Up to 3 retries" is the first send plus 3 retries, 4 attempts in all; the 4th failure is final.
 */

/** The wait before retry 1, 2 and 3: 1, 5 and 15 minutes after the failure that causes it. */
export const RETRY_BACKOFF_MINUTES = [1, 5, 15] as const;

/** The first send and the retries: 4. The store's claim uses the same number to give up on a row that has no attempt left. */
export const MAX_SEND_ATTEMPTS = RETRY_BACKOFF_MINUTES.length + 1;

/**
 * When the next attempt is due after attempt number `attempts` (counting from 1) has failed at `now`, or `null` when the row has no attempt left and is final.
 * 1st failure: +1 minute; 2nd: +5; 3rd: +15; 4th: `null`.
 */
export function nextAttempt(attempts: number, now: Date): Date | null {
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('An attempt number is a whole number from 1.');
  const minutes = RETRY_BACKOFF_MINUTES[attempts - 1];
  return minutes === undefined ? null : new Date(now.getTime() + minutes * MILLISECONDS_PER_MINUTE);
}
