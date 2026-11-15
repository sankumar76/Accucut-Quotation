/**
 * The codes and the words of the quantity warning (STORY-05.12; FR-104; architecture section 4.3 "A zero quantity", UX-36), written once for the server that says them (the 409
 * `CALCULATE_ACK_REQUIRED` and the audit entry) and the dialog that shows them. Pure, with no import, so the dialog's lazy chunk and the server both read it and the first load of the page
 * does not. **None of them uses "rate", "price" or "formula"** (UX-24, NFR-002): the warning says which row has a 0 typed in QTY per Assy and that the row will cost 0, and the 0 is the
 * value the person typed, not a figure from a calculation.
 */

/** The `code` of the 409 that asks the person to confirm before Calculate goes ahead. */
export const CALCULATE_ACK_REQUIRED_CODE = 'CALCULATE_ACK_REQUIRED';

/** The one code of a warning (architecture section 4.3: "kept as a code so that a later warning can join the same path"). */
export const QTY_ZERO_CODE = 'QTY_ZERO';

/** The title of the 409: fixed, so the body is the same for every estimate that has the same rows. */
export const ACK_REQUIRED_TITLE = 'Check the quantity before you calculate.';

/** "Check the quantity on 2 rows": the dialog's title. */
export const warningDialogTitle = (rows: number): string => `Check the quantity on ${rows} ${rows === 1 ? 'row' : 'rows'}`;

export const WARNING_DIALOG_DESCRIPTION = 'You can go back and change the count, or go ahead.';
export const WARNING_LIST_LABEL = 'Rows with a QTY per Assy of 0';

/** Shown when the acknowledged press found a different list from the one the person saw (an input changed in between): nothing was calculated. */
export const WARNING_CHANGED_NOTICE = 'The list changed. Something changed after you pressed Calculate, so this is the new list. Check it again.';

/** "Go back" is the safe choice (focus starts on it); "Calculate anyway" sends the acknowledgement. */
export const WARNING_GO_BACK = 'Go back';
export const WARNING_GO_AHEAD = 'Calculate anyway';

/** "QTY per Assy is 0 on 1.4 Top cover. That row will cost 0 in this estimate." A part with no name is named by its Sl. No alone. */
export function warningLine(slNo: string, label: string): string {
  const row = label === '' ? slNo : `${slNo} ${label}`;
  return `QTY per Assy is 0 on ${row}. That row will cost 0 in this estimate.`;
}
