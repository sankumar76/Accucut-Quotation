import { assertNever } from '../assert-never';

/**
 * What uses a field, and the words that say so (STORY-08.04 AC-2; FR-076; SCR-20 "Blocked by formulas"; architecture section 4.5: "A field's references include formulas, `hideWhenZero`, `visibleWhen` and stage
 * totals"). Pure and free of any server import, so the answer of the server, the 409 problem body and the dialog all read one shape and one set of sentences. A column letter and a label are the server's,
 * taken from the registry at the moment of the read; nothing here types one (coding standards section 10).
 *
 * **Restricted** (NFR-002): a formula use carries the formula's text in display form. Every route that answers with it is the Admin's alone.
 */

/** A formula that reads the field: the formula's own field, and its text in display form (column letters and rate names). */
export interface FormulaFieldUse {
  readonly kind: 'formula';
  readonly fieldId: string;
  readonly letter: string;
  readonly label: string;
  readonly formula: string;
}

/** An output whose line is hidden while the field is 0 (`hideWhenZero`), or an input shown only while the field holds a value (`visibleWhen`). */
export interface RuleFieldUse {
  readonly kind: 'hide-when-zero' | 'visibility-rule';
  readonly fieldId: string;
  readonly letter: string;
  readonly label: string;
}

/** A stage whose total adds the field. */
export interface StageTotalUse {
  readonly kind: 'stage-total';
  readonly stageId: string;
  readonly number: number;
  readonly name: string;
}

export type FieldUse = FormulaFieldUse | RuleFieldUse | StageTotalUse;

/** The one sentence under a use the Admin cannot change in the portal yet (OQ-2: no story edits a rule or a stage total). */
export const CANNOT_CHANGE_YET = 'This use cannot be changed in the portal yet.';

/** `The hide-when-zero rule of AM Bending Cost`, `The visibility rule of AP Notch Count`, `The total of stage 3`. A formula is named by its column and label; it has the formula to show beside it. */
export function useTitle(use: FieldUse): string {
  switch (use.kind) {
    case 'formula':
      return `${use.letter} ${use.label}`;
    case 'hide-when-zero':
      return `The hide-when-zero rule of ${use.letter} ${use.label}`;
    case 'visibility-rule':
      return `The visibility rule of ${use.letter} ${use.label}`;
    case 'stage-total':
      return `The total of stage ${String(use.number)}`;
    default:
      return assertNever(use, 'field use');
  }
}

/** True for a use the Admin can change by editing a formula (SCR-18): only a formula. */
export function canEditUse(use: FieldUse): use is FormulaFieldUse {
  return use.kind === 'formula';
}

/** `Cannot delete AL Cutting Cost yet.` and then how many things use it: `1 formula uses this field.` / `3 formulas use this field.`; when something other than a formula uses it, `places` is the word. */
export function blockedSentence(letter: string, label: string, uses: ReadonlyArray<FieldUse>): string {
  const count = uses.length;
  const onlyFormulas = uses.every(canEditUse);
  const how = onlyFormulas ? (count === 1 ? '1 formula uses' : `${String(count)} formulas use`) : count === 1 ? '1 place uses' : `${String(count)} places use`;
  return `Cannot delete ${letter} ${label} yet. ${how} this field.`;
}

/** A use rebuilt key by key, so a record with more in it (a formula's internal form, a stage's other properties) never reaches a response body even if a service one day hands one over (NFR-002). */
export function plainUse(use: FieldUse): FieldUse {
  switch (use.kind) {
    case 'formula':
      return { kind: 'formula', fieldId: use.fieldId, letter: use.letter, label: use.label, formula: use.formula };
    case 'hide-when-zero':
    case 'visibility-rule':
      return { kind: use.kind, fieldId: use.fieldId, letter: use.letter, label: use.label };
    case 'stage-total':
      return { kind: 'stage-total', stageId: use.stageId, number: use.number, name: use.name };
    default:
      return assertNever(use, 'field use');
  }
}
