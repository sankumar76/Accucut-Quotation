import type { FieldKind } from '../fields/types';

import type { DeletedColumn } from './field-delete';
import { movedLeftWords } from './field-delete-words';
import { movedRuns, type LetterChanges, type MovedRun } from './field-insert-changes';

/**
 * What the audit entry `config.field_deleted` keeps and the words it shows (STORY-08.04 AC-8; FR-011, FR-079; UX spec SCR-16). Pure, so the save and the registry's `describe` read one file. The entry names who
 * and when through its own columns; here it keeps the column that was deleted (letter, label, kind and, for an output, the formula in display form, because the log is read by the Admin alone, NFR-002) and
 * what moved, as runs of the OLD letters with the number of places to the left. It has no key a password, figure or rate value could sit in.
 */

export interface DeleteAuditBefore {
  readonly letter: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** The formula of an output in display form, or `null` for an input. */
  readonly formula: string | null;
}

export interface DeleteAuditAfter {
  readonly moved: ReadonlyArray<MovedRun>;
  readonly version: number;
}

/** The value stored under "before": the column as it was. */
export function deleteAuditBefore({ letter, label, kind, formula }: DeletedColumn): DeleteAuditBefore {
  return { letter, label, kind, formula };
}

/** The value stored under "after": the runs of columns that moved to the left (old letters, places to the left) and the version the delete made. */
export function deleteAuditAfter(changes: LetterChanges, version: number): DeleteAuditAfter {
  return { moved: movedRuns(changes.moved).map(({ from, to, by }) => ({ from, to, by: -by })), version };
}

/** `Column AY, Cutting Cost, formula <the formula as the Admin read it>`; an input has no formula part. */
export function describeDeleteBefore(before: DeleteAuditBefore): string {
  const column = `Column ${before.letter}, ${before.label}`;
  return before.formula === null ? column : `${column}, formula ${before.formula}`;
}

/** `Deleted. Columns AZ to BP moved one to the left (configuration version 11)`; with nothing after the deleted column: `Deleted. No other column moved (configuration version 11)`. */
export function describeDeleteAfter(after: DeleteAuditAfter): string {
  const moved = after.moved.length === 0 ? 'No other column moved' : after.moved.map((run) => movedLeftWords(run.from, run.to, run.by)).join('; ');
  return `Deleted. ${moved} (configuration version ${String(after.version)})`;
}
