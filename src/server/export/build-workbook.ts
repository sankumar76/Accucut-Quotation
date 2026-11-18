import ExcelJS from 'exceljs';

import { columnLetterToIndex } from '../../lib/columns';
import { dimensionsOf } from '../../lib/images/dimensions';

import type { ExportCell, ExportModel, ExportPicture } from './export-model';

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
 *
 * **A picture is embedded, never written as a value** (STORY-07.02 AC-4; FR-067): each distinct picture is added to the workbook once, and a row that has one anchors it in its own cell of the picture column,
 * scaled to fit the cell with its proportions kept (never above its own size) and centred in it. The row is made tall enough to see the picture. A picture whose size cannot be read fills the cell
 * instead. The cell itself stays empty, so a part with no picture and a part with one differ only by the drawing over the cell.
 */

const HEADER_ROW = 1;
const CENTRED = { horizontal: 'center', vertical: 'middle' } as const;
/** Excel's text format: the header cells are text whatever the column's own format is. */
const TEXT_FORMAT = '@';

/** The height of a row with a picture, in points: 75 points is 100 pixels at 96 dots per inch, enough to see a part. */
const PICTURE_ROW_HEIGHT_POINTS = 75;
const PIXELS_PER_POINT = 96 / 72;
/** Excel's own arithmetic for the width of a column in pixels: 7 pixels for each character of the default font, and 5 for the cell's padding. */
const PIXELS_PER_CHARACTER = 7;
const COLUMN_PADDING_PIXELS = 5;
/** The space kept free at each edge of the cell, so a picture never touches the grid lines. */
const PICTURE_MARGIN_PIXELS = 3;

/** A cell value that may be written: a string as text, a finite number, or nothing. */
function writable(cell: ExportCell, where: string): ExportCell {
  if (typeof cell === 'number' && !Number.isFinite(cell)) throw new RangeError(`The cell at ${where} is not a finite number.`);
  return cell;
}

interface Placement {
  /** Zero-based, as the drawing wants it: a whole number is a cell's own corner and the fraction is the distance into the cell. */
  readonly tl: { readonly col: number; readonly row: number };
  readonly ext: { readonly width: number; readonly height: number };
}

/** Where a picture goes in its cell and how large it is in pixels: inside the cell's room with its own proportions, centred; a picture smaller than the room keeps its size. */
function placementOf(picture: ExportPicture, zeroBasedColumn: number, zeroBasedRow: number, columnWidth: number): Placement {
  const cellWidth = Math.trunc(columnWidth * PIXELS_PER_CHARACTER + COLUMN_PADDING_PIXELS);
  const cellHeight = Math.round(PICTURE_ROW_HEIGHT_POINTS * PIXELS_PER_POINT);
  const room = { width: cellWidth - 2 * PICTURE_MARGIN_PIXELS, height: cellHeight - 2 * PICTURE_MARGIN_PIXELS };
  const size = dimensionsOf(picture.bytes, picture.extension);
  const ext =
    size === null
      ? room
      : (() => {
          const scale = Math.min(room.width / size.width, room.height / size.height, 1);
          return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
        })();
  return {
    tl: { col: zeroBasedColumn + (cellWidth - ext.width) / 2 / cellWidth, row: zeroBasedRow + (cellHeight - ext.height) / 2 / cellHeight },
    ext,
  };
}

/** ExcelJS's typings name its own empty `Buffer` (an `ArrayBuffer`); what it takes at run time is a Node `Buffer`. A type guard says so, where the source rules allow no assertion. */
const isExcelBuffer = (value: unknown): value is ExcelJS.Buffer => Buffer.isBuffer(value);

/** The picture's bytes as the Node `Buffer` ExcelJS embeds: a view on the same memory, so nothing is copied. */
function excelBufferOf(bytes: Uint8Array): ExcelJS.Buffer {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!isExcelBuffer(view)) throw new TypeError('A picture could not be read as bytes.');
  return view;
}

/** Adds each distinct picture to the workbook once and anchors it in the picture column of every row that names it. */
function embedPictures(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, model: ExportModel): void {
  const pictures = model.pictures ?? [];
  const added = new Map<number, number>();
  model.rows.forEach((row, rowIndex) => {
    if (row.picture === undefined || row.picture === null) return;
    const picture = pictures[row.picture];
    if (picture === undefined || model.pictureColumn === undefined) throw new RangeError(`The model has no picture at place ${String(row.picture)}.`);
    let imageId = added.get(row.picture);
    if (imageId === undefined) {
      imageId = workbook.addImage({ buffer: excelBufferOf(picture.bytes), extension: picture.extension });
      added.set(row.picture, imageId);
    }
    const rowNumber = HEADER_ROW + 1 + rowIndex;
    const columnIndex = columnLetterToIndex(model.pictureColumn);
    sheet.getRow(rowNumber).height = PICTURE_ROW_HEIGHT_POINTS;
    sheet.addImage(imageId, { ...placementOf(picture, columnIndex - 1, rowNumber - 1, sheet.getColumn(columnIndex).width ?? 0), editAs: 'oneCell' });
  });
}

/**
 * The footer row of the total Tool Cost (STORY-07.03 AC-3): only the cells the footer holds are written, each as a value of its own, in its column's format (a label is text, so `@`) and centred. The row number is the
 * model's own (`product-cells.ts` puts it two below the last part), and the model's schema refuses one on a node row.
 */
function writeFooter(sheet: ExcelJS.Worksheet, model: ExportModel): void {
  const { footer } = model;
  if (footer === undefined) return;
  for (const column of model.columns) {
    const value = writable(footer.cells[column.letter] ?? null, `${column.letter}${footer.row}`);
    if (value === null) continue;
    const cell = sheet.getCell(footer.row, columnLetterToIndex(column.letter));
    cell.value = value;
    cell.numFmt = typeof value === 'string' ? TEXT_FORMAT : column.numFmt;
    cell.alignment = CENTRED;
  }
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

  writeFooter(sheet, model);
  embedPictures(workbook, sheet, model);

  // `writeBuffer` answers a Node `Buffer`, which may sit on a pooled `ArrayBuffer`; a copy is a plain `Uint8Array` that owns its bytes, so it can be handed over a thread boundary and sent as it is.
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
