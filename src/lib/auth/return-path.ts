/**
 * Where a person goes after signing in (STORY-01.01 AC-1 and AC-6, architecture section 8, ADR-009).
 *
 * The sign-in link may carry a return address (`?callbackUrl=`). It is honoured only as a same-origin relative
 * path. Anything else (another site, a protocol-relative `//host`, a backslash trick, a scheme) is ignored and
 * the person goes to their home. This is the whole defence against an open redirect, so it is a pure function
 * that both the page and the form call.
 */

/** Every role's home page until the role-specific homes arrive (AC-1: `/queue`). */
export const HOME_PATH = '/queue';

/** The sign-in page. */
export const SIGN_IN_PATH = '/sign-in';

/** The query parameter that carries the return address. */
export const RETURN_PARAMETER = 'callbackUrl';

/**
 * The request header in which `proxy.ts` hands the address that was asked for to the page that has to refuse a stale
 * session. It is always set by the proxy, so a value the browser sent is replaced; and it is read only through
 * `signInPathFor`, which keeps a same-origin relative path and nothing else (AC-4 of STORY-01.02).
 */
export const RETURN_PATH_HEADER = 'x-return-path';

/** A return address longer than this is not a page of this portal. */
const MAX_RETURN_LENGTH = 2_000;

/** A placeholder origin used only to resolve a candidate; a candidate that leaves it is refused. */
const PROBE_ORIGIN = 'http://return-path.invalid';

/** Pages and routes that make no sense as a place to land after signing in. */
const NEVER_RETURN_TO: ReadonlyArray<string> = [SIGN_IN_PATH, '/api'];

// The point is to refuse control characters (CR, LF, tab, NUL), which a header or a log line could be split on.
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function startsAt(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * The path to go to after signing in: `candidate` if it is a same-origin relative path of this portal, else
 * `fallback`. The result always starts with a single `/` and never contains a scheme or a host.
 */
export function safeReturnPath(candidate: unknown, fallback: string = HOME_PATH): string {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > MAX_RETURN_LENGTH) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  if (candidate.includes('\\') || CONTROL_CHARACTER.test(candidate)) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(candidate, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  // `/.//evil` resolves to the path `//evil`, which a browser reads as another site: check the result, not just the input.
  if (resolved.origin !== PROBE_ORIGIN || resolved.pathname.startsWith('//')) return fallback;
  if (NEVER_RETURN_TO.some((prefix) => startsAt(resolved.pathname, prefix))) return fallback;
  return `${resolved.pathname}${resolved.search}`;
}

/** The sign-in address for a signed-out visitor who asked for `path`, so they come back to it afterwards. */
export function signInPathFor(path: string): string {
  const target = safeReturnPath(path, HOME_PATH);
  return target === HOME_PATH ? SIGN_IN_PATH : `${SIGN_IN_PATH}?${RETURN_PARAMETER}=${encodeURIComponent(target)}`;
}
