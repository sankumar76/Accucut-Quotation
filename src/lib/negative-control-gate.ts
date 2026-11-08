/**
 * The gate of the scan's negative control (STORY-01.03 AC-4). `/api/test-only/leak` deliberately returns one invented sentinel so
 * the cost-confidentiality scan can show it finds a planted leak. It must exist only in a test environment:
 *   - it is on only when `NODE_ENV` is `test`, which is Vitest's value. No Next.js server has it: `next dev` forces
 *     `development` and `next start` forces `production`, whatever the environment says (checked on Next.js 16.4.3), so the
 *     route is on in the in-process tests (`tests/security/negative-control.test.ts`) and off in every server, the image included;
 *   - the sentinel is not in the source. It is read from the environment of the test run (`CANARY_NEGATIVE_CONTROL`), so a
 *     build holds nothing that a scan of its output could find, and a server started without it answers 404 even under test.
 *
 * Call both with no argument: every caller then reads the same variables, as `isDesignSystemAvailable` does.
 */

export const NEGATIVE_CONTROL_ENV_NAME = 'CANARY_NEGATIVE_CONTROL';

/** Is the test-only route on? Only under `NODE_ENV=test`. */
export function isNegativeControlEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === 'test';
}

/** The sentinel the test run supplied, or `undefined` when none was (or it is blank). */
export function negativeControlSentinel(supplied: string | undefined = process.env[NEGATIVE_CONTROL_ENV_NAME]): string | undefined {
  const text = supplied?.trim();
  return text === undefined || text === '' ? undefined : text;
}
