import { Decimal, type Value } from '../decimal';
import { typedFieldValue } from '../estimate/row-calculator';
import { findFieldById, findFieldByKey, fieldLetter, referenceContext } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { MATERIAL_IN_DRAWING_KEY, MATERIAL_RATE_KEY, type MaterialOperandKey } from '../fields/types';
import { createRateLookup, evaluateWithWorking, referenceDisplayName, type Expression, type RateReference, type Resolver } from '../formula';
import { NO_FIGURE, toTwoPlaces } from '../money';

/**
 * The preview of an edited formula on a row of the latest calculated estimate (STORY-08.02 AC-1, AC-3, AC-8; FR-073; architecture section 6 "Sample rows"): the new formula is worked out once, from the values that row
 * and its calculation stored, and **nothing is written** ("The preview changes nothing"). Pure: the stored figures are passed in.
 *
 * Every other field is read as the calculation stored it (a typed input, a looked-up price, a calculated output), so the preview answers "what would this one formula give on that row", not "what would the
 * whole chain give": a field that reads this one keeps its stored figure. A division by zero, a field with no stored figure or a rate the calculation never read is no figure, shown as the dash and never a
 * crash (AC-8, BR-039). A formula with one value for the whole estimate (BL) is worked out over every row of the sample estimate; it reads a figure of the product only for the total and the tool cost.
 */

/** A row's typed values and calculated outputs by field ID, as the calculation record keeps them: full-precision decimal text, words, or `null`. */
export type StoredFigures = Readonly<Record<string, string | null>>;

export interface PreviewRow {
  readonly nodeId: string;
  readonly slNo: string;
  readonly inputs: StoredFigures;
  readonly outputs: StoredFigures;
}

/** What the calculation's master snapshot holds that a preview reads. */
export interface PreviewSnapshot {
  readonly rates: ReadonlyArray<{ readonly id: string; readonly name: string; readonly value: string }>;
  readonly materials: ReadonlyArray<{ readonly materialInDrawing: string; readonly pricePerKg: string; readonly specificGravity: string; readonly scrapRate: string }>;
  readonly exchangeRates: { readonly usd: string | null; readonly eur: string | null };
}

export interface PreviewProduct {
  readonly totalPrice: string | null;
  readonly toolCostTotal: string | null;
}

export interface PreviewInput {
  /** The document with the edited formula in place. */
  readonly document: ConfigDocument;
  readonly rates: ReadonlyArray<RateReference>;
  readonly fieldId: string;
  readonly expression: Expression;
  readonly snapshot: PreviewSnapshot;
  readonly product: PreviewProduct;
  /** Every row of the sample estimate, for `SUM`. */
  readonly rows: ReadonlyArray<PreviewRow>;
  /** The row chosen to try the formula on; `null` for a formula that has one value for the estimate. */
  readonly row: PreviewRow | null;
}

export interface PreviewOperand {
  /** A field as `P Cutting Time`, a rate or an operand by its name, or a total as `SUM(BG)`. */
  readonly name: string;
  /** Full-precision decimal text as used, or `null` where there was no figure. */
  readonly value: string | null;
}

export interface FormulaPreview {
  /** The Sl. No of the row the formula was tried on, or `null` for a whole-estimate formula. */
  readonly slNo: string | null;
  /** The result at full precision, or `null` for no figure. */
  readonly value: string | null;
  /** The result as the screen prints it: two decimals, or the dash (AC-3, AC-8). */
  readonly shown: string;
  readonly operands: ReadonlyArray<PreviewOperand>;
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;
const decimalOf = (text: string | null | undefined): Value => (text !== undefined && text !== null && DECIMAL_TEXT.test(text) ? new Decimal(text) : null);

type SnapshotMaterial = PreviewSnapshot['materials'][number];

/** The material of the row, found by the words of E that the calculation stored. */
function materialOf(document: ConfigDocument, snapshot: PreviewSnapshot, row: PreviewRow | undefined): SnapshotMaterial | undefined {
  const field = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  const words = field === undefined ? undefined : row?.inputs[field.id];
  return typeof words === 'string' ? snapshot.materials.find((material) => material.materialInDrawing === words) : undefined;
}

function typedMapOf(document: ConfigDocument, row: PreviewRow): ReadonlyMap<string, Value> {
  const typed = new Map<string, Value>();
  for (const field of document.fields) {
    if (field.kind !== 'input' || (field.dataType !== 'number' && field.dataType !== 'flag')) continue;
    const value = decimalOf(row.inputs[field.id]);
    if (value !== null) typed.set(field.id, value);
  }
  return typed;
}

function resolverOf(input: PreviewInput): Resolver {
  const { document, snapshot, product, rows, row } = input;
  const material = materialOf(document, snapshot, row ?? rows[0]);
  const rate = createRateLookup(snapshot.rates.map((item) => ({ id: item.id, name: item.name, value: decimalOf(item.value) })));
  const typedOf = new Map(rows.map((each) => [each.nodeId, typedMapOf(document, each)]));

  /** One row's value of a field: calculated as stored, looked up, or typed. */
  const rowValue = (each: PreviewRow, fieldId: string): Value => {
    const field = findFieldById(document, fieldId);
    if (field?.kind === 'output') return decimalOf(each.outputs[fieldId]);
    if (field?.kind === 'auto') return field.key === MATERIAL_RATE_KEY ? decimalOf(materialOf(document, snapshot, each)?.pricePerKg) : null;
    return typedFieldValue(document, typedOf.get(each.nodeId) ?? new Map(), fieldId);
  };

  const materialValue = (key: MaterialOperandKey): Value => decimalOf(material?.[key]);
  return {
    fieldValue(fieldId) {
      const field = findFieldById(document, fieldId);
      if (field?.rowScope === 'product') {
        if (field.systemRole === 'total') return decimalOf(product.totalPrice);
        return field.systemRole === 'tool-cost' ? decimalOf(product.toolCostTotal) : null;
      }
      return row === null ? null : rowValue(row, fieldId);
    },
    columnValues: (fieldId) => rows.map((each) => rowValue(each, fieldId)),
    rate,
    material: materialValue,
    exchangeRate: (currency) => decimalOf(currency === 'USD' ? snapshot.exchangeRates.usd : snapshot.exchangeRates.eur),
  };
}

/** Works the edited formula out once on the chosen row and says what it read. */
export function previewFormula(input: PreviewInput): FormulaPreview {
  const context = referenceContext(input.document, input.rates);
  const { value, operands } = evaluateWithWorking(input.expression, resolverOf(input));
  const nameOf = (fieldId: string): string => {
    const field = findFieldById(input.document, fieldId);
    return field === undefined ? '?' : fieldLetter(field);
  };
  const shownOperands = operands.map((operand): PreviewOperand => {
    if (operand.kind === 'sum') return { name: `SUM(${nameOf(operand.fieldId)})`, value: operand.value?.toString() ?? null };
    const letterOrName = referenceDisplayName(operand.reference, context) ?? '?';
    const field = operand.reference.kind === 'field' ? findFieldById(input.document, operand.reference.id) : undefined;
    return { name: field === undefined ? letterOrName : `${letterOrName} ${field.label}`, value: operand.value?.toString() ?? null };
  });
  const text = value?.toString() ?? null;
  return { slNo: input.row?.slNo ?? null, value: text, shown: (text === null ? null : toTwoPlaces(text)) ?? NO_FIGURE, operands: shownOperands };
}
