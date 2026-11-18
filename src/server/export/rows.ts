import { buildTree } from '../../lib/estimate/tree';
import { fieldLetter, findFieldByKey } from '../../lib/fields/registry';
import type { FieldDefinition } from '../../lib/fields/field-schema';
import type { ConfigDocument } from '../../lib/fields/schema';
import { MATERIAL_IN_DRAWING_KEY, MATERIAL_RATE_KEY } from '../../lib/fields/types';
import { isNotApplicableName } from '../../lib/masters/system-entries';

import type { ExportCell, ExportRow } from './export-model';

/**
 * The node rows of the file (STORY-07.02 AC-1 to AC-3, AC-6, AC-7; FR-067, FR-068; SPEC sections 10 and 14.5; architecture section 4.6): a **pure** function from the stored rows of one calculation to the
 * cells of each row, in depth-first order. It reads the registry and the rows it is given and nothing else, so a test calls it with no database, and it is the one place that decides what a cell of
 * a node row holds.
 *
 * **Every column is exported** (FR-068): a number or a flag nobody typed is 0 (Fasteners Qty and Cost while Fasteners is "None", an unselected treatment flag), as the calculation itself read it; an
 * output hidden on screen because it is 0 is stored as 0 and written as 0. A figure that could not be worked out (a division by zero) is stored as `null` and is an **empty cell**, never `Infinity`,
 * `NaN` or words (AC-3). The Sl. No is the text it was stored as, so "1.10" keeps its zero (AC-1). A stored figure that is not a plain decimal is a fault in the record: it is refused with words that
 * hold none of it, and the file is never written with a wrong cell.
 *
 * **Text is text.** A word a person typed goes into the model as a string and the model has no formula cell, so a value that starts with `=`, `+`, `-`, `@`, a tab, a carriage return or a line feed is
 * stored as the string it is (AC-7, NFR-027, GitHub issue 394).
 *
 * **What is not a node row's:** the product-level columns (BL, BN and BO, `rowScope` `product`) are left empty here: row 2 and the footer are STORY-07.03's. The picture column is left empty too: the picture
 * is embedded over the cell by `build-workbook.ts`, so the row only says which picture (`picture`).
 */

/** What the record keeps of one node: the shape of `CalculationRowRecord` that the export reads, and no more. */
export interface StoredExportRow {
  readonly nodeId: string;
  readonly parentId: string | null;
  readonly sortIndex: number;
  /** The Sl. No as it was when Calculate was pressed. */
  readonly slNo: string;
  /** The typed numbers and flags, the typed words, and the resolved words of E and F, by field ID. */
  readonly inputs: Readonly<Record<string, string | null>>;
  readonly imageId: string | null;
  /** The calculated figures as full-precision decimal text by field ID; `null` is "no figure". */
  readonly outputs: Readonly<Record<string, string | null>>;
}

/** A material of the calculation's own snapshot: the words as they were then and the price per kg as decimal text. Nothing else of the material is read. */
export interface StoredMaterial {
  readonly materialInDrawing: string;
  readonly pricePerKg: string;
}

export interface NodeRowsInput {
  readonly document: ConfigDocument;
  readonly rows: ReadonlyArray<StoredExportRow>;
  readonly materials: ReadonlyArray<StoredMaterial>;
  /** The place in the model's list of pictures of this stored picture, or `undefined` when it is not embedded (a kind the workbook cannot hold, or a picture that is not there). */
  readonly pictureIndexOf: (imageId: string) => number | undefined;
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

/** A decimal text as the JavaScript number Excel stores (a double): the stored text keeps its digits, the cell holds what a spreadsheet can. */
function numberOf(text: string, fault: string): number {
  if (!DECIMAL_TEXT.test(text)) throw new Error(fault);
  return Number(text);
}

/** A field a person typed a value into: a number or a flag as a number (0 when nobody typed one), a word as the text it is, or the registry's default when none was given. */
function inputCell(field: Extract<FieldDefinition, { kind: 'input' }>, stored: string | null | undefined): ExportCell {
  switch (field.dataType) {
    case 'image':
      return null;
    case 'number':
    case 'flag':
      // An absent number is 0, as the row calculation itself read it (SPEC section 14 item 4); a typed one is a plain decimal.
      return stored === undefined || stored === null || stored.trim() === '' ? 0 : numberOf(stored, 'A stored number is not a number.');
    case 'text':
    case 'select':
    case 'select_other':
      return typeof stored === 'string' && stored.trim() !== '' ? stored : field.defaultValue;
    default:
      return null;
  }
}

export function exportRowsOf({ document, rows, materials, pictureIndexOf }: NodeRowsInput): ExportRow[] {
  const entries = buildTree(rows.map((row) => ({ id: row.nodeId, parentId: row.parentId, sortIndex: row.sortIndex, row })));
  // A node that cannot be reached from the top is a fault in the record, never a part left out of the file without a word.
  if (entries.length !== rows.length) throw new Error('The calculation holds a part that cannot be reached from the top of its tree.');

  const fields = [...document.fields].sort((a, b) => a.position - b.position).map((field) => ({ field, letter: fieldLetter(field) }));
  const materialField = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  const materialByWords = new Map(materials.map((material) => [material.materialInDrawing, material]));

  /** The material of a row, from the words stored in E and the calculation's own snapshot (the same match the cost details make). */
  function materialOf(row: StoredExportRow): StoredMaterial {
    const words = materialField === undefined ? undefined : row.inputs[materialField.id];
    const found = typeof words === 'string' ? materialByWords.get(words) : undefined;
    if (found === undefined) throw new Error('The calculation record holds no material for a row.');
    return found;
  }

  function cellOf(field: FieldDefinition, row: StoredExportRow): ExportCell {
    // Row 2 and the footer carry the product's own figures (STORY-07.03).
    if (field.rowScope === 'product') return null;
    if (field.systemRole === 'sl-no') return row.slNo;
    switch (field.kind) {
      case 'output': {
        const stored = row.outputs[field.id];
        return stored === undefined || stored === null ? null : numberOf(stored, 'A stored figure is not a number.');
      }
      case 'input':
        return inputCell(field, row.inputs[field.id]);
      case 'auto': {
        if (field.key === MATERIAL_RATE_KEY) {
          // The hidden "Not applicable" material has no price to show: F and I are blank (AC-6).
          const material = materialOf(row);
          return isNotApplicableName(material.materialInDrawing) ? null : numberOf(material.pricePerKg, 'A stored figure is not a number.');
        }
        const words = row.inputs[field.id];
        return typeof words === 'string' ? words : null;
      }
      default:
        return null;
    }
  }

  return entries.map(({ node }): ExportRow => {
    const { row } = node;
    const cells: Record<string, ExportCell> = {};
    for (const { field, letter } of fields) cells[letter] = cellOf(field, row);
    const picture = row.imageId === null ? undefined : pictureIndexOf(row.imageId);
    return { cells, picture: picture ?? null };
  });
}
