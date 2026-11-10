import { fieldLetter, findFieldByKey } from './registry';
import type { ConfigDocument } from './schema';

/**
 * A field of the registry looked up by its **key**, for copy that names a column (UX-23, STORY-02.04 AC-5): "The rate (<its letter>) feeds
 * Unit Production Price (USD), <its letter>." The letter is derived from the field's position in the document you pass (`fieldLetter`, FR-021), never typed
 * and never cached, so a later re-lettering is followed at the next read. A key is the field's stable name (`exchange-rate-usd`); its letter and
 * its label may change.
 */

/** A column as a hint names it: the letter it has now, and its name. */
export interface FieldColumn {
  readonly letter: string;
  readonly label: string;
}

/** The letter and the name of the field with this key, or `null` if the document has none. */
export function columnOfKey(document: ConfigDocument, key: string): FieldColumn | null {
  const field = findFieldByKey(document, key);
  return field === undefined ? null : { letter: fieldLetter(field), label: field.label };
}
