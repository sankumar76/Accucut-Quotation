import { fieldLetter } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';

import type { ExportColumn, ExportModel } from './export-model';

/**
 * The columns of the worksheet, read from the registry (STORY-07.01 AC-1; FR-066; architecture sections 4.5 and 4.6): the letters come from each field's position, so a field inserted or
 * deleted later moves every column after it and the file follows; the header is the field's label, and the width and number format are the registry's own, which hold SPEC section 7.5.
 * Nothing about a column is written here by hand (coding standards section 10).
 */

/** The name of the one sheet of the workbook. */
export const SHEET_NAME = 'Quotation';

export function exportColumnsOf(document: ConfigDocument): ExportColumn[] {
  return [...document.fields]
    .sort((a, b) => a.position - b.position)
    .map((field) => ({ letter: fieldLetter(field), header: field.label, width: field.width, numFmt: field.numFmt }));
}

/** The model of a file with no rows below the header (STORY-07.01); the node rows are added by STORY-07.02. */
export function headerOnlyModel(document: ConfigDocument): ExportModel {
  return { sheetName: SHEET_NAME, columns: exportColumnsOf(document), rows: [] };
}
