import { indexToColumnLetter } from '../../src/lib/columns';

/**
 * A stored formula as a person would read it (STORY-01.03 QLT-05): `{{f:<id>}}` as the column letter of the field's position,
 * `{{rate:<id>}}` as the rate's name, `{{mat:<key>}}` and `{{fx:<currency>}}` as the operand names of SPEC section 8.2. This is the form a
 * careless view would print, so the scan forbids it as well as the internal form.
 *
 * The engine's own `toDisplayForm` is `server-only` and so cannot be imported into the Playwright process that runs the scan; this is a
 * small copy for the scan's use, and `tests/security/formula-display.test.ts` shows it equals `toDisplayForm` for every seed formula, so
 * the two cannot drift apart unnoticed.
 */

const MATERIAL_NAMES: Readonly<Record<string, string>> = {
  pricePerKg: 'Material-Price-per-kg',
  specificGravity: 'Material-Specific-Gravity',
  scrapRate: 'Material-Scrap-Rate',
};
const EXCHANGE_PREFIX = 'ExchangeRate-';

export interface DisplayContext {
  /** The 1-based position of each field, by field ID (the column letter is derived from it, never stored). */
  readonly positionOf: ReadonlyMap<string, number>;
  /** The name of each Process Master rate, by ID. */
  readonly rateNameOf: ReadonlyMap<string, string>;
}

const REFERENCE = /\{\{(f|rate|mat|fx):([^}]+)\}\}/g;

/** The display form of an internal-form formula. A reference it cannot resolve is left as it was, so the internal text stays findable. */
export function displayFormOf(internalForm: string, context: DisplayContext): string {
  return internalForm.replace(REFERENCE, (whole, kind: string, key: string) => {
    switch (kind) {
      case 'f': {
        const position = context.positionOf.get(key);
        return position === undefined ? whole : indexToColumnLetter(position);
      }
      case 'rate':
        return context.rateNameOf.get(key) ?? whole;
      case 'mat':
        return MATERIAL_NAMES[key] ?? whole;
      case 'fx':
        return `${EXCHANGE_PREFIX}${key}`;
      default:
        return whole;
    }
  });
}
