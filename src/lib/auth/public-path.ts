/**
 * The pages a person with no session must be able to open: the sign-in page, the two pages of the reset by e-mailed link (STORY-09.07: a person who
 * forgot their password has no session) and next-auth's own routes. The proxy sends no one away from these. A path that only starts like one of
 * them (`/sign-ins`, `/forgot-passwords`, `/account/reset-password`) is not public and is still checked.
 */
const PUBLIC_PATH = /^\/(?:sign-in|forgot-password|reset-password|api\/auth)(?:\/|$)/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH.test(pathname);
}
