import { NextResponse, type NextRequest } from 'next/server';

import { RETURN_PATH_HEADER, signInPathFor } from '@/lib/auth/return-path';
import { hasSessionCookie, SESSION_COOKIE_HEADER, SESSION_COOKIE_PRESENT } from '@/lib/auth/session-ended';
import { loadOriginEnv } from '@/lib/env';

/**
 * Sends a signed-out visitor to the sign-in page (STORY-01.01 AC-4; architecture section 8).
 *
 * This is a convenience, never an authorisation control: it looks only for the presence of a session cookie
 * and checks nothing about it. The real check is `requireUser()` in the page or the route, which reads the
 * database (the lesson of the 2025 Next.js middleware bypass). A forged or stale cookie passes here and is
 * refused there.
 *
 * An API request is never redirected: a signed-out call reaches the route, and `withRoute` answers it with 401 and a problem
 * body (STORY-01.02 AC-4). For a request with a cookie it also records the address asked for in a request header, for the
 * page that finds the session stale and sends the person to sign in with that address kept. It also says, in a header of its
 * own, whether the browser sent a session cookie, so that a session that ended (the cookie is there, the token in it is
 * dead) is told apart from a visit with no session (STORY-01.06).
 *
 * Every response it handles carries `Cache-Control: private, no-store`, so the browser's back button after
 * sign-out cannot show a protected page from its cache, and `X-Robots-Tag` so a crawler that is turned away does
 * not index the redirect (architecture section 8, "Indexing and sharing").
 */

const NO_STORE = 'private, no-store';
const NO_INDEX = 'noindex, nofollow';

/**
 * Next.js requires an absolute Location. In production it is built from the validated `APP_ORIGIN` and nothing else, so a
 * host name this process only thinks it has (behind the reverse proxy) can never decide where a person is sent, and a
 * missing or malformed setting fails loudly instead of quietly trusting the `Host` header (G6 STD-03). The server also
 * refuses to start without it (`src/instrumentation.ts`). In development and tests the request's own address stands in.
 */
function portalOrigin(request: NextRequest): string {
  try {
    return loadOriginEnv().APP_ORIGIN;
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
    return request.url;
  }
}

/** An API route answers for itself: `withRoute` gives a signed-out caller 401 with a problem body, not a page redirect (AC-4). */
function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const sentSessionCookie = hasSessionCookie(request.cookies.getAll());
  if (sentSessionCookie || isApiPath(pathname)) {
    // The address asked for, for the page that finds the session stale and sends the person to sign in (AC-4). It always
    // replaces whatever the browser sent under that name, and it is read only through `signInPathFor`.
    const forwarded = new Headers(request.headers);
    forwarded.set(RETURN_PATH_HEADER, `${pathname}${search}`);
    // Whether the browser sent a session cookie, for the page or route that cannot read a session from it: a session that ended
    // and a visit with no session are told apart by it (STORY-01.06 AC-3, AC-4). Always the proxy's word, never the browser's.
    if (sentSessionCookie) forwarded.set(SESSION_COOKIE_HEADER, SESSION_COOKIE_PRESENT);
    const response = NextResponse.next({ request: { headers: forwarded } });
    response.headers.set('Cache-Control', NO_STORE);
    return response;
  }
  const response = NextResponse.redirect(new URL(signInPathFor(`${pathname}${search}`), portalOrigin(request)), 307);
  response.headers.set('Cache-Control', NO_STORE);
  response.headers.set('X-Robots-Tag', NO_INDEX);
  return response;
}

/**
 * Everything except the sign-in page, next-auth's own routes, and static files (the build output, the logo). The
 * sign-in page is public; the rest is behind the check.
 */
export const config = {
  matcher: ['/((?!sign-in(?:/|$)|api/auth(?:/|$)|_next/static|_next/image|accucut-logo\\.jpg$).*)'],
};
