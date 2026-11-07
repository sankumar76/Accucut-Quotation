import { FormulaError, toDisplayForm, toInternalForm, type RateReference } from '../formula';

import { referenceContext } from './registry';
import type { ConfigDocument } from './schema';

/**
 * The property that keeps a stored formula meaning what it meant (DEF-006, QLT-15 of the G6 of AQP-113): **every formula of the
 * configuration comes back unchanged from its display form under the current rate names**, that is
 * `toInternalForm(toDisplayForm(f, names), names) === f`. Whether a name is ambiguous depends on how display form is read (longest
 * name first, never backing up), not on the names alone, so a rule about names cannot be both complete and free of false refusals.
 * This asks the question directly of the formulas that exist. Pure; the caller passes the document and the set of rates.
 *
 * A formula that cannot be shown or read back at all (a reference to a rate the set does not hold) does not round-trip either.
 */

/** The IDs of the fields whose formula does not round-trip under `rates`. Empty when every stored formula keeps its meaning. */
export function fieldsThatDoNotRoundTrip(document: ConfigDocument, rates: ReadonlyArray<RateReference>): ReadonlySet<string> {
  const context = referenceContext(document, rates);
  const broken = new Set<string>();
  for (const field of document.fields) {
    if (field.kind === 'output' && field.formula !== null && !roundTrips(field.formula, context)) broken.add(field.id);
  }
  return broken;
}

function roundTrips(formula: string, context: ReturnType<typeof referenceContext>): boolean {
  try {
    return toInternalForm(toDisplayForm(formula, context), context) === formula;
  } catch (error) {
    if (error instanceof FormulaError) return false;
    throw error;
  }
}

/**
 * The fields whose formula round-trips under `before` and does not under `after`: what a change to the rates would break. A formula
 * that was already broken is not the change's doing and does not refuse it (QLT-17).
 */
export function fieldsBrokenByChange(document: ConfigDocument, before: ReadonlyArray<RateReference>, after: ReadonlyArray<RateReference>): string[] {
  const broken = [...fieldsThatDoNotRoundTrip(document, after)];
  // The usual answer is "nothing is broken", and then the rates before the change need not be read at all.
  if (broken.length === 0) return [];
  const alreadyBroken = fieldsThatDoNotRoundTrip(document, before);
  return broken.filter((id) => !alreadyBroken.has(id));
}
