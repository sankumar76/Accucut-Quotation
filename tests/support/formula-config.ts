import type { ConfigDocument } from '../../src/lib/fields/schema';

import { cloneSeedConfig } from './seed-config';

/**
 * A configuration for the tests of what a rate name may be (DEF-006, QLT-15): the seed registry with one more stored formula, so a
 * test can say "a formula `{{rate:A}}-{{rate:B}}` exists". The formula goes on the one output field that the seed leaves without a
 * formula (the Approved Quote Price, which is entered), so no seed formula changes and the 15 seed rates keep the uses they have.
 */

/** A rate reference as a stored formula holds it. */
export const rateRef = (id: string): string => `{{rate:${id}}}`;

/** The seed configuration with `formula` stored on the field that has none. */
export function configurationWithFormula(formula: string): ConfigDocument {
  const document = cloneSeedConfig();
  const empty = document.fields.find((field) => field.kind === 'output' && field.formula === null);
  if (empty === undefined) throw new Error('The seed registry has no output field without a formula.');
  return { ...document, fields: document.fields.map((field) => (field === empty && field.kind === 'output' ? { ...field, formula } : field)) };
}
