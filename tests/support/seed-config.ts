import { columnLetterToIndex } from '../../src/lib/columns';
import type { FieldDefinition } from '../../src/lib/fields/field-schema';
import type { ConfigDocument } from '../../src/lib/fields/schema';
import { SEED_PROCESS_ITEMS, SEED_VERSION_REASON, seedConfig } from '../../prisma/seed/config';

/**
 * The `seedConfig` fixture (test strategy section 4): the SPEC section 7 registry, from the same module
 * production seeds from, so a test and an install can never disagree about the seed.
 */
export { SEED_PROCESS_ITEMS, SEED_VERSION_REASON, seedConfig };

/** A deep copy a test may change freely. The shared `seedConfig` must never be mutated. */
export function cloneSeedConfig(): ConfigDocument {
  return structuredClone(seedConfig);
}

/**
 * The seed field at a SPEC letter. Tests may write letters (coding standards section 10); production code
 * derives them.
 */
export function seedFieldAt(letter: string, document: ConfigDocument = seedConfig): FieldDefinition {
  const field = document.fields[columnLetterToIndex(letter) - 1];
  if (field === undefined) throw new Error(`The seed has no field at ${letter}.`);
  return field;
}
