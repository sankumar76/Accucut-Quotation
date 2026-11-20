import type { Outcome } from '../api-client';
import { CONFIG_VERSION_CHANGED_CODE, FIELD_IN_USE_CODE, STEP_UP_FAILED_CODE, STEP_UP_LOCKED_CODE } from '../errors';
import type { FieldUse } from '../fields/uses';

import { usesOfRefusal, type DeletedFieldView, type FieldReferencesView } from './delete-field-client';
import { GONE_LINE, stepUpFailedLine, stepUpLockedLine } from './field-delete-words';

/**
 * What the delete dialog of SCR-20 shows after each answer of the server (STORY-08.04 AC-2 to AC-4), as pure rules so they can be tested without a browser: the references read decides between the blocked list and the
 * confirm state; a delete answers the success, a wrong password under the field, a block, a field that something uses now, a version that moved on, a field that is gone, or a lost answer. Nothing here decides
 * anything the server has not: it only chooses what to show for what the server said. `stale` is true when the list behind the dialog is out of date or the delete may have gone through, so the screen reads it again.
 */

export type DeletePhase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'load-failed' }
  /** Something uses the field (read, or refused at the delete): the list, with no password field. */
  | { readonly kind: 'blocked'; readonly uses: ReadonlyArray<FieldUse> }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'saving' }
  /** The step-up is blocked (429): the sentence; the Admin may try again later. */
  | { readonly kind: 'locked'; readonly message: string }
  /** A refusal that a repeat cannot cure: the server's sentence (a version that moved on, a System field, a field that is gone). */
  | { readonly kind: 'stopped'; readonly message: string }
  | { readonly kind: 'unconfirmed' };

export interface ReadChange {
  readonly phase: DeletePhase;
  readonly stale: boolean;
}

/** After `GET .../references`. */
export function phaseAfterRead(outcome: Outcome<FieldReferencesView>): ReadChange {
  if (outcome.status === 'ok') return { phase: outcome.value.uses.length === 0 ? { kind: 'confirm' } : { kind: 'blocked', uses: outcome.value.uses }, stale: false };
  if (outcome.status === 'failed') return { phase: { kind: 'load-failed' }, stale: false };
  const gone = outcome.httpStatus === 404;
  return { phase: { kind: 'stopped', message: gone ? GONE_LINE : outcome.title }, stale: gone };
}

export type DeleteChange = { readonly deleted: string } | { readonly phase: DeletePhase; readonly passwordError: string | null; readonly stale: boolean };

/** After `DELETE .../{id}`. */
export function phaseAfterDelete(outcome: Outcome<DeletedFieldView>): DeleteChange {
  if (outcome.status === 'ok') return { deleted: outcome.value.message };
  if (outcome.status === 'failed') return { phase: { kind: 'unconfirmed' }, passwordError: null, stale: true };
  if (outcome.code === STEP_UP_FAILED_CODE) return { phase: { kind: 'confirm' }, passwordError: stepUpFailedLine(outcome.title), stale: false };
  if (outcome.code === STEP_UP_LOCKED_CODE) return { phase: { kind: 'locked', message: stepUpLockedLine(outcome.title) }, passwordError: null, stale: false };
  const uses = outcome.code === FIELD_IN_USE_CODE ? usesOfRefusal(outcome) : null;
  const stale = outcome.code === CONFIG_VERSION_CHANGED_CODE || outcome.code === FIELD_IN_USE_CODE || outcome.httpStatus === 404;
  if (uses !== null && uses.length > 0) return { phase: { kind: 'blocked', uses }, passwordError: null, stale };
  return { phase: { kind: 'stopped', message: outcome.httpStatus === 404 ? GONE_LINE : outcome.title }, passwordError: null, stale };
}
