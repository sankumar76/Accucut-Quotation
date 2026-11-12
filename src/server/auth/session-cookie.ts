import { encode } from 'next-auth/jwt';

import { MILLISECONDS_PER_SECOND, type Clock } from '../../lib/time';
import type { ResponseCookie } from '../http/set-cookie';

import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS, type SessionToken } from './session-token';

/**
 * A fresh session cookie for a person who is already signed in (STORY-01.05 AC-3). After a password change `session_version` is raised,
 * which refuses every token issued before, so the browser that made the change is given a new token at the new version and stays signed in.
 *
 * Why not next-auth's session `update` (assumption A-3 of the story): `update` is a client call that makes the server rewrite the token
 * from what the client sends, and this app's `jwt` callback rebuilds a token only at sign-in, from three server-held values. Letting a
 * client-supplied value reach the token would widen what the cookie can be made to say; issuing the cookie from the route that has just
 * changed the password does not. The token is the same three claims as at sign-in (`sub`, `sv`, `signedAt`), sealed with the same secret by
 * the same `encode`, with the same 12 hours counted from this moment: proving the current password is a fresh sign-in, as far as the
 * session is concerned. The cookie has next-auth's name and attributes, so `getServerSession` reads it as any other.
 */

export interface SessionCookieIssuer {
  issue(userId: string, sessionVersion: number): Promise<ResponseCookie>;
}

export interface SessionCookieIssuerInput {
  /** `AUTH_SECRET`. */
  readonly secret: string;
  readonly clock: Clock;
  /** True in a production build: the cookie is `__Secure-` prefixed and Secure, as `buildAuthOptions` makes it. */
  readonly production: boolean;
}

/** The name next-auth gives the session cookie. */
export function sessionCookieName(production: boolean): string {
  return `${production ? '__Secure-' : ''}next-auth.session-token`;
}

export function createSessionCookieIssuer({ secret, clock, production }: SessionCookieIssuerInput): SessionCookieIssuer {
  return {
    async issue(userId, sessionVersion) {
      const token: SessionToken = { sub: userId, sv: sessionVersion, signedAt: Math.floor(clock.now().getTime() / MILLISECONDS_PER_SECOND) };
      const value = await encode({ token, secret, maxAge: SESSION_MAX_AGE_SECONDS });
      return { name: sessionCookieName(production), value, maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS, secure: production };
    },
  };
}
