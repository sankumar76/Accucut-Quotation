import 'server-only';

import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { redirect, unauthorized } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { ForbiddenError, UnauthorizedError } from '../../lib/errors';
import { RETURN_PATH_HEADER, SIGN_IN_PATH, signInPathFor } from '../../lib/auth/return-path';
import { SESSION_COOKIE_HEADER, SESSION_COOKIE_PRESENT, SESSION_ENDED_CODE } from '../../lib/auth/session-ended';
import { systemClock } from '../../lib/time';
import { getAuthOptions, getUserRepository } from '../composition';
import type { UserRole } from '../repositories/user-repository';

import { resolveSession, type AuthenticatedUser } from './resolve-session-user';

export type { AuthenticatedUser } from './resolve-session-user';

/**
 * Who is making this request (ADR-009, architecture section 8). next-auth is used narrowly behind this file
 * (TD-02): nothing else imports `getServerSession`.
 *
 * The cookie says who signed in and when. It never says what they may do: the role and the active flag are read
 * from `users` on every request, so a deactivation or a role change is effective at the next request (AC-5), and a
 * session whose `session_version` no longer matches (sign-out raised it) or that is 12 hours from sign-in or older is refused.
 * The 12 hours are checked in one place, `resolveSession`, and they are counted from sign-in: activity does not extend them
 * (STORY-01.06).
 */

type SessionState = { readonly status: 'signed-in'; readonly user: AuthenticatedUser } | { readonly status: 'ended' | 'signed-out' };

const ENDED: SessionState = { status: 'ended' };
const SIGNED_OUT: SessionState = { status: 'signed-out' };

/** Did the browser send a session cookie? `proxy.ts` says so in a header it always sets itself. */
async function browserSentSessionCookie(): Promise<boolean> {
  return (await headers()).get(SESSION_COOKIE_HEADER) === SESSION_COOKIE_PRESENT;
}

/**
 * How the request stands, read once per request however many components ask. A session has **ended** when its token is
 * 12 hours old or more, or when the browser still sends the cookie but the server can no longer read a token in it (the token's
 * own expiry has passed, which `options.ts` sets to the same 12 hours). The words for that are "your session ended" (SCR-26).
 * A token still inside its 12 hours that the account no longer vouches for (deactivated, a version that does not match) is
 * not described that way: those people are sent to sign in, as before.
 */
const readSessionState = cache(async (): Promise<SessionState> => {
  // Who is signed in is known only at request time. Saying so first keeps every page that asks from being prerendered at
  // build time, where there are no settings (the build would fail on the missing environment, not render).
  await connection();
  const session = await getServerSession(getAuthOptions());
  const claims =
    session?.userId !== undefined && session.sessionVersion !== undefined
      ? {
          userId: session.userId,
          sessionVersion: session.sessionVersion,
          signedAt: session.signedAt ?? Math.floor(systemClock.now().getTime() / 1_000),
        }
      : null;
  const resolution = await resolveSession(claims, getUserRepository(), systemClock.now());
  if (resolution.status === 'active') return { status: 'signed-in', user: resolution.user };
  if (resolution.status === 'ended') return ENDED;
  if (resolution.status === 'unreadable' && (await browserSentSessionCookie())) return ENDED;
  return SIGNED_OUT;
});

/** The current user, or null when signed out. Read once per request however many components ask. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const state = await readSessionState();
  return state.status === 'signed-in' ? state.user : null;
}

/**
 * For route handlers and services: the current user, or an `UnauthorizedError` (401). When the session ended the error carries
 * the code `SESSION_ENDED`, which `withRoute` turns into the 401 problem body that makes the browser go to SCR-01 (AC-4).
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const state = await readSessionState();
  if (state.status === 'signed-in') return state.user;
  throw state.status === 'ended' ? new UnauthorizedError('Your session ended.', { code: SESSION_ENDED_CODE }) : new UnauthorizedError();
}

/**
 * For pages: the current user; SCR-26 "Session ended" when the session ended (`unauthorized()`, status 401, drawn by
 * `app/unauthorized.tsx`, AC-3); otherwise a redirect to the sign-in page that remembers where the person was going (AC-4 of
 * STORY-01.02). The address comes from the header `proxy.ts` sets on every request and goes through `signInPathFor`, so
 * only a same-origin path is kept; a request that carries none just goes to the sign-in page.
 */
export async function requireUserOrRedirect(): Promise<AuthenticatedUser> {
  const state = await readSessionState();
  if (state.status === 'signed-in') return state.user;
  if (state.status === 'ended') unauthorized();
  redirect(signInPathFor((await headers()).get(RETURN_PATH_HEADER) ?? SIGN_IN_PATH));
}

/** Refuses a role that is not listed with a `ForbiddenError` (403), before any lookup (CR-33). */
export function requireRole(user: AuthenticatedUser, ...allowed: ReadonlyArray<UserRole>): AuthenticatedUser {
  if (!allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}
