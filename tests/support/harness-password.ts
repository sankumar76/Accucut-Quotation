/**
 * The password of every invented person of the security harness (`session-harness.ts`) and of every person the end-to-end suite signs in
 * as (`E2E_PASSWORD` in `tests/e2e/support/auth.ts` is this value). It is one value on purpose: the recipe of `POST /api/v1/account/password`
 * (`route-calls.ts`) sends it as both the current and the new password, so the same recipe runs in the role matrix over the harness and in the
 * confidentiality scan against a real disposable Engineer. It passes the password rule (STORY-01.05), is invented, and
 * lives apart from the harness because `route-calls.ts` also runs under Playwright, which must not load the harness (vitest and server code).
 */
export const HARNESS_PASSWORD = 'invented-e2e-password-for-aqp-38';

/**
 * The password the account recipe changes it to (STORY-01.05 QLT-01: a new password may not be the current one, so the recipe cannot send the
 * same value twice). It also passes the rule. The vitest harness puts a person back on `HARNESS_PASSWORD` every time `signInAs` names them, so
 * the call is repeatable for every role; the real scan calls it once for a person made for that run.
 */
export const HARNESS_NEXT_PASSWORD = 'invented-e2e-password-for-aqp-81-next';
