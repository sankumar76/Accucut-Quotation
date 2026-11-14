/**
 * The real-value recipe of the estimate routes (STORY-05.01; STORY-01.03 AC-6): the scan and the role matrix open `/estimates/<code>` and
 * `PUT /api/v1/estimates/<id>/customer` with an estimate that really exists and belongs to the Engineer who signs in.
 *
 * The recipe's one input is the ID of that Engineer (`ownerId`, or the `targetId` of a route call): the estimate gets that ID, and its task a code made from it, in a
 * year no real task can have (`Q-9999-...`, the running number from the first eight hex digits of the ID). So the in-memory world of the security tests
 * (`session-harness.ts`) and the E2E database (`ensureCanaryEstimate` in `tests/e2e/support/auth.ts`) agree on both, with nothing stored but the ID.
 * Every value is invented.
 */

const CANARY_YEAR = 9999;
const HEX_DIGITS_USED = 8;
const MIN_DIGITS = 4;

/** The code of the canary task of the Engineer with this ID. */
export function canaryTaskCodeFor(ownerId: string): string {
  const running = Number.parseInt(ownerId.replace(/-/g, '').slice(0, HEX_DIGITS_USED), 16);
  if (Number.isNaN(running)) throw new Error('The recipe needs an ID that starts with hexadecimal digits.');
  return `Q-${CANARY_YEAR}-${String(running).padStart(MIN_DIGITS, '0')}`;
}

/** The address of the canary workspace of the Engineer with this ID. */
export function canaryEstimatePageFor(ownerId: string): string {
  return `/estimates/${canaryTaskCodeFor(ownerId)}`;
}

/** An invented UNC path for the canary task. */
export const CANARY_FOLDER_PATH = '\\\\invented-server\\invented-share\\RFQ-canary';
