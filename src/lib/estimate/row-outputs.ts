import 'server-only';

import { Decimal, type Value } from '../decimal';

/**
 * One node's calculated fields, columns M to BK (SPEC section 7.4; FR-024, FR-027; architecture sections 4.2 and 5.1).
 *
 * **Restricted** (ADR-008, NFR-002): this module holds calculated costs, so nothing an Engineer's code path can reach may
 * import it. `eslint.config.mjs` refuses it from the Engineer views (`src/server/views/engineer-*`), and `server-only` keeps it out of
 * every client component. Calculated values live in this type and in the `calculation_rows` table, never in an input type.
 */

/** What a person sees where a figure cannot be worked out (SPEC section 8.2, A-07). The export leaves the cell empty instead. */
export const NO_FIGURE_TEXT = '—';

/** The decimals a figure shows (FR-027): 2. The stored value keeps all of its digits. */
const DISPLAY_PLACES = 2;

/** The outputs of one row by field ID, each a `Decimal` (34 significant digits, half-up) or `null` for no figure. */
export interface RowOutputs {
  readonly values: ReadonlyMap<string, Value>;
}

/** A row's outputs as they are stored and returned: full-precision decimal text by field ID, `null` for no figure. Never a JavaScript number. */
export type StoredRowOutputs = Readonly<Record<string, string | null>>;

/**
 * The stored form of a row's outputs (FR-027). `Decimal` is configured never to write an exponent, and `toString` writes zero without a
 * sign, so the text is always a plain decimal such as `0.0000000001` or `0`.
 */
export function storeRowOutputs(outputs: RowOutputs): StoredRowOutputs {
  return Object.fromEntries([...outputs.values].map(([fieldId, value]) => [fieldId, value === null ? null : value.toString()]));
}

/**
 * A stored value as the screen shows it: 2 decimals, a tie rounded away from zero as Excel does, or a dash for no figure. A stored value
 * therefore differs from the shown one only by that rounding (FR-027).
 */
export function displayStoredValue(stored: string | null): string {
  return stored === null ? NO_FIGURE_TEXT : new Decimal(stored).toFixed(DISPLAY_PLACES);
}
