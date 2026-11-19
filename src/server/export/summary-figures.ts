import { Decimal } from '../../lib/decimal';
import { priceDifference } from '../../lib/estimate/approve-price';
import { fieldLetter, findSystemField } from '../../lib/fields/registry';
import type { FieldDefinition } from '../../lib/fields/field-schema';
import type { ConfigDocument } from '../../lib/fields/schema';
import { toTwoPlaces } from '../../lib/money';
import type { ExportFiguresView } from '../views/schemas/export';

import type { ExportCell, ExportFooter, ExportRow } from './export-model';
import { approvedPriceOf, productCellAddresses, productLetters } from './product-cells';

/**
 * The figures SCR-10 shows beside the rows of the file (STORY-07.03 AC-8, AC-9; UX spec SCR-10), **read back from the cells the file holds** and not worked out a second time: each row's H, its own BG and its own
 * Tool Cost (BM), BL2, BN2, BO2 and the total Tool Cost of the footer. So the page cannot say one figure while the file says another, and what it adds up (the BG column against BL2) is the file's own column.
 *
 * It is a pure function of the file's rows and footer and the latest approval, so a test calls it with no database. It is called only while the state of the figures is `current`: the cells were built from the
 * stored record by the one read of it (`readFiguresWhenCurrent`), so nothing here reads a figure.
 *
 * **The approval** is the price in BO2 with the difference from the calculated total it was set against and the reason, which SCR-10 shows and the file never holds (FR-103). It is `null` when BO2 is empty.
 */

/** What the summary needs of the estimate's latest approval: the record `findLatestApproval` answers, and a record with no more than these members is enough. */
export interface SummaryApproval {
  readonly approvedPrice: string;
  readonly approvedAt: Date;
  readonly calculatedTotal: string;
  readonly overrideReason: string | null;
  readonly unlock: object | null;
  readonly cancel: object | null;
}

export interface SummaryFiguresInput {
  readonly document: ConfigDocument;
  /** The node rows of the file, with BL2, BN2 and BO2 filled in. */
  readonly rows: ReadonlyArray<ExportRow>;
  readonly footer: ExportFooter;
  /** The estimate's latest approval, or `null`. */
  readonly approval: SummaryApproval | null;
}

const PLACES = 2;

function required(field: FieldDefinition | undefined, what: string): FieldDefinition {
  if (field === undefined) throw new Error(`The configuration version has no field for ${what}.`);
  return field;
}

/** A cell's number as plain decimal text (never an exponent), or `null` for an empty cell. A text or a number that is not finite is a fault in the model: the file would not have been built. */
function decimalOf(cell: ExportCell | undefined): string | null {
  if (cell === undefined || cell === null) return null;
  if (typeof cell !== 'number' || !Number.isFinite(cell)) throw new Error('A cell of the file is not a number.');
  return new Decimal(cell).toFixed();
}

function requiredDecimal(cell: ExportCell | undefined): string {
  const text = decimalOf(cell);
  if (text === null) throw new Error('A cell of the file holds no number.');
  return text;
}

/** The figure at two decimals, a tie rounded away from zero as the screens do. */
function twoPlaces(text: string): string {
  const rounded = toTwoPlaces(text);
  if (rounded === null) throw new Error('A figure is not a number.');
  return rounded;
}

export function summaryFiguresOf({ document, rows, footer, approval }: SummaryFiguresInput): ExportFiguresView {
  const letters = productLetters(document);
  const slNo = letterOfRole(document, 'sl-no', 'the Sl. No');
  const count = letterOfRole(document, 'quantity', 'the count of a part');
  const unitPrice = letterOfRole(document, 'unit-price', "a row's own price");
  const first = rows[0];
  const bl = decimalOf(first?.cells[letters.bl]);

  const lines = rows.map((row) => {
    const text = row.cells[slNo];
    if (typeof text !== 'string' || text === '') throw new Error('A row of the file has no Sl. No.');
    return { slNo: text, count: requiredDecimal(row.cells[count]), bg: decimalOf(row.cells[unitPrice]), toolCost: requiredDecimal(row.cells[letters.toolCost]) };
  });

  // The BG column added up exactly, and the lines as they are shown (each rounded to two decimals first): SCR-10 says when the two differ by a few hundredths (UX-02).
  const columnSum = lines.reduce((sum, line) => sum.plus(line.bg === null ? 0 : new Decimal(line.bg)), new Decimal(0));
  const linesAsShown = lines.reduce((sum, line) => sum.plus(line.bg === null ? 0 : new Decimal(twoPlaces(line.bg))), new Decimal(0));

  return {
    rows: lines,
    totals: { bl, bn: decimalOf(first?.cells[letters.bn]), bo: decimalOf(first?.cells[letters.bo]), toolCostTotal: requiredDecimal(footer.cells[letters.toolCost]) },
    letters: { count, bg: unitPrice, toolCost: letters.toolCost },
    cells: productCellAddresses(document, rows.length),
    approval: approvalOf(approval),
    reconciliation: {
      columnSum: columnSum.toFixed(),
      linesAsShown: linesAsShown.toFixed(PLACES),
      total: bl,
      matches: bl !== null && twoPlaces(columnSum.toFixed()) === twoPlaces(bl),
    },
  };
}

function letterOfRole(document: ConfigDocument, role: 'sl-no' | 'quantity' | 'unit-price', what: string): string {
  return fieldLetter(required(findSystemField(document, role), what));
}

/** The price in BO2 with what SCR-10 says of it, or `null` when BO2 is empty: no approval (never approved, or its price was removed) or one that was cancelled. */
function approvalOf(approval: SummaryApproval | null): ExportFiguresView['approval'] {
  // The one decision of what BO2 holds is `approvedPriceOf`: the summary says what the file says.
  const price = approvedPriceOf(approval);
  if (approval === null || price === null) return null;
  return {
    price,
    approvedAt: approval.approvedAt.toISOString(),
    earlier: approval.unlock !== null,
    calculatedTotal: approval.calculatedTotal,
    difference: priceDifference(price, approval.calculatedTotal),
    reason: approval.overrideReason,
  };
}
