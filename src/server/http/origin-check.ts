/**
 * The CSRF check of every state-changing request (STORY-01.02 AC-5, NFR-003, architecture section 8): the request is
 * accepted only when its `Origin` is the portal's own origin (`APP_ORIGIN`), or the browser says
 * `Sec-Fetch-Site: same-origin`. A request that carries neither is refused too: deny by default. `SameSite=Lax` on the
 * session cookie is the second layer, and Server Actions are not used, so `withRoute` is the one place this runs.
 *
 * Safe methods (GET, HEAD, OPTIONS) change nothing and are not checked.
 */

const ORIGIN_HEADER = 'origin';
const FETCH_SITE_HEADER = 'sec-fetch-site';
const SAME_ORIGIN = 'same-origin';

/** `appOrigin` is the validated `APP_ORIGIN`: scheme, host and port, no path, no trailing slash. */
export function isSameOriginRequest(headers: Headers, appOrigin: string): boolean {
  if (headers.get(FETCH_SITE_HEADER) === SAME_ORIGIN) return true;
  return headers.get(ORIGIN_HEADER) === appOrigin;
}
