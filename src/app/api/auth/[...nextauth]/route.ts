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

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const handler = NextAuth(getAuthOptions());
  return withSignInStatus(await handler(request, context));
}

export { handle as GET, handle as POST };
