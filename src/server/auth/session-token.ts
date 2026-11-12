import { z } from 'zod';

import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_SECOND } from '../../lib/time';

/**
 * What the session cookie holds and how long it lives (STORY-01.01 AC-5, STORY-01.06, ADR-009).
 *
 * The token carries only three things: the user ID (`sub`), the user's `session_version` when they signed in
 * (`sv`) and the sign-in time (`signedAt`, seconds). The role and the active flag are never in it; they are read
 * from `users` on every request, so a deactivation or a role change takes effect at the next request.
 *
 * This file is where the 12 hours are decided: one constant and the checks over it. `resolve-session-user.ts` is the one
 * place that asks them of a request (`requireUser()` and `requireUserOrRedirect()` reach it through `session.ts`).
 */

/** A session lasts 12 hours from sign-in (FR-099, D-19, ASSUMPTION-56). Activity does not extend it. */
export const SESSION_HOURS = 12;
export const SESSION_MAX_AGE_SECONDS = (SESSION_HOURS * MILLISECONDS_PER_HOUR) / MILLISECONDS_PER_SECOND;

/**
 * How long the cookie stays in the browser after the token inside it has died. The token is refused after 12 hours whatever the
 * cookie says (below), so this adds no access. It lets a person who comes back to an open tab the next morning, or after the
 * weekend, be told that the session ended (SCR-26) instead of being sent to the sign-in page with no explanation: a browser
 * deletes an expired cookie, and a request with no cookie looks like a visit by someone who never signed in (STORY-01.06 AC-3).
 */
export const SESSION_ENDED_NOTICE_DAYS = 7;
export const SESSION_COOKIE_MAX_AGE_SECONDS =
  SESSION_MAX_AGE_SECONDS + (SESSION_ENDED_NOTICE_DAYS * MILLISECONDS_PER_DAY) / MILLISECONDS_PER_SECOND;

export const sessionTokenSchema = z.object({
  sub: z.string().min(1),
  sv: z.number().int().nonnegative(),
  signedAt: z.number().int().positive(),
});

export type SessionToken = z.infer<typeof sessionTokenSchema>;

function ageSeconds(signedAt: number, now: Date): number {
  return now.getTime() / MILLISECONDS_PER_SECOND - signedAt;
}

/** True while `signedAt` (seconds) is less than 12 hours before `now`. Judged from the sign-in time, not from the last request. */
export function isWithinSession(signedAt: number, now: Date): boolean {
  const age = ageSeconds(signedAt, now);
  return age >= 0 && age < SESSION_MAX_AGE_SECONDS;
}

/** True once 12 hours have passed since `signedAt`. A sign-in time in the future is not an ended session; it is not a session. */
export function hasSessionEnded(signedAt: number, now: Date): boolean {
  return ageSeconds(signedAt, now) >= SESSION_MAX_AGE_SECONDS;
}

/**
 * Whole seconds from `now` to 12 hours after `signedAt`, never below zero. The token's own expiry is set from it, so a token that
 * is written again later in the session still dies at the same instant: activity does not push it out (STORY-01.06 AC-2).
 */
export function sessionSecondsLeft(signedAt: number, now: Date): number {
  return Math.max(0, signedAt + SESSION_MAX_AGE_SECONDS - Math.floor(now.getTime() / MILLISECONDS_PER_SECOND));
}
