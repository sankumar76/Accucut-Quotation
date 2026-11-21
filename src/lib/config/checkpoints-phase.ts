import type { Outcome } from '../api-client';
import { CONFIG_VERSION_CHANGED_CODE, STEP_UP_FAILED_CODE, STEP_UP_LOCKED_CODE } from '../errors';

import { stepUpFailedLine, stepUpLockedLine } from './checkpoint';
import type { CheckpointRow, RevertedVersion } from './checkpoints-client';

/**
 * What SCR-21 shows after each answer of the server (STORY-08.06 AC-2, AC-4, AC-7), as pure rules so they can be tested without a browser. A save answers the saved checkpoint, or the sentence for the name field; a
 * revert answers the success with its undo, a wrong password under the field, a block, a refusal that a repeat cannot cure, or a lost answer. Nothing here decides anything the server has not: it only chooses what to
 * show for what the server said. `stale` is true when the lists behind the screen are out of date or the change may have gone through, so the screen reads them again.
 */

export type RevertPhase =
  /** The password is asked for. */
  | { readonly kind: 'confirm' }
  | { readonly kind: 'saving' }
  /** The step-up is blocked (429): the sentence; the Admin may try again later. */
  | { readonly kind: 'locked'; readonly message: string }
  /** A refusal that a repeat cannot cure: the server's sentence (a version that moved on, nothing to revert, a target that cannot be used, a version that is gone). */
  | { readonly kind: 'stopped'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

export type SaveChange = { readonly saved: CheckpointRow } | { readonly nameError: string } | { readonly unconfirmed: true };

/** After `POST /config/checkpoints`. A refusal of any kind is said under the name field, in the server's words. */
export function phaseAfterSave(outcome: Outcome<CheckpointRow>): SaveChange {
  if (outcome.status === 'ok') return { saved: outcome.value };
  if (outcome.status === 'failed') return { unconfirmed: true };
  return { nameError: outcome.fields['name'] ?? outcome.title };
}

export type RevertChange = { readonly reverted: RevertedVersion } | { readonly phase: RevertPhase; readonly passwordError: string | null; readonly stale: boolean };

/** The refusals after which the configuration is not what the screen showed: the screen reads the current version and the lists again. */
const NOT_WHAT_THE_SCREEN_SHOWED = new Set<string>([CONFIG_VERSION_CHANGED_CODE, 'NOTHING_TO_REVERT']);

/** After `POST /config/versions/{id}/revert`. */
export function phaseAfterRevert(outcome: Outcome<RevertedVersion>): RevertChange {
  if (outcome.status === 'ok') return { reverted: outcome.value };
  if (outcome.status === 'failed') return { phase: { kind: 'unconfirmed' }, passwordError: null, stale: true };
  if (outcome.code === STEP_UP_FAILED_CODE) return { phase: { kind: 'confirm' }, passwordError: stepUpFailedLine(outcome.title), stale: false };
  if (outcome.code === STEP_UP_LOCKED_CODE) return { phase: { kind: 'locked', message: stepUpLockedLine(outcome.title) }, passwordError: null, stale: false };
  // A 422 for a target that cannot be used names each field in its own sentence (`errors`); the title of that error type is a generic "Check the values", so the sentences are what is shown. Any other refusal is the server's one title.
  const sentences = Object.values(outcome.fields);
  const message = outcome.httpStatus === 422 && sentences.length > 0 ? sentences.join(' ') : outcome.title;
  return { phase: { kind: 'stopped', message }, passwordError: null, stale: NOT_WHAT_THE_SCREEN_SHOWED.has(outcome.code) || outcome.httpStatus === 404 };
}
