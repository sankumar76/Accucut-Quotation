import NextAuth from 'next-auth';

import { withSignInStatus } from '@/server/auth/locked-response';
import { getAuthOptions } from '@/server/composition';

/**
 * Sign-in and sign-out (`/api/auth/*`, architecture section 6): next-auth's own routes, public, answering 401 for a
 * refused sign-in, 429 for a blocked one and 503 when it could not be checked. Its CSRF token protects them (architecture section 8). Nothing else
 * in the portal imports next-auth's handler; the rules are in `src/server/auth` and `auth-service.ts`.
 *
 * The options are built on the first request, not at import, so `next build` needs no settings.
 */

type RouteContext = { readonly params: Promise<{ readonly nextauth: string[] }> };

/**
 * next-auth's client-side log relay. Once the options carry a `logger` (they do: `buildNextAuthLogger`, issue 255), next-auth answers
 * `POST /api/auth/_log` with no sign-in and no CSRF token, passing the body to that logger at a level the caller picks. Nothing in the
 * portal uses it, so it is closed here, before the request reaches next-auth (SEC-01). Any method gets the same plain 404.
 */
const LOG_RELAY_ACTION = '_log';
const NOT_FOUND_STATUS = 404;

async function handle(request: Request, context: RouteContext): Promise<Response> {
  if ((await context.params).nextauth[0] === `${LOG_RELAY_ACTION}-off`) return new Response(null, { status: NOT_FOUND_STATUS });
  const handler = NextAuth(getAuthOptions());
  return withSignInStatus(await handler(request, context));
}

export { handle as GET, handle as POST };
