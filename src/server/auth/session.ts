import 'server-only';

import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { ForbiddenError, UnauthorizedError } from '../../lib/errors';
import { RETURN_PATH_HEADER, SIGN_IN_PATH, signInPathFor } from '../../lib/auth/return-path';
import { systemClock } from '../../lib/time';
import { getAuthOptions, getUserRepository } from '../composition';
import type { UserRole } from '../repositories/user-repository';

import { resolveSessionUser, type AuthenticatedUser } from './resolve-session-user';

export type { AuthenticatedUser } from './resolve-session-user';

/**
 * Who is making this request (ADR-009, architecture section 8). next-auth is used narrowly behind this file
 * (TD-02): nothing else imports `getServerSession`.
 *
 * The cookie says who signed in and when. It never says what they may do: the role and the active flag are read
 * from `users` on every request, so a deactivation or a role change is effective at the next request (AC-5), and a
 * session whose `session_version` no longer matches (sign-out raised it) or that is past 12 hours is refused.
 */

/** The current user, or null when signed out. Read once per request however many components ask. */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  // Who is signed in is known only at request time. Saying so first keeps every page that asks from being prerendered at
  // build time, where there are no settings (the build would fail on the missing environment, not render).
  await connection();
  const session = await getServerSession(getAuthOptions());
  const claims =
    session?.userId !== undefined && session.sessionVersion !== undefined && session.signedAt !== undefined
      ? { userId: session.userId, sessionVersion: session.sessionVersion, signedAt: session.signedAt }
      : null;
  return resolveSessionUser(claims, getUserRepository(), systemClock.now());
});

/** For route handlers and services: the current user, or an `UnauthorizedError` (401). */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (user === null) throw new UnauthorizedError();
  return user;
}

/**
 * For pages: the current user, or a redirect to the sign-in page that remembers where the person was going (AC-4 of
 * STORY-01.02). The address comes from the header `proxy.ts` sets on every request and goes through `signInPathFor`, so
 * only a same-origin path is kept; a request that carries none just goes to the sign-in page.
 */
export async function requireUserOrRedirect(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (user === null) redirect(signInPathFor((await headers()).get(RETURN_PATH_HEADER) ?? SIGN_IN_PATH));
  return user;
}

/** Refuses a role that is not listed with a `ForbiddenError` (403), before any lookup (CR-33). */
export function requireRole(user: AuthenticatedUser, ...allowed: ReadonlyArray<UserRole>): AuthenticatedUser {
  if (!allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}
