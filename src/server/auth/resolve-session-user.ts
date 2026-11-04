import type { UserAccount, UserRepository, UserRole } from '../repositories/user-repository';

import { isWithinSession } from './session-token';

/**
 * Who a session cookie stands for (ADR-009, architecture section 8). The role and the active flag are never in the
 * cookie: they are read from `users` on every request, so a deactivation or a role change is effective at the next
 * request (STORY-01.01 AC-5), a session whose `session_version` no longer matches is ended, and a session is
 * 12 hours from sign-in. Kept apart from `session.ts` so it needs neither next-auth nor Next.js and can be tested
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
 * The user for a set of claims, or null if the session must not be honoured: no such user, deactivated, a
 * `session_version` that no longer matches, or past 12 hours from sign-in. Pure of next-auth, so tests call it
 * directly with a repository and a clock.
 */
export async function resolveSessionUser(
  claims: SessionClaims | null,
  users: UserRepository,
  now: Date,
): Promise<AuthenticatedUser | null> {
  if (claims === null || !isWithinSession(claims.signedAt, now)) return null;
  const account: UserAccount | null = await users.findAccountById(claims.userId);
  if (account === null || !account.isActive || account.sessionVersion !== claims.sessionVersion) return null;
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    mustChangePassword: account.mustChangePassword,
  };
}
