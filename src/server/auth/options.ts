import type { NextAuthOptions } from 'next-auth';
import { encode } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';

import { isAppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { SIGN_IN_PATH } from '../../lib/auth/return-path';
import { MILLISECONDS_PER_SECOND, type Clock } from '../../lib/time';
import type { AuthService } from '../services/auth-service';

import { clientAddressFrom } from './client-address';
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS, sessionSecondsLeft, sessionTokenSchema } from './session-token';

/**
 * The next-auth configuration (ADR-009, TD-02): the credentials provider with a JWT session in an encrypted
 * cookie. next-auth is used narrowly. It carries the cookie and the CSRF token; the rules (who may sign in, how
 * often, what the token holds) are ours and live in `auth-service.ts` and here.
 *
 * Built by a function, not at import time, so a test can build it in production mode over plain http (AC-5) and
 * with a controlled clock.
 */

/** What `authorize` throws for a blocked key. next-auth passes the message to the client as `error`. */
export const LOCKED_ERROR_CODE = 'locked';
/** What `authorize` throws when the sign-in could not be checked (database down). The cause stays in the log. */
export const UNAVAILABLE_ERROR_CODE = 'unavailable';

/**
 * Input limits at the boundary. The password has no rule here: sign-in checks the hash, never the password rule
 * (architecture section 8). The generous upper bound only keeps a huge body away from the hash function.
 */
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1_024;

const credentialsSchema = z.object({
  email: z.string().min(1).max(MAX_EMAIL_LENGTH),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

declare module 'next-auth' {
  interface User {
    /** The user's `session_version` at sign-in, copied into the token. */
    sessionVersion?: number;
  }
  interface Session {
    /** From the token, and nothing else: role and active flag are read from the database per request. */
    userId?: string;
    sessionVersion?: number;
    signedAt?: number;
  }
}

export interface AuthOptionsInput {
  readonly authService: AuthService;
  readonly clock: Clock;
  /** `AUTH_SECRET`. */
  readonly secret: string;
  /**
   * True in a production build: the cookie is `__Secure-` prefixed and Secure (AC-5). A test passes true over
   * plain http to inspect the options; the browser accepts Secure cookies from localhost.
   */
  readonly production: boolean;
}

async function safelyAuthenticate(
  authService: AuthService,
  attempt: Parameters<AuthService['authenticate']>[0],
): ReturnType<AuthService['authenticate']> {
  try {
    return await authService.authenticate(attempt);
  } catch (error) {
    // The cause may be a driver error with a host name in it. Log its kind only, and tell the client nothing
    // beyond "could not be checked" (STD-19).
    logger.error(
      { errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined },
      'Sign-in could not be checked.',
    );
    throw new Error(UNAVAILABLE_ERROR_CODE);
  }
}

export function buildAuthOptions({ authService, clock, secret, production }: AuthOptionsInput): NextAuthOptions {
  return {
    secret,
    useSecureCookies: production,
    // The token lives 12 hours and the cookie a stated number of days longer, so a person coming back is told the session ended
    // (`session-token.ts`). next-auth uses `session.maxAge` for the cookie and passes it to `encode` as the token's lifetime;
    // `encode` below replaces that lifetime with the time that is left.
    session: { strategy: 'jwt', maxAge: SESSION_COOKIE_MAX_AGE_SECONDS },
    jwt: {
      maxAge: SESSION_MAX_AGE_SECONDS,
      // next-auth writes the token again whenever the session route is called, with a fresh lifetime from that moment. Here it is
      // always 12 hours after the sign-in time held in the token, so calling that route, by a script or by an open tab, cannot push
      // the token's expiry out (STORY-01.06 AC-2). The server's own check (`resolve-session-user.ts`) does not depend on this.
      encode: ({ token, secret, salt }) => {
        const parsed = sessionTokenSchema.safeParse(token);
        const maxAge = parsed.success ? sessionSecondsLeft(parsed.data.signedAt, clock.now()) : SESSION_MAX_AGE_SECONDS;
        return encode({ ...(token === undefined ? {} : { token }), secret, ...(salt === undefined ? {} : { salt }), maxAge });
      },
    },
    // Failures come back to the sign-in page as a code in the address; the page shows the notice.
    pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
    providers: [
      CredentialsProvider({
        name: 'E-mail and password',
        credentials: { email: { label: 'E-mail', type: 'email' }, password: { label: 'Password', type: 'password' } },
        async authorize(credentials, request) {
          const input = credentialsSchema.safeParse(credentials);
          if (!input.success) return null;
          const result = await safelyAuthenticate(authService, {
            email: input.data.email,
            password: input.data.password,
            ipAddress: clientAddressFrom(request.headers),
          });
          if (result.status === 'signed-in') return { id: result.userId, sessionVersion: result.sessionVersion };
          if (result.reason === 'locked') throw new Error(LOCKED_ERROR_CODE);
          return null;
        },
      }),
    ],
    callbacks: {
      // Runs at sign-in with `user`, and on later requests with the token only. At sign-in the token is built
      // afresh from three values, so nothing else (name, e-mail, picture) is ever copied into the cookie.
      jwt({ token, user }) {
        if (user === undefined) return token;
        return {
          sub: user.id,
          sv: user.sessionVersion ?? 0,
          signedAt: Math.floor(clock.now().getTime() / MILLISECONDS_PER_SECOND),
        };
      },
      session({ session, token }) {
        const parsed = sessionTokenSchema.safeParse(token);
        if (!parsed.success) return { expires: session.expires };
        return {
          expires: session.expires,
          userId: parsed.data.sub,
          sessionVersion: parsed.data.sv,
          signedAt: parsed.data.signedAt,
        };
      },
    },
    events: {
      // Sign-out ends every session of the person, not just this cookie, because a JWT cannot be taken back
      // by deleting it at the server (ADR-009; the architect's sign-out and session_version design).
      async signOut({ token }) {
        const parsed = sessionTokenSchema.safeParse(token);
        if (!parsed.success) return;
        try {
          // Only the version this token carries: an out-of-date token cannot end the person's current session (ADR-009 amendment 1).
          await authService.endAllSessions(parsed.data.sub, parsed.data.sv);
        } catch (error) {
          logger.error(
            { errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined },
            'Sessions could not be ended at sign-out.',
          );
        }
      },
    },
  };
}
