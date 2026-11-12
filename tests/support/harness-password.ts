/**
 * The password of every invented person of the security harness (`session-harness.ts`) and of every person the end-to-end suite signs in
 * as (`E2E_PASSWORD` in `tests/e2e/support/auth.ts` is this value). It is one value on purpose: the recipe of `POST /api/v1/account/password`
 * (`route-calls.ts`) sends it as both the current and the new password, so the same recipe runs in the role matrix over the harness and in the
 * confidentiality scan against a real disposable Engineer, and can be repeated. It passes the password rule (STORY-01.05), is invented, and
 * lives apart from the harness because `route-calls.ts` also runs under Playwright, which must not load the harness (vitest and server code).
 */
export const HARNESS_PASSWORD = 'invented-e2e-password-for-aqp-38';
