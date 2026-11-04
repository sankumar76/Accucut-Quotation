import { NextResponse, type NextRequest } from 'next/server';

import { signInPathFor } from '@/lib/auth/return-path';

/**
 * Sends a signed-out visitor to the sign-in page (STORY-01.01 AC-4; architecture section 8).
 *
 * This is a convenience, never an authorisation control: it looks only for the presence of a session cookie
 * and checks nothing about it. The real check is `requireUser()` in the page or the route, which reads the
 * database (the lesson of the 2025 Next.js middleware bypass). A forged or stale cookie passes here and is
 * refused there.
 *
 * Every response it handles carries `Cache-Control: private, no-store`, so the browser's back button after
 * sign-out cannot show a protected page from its cache, and `X-Robots-Tag` so a crawler that is turned away does
 * not index the redirect (architecture section 8, "Indexing and sharing").
 */

/** The session cookie as next-auth names it: with the prefix when the cookie is Secure, without it otherwise. */
const SESSION_COOKIE_NAMES: ReadonlyArray<string> = ['__Secure-next-auth.session-token', 'next-auth.session-token'];

const NO_STORE = 'private, no-store';
const NO_INDEX = 'noindex, nofollow';

/** next-auth splits a large cookie into `<name>.0`, `<name>.1` ... */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => SESSION_COOKIE_NAMES.some((base) => name === base || name.startsWith(`${base}.`)));
}

export function proxy(request: NextRequest): NextResponse {
  if (hasSessionCookie(request)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', NO_STORE);
    return response;
  }
  const { pathname, search } = request.nextUrl;
  // A relative Location, so the redirect never depends on the host name this process thinks it has.
  const response = new NextResponse(null, { status: 307, headers: { Location: signInPathFor(`${pathname}${search}`) } });
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
