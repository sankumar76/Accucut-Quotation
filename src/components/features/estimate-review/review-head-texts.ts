import 'server-only';

/**
 * The words only SCR-06's head uses (AQP-452, DEF-110). `server-only` makes a client import of this file fail the build, so these words and the head that uses them never reach the estimate page's first load
 * (NFR-009; the ceiling of PRD 0.58).
 */

/** The button of SCR-06's head that opens the task folder (the mock-up). */
export const OPEN_FOLDER_LABEL = 'Open folder';
/** The words before the subject in SCR-06's meta line. */
export const SUBJECT_META_PREFIX = 'Subject:';
