import { HOME_PATH, RETURN_PARAMETER, SIGN_IN_PATH, safeReturnPath } from './return-path';

/**
 * What the server and the browser share about a session that ended (STORY-01.06 AC-3 and AC-4; architecture section 8).
 * Plain data and small functions, with no Next.js, zod or server import, so the client that reads a refusal can load it.
 *
 * A session lasts 12 hours from sign-in. When it ends, a page request shows SCR-26 "Session ended" and an API call is
 * answered with 401 and the code below; the browser then goes to SCR-01 in its "Session ended" state, with the page the person
 * was on kept as the place to come back to.
 */

/** The `code` of the 401 problem body for a session that ended. Every other 401 keeps `UNAUTHORIZED`. */
export const SESSION_ENDED_CODE = 'SESSION_ENDED';

/** The query parameter of the sign-in address that asks SCR-01 for its "Session ended" state, and its one value. */
export const REASON_PARAMETER = 'reason';
export const SESSION_ENDED_REASON = 'session-ended';

/** SCR-01 "Session ended" state (UX spec section 6): the words shown under the heading. */
export const SESSION_ENDED_NOTICE = 'Your session ended. Sign in again to continue where you left off.';

/**
 * The session cookie as next-auth names it: with the prefix when the cookie is Secure, without it otherwise. next-auth splits
 * a large cookie into `<name>.0`, `<name>.1` ...
 */
const SESSION_COOKIE_NAMES: ReadonlyArray<string> = ['__Secure-next-auth.session-token', 'next-auth.session-token'];

/** Does this request carry a session cookie? It looks at the name only: what is inside is for the server to judge. */
export function hasSessionCookie(cookies: ReadonlyArray<{ readonly name: string }>): boolean {
  return cookies.some(({ name }) => SESSION_COOKIE_NAMES.some((base) => name === base || name.startsWith(`${base}.`)));
}

/**
 * The request header in which `proxy.ts` tells the page or route whether the browser sent a session cookie. The proxy always
 * sets it (or removes what the browser sent under that name) for every request it handles, so it is the proxy's word. It only
 * decides which words a refused person sees (a session that ended, or a visit with no session at all), never who they are.
 */
export const SESSION_COOKIE_HEADER = 'x-session-cookie';
export const SESSION_COOKIE_PRESENT = '1';

/** Is this refusal the one that says the session ended? */
export function isSessionEnded(httpStatus: number, code: string): boolean {
  return httpStatus === 401 && code === SESSION_ENDED_CODE;
}

/**
 * The sign-in address that shows the "Session ended" state and, when `returnPath` is a same-origin page of this portal other
 * than the home page, brings the person back to it after signing in (AC-3, AC-4). Anything else is dropped (`safeReturnPath`).
 */
export function signInPathAfterSessionEnded(returnPath: string): string {
  const target = returnPath.length > 0 ? returnPath : safeReturnPath(returnPath, HOME_PATH);
  const reason = `${SIGN_IN_PATH}?${REASON_PARAMETER}=${SESSION_ENDED_REASON}`;
  return target === HOME_PATH ? reason : `${reason}&${RETURN_PARAMETER}=${encodeURIComponent(target)}`;
}

/** In the browser: leaves the current page for SCR-01, to sign in again and come back here. Does nothing outside a browser. */
export function goToSessionEndedSignIn(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  window.location.assign(signInPathAfterSessionEnded(`${pathname}${search}`));
}

/** For a client that has read a refusal: leaves for SCR-01 if it says the session ended, and says whether it did. */
export function handleSessionEnded(httpStatus: number, code: string): boolean {
  if (!isSessionEnded(httpStatus, code)) return false;
  goToSessionEndedSignIn();
  return true;
}
