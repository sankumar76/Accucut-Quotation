import { fieldLetter } from './registry';
import type { ConfigDocument } from './schema';

/**
 * Which formulas use which Process Master rate (STORY-02.01 AC-1, AC-4; architecture section 4.5). A formula is stored in internal
 * form, where a rate is `{{rate:<id>}}`, so the answer is a scan of the stored text for that reference. No formula is parsed: a
 * reference that is in the text is a use, whatever the text around it is, which errs on the side of refusing a delete.
 *
 * Pure; the caller passes the current configuration version's document. The letter is derived from the field's position, as
 * everywhere (coding standards section 10), so it is right after a field is inserted.
 */

/** One formula that uses a rate: the field's column letter and its label. */
export interface RateUse {
  readonly letter: string;
  readonly label: string;
}

const RATE_REFERENCE = /\{\{rate:([0-9a-fA-F-]{36})\}\}/g;

/** The rate IDs in a stored formula, in lower case. */
function rateIdsIn(formula: string): ReadonlySet<string> {
  return new Set(Array.from(formula.matchAll(RATE_REFERENCE), (match) => (match[1] ?? '').toLowerCase()));
}

/**
 * Every rate ID that some formula of the document uses, with the formulas that use it in column order. A rate no formula uses
 * is not in the map. Reads only the `formula` of an output field (no other kind has one): the other places a field can refer to another (`hideWhenZero`, `visibleWhen`, stage
 * totals) name fields, never rates.
 */
export function rateUsesOf(document: ConfigDocument): ReadonlyMap<string, ReadonlyArray<RateUse>> {
  const uses = new Map<string, RateUse[]>();
  const byPosition = [...document.fields].sort((a, b) => a.position - b.position);
  for (const field of byPosition) {
    if (field.kind !== 'output' || field.formula === null) continue;
    for (const rateId of rateIdsIn(field.formula)) {
      const list = uses.get(rateId) ?? [];
      list.push({ letter: fieldLetter(field), label: field.label });
      uses.set(rateId, list);
    }
  }
  return uses;
}
