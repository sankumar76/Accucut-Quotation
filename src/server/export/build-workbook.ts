import ExcelJS from 'exceljs';

import { columnLetterToIndex } from '../../lib/columns';

import type { ExportCell, ExportModel } from './export-model';

/**
 * The one place that turns an `ExportModel` into an `.xlsx` (ADR-012; TD-01; STORY-07.01 AC-1, AC-4): **the only file that imports ExcelJS**, so the library can be replaced behind this function
 * without touching a caller. It is a plain function of plain data, so a test calls it in process and the thread entry (`src/worker/export-thread.ts`) holds no logic of its own.
 *
 * **Row 1 is the fixed header row**: the registry's labels, in the registry's order, with each column's width from the registry. Every cell, header and body, is centred horizontally and vertically
 * and carries its column's number format. A number is written as a number at **full precision** (the format only changes how Excel shows it, so Excel's own sums reconcile with the stored values).
 *
 * **Text is always text** (NFR-027, GitHub issue 394): a string goes into the cell as a plain string value, and the model has no formula cell, so nothing a person typed can become a live formula. A
 * value that starts with `=`, `+`, `-` or `@` is stored as the shared string it is, which Excel reads as text and never evaluates. A column that holds text is also formatted `@` by the registry.
 * A number that is not finite would corrupt the file, so it is refused here rather than written.
 */

const HEADER_ROW = 1;
const CENTRED = { horizontal: 'center', vertical: 'middle' } as const;
/** Excel's text format: the header cells are text whatever the column's own format is. */
const TEXT_FORMAT = '@';

/** A cell value that may be written: a string as text, a finite number, or nothing. */
function writable(cell: ExportCell, where: string): ExportCell {
  if (typeof cell === 'number' && !Number.isFinite(cell)) throw new RangeError(`The cell at ${where} is not a finite number.`);
  return cell;
}

export async function buildWorkbook(model: ExportModel): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(model.sheetName);

  for (const column of model.columns) {
    const columnIndex = columnLetterToIndex(column.letter);
    sheet.getColumn(columnIndex).width = column.width;
    const header = sheet.getCell(HEADER_ROW, columnIndex);
    // A header is written as a string, like any other text: the registry's label is typed by an Admin.
    header.value = column.header;
    header.numFmt = TEXT_FORMAT;
    header.alignment = CENTRED;
  }

  model.rows.forEach((row, rowIndex) => {
    const rowNumber = HEADER_ROW + 1 + rowIndex;
    for (const column of model.columns) {
      const cell = sheet.getCell(rowNumber, columnLetterToIndex(column.letter));
      const value = writable(row.cells[column.letter] ?? null, `${column.letter}${rowNumber}`);
      if (value !== null) cell.value = value;
      cell.numFmt = column.numFmt;
      cell.alignment = CENTRED;
    }
  });

  // `writeBuffer` answers a Node `Buffer`, which may sit on a pooled `ArrayBuffer`; a copy is a plain `Uint8Array` that owns its bytes, so it can be handed over a thread boundary and sent as it is.
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
