/**
 * The fixed values of the response security headers (architecture section 8 "Security headers", ADR-010, DEF-054). No imports,
 * because `next.config.ts` reads this file too and Next.js loads that file before the `@/` alias exists.
 *
 * What sets what (the app sets every header itself, so it is safe with or without a reverse proxy in front):
 *   - `src/proxy.ts` sets all of them on every page and API answer it handles (`src/lib/security/response-headers.ts` builds them);
 *   - `next.config.ts` sets the three static ones on the files the proxy does not run for (the build output and the logo).
 * `Strict-Transport-Security` is deliberately not here: HSTS belongs to whatever ends TLS, so the reverse proxy is its only sender (architecture
 * section 8 "Reverse proxy contract" P3). The app is reached over plain http behind it and cannot know the scheme; a test pins that it never sends one.
 */

/** A browser never guesses another type from the bytes: a stored picture or a download cannot run as a page or a script. */
export const NOSNIFF = 'nosniff';

/** The legacy twin of `frame-ancestors 'none'`, for a browser that does not read the policy: no page of the portal can be framed (clickjacking of sign-in, Approve, Unlock and the step-up dialogs). */
export const FRAME_DENY = 'DENY';

/**
 * Features the portal does not use, switched off for it and for anything it embeds. The camera is off because the picture control
 * takes a file or a paste (`accept` only, no `capture`). Clipboard write stays at its default: the folder path copy button uses it.
 * Only features every current browser knows are listed, so no browser prints a warning about the header.
 */
export const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'display-capture=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
  'midi=()',
].join(', ');

/** The default: a same-origin navigation sends the address, a cross-origin one sends nothing. */
export const REFERRER_POLICY = 'same-origin';

/** The two reset pages: the address of one carries the single-use token, so no `Referer` leaves it at all (STORY-09.07 AC-9, `Referrer-Policy: no-referrer`). */
export const REFERRER_POLICY_RESET_PAGE = 'no-referrer';

/** The three that a file served from the build output or `public/` needs: the proxy does not run for it. */
export const STATIC_FILE_SECURITY_HEADERS: ReadonlyArray<{ readonly key: string; readonly value: string }> = [
  { key: 'X-Content-Type-Options', value: NOSNIFF },
  { key: 'X-Frame-Options', value: FRAME_DENY },
  { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
];
