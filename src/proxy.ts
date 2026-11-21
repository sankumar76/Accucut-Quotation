import { NextResponse, type NextRequest } from 'next/server';

import { isPublicPath } from '@/lib/auth/public-path';
import { RETURN_PATH_HEADER, signInPathFor } from '@/lib/auth/return-path';
import { hasSessionCookie, SESSION_COOKIE_HEADER, SESSION_COOKIE_PRESENT } from '@/lib/auth/session-ended';
import { loadOriginEnv } from '@/lib/env';
import { API_CONTENT_SECURITY_POLICY, AUTH_ROUTE_CONTENT_SECURITY_POLICY, createNonce, NONCE_HEADER, pageContentSecurityPolicy } from '@/lib/security/csp';
import { securityHeaders } from '@/lib/security/response-headers';

/**
 * Sends a signed-out visitor to the sign-in page (STORY-01.01 AC-4; architecture section 8), and puts the security headers on every
 * answer it handles (DEF-054, ADR-010).
 *
 * The redirect is a convenience, never an authorisation control: it looks only for the presence of a session cookie
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
 * Every response it handles for a path that is not public carries `Cache-Control: private, no-store`, so the browser's back button after
 * sign-out cannot show a protected page from its cache, and a redirect also carries `X-Robots-Tag` so a crawler that is turned away does
 * not index it (architecture section 8, "Indexing and sharing").
 *
 * The public pages (sign-in, the two reset pages, next-auth's routes) are not redirected and not marked `no-store` here, but they get
 * the security headers like every other page. The Content Security Policy carries a nonce made for this request: the proxy puts the
 * policy on the request too, and Next.js reads the nonce from it while it renders and puts it on its own scripts. A page must
 * therefore be rendered per request: the root layout reads the request's headers for that, so no page is built ahead of time without a nonce.
 *
 * An API answer gets the policy of data (`API_CONTENT_SECURITY_POLICY`, with `sandbox`; next-auth's routes without it). It is the one that reaches the browser for a picture download too: a route's own
 * header of the same name is dropped by Next.js when the proxy has set it already, so a policy that a route needs must be set here.
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

/** The request as the page or route sees it: the proxy's own words about the address and the cookie, never the browser's (STORY-01.02 AC-4, STORY-01.06 AC-3, AC-4). */
function forwardedHeaders(request: NextRequest, sentSessionCookie: boolean, isPublic: boolean): Headers {
  const { pathname, search } = request.nextUrl;
  const forwarded = new Headers(request.headers);
  if (isPublic) {
    forwarded.delete(RETURN_PATH_HEADER);
  } else {
    // The address asked for, for the page that finds the session stale and sends the person to sign in (AC-4). It always
    // replaces whatever the browser sent under that name, and it is read only through `signInPathFor`.
    forwarded.set(RETURN_PATH_HEADER, `${pathname}${search}`);
  }
  // Whether the browser sent a session cookie, for the page or route that cannot read a session from it: a session that ended
  // and a visit with no session are told apart by it (STORY-01.06 AC-3, AC-4). Always the proxy's word, never the browser's.
  if (sentSessionCookie && !isPublic) forwarded.set(SESSION_COOKIE_HEADER, SESSION_COOKIE_PRESENT);
  else forwarded.delete(SESSION_COOKIE_HEADER);
  return forwarded;
}

function withSecurityHeaders(response: NextResponse, request: NextRequest, policy: string): NextResponse {
  for (const [name, value] of securityHeaders({ policy, pathname: request.nextUrl.pathname })) {
    response.headers.set(name, value);
  }
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const isApi = isApiPath(pathname);
  const sentSessionCookie = hasSessionCookie(request.cookies.getAll());
  if (isPublic || sentSessionCookie || isApi) {
    const forwarded = forwardedHeaders(request, sentSessionCookie, isPublic);
    // An API answer is data: its policy needs no nonce. A page's policy is made for this request and is also given to Next.js on the request, where it reads the nonce.
    let policy = isPublic && isApi ? AUTH_ROUTE_CONTENT_SECURITY_POLICY : API_CONTENT_SECURITY_POLICY;
    if (isApi) {
      forwarded.delete(NONCE_HEADER);
    } else {
      const nonce = createNonce();
      policy = pageContentSecurityPolicy({ nonce, development: process.env.NODE_ENV === 'development' });
      forwarded.set('Content-Security-Policy', policy);
      forwarded.set(NONCE_HEADER, nonce);
    }
    const response = withSecurityHeaders(NextResponse.next({ request: { headers: forwarded } }), request, policy);
    if (!isPublic) response.headers.set('Cache-Control', NO_STORE);
    return response;
  }
  const response = NextResponse.redirect(new URL(signInPathFor(`${pathname}${search}`), portalOrigin(request)), 307);
  response.headers.set('Cache-Control', NO_STORE);
  response.headers.set('X-Robots-Tag', NO_INDEX);
  return withSecurityHeaders(response, request, API_CONTENT_SECURITY_POLICY);
}

/**
 * Everything except the build output, Next.js's image route and the logo, which the proxy never needs to see (they are static files; `next.config.ts`
 * gives them their security headers). Every page, every API route and every error page goes through it, public or not. The two prefixes end at a boundary,
 * so `/_next/staticfoo` and `/_next/image-x`, which are not those files and are answered by the app's not-found page, go through the proxy too.
 */
export const config = {
  matcher: ['/((?!_next/static/|_next/image(?:$|/)|accucut-logo\\.jpg$).*)'],
};
