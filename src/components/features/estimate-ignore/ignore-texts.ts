/**
 * The words of Ignore and Restore (CR-01 item 7D, AQP-401; the ux-expert's comment 12944, the design of record until ux-spec 0.36), written in the one place the dialogs and the notices are built from. The dialogs'
 * words are fetched with the dialogs, on the first press of a button, and are **not** in the first load of `/estimates/[code]` (NFR-009, ADR-016): nothing in the review's first-load files imports this file except the two
 * server notices, which are text and no script. No word here holds a figure, a rate or a formula (NFR-002). A sentence of the server's (the 409s, the 422 of the remarks) is written once, in `lib/estimate/state-machine.ts`
 * and `lib/estimate/ignore-words.ts`, and is not repeated here.
 */

import { IGNORE_REMARKS_MAX_LENGTH } from '@/lib/estimate/ignore-words';

/** The status an ignored estimate had, which Restore gives back: Ignored is a layer over the status, and a Quoted estimate cannot be ignored. */
export type UnderlyingStatus = 'DRAFT' | 'PREPARED' | 'APPROVED';

const STATUS_WORD: Readonly<Record<UnderlyingStatus, string>> = { DRAFT: 'Draft', PREPARED: 'Prepared', APPROVED: 'Approved' };
export const statusWord = (status: UnderlyingStatus): string => STATUS_WORD[status];

/** The tab an estimate with this status is in once it is restored: an Approved one is closed, a Draft or a Prepared one is open (`isTaskClosed`). */
const tabWord = (status: UnderlyingStatus): string => (status === 'APPROVED' ? 'Closed' : 'Open');

// ---- The Ignore dialog ---------------------------------------------------------------------------------------------------------------------

export const ignoreTitle = (code: string): string => `Ignore ${code}?`;

export const IGNORE_INTRO =
  'Use this when an RFQ is not taken forward or is rejected. It leaves Open and Overdue and is listed under Ignored. While it is ignored it is read-only: nobody can change, calculate, approve, mark as quoted or download it. Nothing in the estimate is deleted, and you can restore it later.';

export const REMARKS_LABEL = 'Remarks';
/** Beside the label: the field is required (the visible word, not an asterisk that a screen reader skips). */
export const REMARKS_REQUIRED_TAG = 'Required';
/** The hint reads the one constant of the limit (NFR-032). */
export const REMARKS_HINT = `Why this RFQ is set aside. The Engineer can read this in their Ignored tab, and it is kept in the audit log. Up to ${IGNORE_REMARKS_MAX_LENGTH} characters.`;

export const KEEP_IT_OPEN_LABEL = 'Keep it open';
export const IGNORE_SUBMIT_LABEL = 'Ignore RFQ';
export const IGNORING_LABEL = 'Ignoring';

/** No usable answer came: it claims nothing about what was stored (UX 12944 section 3). */
export const IGNORE_UNCONFIRMED =
  'We could not confirm that the RFQ was ignored. It may have gone through, and the page is being updated to show it. If this window stays open, press Ignore RFQ again. An RFQ can only be ignored once, so pressing again cannot ignore it twice.';

/** Read out politely once the page has been drawn again (UX 12944 section 3). */
export const ignoredStatusLine = (code: string): string => `${code} ignored. It is now in the Ignored tab.`;

// ---- The Restore dialog --------------------------------------------------------------------------------------------------------------------

export const restoreTitle = (code: string): string => `Restore ${code}?`;

export const KEEP_IT_IGNORED_LABEL = 'Keep it ignored';
export const RESTORE_SUBMIT_LABEL = 'Restore RFQ';
export const RESTORING_LABEL = 'Restoring';

export const RESTORE_UNCONFIRMED =
  'We could not confirm that the RFQ was restored. It may have gone through, and the page is being updated to show it. If this window stays open, press Restore RFQ again. An RFQ can only be restored once, so pressing again cannot restore it twice.';

/** What the dialog needs of the estimate to say where it goes back to. All of it is on the Lead's page already. */
export interface RestoreFacts {
  /** The status it had when it was ignored. */
  readonly status: UnderlyingStatus;
  /** The Engineer whose queue it returns to, by name. */
  readonly engineerName: string;
  /** The deadline written in IST, "02 Nov 2026, 17:00 IST". */
  readonly deadlineLabel: string;
  /** The deadline has passed at the moment the page was drawn. */
  readonly deadlinePassed: boolean;
}

/**
 * The lines of the Restore dialog (UX 12944 section 2), chosen by the status underneath. A Draft or a Prepared estimate returns to the Engineer's Open queue; an Approved one to the Closed tab. The Overdue sentence is added
 * only when the deadline has passed and the status is not Approved (an Approved task is closed, so never overdue).
 */
export function restoreLines({ status, engineerName, deadlineLabel, deadlinePassed }: RestoreFacts): ReadonlyArray<string> {
  const word = statusWord(status);
  const where = status === 'APPROVED' ? 'returns to the Closed tab' : `returns to ${engineerName}'s Open queue`;
  const lines = [`It goes back to ${word}, the status it had when it was ignored, and ${where}. Nothing in the estimate changes.`];
  if (deadlinePassed && status !== 'APPROVED') lines.push(`Its deadline, ${deadlineLabel}, has passed, so it will also show as Overdue.`);
  return lines;
}

/** Read out politely once the page has been drawn again, by the status it came back as (UX 12944 section 2). */
export const restoredStatusLine = (code: string, status: UnderlyingStatus): string => `${code} restored. It is back as ${statusWord(status)}, in ${tabWord(status)}.`;

// ---- The notices ---------------------------------------------------------------------------------------------------------------------------

export const REMARKS_PREFIX = 'Remarks: ';

/** The title of the Lead's notice and of the Engineer's: when and by whom (the time already written in IST). */
export const ignoredNoticeTitle = (atLabel: string, byName: string): string => `Ignored on ${atLabel} by ${byName}.`;
export const engineerNoticeTitle = (atLabel: string, byName: string): string => `This task was ignored on ${atLabel} by ${byName}.`;

/** The Lead's and the Admin's read-only sentence, with what Restore does (UX 12944 section 2). The words are the Lead's own: they speak of Restore and of downloads. */
export const ignoredNoticeBody = (status: UnderlyingStatus): string =>
  `This RFQ is read-only. It cannot be changed, calculated, approved, marked as quoted or downloaded until it is restored. It was ${statusWord(status)} when it was ignored. Restore puts it back as ${statusWord(status)}.`;

/** The Engineer's sentence: they can read everything and change nothing, and are told what a Lead's restore does. It does not name the status underneath (UX 12944 section 4). */
export const ENGINEER_NOTICE_BODY =
  'You can read everything here, but nothing can be changed. A Lead or Admin can restore it, and it then comes back to your tasks with the status it had.';

/** The danger alert on SCR-05 when a save, an auto-save or a Calculate was refused 409 because the estimate was ignored meanwhile (UX 12944 section 4). Said only for the server's 409. */
export const ENGINEER_IGNORED_ALERT = 'A Lead or Admin ignored this task, so the changes you just made were not saved. Reload the page to read their remarks.';
export const RELOAD_PAGE_LABEL = 'Reload page';
