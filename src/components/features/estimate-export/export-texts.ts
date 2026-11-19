import { NOT_CALCULATED_REFUSAL, OUT_OF_DATE_REFUSAL } from '@/lib/export/refusal-words';

/**
 * The words of SCR-10 "Excel export" (STORY-07.01 AC-6; UX spec SCR-10). Kept in one file so a test and the page read the same sentences.
 */

/** The title of the page and of the browser tab: no task code and no customer name in it (architecture section 8, FR-089). */
export const EXPORT_TITLE = 'Excel export';
export const EXPORT_META_TITLE = 'Excel export';

export const BACK_TO_ESTIMATE = 'Back to the estimate';

export const FILE_CARD_TITLE = 'The file';
export const FILE_NAME_LABEL = 'File name';
export const FILE_ROWS_LABEL = 'Rows in the file';
export const FILE_COLUMNS_LABEL = 'Columns';
export const COLUMNS_RANGE = (first: string, last: string): string => `${first} to ${last}`;

export const DOWNLOAD_LABEL = 'Download .xlsx';

/** "10 parts", "1 part", "0 parts". */
export const PARTS = (count: number): string => `${count.toLocaleString('en-US')} ${count === 1 ? 'part' : 'parts'}`;
export const PICTURES = (count: number): string => `${count.toLocaleString('en-US')} ${count === 1 ? 'picture' : 'pictures'}`;

/** The Building state (UX spec SCR-10 "States"). */
export const BUILDING_LINE = (parts: number, pictures: number): string => `Building the file. ${PARTS(parts)}, ${PICTURES(pictures)}. This usually takes a few seconds.`;

/** The Error state: a sentence, and the reference a person can read out. */
export const ERROR_TITLE = 'We could not build the file';
export const ERROR_BODY = 'Try again. If it keeps failing, give the reference below to your administrator.';
export const REFERENCE_LINE = (reference: string): string => `Reference: ${reference}`;

/** The Empty state: no parts. */
export const EMPTY_TITLE = 'Nothing to export yet';
export const EMPTY_BODY = 'This estimate has no parts, so there is no file to download. Add a part on the estimate first.';

export const ROWS_CARD_TITLE = 'The rows in the file';
export const ROWS_CARD_NOTE = 'One row for each part, in the order of the parts tree.';
export const ROWS_REGION_LABEL = 'The rows in the file';
export const ROWS_CAPTION = 'The parts the file will hold, with the count typed for each';
export const HEAD_SL_NO = 'Sl. No';
export const HEAD_PART = 'Part';
export const HEAD_COUNT = 'Qty';
export const PART_NAME_FALLBACK = 'No name yet';

/**
 * STORY-07.03 AC-9 (UX spec SCR-10 "Layout", "How BL2 is made", "States"): the words of the figures the page shows while the calculation is current. A letter or a cell address is passed in, read from the registry by
 * the server, and never written here.
 */
export const HEAD_COUNT_WHOLE_ORDER = (letter: string): string => `Qty (${letter}), for the whole order`;
export const HEAD_IN_FILE_PRICE = (letter: string): string => `In the file: ${letter}`;
export const HEAD_IN_FILE_TOOL_COST = (letter: string): string => `In the file: Tool Cost (${letter})`;
export const ROWS_CARD_NOTE_FIGURES = (count: string, price: string): string =>
  `Every row holds its own count for the whole order (${count}) and its own ${price}. The file has no per-item totals and nothing is multiplied by the rows above.`;
export const ROWS_CAPTION_FIGURES = (count: string, price: string, toolCost: string): string => `Count (${count}), Unit Production Price (${price}) and Tool Cost (${toolCost}) per row in the file`;

/** The last row of the table: the BG column added up, and what it is against BL2. */
export const COLUMN_SUM_LABEL = (bl: string): string => `BG column added up: ${bl}, the same as the total on screen`;
export const COLUMN_SUM_DIFFERS = (bl: string): string => `BG column added up: not the same as ${bl}`;
export const TOTAL_TOOL_COST_LABEL = 'Total Tool Cost';
export const TOTAL_TOOL_COST_ROW = (row: string): string =>
  `Total Tool Cost: file row ${row}, one empty row below the last part, with the label in the cell to the left of the Tool Cost column`;
export const TOTAL_TOOL_COST_NOTE = (bn: string): string =>
  `The Total Tool Cost sits below the parts so that no part's own Tool Cost cell is replaced (the first part's own Tool Cost is in the Tool Cost cell of row 2). ${bn} divides BL2 by it.`;

/** "How BL2 is made" (AQP-26): add the BG column and you get BL2, at any quantity. */
export const HOW_TITLE = (bl: string): string => `How ${bl} is made`;
export const HOW_LEAD = 'How to reconcile.';
export const HOW_BODY = (bl: string): string =>
  `Add the BG column of the file. That gives ${bl}, at any quantity. Each row's BG already holds the count for the whole order that the Engineer typed, so nothing is multiplied by the rows above. For example, for 2 frames, 6 pipes and 24 lids the Engineer types 2, 6 and 24.`;
export const ROUNDING_SENTENCE =
  'Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.';
export const LINES_AS_SHOWN = (shown: string, total: string): string => `The lines of the table above add to ${shown} as shown, and the total is ${total}.`;
/** Said only if the column and BL2 are not the same at two decimals: a fault, never hidden. */
export const COLUMN_MISMATCH = (sum: string, bl: string): string => `The BG column adds up to ${sum}, but ${bl} is not the same. Do not send this file: tell your administrator.`;

/** "What the file holds": the checklist of the product's own cells. */
export const HOLDS_TITLE = 'What the file holds';
export const HOLDS_ONCE = (bl: string, bn: string, bo: string): string => `${bl}, ${bn} and ${bo} appear once, in row 2, and the file has no per-item totals. The Total Tool Cost appears once, below the last part.`;
export const HOLDS_OWN_TOOL_COST = 'Every part keeps its own Tool Cost in its own row';
export const HOLDS_EMPTY_CELL = 'A divide by zero is an empty cell';
export const NO_FIGURE_CELL = 'No figure: an empty cell';
export const toolCostCell = (value: string, row: string): string => `${value}, in the Tool Cost column of row ${row}`;

export const BO_EMPTY = 'Empty until approved, and empty after the Admin cancels an approval';
export const boApproved = (price: string, time: string): string => `${price}, approved on ${time}.`;
export const boApprovedEarlier = (price: string, time: string): string => `${price}, approved earlier on ${time}. It stays until a new approval replaces it.`;
export const boDifference = (direction: 'lower' | 'higher', amount: string): string => `${amount} ${direction} than the calculated total.`;
export const boSetAgainst = (price: string, calculatedTotal: string): string => `The price ${price} was set against the calculated total ${calculatedTotal}.`;
export const boReasonGiven = (reason: string): string => `Reason given: ${reason}`;
export const BO_NO_REASON = 'No reason given.';
export const BO_REASON_NOT_IN_FILE = 'The reason is shown here, on the estimate and in the audit log. It is not written into the file, because the file follows the worksheet layout.';

/**
 * STORY-07.04 AC-5 (UX spec SCR-10 "No file until a calculation is current"): the two refused states, which show no file card and no table. The bold line and the sentence under it are the 409's own words
 * (`lib/export/refusal-words.ts`), so a person who presses a stale button reads the same sentences as one who opens the page.
 */
export const NOT_CALCULATED_LEAD = NOT_CALCULATED_REFUSAL.lead;
export const NOT_CALCULATED_REST = NOT_CALCULATED_REFUSAL.rest;
export const CALCULATE_FIRST_TITLE = 'Calculate first';
export const CALCULATE_FIRST_BODY = 'The file holds the rows and the totals of a calculation. There is none yet.';
export const GO_TO_ESTIMATE_TO_CALCULATE = 'Go to the estimate to Calculate';

export const CLEARED_LEAD = OUT_OF_DATE_REFUSAL.lead;
export const CLEARED_REST = OUT_OF_DATE_REFUSAL.rest;
export const RECALCULATE_FIRST_TITLE = 'Recalculate first';
export const RECALCULATE_FIRST_BODY = 'The file would hold figures that no longer match the inputs, so the portal does not build one. After Recalculate the download comes back.';
export const GO_TO_ESTIMATE_TO_RECALCULATE = 'Go to the estimate to Recalculate';
