import { z } from 'zod';

import { isExportFileName } from '../../../lib/export/file-name';
import { XLSX_MIME } from '../../export/export-model';

/**
 * The contracts of the two export routes (STORY-07.01 AC-2, AC-3, AC-6; architecture section 6 "Export" and "Export summary"): `GET /api/v1/estimates/{id}/export` answers the file, and
 * `GET /api/v1/estimates/{id}/export-summary` answers what SCR-10 shows before the file is asked for. **Restricted** (NFR-002, ADR-008): the file carries the registry's layout and, from STORY-07.02, costs
 * and formulas, so both routes list the Lead and the Admin alone, `withRoute` refuses every other role before anything is looked up, and the lint and `tests/security/engineer-import-rule.test.ts`
 * refuse this file to an Engineer view.
 *
 * Both are one strict schema each: a key that is not named is an error and never reaches a client. The summary holds counts, the name the file will have, the letters of its first and last column, and for each part
 * its Sl. No, its name and the count typed in H (an input, not a figure of the calculation). **Its figures (STORY-07.03 AC-8) are `figures`, present only while the state is `current`** and read through the figure
 * state like every other figure: each row's H, BG and Tool Cost as the file holds them, BL2, BN2, BO2 and the total Tool Cost, the approved price's difference and reason, and the reconciliation of the BG column
 * with BL2. In any other state `figures` is `null` and nothing of a calculation is in the answer. **The quantity warning (STORY-07.06 AC-4)** is `warning`, under the same rule: who went ahead, when and the
 * rows, only while the state is `current` (the schema refuses it in any other), for the Lead and the Admin alone, and never in the file (A-24).
 */

/** A name the export makes (`isExportFileName`, `lib/export/file-name.ts`): `<short name>_<subject>_<DD-MM-YYYY>.xlsx`, which may hold non-ASCII letters. It goes into a header, so no other name may. */
const exportFileNameSchema = z.string().refine(isExportFileName, { message: 'Not a name the export makes.' });

/** The file route's answer: the MIME type of a workbook, its bytes and its name. `withRoute` turns it into the attachment (`file-response.ts`). */
export const exportFileSchema = z.strictObject({
  mime: z.literal(XLSX_MIME),
  bytes: z.instanceof(Uint8Array),
  fileName: exportFileNameSchema,
});

const columnLetters = z.string().regex(/^[A-Z]{1,10}$/);
const decimalText = z.string().regex(/^-?\d+(\.\d+)?$/);

const cellAddress = z.string().regex(/^[A-Z]{1,10}[0-9]+$/);

/** The figures of SCR-10, as the file holds them (STORY-07.03 AC-8): decimal text, `null` where the file's cell is empty. */
export const exportFiguresSchema = z.strictObject({
  /** Each row of the file in tree order: H, its own BG and its own Tool Cost (BM), as written in the cells. No row has a total of the rows below it. */
  rows: z.array(z.strictObject({ slNo: z.string().min(1), count: decimalText, bg: decimalText.nullable(), toolCost: decimalText })),
  /** BL2, BN2 and BO2 (once, in row 2) and the total Tool Cost (the footer): `null` is an empty cell. */
  totals: z.strictObject({ bl: decimalText.nullable(), bn: decimalText.nullable(), bo: decimalText.nullable(), toolCostTotal: decimalText }),
  /** The columns SCR-10 names beside the rows: the count (H), the row's own price (BG) and the Tool Cost (BM), from the registry. */
  letters: z.strictObject({ count: columnLetters, bg: columnLetters, toolCost: columnLetters }),
  /** Where they are in the file: `BL2`, `BN2`, `BO2` and the footer's cell (`BM13` for 10 parts), from the registry. */
  cells: z.strictObject({ bl: cellAddress, bn: cellAddress, bo: cellAddress, toolCostTotal: cellAddress }),
  /** The price in BO2 against the calculated total it was set against; `null` when BO2 is empty (no approval, or it was cancelled, or its price removed). The reason is shown here and never written into the file (FR-103). */
  approval: z
    .strictObject({
      price: decimalText,
      /** When it was approved, as an ISO instant; SCR-10 writes it in IST. */
      approvedAt: z.iso.datetime(),
      /** The estimate was unlocked since: the price is the one approved earlier, and it stays until a new approval replaces it (D-29). */
      earlier: z.boolean(),
      calculatedTotal: decimalText,
      /** How far the price is from the calculated total at rupees and paise, or `null` when it is the same price. */
      difference: z.strictObject({ direction: z.enum(['lower', 'higher']), amount: decimalText }).nullable(),
      reason: z.string().nullable(),
    })
    .nullable(),
  /** The BG column added up against BL2 (SPEC section 14.2): the exact sum, the sum of the lines as shown at two decimals, the stored BL, and whether the exact sum and BL are the same at two decimals. */
  reconciliation: z.strictObject({ columnSum: decimalText, linesAsShown: decimalText, total: decimalText.nullable(), matches: z.boolean() }),
});

/**
 * The quantity warning of the calculation the file is made from (STORY-07.06 AC-4; architecture section 4.3 "What the Lead sees"): who went ahead (the name now of the person who pressed Calculate or Recalculate: with
 * the time, the acknowledgement), when (the calculation's own time, an ISO instant that SCR-10 writes in IST) and each row that had 0 in QTY per Assy, by its Sl. No and its name as text at that moment. No figure,
 * no code and no ID. It is for SCR-10's notice and never in the file (A-24). The Lead and the Admin alone read it, like the rest of the summary (NFR-002).
 */
export const exportWarningSchema = z.strictObject({
  madeBy: z.string().min(1),
  at: z.iso.datetime(),
  rows: z
    .array(z.strictObject({ slNo: z.string().min(1), label: z.string() }))
    .min(1)
    .readonly(),
});

export const exportSummarySchema = z.strictObject({
  /** The name the file would have if it were downloaded now (the date is today's IST date). */
  fileName: exportFileNameSchema,
  /** The parts of the estimate: the rows the file will hold below its header. */
  partCount: z.number().int().min(0),
  /** The parts that have a picture. */
  pictureCount: z.number().int().min(0),
  /** The first and last column of the file and how many there are, from the registry. */
  columns: z.strictObject({ first: columnLetters, last: columnLetters, count: z.number().int().min(1) }),
  /** "The rows in the file", in tree order: the Sl. No, the part's name (empty when none was typed) and the count typed in H (`null` when none was). */
  rows: z.array(z.strictObject({ slNo: z.string().min(1), name: z.string(), count: decimalText.nullable() })),
  /** The state of the estimate's figures: the file exists only while it is `current` (architecture section 4.6). */
  state: z.enum(['none', 'current', 'out-of-date']),
  /** The figures of the file; `null` unless the state is `current`. */
  figures: exportFiguresSchema.nullable(),
  /** The quantity warning on the calculation, **only while the state is `current`** (the list of a stale calculation may be wrong): `null` in the other two states and when the calculation had none. */
  warning: exportWarningSchema.nullable(),
}).refine((summary) => summary.warning === null || summary.state === 'current', { message: 'A warning is carried only while the figures are current.', path: ['warning'] });

export type ExportWarningView = z.infer<typeof exportWarningSchema>;
export type ExportFiguresView = z.infer<typeof exportFiguresSchema>;
export type ExportSummaryView = z.infer<typeof exportSummarySchema>;
export type ExportFileView = z.infer<typeof exportFileSchema>;
