import { decode } from 'next-auth/jwt';
import { describe, expect, it } from 'vitest';

import { createSessionCookieIssuer, sessionCookieName } from '@/server/auth/session-cookie';
import { SESSION_COOKIE_MAX_AGE_SECONDS, sessionTokenSchema } from '@/server/auth/session-token';

/**
 * STORY-01.05 AC-3: after a password change the browser is given a fresh session at the new `session_version`. The token holds the same
 * three claims as at sign-in and nothing else, it is sealed with the portal's secret, and the cookie has next-auth's name, so
 * `getServerSession` reads it like any other. Every value here is invented.
 */

const SECRET = 'invented-session-secret-for-this-test-0123456789';
const NOW = new Date('2026-11-12T10:00:00.000Z');
const SIGNED_AT = Math.floor(NOW.getTime() / 1000);
const USER_ID = '00000000-0000-4000-8000-00000000aaaa';

describe('sessionCookieName', () => {
  it('is next-auth\'s name, with the __Secure- prefix only for a production (Secure) cookie', () => {
    expect(sessionCookieName(false)).toBe('next-auth.session-token');
    expect(sessionCookieName(true)).toBe('__Secure-next-auth.session-token');
  });
});

describe('createSessionCookieIssuer', () => {
  const issuer = createSessionCookieIssuer({ secret: SECRET, clock: { now: () => NOW }, production: false });

  it('seals sub, sv and signedAt (the time of the change), and nothing else a client could vary', async () => {
    const cookie = await issuer.issue(USER_ID, 4);
    const token = await decode({ token: cookie.value, secret: SECRET });
    expect(sessionTokenSchema.parse(token)).toEqual({ sub: USER_ID, sv: 4, signedAt: SIGNED_AT });
    // next-auth adds only its own claims (issued-at, expiry, id); no name, e-mail or role is ever put in the cookie.
    expect(Object.keys(token ?? {}).sort()).toEqual(['exp', 'iat', 'jti', 'signedAt', 'sub', 'sv']);
  });

  it('gives the cookie next-auth\'s name and attributes and the lifetime of the sign-in cookie', async () => {
    const cookie = await issuer.issue(USER_ID, 1);
    expect(cookie).toMatchObject({ name: 'next-auth.session-token', maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS, secure: false });
  });

  it('is Secure and prefixed in production', async () => {
    const production = createSessionCookieIssuer({ secret: SECRET, clock: { now: () => NOW }, production: true });
    expect(await production.issue(USER_ID, 1)).toMatchObject({ name: '__Secure-next-auth.session-token', secure: true });
  });

  it('is not readable with another secret', async () => {
    const cookie = await issuer.issue(USER_ID, 1);
    await expect(decode({ token: cookie.value, secret: `${SECRET}-other` })).rejects.toThrow();
  });
});
