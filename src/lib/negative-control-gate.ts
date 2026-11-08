/**
 * The gate of the scan's negative control (STORY-01.03 AC-4). `/api/test-only/leak` deliberately returns one invented sentinel so
 * the cost-confidentiality scan can show it finds a planted leak. It must exist only in a test environment:
 *   - it is on only when `NODE_ENV` is `test`, which is Vitest's value;
 *   - the reason it is off in every Next.js server is the BUNDLER, not the command: Next.js replaces the dot-access expression
 *     `process.env.NODE_ENV` at build time (`development` in `next dev`, `production` in `next build`), so the default argument of
 *     `isNegativeControlEnabled` is a constant in every server bundle and the route is dead there whatever the runtime environment
 *     says. (`next start` itself keeps a `NODE_ENV` that is already set, so "next start forces production" is NOT the reason; the
 *     compiled chunk reads `function(e="production"){return"test"===e}()`.) That only holds while the read stays a dot-access
 *     default: a destructured, bracketed or computed read is not replaced and would make the gate depend on the environment.
 *     `scripts/check-production-routes.ts` (CI stage 9) fails the build if the compiled route reads `NODE_ENV` at run time, and
 *     `tests/security/scanner.test.ts` pins the source form;
 *   - the sentinel is not in the source. It is read from the environment of the test run (`CANARY_NEGATIVE_CONTROL`), so a build
 *     holds nothing that a scan of its output could find, and a server started without it answers 404 even under test.
 *
 * `CANARY_NEGATIVE_CONTROL` is deliberately outside `src/lib/env.ts` (STD-03): it exists only in tests, it must never fail a
 * start-up check, and it must not appear in `.env.example` or the list of variables of architecture section 8. The README names it in
 * "Cost confidentiality scan".
 *
 * Call both functions with no argument: every caller then reads the same variables, as `isDesignSystemAvailable` does.
 */

export const NEGATIVE_CONTROL_ENV_NAME = 'CANARY_NEGATIVE_CONTROL';

/** Is the test-only route on? Only under `NODE_ENV=test`. Keep the default as the literal `process.env.NODE_ENV` (see above). */
export function isNegativeControlEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === 'test';
}

/** The sentinel the test run supplied, or `undefined` when none was (or it is blank). */
export function negativeControlSentinel(supplied: string | undefined = process.env[NEGATIVE_CONTROL_ENV_NAME]): string | undefined {
  const text = supplied?.trim();
  return text === undefined || text === '' ? undefined : text;
}
