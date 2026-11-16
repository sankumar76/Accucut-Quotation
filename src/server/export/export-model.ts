import { z } from 'zod';

/**
 * The plain data the workbook is built from (ADR-012, architecture section 4.6; STORY-07.01 AC-1, AC-4, AC-5).
 *
 * `build-workbook.ts` takes **only** this and nothing else, so the library behind it (ExcelJS, TD-01) can be swapped without touching a caller, and so the model can cross into a `worker_threads`
 * thread by structured clone: it holds strings, numbers and `null`, no function, no class and no Decimal.
 *
 * **A cell is a string, a number or empty, and a string is always text.** There is no formula cell in the model, so no value a person typed (a part's name, its remarks, a customer's name) can become
 * one: a value that starts with `=`, `+`, `-` or `@` is written as the string it is (GitHub issue 394, NFR-027). A number is the stored figure at full precision, shown through its column's format.
 */

/** One column of the sheet, in the order of the registry. Its letter is derived from the registry's position (`fieldLetter`), never written by hand. */
export interface ExportColumn {
  /** The Excel letter, `A` to `BO` in the seed. */
  readonly letter: string;
  /** The header text: the registry's label. */
  readonly header: string;
  /** Excel's column width, in characters (the registry's `width`). */
  readonly width: number;
  /** The Excel number format of the column's cells (the registry's `numFmt`): `#,##0.00`, a currency format, `@` for text. */
  readonly numFmt: string;
}

/** A string is text, always. A number is a figure at full precision. `null` is an empty cell (a divide by zero is an empty cell, ADR-012). */
export type ExportCell = string | number | null;

/** One row of the sheet below the header: the cells by column letter. A letter with no entry is an empty cell. */
export interface ExportRow {
  readonly cells: Readonly<Record<string, ExportCell>>;
}

export interface ExportModel {
  /** The name of the one sheet. */
  readonly sheetName: string;
  readonly columns: ReadonlyArray<ExportColumn>;
  /** The rows below the header row, from row 2. Empty in STORY-07.01: the node rows are STORY-07.02's. */
  readonly rows: ReadonlyArray<ExportRow>;
}

const cellSchema = z.union([z.string(), z.number(), z.null()]);

/**
 * The shape of an `ExportModel`, checked where it arrives in the thread (`thread-protocol.ts`): the thread takes its input from `workerData`, which is `unknown` to the type system, so the model is read
 * through this schema and not assumed. Strict, so a key it does not name is refused. A sheet name is at most 31 characters and holds none of `\ / ? * [ ] :` (Excel's own rule).
 */
export const exportModelSchema = z.strictObject({
  sheetName: z.string().min(1).max(31).regex(/^[^\\/?*[\]:]+$/),
  columns: z
    .array(z.strictObject({ letter: z.string().regex(/^[A-Z]{1,10}$/), header: z.string(), width: z.number().positive().max(255), numFmt: z.string().min(1) }))
    .min(1),
  rows: z.array(z.strictObject({ cells: z.record(z.string(), cellSchema) })),
});

/** The MIME type of an `.xlsx` file. */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
