import type { FieldDefinition } from '../fields/field-schema';
import { findFieldByKey } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';

import { PART_NAME_KEYS } from './calculate-check';

/**
 * The words of a part's name on a review screen (STORY-06.02, STORY-06.03; FR-029): what was typed in Description, else in Part No., else nothing. An input, never a figure, so it is read from the
 * part as it is now. One copy, used by the estimate review and by the cost details of a row.
 */

/** The typed text of a part's field, or `null` when none was typed. */
export const typedText = (inputs: Readonly<Record<string, unknown>>, field: FieldDefinition | undefined): string | null => {
  const value = field === undefined ? undefined : inputs[field.id];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/** The words of a part's name: Description, else Part No., else empty. */
export function partNameOf(document: ConfigDocument, inputs: Readonly<Record<string, unknown>>): string {
  for (const key of PART_NAME_KEYS) {
    const name = typedText(inputs, findFieldByKey(document, key));
    if (name !== null) return name;
  }
  return '';
}
