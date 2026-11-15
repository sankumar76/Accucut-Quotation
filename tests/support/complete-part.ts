import type { ConfigDocument } from '../../src/lib/fields/schema';
import { findFieldByKey } from '../../src/lib/fields/registry';

import { completePartInputsFor, INVENTED_MATERIAL_ID } from './complete-part-inputs';
import { seedConfig } from './seed-config';

/**
 * A part with every input Calculate needs, over the seed registry (STORY-05.09): see `complete-part-inputs.ts`, which takes the registry as a parameter. A test changes one value to make one
 * thing wrong. Every value is invented.
 */

export { INVENTED_MATERIAL_ID, INVENTED_NUMBER, INVENTED_TEXT } from './complete-part-inputs';

/** The stored inputs of a complete part of the seed registry, by field ID. */
export function completePartInputs(document: ConfigDocument = seedConfig, materialId: string = INVENTED_MATERIAL_ID): Record<string, string> {
  return completePartInputsFor(document, materialId);
}

/** The ID of the registry's field with this key. Throws for a key the registry does not have. */
export function fieldIdOf(key: string, document: ConfigDocument = seedConfig): string {
  const field = findFieldByKey(document, key);
  if (field === undefined) throw new Error(`The registry has no field "${key}".`);
  return field.id;
}
