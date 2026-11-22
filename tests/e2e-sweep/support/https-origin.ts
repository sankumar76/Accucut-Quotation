/**
 * Makes the sweep's helpers address the portal over HTTPS (STORY-10.08, AQP-370; `scripts/lib/tls-front.ts` says why). `tests/e2e/support/servers.ts` reads `E2E_DEV_SCHEME` when it is first loaded and
 * builds `DEVELOPMENT_URL` (the `Origin` that the helpers send, and the portal's own address) from it, so this file must be the first import of `playwright.sweep.config.ts`: the main process sets it
 * before any helper is loaded, and the workers it starts inherit it. It has no export and no test; the required check's configuration never imports it, so its servers stay on plain http.
 */
process.env['E2E_DEV_SCHEME'] = 'https';
