import type { ConfigDocument } from '../fields/schema';

import { buildFormSections, type FormFieldView } from './form-fields';
import { treatmentChoiceOf } from './treatment-value';

/**
 * The fields a Lead's or an Admin's save changed, as the audit entry `estimate.inputs_changed` keeps them (DEF-131 stage 2; architecture note lead-admin-input-edit-2026-11-27, section 3.4). **Only the
 * fields that changed**, in the form's order, each with its Excel letter, its label and its **display text** frozen at the time: a number as the normalised text it is stored as, a text as it was typed, a
 * material by its **name** (never its ID), a choice by its option, a treatment by its words, a flag as Yes or No, and a blank as `null`. A field that a rule zeroed in the same save counts as changed, so the
 * entry shows the zero. Only a field of the form that a person types or chooses can appear (`editable`): a rate, a calculated field or an unknown key has no place here (NFR-002, NFR-007). Plain data, no
 * database: the caller gives the names of the materials it read.
 */

/** One field in an entry: no key but these three, so no figure and no ID has a place to go. */
export interface ChangedField {
  readonly letter: string;
  readonly label: string;
  readonly value: string | null;
}

/** The fields before and after, in step: the same fields in the same order. */
export interface FieldChanges {
  readonly before: ReadonlyArray<ChangedField>;
  readonly after: ReadonlyArray<ChangedField>;
}

/** The words for a material that the Material Master no longer lists (deleted since it was chosen), so the entry still says something and never shows an ID. */
export const REMOVED_MATERIAL_TEXT = 'A removed material';

/** The longest text one field keeps in an entry; a longer one is cut, so a long remark can never make the entry refuse (and the save with it). */
export const MAX_ENTRY_VALUE_LENGTH = 2_000;

/** The display text of one stored value, or null for a blank. */
function displayOf(field: FormFieldView, stored: unknown, materialNames: ReadonlyMap<string, string>): string | null {
  if (stored === undefined || stored === null) return null;
  switch (field.rule.type) {
    case 'treatment': {
      const choice = treatmentChoiceOf(stored);
      return choice === null || choice.text === '' ? null : choice.text;
    }
    case 'select':
      return typeof stored === 'string' && stored !== '' ? (materialNames.get(stored.toLowerCase()) ?? REMOVED_MATERIAL_TEXT) : null;
    case 'flag':
      return stored === '1' ? 'Yes' : stored === '0' ? 'No' : null;
    case 'derived':
    case 'picture':
      return null;
    default:
      return typeof stored === 'string' && stored !== '' ? stored : null;
  }
}

export function changedFields(document: ConfigDocument, before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>, materialNames: ReadonlyMap<string, string>): FieldChanges {
  const was: ChangedField[] = [];
  const now: ChangedField[] = [];
  for (const field of buildFormSections(document).flatMap((section) => section.fields)) {
    if (!field.editable || (!(field.id in before) && !(field.id in after))) continue;
    const from = displayOf(field, before[field.id], materialNames);
    const to = displayOf(field, after[field.id], materialNames);
    if (from === to) continue;
    was.push({ letter: field.letter, label: field.label, value: from === null ? null : from.slice(0, MAX_ENTRY_VALUE_LENGTH) });
    now.push({ letter: field.letter, label: field.label, value: to === null ? null : to.slice(0, MAX_ENTRY_VALUE_LENGTH) });
  }
  return { before: was, after: now };
}
