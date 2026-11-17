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
