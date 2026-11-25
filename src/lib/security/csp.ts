import { createHash } from 'node:crypto';

import { EARLY_INTENT_SCRIPT } from '@/lib/ui/early-intent-script';

/**
 * The Content Security Policy of the portal (architecture section 8 "Security headers" and section 10; ADR-010; DEF-054).
 *
 * Scripts. `script-src` holds the per-request nonce and `'strict-dynamic'`: Next.js puts the nonce on its own scripts while it
 * renders (it reads it from the policy on the request), and a script that a nonced script loads is trusted through it, so the
 * lazily loaded chunks of the dialogs work. `'self'` is kept for a browser that does not know `'strict-dynamic'`. There is no
 * `'unsafe-inline'`, and no `'unsafe-eval'` outside `next dev` (React's debugging tools in development need it; production never does).
 * The one inline script of our own, the early-tap script of the portal frame, is allowed by the SHA-256 hash of its text, computed here
 * from the exported constant, never copied by hand (AQP-188 G6 STD-01, DL-091): if the text changes, the policy and the page change together.
 *
 * Styles. `style-src` is `'self'` plus the nonce. The one loosening is `style-src-attr 'unsafe-inline'`: Radix UI and the floating-ui
 * placement code write `style="..."` attributes (the position of a menu, the height of a collapsible), and a style attribute cannot carry
 * a nonce or a hash. An attribute can run no script and load nothing, so the loosening is limited to what a style attribute can do.
 * In `next dev` the styles of the error overlay are added at run time, so development uses `'unsafe-inline'` for `style-src` too; the
 * production policy never does.
 *
 * Everything else comes from the portal's own origin: pictures are `'self'` and `blob:` (a pasted or chosen picture is previewed from a
 * `blob:` address), fonts are self-hosted (`next/font`), `connect-src` is `'self'` (the portal talks to its own API only). Nothing can
 * be framed (`frame-src 'none'`), nothing embeds the portal (`frame-ancestors 'none'`), no plug-in loads (`object-src 'none'`), and a
 * form posts to the portal only (`form-action 'self'`).
 */

const NONCE_BYTES = 16;

/**
 * The request header that carries the nonce from the proxy to the root layout (always the proxy's word: it replaces whatever a browser sent). The layout
 * hands it to the browser's own code as `__webpack_nonce__`, which is where react-style-singleton (inside Radix's scroll lock, used by every modal
 * dialog and sheet) reads the nonce for the one `<style>` element it adds when a dialog opens. Without it, that element is blocked.
 */
export const NONCE_HEADER = 'x-nonce';

/** What a nonce looks like: base64. The root layout checks the header it was given against this before it writes it into a script, so a value that is not one never becomes markup. */
export const NONCE_PATTERN = /^[A-Za-z0-9+/]{16,}={0,2}$/;

/** A fresh value for every request: 128 random bits, base64, never reused and never stored. */
export function createNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(NONCE_BYTES))).toString('base64');
}

/** The source expression for the early-tap script: a hash of its exact text. The portal frame renders the constant as it is, with nothing around it. */
export const EARLY_INTENT_SCRIPT_SOURCE = `'sha256-${createHash('sha256').update(EARLY_INTENT_SCRIPT, 'utf8').digest('base64')}'`;

/**
 * An answer that is data and not a page (a JSON body, a redirect, a stored file): nothing may load from it, nothing may frame it, and opened as a page it gets an opaque origin
 * (`sandbox`: no forms, no pop-ups, no navigation). `sandbox` is what ADR-013 and STORY-05.07 AC-5 ask of a picture download.
 *
 * It is set here, by the proxy, and not by the route: when a route sets a header that the proxy already set, Next.js keeps the proxy's value and drops the route's (`send-response.js` adds a
 * route header only if it is absent). `file-response.ts` sets this same constant on a stored file, so that answer is safe without the proxy too, but the one on the wire is the proxy's, and `tests/unit/security-headers.test.ts` pins it through the proxy.
 */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; sandbox";

/** next-auth's own routes (`/api/auth/*`) get the same policy without `sandbox`, so nothing it ever shows as a page (a sign-in form, an error page) can be blocked by it. */
export const AUTH_ROUTE_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

export interface PageCspOptions {
  readonly nonce: string;
  /** True only under `next dev`. Never true in a build, a test or production. */
  readonly development: boolean;
}

export function pageContentSecurityPolicy({ nonce, development }: PageCspOptions): string {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", EARLY_INTENT_SCRIPT_SOURCE, ...(development ? ["'unsafe-eval'"] : [])];
  const styleSources = development ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`];
  // The development server talks to the browser over a web socket (hot reload); 'self' covers it in current browsers, `ws:` for the rest.
  const connectSources = development ? ["'self'", 'ws:', 'wss:'] : ["'self'"];
  const directives: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSources],
    ['style-src', styleSources],
    ['style-src-attr', ["'unsafe-inline'"]],
    ['img-src', ["'self'", 'blob:']],
    ['font-src', ["'self'"]],
    ['connect-src', connectSources],
    ['frame-src', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];
  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}
