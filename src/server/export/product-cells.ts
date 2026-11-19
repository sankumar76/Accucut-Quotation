import { indexToColumnLetter } from '../../lib/columns';
import { fieldLetter, findFieldByKey, findSystemField } from '../../lib/fields/registry';
import type { FieldDefinition } from '../../lib/fields/field-schema';
import type { ConfigDocument } from '../../lib/fields/schema';
import { PRICE_PER_TOOL_COST_KEY } from '../../lib/fields/types';

import type { ExportCell, ExportFooter, ExportRow } from './export-model';
import { numberOf } from './rows';

/**
 * The cells of the file that belong to the product and not to a part (STORY-07.03 AC-1, AC-3, AC-4, AC-6; FR-069, FR-103, FR-107, FR-108; D-05, D-16, D-29; SPEC section 10; architecture sections 4.6 and 4.10): BL2,
 * BN2 and BO2 in row 2, and the footer of the total Tool Cost. **This is the one place that decides them**, as a pure function of the registry and four figures, so a test calls it with no database.
 *
 * **Found by role, never by letter** (coding standards section 10): BL is the field with the `total` role, BN the field with the key `price-per-tool-cost` and BO the field with the `approved-price` role, so the
 * cells follow their columns when a field is inserted and the letters move. The footer's value is in the column of the `tool-cost` role and its label in the column to the left of it.
 *
 * **Once, in row 2 (D-16).** The file has no per-item totals: every other row holds nothing in these three columns. **The total Tool Cost** is the plain sum of every part's Tool Cost with no quantity applied, as the
 * calculation stored it (`product_values.toolCostTotal`), so an approved file never changes. It cannot go in row 2, because the Tool Cost cell of row 2 is the first part's own entry: it goes in a footer row two below
 * the last part, with one empty row between (10 parts in rows 2 to 11 give row 13). With no Tool Cost entered it shows 0 and BN2 stays empty.
 *
 * **BO2 (D-29, architecture section 4.10).** It holds the price of the estimate's **latest approval** and nothing when there is none or when it was cancelled. The latest approval is read through
 * `findLatestApproval` (it answers none once the price was removed), so this module is only told the answer: a price approved earlier still stands after an unlock, and a cancelled approval leaves the file.
 *
 * **The override's reason goes in no cell** (FR-103, PRD v0.7): this module is not given it. A figure is a number at full precision and the registry's own two-decimal format shows it; a figure that could not be
 * worked out (a division by zero) is an empty cell. Text goes in as a string only, so nothing can become a live formula.
 */

/** The label of the footer, in the cell to the left of the Tool Cost column. */
export const TOTAL_TOOL_COST_LABEL = 'Total Tool Cost';

/** One empty row between the last part and the footer (UX spec SCR-10; architecture section 4.6): the footer is at `lastNodeRow + 2`. */
const ROWS_BELOW_THE_LAST_PART = 2;
/** Row 1 is the header, so the first part is in row 2. */
const HEADER_ROW = 1;
const FIRST_NODE_ROW = HEADER_ROW + 1;

/** The four figures of the product's cells, each as the decimal text it is stored as, or `null` for no figure. */
export interface ProductFigures {
  /** BL: the stored total price. */
  readonly totalPrice: string | null;
  /** BN: BL divided by the total Tool Cost; `null` with no Tool Cost. */
  readonly pricePerToolCost: string | null;
  /** The plain sum of every part's Tool Cost; `null` or 0 with none entered. */
  readonly toolCostTotal: string | null;
  /** BO as the file holds it, from `approvedPriceOf`. */
  readonly approvedPrice: string | null;
}

/** What the file needs of the estimate's latest approval: its price, and the cancel if one was stored. The record `findLatestApproval` answers has both (and more, which is not read here). */
export interface LatestApproval {
  readonly approvedPrice: string;
  readonly cancel: object | null;
}

/**
 * BO as the file holds it: the latest approval's price, or `null` when there is no approval (never approved, or the price was removed: `findLatestApproval` answers none) or the approval was cancelled (D-29; the
 * price stays on screen, labelled "Approval cancelled", and leaves the file). An unlocked approval keeps its price: the unlock is stored apart from it.
 */
export function approvedPriceOf(latest: LatestApproval | null): string | null {
  return latest === null || latest.cancel !== null ? null : latest.approvedPrice;
}

function required(field: FieldDefinition | undefined, what: string): FieldDefinition {
  if (field === undefined) throw new Error(`The configuration version has no field for ${what}.`);
  return field;
}

/** The letters of the product's own cells and of the footer's two cells, found in the registry (never written by hand). */
export interface ProductLetters {
  /** BL, the total price. */
  readonly bl: string;
  /** BN, BL per Tool Cost. */
  readonly bn: string;
  /** BO, the approved price. */
  readonly bo: string;
  /** The Tool Cost column: the footer's number is in it, and so is every part's own Tool Cost. */
  readonly toolCost: string;
  /** The cell to the left of the Tool Cost column: the footer's label. */
  readonly footerLabel: string;
}

export function productLetters(document: ConfigDocument): ProductLetters {
  const toolCost = required(findSystemField(document, 'tool-cost'), 'the Tool Cost');
  // The label has a cell only if the Tool Cost column is not the first: a registry whose first column were the Tool Cost could not hold it, which is a fault in the data and never a footer without its label.
  if (toolCost.position <= 1) throw new Error('The Tool Cost column has no cell to its left for the footer label.');
  return {
    bl: fieldLetter(required(findSystemField(document, 'total'), 'the total price')),
    bn: fieldLetter(required(findFieldByKey(document, PRICE_PER_TOOL_COST_KEY), 'the price per Tool Cost')),
    bo: fieldLetter(required(findSystemField(document, 'approved-price'), 'the approved price')),
    toolCost: fieldLetter(toolCost),
    footerLabel: indexToColumnLetter(toolCost.position - 1),
  };
}

const figureCell = (text: string | null): ExportCell => (text === null ? null : numberOf(text, 'A stored figure is not a number.'));

/**
 * The rows with BL2, BN2 and BO2 filled in. Only the first row is touched; the others keep their own empty cells in these columns (no per-item total). A copy: the rows given are not changed. With no row
 * there is no row 2 and nothing is written.
 */
export function withProductCells(document: ConfigDocument, rows: ReadonlyArray<ExportRow>, figures: ProductFigures): ExportRow[] {
  const letters = productLetters(document);
  return rows.map((row, index) =>
    index > 0
      ? row
      : { ...row, cells: { ...row.cells, [letters.bl]: figureCell(figures.totalPrice), [letters.bn]: figureCell(figures.pricePerToolCost), [letters.bo]: figureCell(figures.approvedPrice) } },
  );
}

/** The sheet's row number of the footer for this many node rows: two below the last (`lastNodeRow + 2`). */
const footerRowOf = (nodeRowCount: number): number => HEADER_ROW + nodeRowCount + ROWS_BELOW_THE_LAST_PART;

/**
 * The footer: "Total Tool Cost" in the cell to the left of the Tool Cost column and the sum in that column, at `lastNodeRow + 2`. No node's own Tool Cost cell is replaced. With no Tool Cost it holds 0.
 */
export function footerOf(document: ConfigDocument, nodeRowCount: number, toolCostTotal: string | null): ExportFooter {
  const letters = productLetters(document);
  return {
    row: footerRowOf(nodeRowCount),
    cells: { [letters.footerLabel]: TOTAL_TOOL_COST_LABEL, [letters.toolCost]: toolCostTotal === null ? 0 : numberOf(toolCostTotal, 'A stored figure is not a number.') },
  };
}

/** Where SCR-10 says the figures are in the file, as cell addresses (`BL2`, `BN2`, `BO2` and the footer's `BM13`), from the same registry the file is built from. */
export function productCellAddresses(document: ConfigDocument, nodeRowCount: number): { readonly bl: string; readonly bn: string; readonly bo: string; readonly toolCostTotal: string } {
  const letters = productLetters(document);
  return {
    bl: `${letters.bl}${String(FIRST_NODE_ROW)}`,
    bn: `${letters.bn}${String(FIRST_NODE_ROW)}`,
    bo: `${letters.bo}${String(FIRST_NODE_ROW)}`,
    toolCostTotal: `${letters.toolCost}${String(footerRowOf(nodeRowCount))}`,
  };
}
