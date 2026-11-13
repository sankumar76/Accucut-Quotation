/**
 * The one cookie a route handler may set on its answer (STORY-01.05 AC-3: the fresh session after a password change). Written out
 * by hand because a handler must work in a test with no Next.js request around it, and short because the portal sets exactly one
 * kind of cookie from a route: an `HttpOnly` session cookie. Name and value are checked against the characters RFC 6265 allows in a
 * token, so nothing a caller passes can add an attribute or split the header.
 */

export interface ResponseCookie {
  readonly name: string;
  readonly value: string;
  /** Seconds the browser keeps it. */
  readonly maxAgeSeconds: number;
  /** Sent only over https (a production session cookie). */
  readonly secure: boolean;
}

/** RFC 6265 token characters, and the base64url alphabet of a JWE with its dots. */
const COOKIE_TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

/** The `Set-Cookie` header value: `HttpOnly`, `SameSite=Lax`, path `/`, as next-auth sets its own session cookie. */
export function serializeSessionCookie({ name, value, maxAgeSeconds, secure }: ResponseCookie): string {
  if (!COOKIE_TOKEN.test(name) || !COOKIE_TOKEN.test(value)) throw new Error('serializeSessionCookie: the name or value is not a cookie token.');
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 0) throw new Error('serializeSessionCookie: the lifetime is not a whole number of seconds.');
  return [`${name}=${value}`, `Max-Age=${maxAgeSeconds}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', ...(secure ? ['Secure'] : [])].join('; ');
}
