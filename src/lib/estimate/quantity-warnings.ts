import { findFieldByKey, findSystemField } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';

import { PART_NAME_KEYS } from './calculate-check';
import { validateNumberInput } from './validation';
import { QTY_ZERO_CODE } from './warning-copy';

/**
 * The quantity warning (STORY-05.12 AC-1; FR-104; SPEC section 7.3; architecture section 4.3 "A zero quantity"): one warning for every row whose QTY per Assy (H) is 0, wherever the row sits
 * in the tree, a top-level item's own 0 included. A 0 affects only its own row, so the rule is one test of one value and the position of the row does not matter. Pure, so the unit tests cover
 * every case (CE-9 variants A to G) without a database.
 *
 *   - **Its own file.** The story names `validation.ts`; the rule lives beside `calculate-check.ts` for the reason that file gives (STORY-05.09): `validation.ts` is read by the browser (the part
 *     form), and this rule pulls in the registry and the part's name, which only the server needs, and the page's first load has no room left (NFR-009, `/estimates/[code]`). It reads one number
 *     through `validateNumberInput` (the form's own rule, so `0` and `0.00` are the same and `0.01` is not 0), and it is held to the same 95 % of pure code (`vitest.config.ts`).
 *   - **H is found by its system role** (`quantity`), so re-lettering the column cannot break it. A registry with no such field warns nothing: there is no H to read.
 *   - **Rows and inputs only.** A row is its ID, its Sl. No and what it holds by field ID. It takes no calculated output, so a warning can never depend on a master value or a figure (NFR-002),
 *     and a `RowOutputs` is refused by the compiler.
 *   - **A blank is not a 0.** A blank H is a missing input, and Calculate refuses it first (422 `CALCULATE_BLOCKED`), so nobody acknowledges a warning and is then refused for a blank.
 *   - **The label** is the part's name as it is typed now (Description, else Part No.), kept as text in the stored warning (ADR-007). A part with no name has an empty label.
 */

/** One row to be checked: what the tree and the form hold for it. `inputs` is by field ID; a value that is not text is read as nothing. */
export interface WarningRow {
  readonly id: string;
  readonly slNo: string;
  readonly inputs: Readonly<Record<string, unknown>>;
}

/** What is kept for each warned row: the code, the part, its Sl. No and its name as text at that moment (`calculations.warnings`; the audit entry). No figure. */
export interface QuantityWarning {
  readonly code: typeof QTY_ZERO_CODE;
  readonly nodeId: string;
  readonly slNo: string;
  readonly label: string;
}

/** What a normalised 0 is: two decimals, as every stored number is (`normaliseDecimalText`). */
const NORMALISED_ZERO = '0.00';

/** The ID of the field that holds QTY per Assy, or `undefined` if the registry has none. The 409 names it so the dialog can take the person to it. */
export function quantityFieldIdOf(document: ConfigDocument): string | undefined {
  return findSystemField(document, 'quantity')?.id;
}

const typedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The part's name: the first of Description and Part No. that holds a text, or an empty text. */
function labelOf(row: WarningRow, nameFieldIds: ReadonlyArray<string>): string {
  for (const fieldId of nameFieldIds) {
    const text = typedText(row.inputs[fieldId]);
    if (text !== '') return text;
  }
  return '';
}

/** One warning for each row whose QTY per Assy is 0, in the order the rows are given (the tree's reading order). */
export function quantityWarnings(rows: ReadonlyArray<WarningRow>, document: ConfigDocument): QuantityWarning[] {
  const quantityId = quantityFieldIdOf(document);
  if (quantityId === undefined) return [];
  const nameFieldIds = PART_NAME_KEYS.flatMap((key) => findFieldByKey(document, key)?.id ?? []);
  const warnings: QuantityWarning[] = [];
  for (const row of rows) {
    const check = validateNumberInput(typedText(row.inputs[quantityId]));
    if (check.ok && check.value === NORMALISED_ZERO) warnings.push({ code: QTY_ZERO_CODE, nodeId: row.id, slNo: row.slNo, label: labelOf(row, nameFieldIds) });
  }
  return warnings;
}
