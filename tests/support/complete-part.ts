import { buildFormSections } from '../../src/lib/estimate/form-fields';
import type { ConfigDocument } from '../../src/lib/fields/schema';
import { findFieldByKey } from '../../src/lib/fields/registry';

import { seedConfig } from './seed-config';

/**
 * A part with every input Calculate needs, as the part form stores it (STORY-05.09): each field of the form that a person types and Calculate needs, by field ID, with an invented value
 * the field's own rule accepts (a number with two decimals, a short text, the ID of a material). Fasteners (S) is left to its default "None", so Fasteners Qty (T) and Cost (U) are
 * hidden and not needed. A test changes one value to make one thing wrong. Every value is invented.
 */

/** The ID of the invented material every complete part names. A lower-case UUID, as the form stores a choice. */
export const INVENTED_MATERIAL_ID = '00000000-0000-4000-8000-0000000000a1';

export const INVENTED_NUMBER = '12.50';
export const INVENTED_TEXT = 'Invented text';

/** True for a field that a rule of the registry can hide (Fasteners Qty and Cost): a part whose Fasteners is "None" has nothing typed in it. */
function isHidable(document: ConfigDocument, fieldId: string): boolean {
  const found = document.fields.find((candidate) => candidate.id === fieldId);
  return found?.kind === 'input' && found.visibleWhen !== null;
}

/** The stored inputs of a complete part, by field ID. */
export function completePartInputs(document: ConfigDocument = seedConfig): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const section of buildFormSections(document)) {
    for (const field of section.fields) {
      if (!field.editable || !field.required || isHidable(document, field.id)) continue;
      if (field.rule.type === 'select') inputs[field.id] = INVENTED_MATERIAL_ID;
      else if (field.rule.type === 'number') inputs[field.id] = INVENTED_NUMBER;
      // A field with a default (Fasteners: "None") is left to it, as a part nobody typed into is.
      else if (field.defaultValue === null) inputs[field.id] = INVENTED_TEXT;
    }
  }
  return inputs;
}

/** The ID of the registry's field with this key. Throws for a key the registry does not have. */
export function fieldIdOf(key: string, document: ConfigDocument = seedConfig): string {
  const field = findFieldByKey(document, key);
  if (field === undefined) throw new Error(`The registry has no field "${key}".`);
  return field.id;
}
