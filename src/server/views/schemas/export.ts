import { z } from 'zod';

import { XLSX_MIME } from '../../export/export-model';

/**
 * The contracts of the two export routes (STORY-07.01 AC-2, AC-3, AC-6; architecture section 6 "Export" and "Export summary"): `GET /api/v1/estimates/{id}/export` answers the file, and
 * `GET /api/v1/estimates/{id}/export-summary` answers what SCR-10 shows before the file is asked for. **Restricted** (NFR-002, ADR-008): the file carries the registry's layout and, from STORY-07.02, costs
 * and formulas, so both routes list the Lead and the Admin alone, `withRoute` refuses every other role before anything is looked up, and the lint and `tests/security/engineer-import-rule.test.ts`
 * refuse this file to an Engineer view.
 *
 * Both are one strict schema each: a key that is not named is an error and never reaches a client. The summary holds **no figure**: counts, the name the file will have, the letters of its first
 * and last column, and for each part its Sl. No, its name and the count typed in H (an input, not a figure of the calculation).
 */

/** What a file name may be (`lib/export/file-name.ts` makes only these): letters, digits, underscore and hyphen, then `.xlsx`. It goes into a header, so nothing else may. */
export const EXPORT_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,200}\.xlsx$/;

/** The file route's answer: the MIME type of a workbook, its bytes and its name. `withRoute` turns it into the attachment (`file-response.ts`). */
export const exportFileSchema = z.strictObject({
  mime: z.literal(XLSX_MIME),
  bytes: z.instanceof(Uint8Array),
  fileName: z.string().regex(EXPORT_FILE_NAME_PATTERN),
});

const columnLetters = z.string().regex(/^[A-Z]{1,10}$/);
const decimalText = z.string().regex(/^-?\d+(\.\d+)?$/);

export const exportSummarySchema = z.strictObject({
  /** The name the file would have if it were downloaded now (the date is today's IST date). */
  fileName: z.string().regex(EXPORT_FILE_NAME_PATTERN),
  /** The parts of the estimate: the rows the file will hold below its header. */
  partCount: z.number().int().min(0),
  /** The parts that have a picture. */
  pictureCount: z.number().int().min(0),
  /** The first and last column of the file and how many there are, from the registry. */
  columns: z.strictObject({ first: columnLetters, last: columnLetters, count: z.number().int().min(1) }),
  /** "The rows in the file", in tree order: the Sl. No, the part's name (empty when none was typed) and the count typed in H (`null` when none was). */
  rows: z.array(z.strictObject({ slNo: z.string().min(1), name: z.string(), count: decimalText.nullable() })),
});

export type ExportSummaryView = z.infer<typeof exportSummarySchema>;
export type ExportFileView = z.infer<typeof exportFileSchema>;
