import { TEXT_CHARACTERS_MESSAGE, validateTextInput } from '../estimate/validation';

/**
 * The name of a checkpoint and the words around it (STORY-08.06 AC-2, A-4; SPEC section 8.3, FR-078). Pure and without zod, so the screen does not carry a schema (NFR-009) and the server states the same rule
 * again from this file: one limit, one sentence, one check.
 *
 * A name is trimmed, made of single spaces, folded to its compatibility form (so full-width letters and plain ones are one name) and held to 1 to 100 characters, counted as the database counts them (code
 * points). It holds no control, zero-width or lone-surrogate character. Whether a name is free is the database's: the unique index on `lower(name)` compares names ignoring letter case, so two requests that race for
 * one name cannot both win.
 */

/** The longest name. The same limit as every master's name. */
export const CHECKPOINT_NAME_MAX_LENGTH = 100;

export const CHECKPOINT_NAME_REQUIRED_MESSAGE = 'Enter a name for this checkpoint.';
export const CHECKPOINT_NAME_TOO_LONG_MESSAGE = `Use ${String(CHECKPOINT_NAME_MAX_LENGTH)} characters or fewer.`;
/** The 409 `CHECKPOINT_NAME_TAKEN` (the masters' pattern, AC-2). */
export const CHECKPOINT_NAME_TAKEN_MESSAGE = 'A checkpoint with this name already exists. Names must be unique.';

/** The one form in which a name is stored and compared: compatibility forms folded, surrounding spaces removed and every run of white space one space. */
export function canonicalCheckpointName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export type CheckpointNameCheck = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly message: string };

/** Reads a typed name: the name to store, or the words to show under the field. */
export function checkCheckpointName(typed: string): CheckpointNameCheck {
  const name = canonicalCheckpointName(typed);
  const checked = validateTextInput(name, { maxLength: CHECKPOINT_NAME_MAX_LENGTH, multiline: false, countCodePoints: true });
  if (!checked.ok) return { ok: false, message: checked.message === TEXT_CHARACTERS_MESSAGE ? TEXT_CHARACTERS_MESSAGE : CHECKPOINT_NAME_TOO_LONG_MESSAGE };
  return checked.value === null ? { ok: false, message: CHECKPOINT_NAME_REQUIRED_MESSAGE } : { ok: true, name: checked.value };
}

/** 409 `NOTHING_TO_REVERT` (AC-4): the checkpoint holds the same configuration as the current one. No password was asked for. */
export const NOTHING_TO_REVERT_MESSAGE = 'This checkpoint is the same as the current configuration.';

/** 409 `CONFIG_VERSION_CHANGED` for a revert: another save came first (AC-4). Nothing was reverted and nothing was overwritten. */
export function revertVersionChangedMessage(currentVersion: number): string {
  return `The configuration was changed while you were reverting. It is now at configuration version ${String(currentVersion)}. Nothing was reverted; check the list and try again.`;
}

/** `Reverted to version 7. This is now configuration version 9.` (AC-7, proposed words). */
export function revertedMessage(copiedFrom: number, version: number): string {
  return `Reverted to version ${String(copiedFrom)}. This is now configuration version ${String(version)}.`;
}

/** The server's sentence for a wrong password is "That password is not correct."; SCR-21 adds what to do (the pattern of SCR-18 and SCR-20). */
export const stepUpFailedLine = (serverSentence: string): string => `${serverSentence} Try again.`;

/** The server's sentence for a block is "Too many wrong passwords. Try again in 15 minutes."; SCR-21 adds that nothing was changed (AC-4, proposed words). */
export const stepUpLockedLine = (serverSentence: string): string => `${serverSentence} The configuration is not changed.`;
