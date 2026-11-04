import { z } from 'zod';

import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_SECOND } from '../../lib/time';

/**
 * What the session cookie holds and how long it lives (STORY-01.01 AC-5, ADR-009).
 *
 * The token carries only three things: the user ID (`sub`), the user's `session_version` when they signed in
 * (`sv`) and the sign-in time (`signedAt`, seconds). The role and the active flag are never in it; they are read
 * from `users` on every request, so a deactivation or a role change takes effect at the next request.
 */

/** A session lasts 12 hours from sign-in (FR-099, D-19, ASSUMPTION-56). Activity does not extend it. */
export const SESSION_HOURS = 12;
export const SESSION_MAX_AGE_SECONDS = (SESSION_HOURS * MILLISECONDS_PER_HOUR) / MILLISECONDS_PER_SECOND;

export const sessionTokenSchema = z.object({
  sub: z.string().min(1),
  sv: z.number().int().nonnegative(),
  signedAt: z.number().int().positive(),
});

export type SessionToken = z.infer<typeof sessionTokenSchema>;

/** True while `signedAt` (seconds) is less than 12 hours before `now`. Judged from the sign-in time, not from the last request. */
export function isWithinSession(signedAt: number, now: Date): boolean {
  const ageSeconds = now.getTime() / MILLISECONDS_PER_SECOND - signedAt;
  return ageSeconds >= 0 && ageSeconds < SESSION_MAX_AGE_SECONDS;
}
