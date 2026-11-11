import { randomUUID } from 'node:crypto';

import type { BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_SECOND } from '../../../src/lib/time';

import { E2E_AUTH_SECRET, PRODUCTION_URL } from './servers';

/**
 * A session cookie of a chosen age for the production server, so a spec can show what a person sees when their 12 hours are over
 * without waiting for them (STORY-01.06). The token is written the way the portal writes it (`encrypted JWT`, the user ID, the
 * `session_version` and the sign-in time) with the servers' own invented secret (`E2E_AUTH_SECRET`). No tests here.
 *
 *   `expired-token`  the cookie is still in the browser but the token's own expiry has passed: the server cannot read it. This is
 *                    what a tab left open overnight sends (the cookie outlives the token by days).
 *   `old-sign-in`    the token can still be read, and says the person signed in 13 hours ago: the portal's own 12-hour check refuses it.
 */

export type EndedSessionKind = 'expired-token' | 'old-sign-in';

export const SESSION_COOKIE_NAME = '__Secure-next-auth.session-token';

const HOURS_AGO_SIGNED_IN = 13;
const ONE_HOUR_SECONDS = MILLISECONDS_PER_HOUR / MILLISECONDS_PER_SECOND;

export async function addEndedSession(context: BrowserContext, kind: EndedSessionKind, userId: string = randomUUID()): Promise<void> {
  const signedAt = Math.floor(Date.now() / MILLISECONDS_PER_SECOND) - HOURS_AGO_SIGNED_IN * ONE_HOUR_SECONDS;
  // A negative lifetime puts the token's expiry in the past; a positive one keeps it readable.
  const maxAge = kind === 'expired-token' ? -ONE_HOUR_SECONDS : ONE_HOUR_SECONDS;
  const value = await encode({ token: { sub: userId, sv: 0, signedAt }, secret: E2E_AUTH_SECRET, maxAge });
  // By domain and path, not by `url`: the server is plain http on localhost, and a Secure cookie given with an http `url` is refused
  // as invalid, while the browser accepts the same cookie when the server itself sets it (as the sign-in spec shows).
  const { hostname } = new URL(PRODUCTION_URL);
  await context.addCookies([{ name: SESSION_COOKIE_NAME, value, domain: hostname, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
}
