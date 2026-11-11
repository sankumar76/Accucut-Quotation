import type { UserAccount, UserRepository, UserRole } from '../repositories/user-repository';

import { hasSessionEnded, isWithinSession } from './session-token';

/**
 * Who a session cookie stands for (ADR-009, architecture section 8). The role and the active flag are never in the
 * cookie: they are read from `users` on every request, so a deactivation or a role change is effective at the next
 * request (STORY-01.01 AC-5), a session whose `session_version` no longer matches is ended, and a session is
 * 12 hours from sign-in (STORY-01.06). Kept apart from `session.ts` so it needs neither next-auth nor Next.js and can be tested
 * on its own.
 */

/** The signed-in person as a request sees them. No password hash, no token. */
export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly mustChangePassword: boolean;
}

export interface SessionClaims {
  readonly userId: string;
  readonly sessionVersion: number;
  readonly signedAt: number;
}

/**
 * What a request's session comes to:
 *   - `active`: a person who may use the portal now;
 *   - `ended`: a token that is 12 hours old or more. The words for it are "your session ended" (SCR-26), and no database read
 *     is made to say so;
 *   - `refused`: a token inside its 12 hours that the account no longer vouches for (no such user, deactivated, or a
 *     `session_version` that no longer matches). It is sent to sign in as before, because "sessions last 12 hours" would be untrue of it;
 *   - `unreadable`: no claims at all (no cookie, or one this server cannot read).
 */
export type SessionResolution =
  | { readonly status: 'active'; readonly user: AuthenticatedUser }
  | { readonly status: 'ended' | 'refused' | 'unreadable' };

const ENDED: SessionResolution = { status: 'ended' };
const REFUSED: SessionResolution = { status: 'refused' };
const UNREADABLE: SessionResolution = { status: 'unreadable' };

/**
 * The one place the 12 hours are checked for a request (STORY-01.06 AC-2; architecture A-23). Pure of next-auth, so tests call it
 * directly with a repository and a clock.
 */
export async function resolveSession(claims: SessionClaims | null, users: UserRepository, now: Date): Promise<SessionResolution> {
  if (claims === null) return UNREADABLE;
  if (hasSessionEnded(claims.signedAt, now)) return ENDED;
  // A sign-in time in the future is not a session either: it is refused, and not described as an ended one.
  if (!isWithinSession(claims.signedAt, now)) return REFUSED;
  const account: UserAccount | null = await users.findAccountById(claims.userId);
  if (account === null || !account.isActive || account.sessionVersion !== claims.sessionVersion) return REFUSED;
  return {
    status: 'active',
    user: { id: account.id, name: account.name, email: account.email, role: account.role, mustChangePassword: account.mustChangePassword },
  };
}

/**
 * The user for a set of claims, or null if the session must not be honoured: no such user, deactivated, a
 * `session_version` that no longer matches, or 12 hours or more from sign-in.
 */
export async function resolveSessionUser(claims: SessionClaims | null, users: UserRepository, now: Date): Promise<AuthenticatedUser | null> {
  const resolution = await resolveSession(claims, users, now);
  return resolution.status === 'active' ? resolution.user : null;
}
