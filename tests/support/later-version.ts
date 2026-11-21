import { deleteField } from '../../src/lib/config/field-delete';
import { insertFields } from '../../src/lib/config/field-insert';
import { findFieldByKey } from '../../src/lib/fields/registry';
import type { ConfigDocument } from '../../src/lib/fields/schema';

import { defined } from './defined';
import { inputAfterAx } from './insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig } from './seed-config';

/**
 * A later configuration version made the way the Admin's screens make it (STORY-08.03 and STORY-08.04, through their pure cores, so a unit test needs no database): Part No. (B) is deleted and an input
 * is inserted after AX. The document goes through the registry's own schema, as a stored version does. Written once for the tests of STORY-08.05 that need "the configuration changed after the estimate".
 * Every name is invented.
 */

export const LATER_INPUT_LABEL = 'Invented Later Notch Count';
const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));

/** The seed field the later version deletes: nothing uses it, it is on the Engineer's form, and every later column moves when it goes. */
export const DELETED_FIELD = defined(findFieldByKey(seedConfig, 'part-no'));

export interface LaterVersion {
  readonly document: ConfigDocument;
  /** The ID of the input the later version adds. */
  readonly insertedId: string;
  /** The ID of the field the later version no longer has. */
  readonly deletedId: string;
}

export function laterVersion(): LaterVersion {
  const deleted = deleteField({ document: seedConfig, rates: RATES, fieldId: DELETED_FIELD.id });
  if (!deleted.ok) throw new Error('The invented delete must succeed.');
  const inserted = insertFields({ document: deleted.document, rates: RATES, spec: inputAfterAx({ label: LATER_INPUT_LABEL, defaultValue: '1' }) });
  if (!inserted.ok) throw new Error('The invented insert must succeed.');
  return { document: inserted.document, insertedId: defined(inserted.inserted[0]).id, deletedId: DELETED_FIELD.id };
}
