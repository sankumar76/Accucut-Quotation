import {
  FRAME_DENY,
  NOSNIFF,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  REFERRER_POLICY_RESET_PAGE,
} from './header-values';

/**
 * The security headers every answer of the proxy carries (DEF-054; architecture section 8). One function builds the list, so a page, a
 * JSON answer and a redirect cannot differ by accident. HSTS is not among them: the reverse proxy that ends TLS is its only sender (`header-values.ts`).
 */

export interface ResponseSecurityOptions {
  /** The `Content-Security-Policy` value for this answer: the page policy with its nonce, or the policy of an answer that is data. */
  readonly policy: string;
  readonly pathname: string;
}

/** The pages whose address carries the single-use reset token. A path that only starts like them is an ordinary path. */
const RESET_PAGE = /^\/(?:forgot-password|reset-password)\/?$/;

export function securityHeaders({ policy, pathname }: ResponseSecurityOptions): ReadonlyArray<readonly [string, string]> {
  const headers: Array<readonly [string, string]> = [
    ['Content-Security-Policy', policy],
    ['X-Content-Type-Options', NOSNIFF],
    ['X-Frame-Options', FRAME_DENY],
    ['Referrer-Policy', RESET_PAGE.test(pathname) ? REFERRER_POLICY_RESET_PAGE : REFERRER_POLICY],
    ['Permissions-Policy', PERMISSIONS_POLICY],
  ];
  return headers;
}
