/**
 * The words of the quantity warning for a Lead or an Admin (STORY-06.10; UX spec v0.30 SCR-06 "Quantity warning (Recalculate)" and "Warning on this calculation", SCR-08 "Quantity warning on this calculation"; UX-44 to
 * UX-46 and UX-48; FR-104), written once for the three places that say them: the dialog of Recalculate, the notice and mark on the review, and the line of the approval dialog. Pure, with no import, so the lazy
 * chunks and the server read it and **the page's first load does not** (NFR-009, ADR-016: `/estimates/[code]`). The Engineer's words stay in `warning-copy.ts`; nothing here is read by an Engineer's page.
 *
 * A row is named as the calculation kept it: its Sl. No and the part's name as text at that moment, and a part with no name by its Sl. No alone. None of the sentences names a figure: the row costs 0
 * because 0 was typed in QTY per Assy (NFR-002).
 */

/** A warned row as these sentences name it. */
export interface WarnedRowText {
  readonly slNo: string;
  readonly label: string;
}

/** The sentence the Lead's dialog adds to the Engineer's own words (UX-44, A-26): the warning is raised again on every press, whatever the Engineer chose. */
export const LEAD_WARNING_NOTE = 'You are asked each time you press Calculate or Recalculate, even if the Engineer already went ahead.';

/** "Recalculate anyway" for a Recalculate, "Calculate anyway" for a Calculate on a Draft: the button's own label and "anyway". */
export const goAheadLabel = (pressed: string): string => `${pressed} anyway`;

export const QUANTITY_WARNING_TITLE = 'Quantity warning on this calculation.';
/** The mark on each warned row of the tree and of "How the total is built": an icon and these words. */
export const QUANTITY_TAG = 'Quantity 0';

/** How many rows a sentence names before it counts the rest, so an estimate with hundreds of zeros does not push the tiles off the screen. The mark on each row still shows every one. */
const NAMED_ROWS = 10;

const rowText = ({ slNo, label }: WarnedRowText): string => (label === '' ? slNo : `${slNo} ${label}`);
const rowsWord = (count: number): string => (count === 1 ? 'row' : 'rows');

/** "2.2 Support arm and 2.3 Spacer", "a, b and c", or the first ten and "and 3 more rows". */
export function warnedRowsList(rows: ReadonlyArray<WarnedRowText>): string {
  const named = rows.slice(0, NAMED_ROWS).map(rowText);
  const more = rows.length - named.length;
  if (more > 0) return `${named.join(', ')} and ${more} more ${rowsWord(more)}`;
  const last = named[named.length - 1] ?? '';
  return named.length < 2 ? last : `${named.slice(0, -1).join(', ')} and ${last}`;
}

/** The sentence under the notice's title: who went ahead, when, and on which rows. `time` is `formatIst`'s ("05 Nov 2026, 10:42 IST"). */
export const quantityWarningWhen = (name: string, time: string, rows: ReadonlyArray<WarnedRowText>): string =>
  `${name} went ahead on ${time} with 0 in QTY per Assy on ${rows.length} ${rowsWord(rows.length)}: ${warnedRowsList(rows)}.`;

/** What it means, and that approving is not stopped. */
export const quantityWarningMeaning = (rows: number): string =>
  `${rows === 1 ? 'This row costs' : 'Each of these rows costs'} 0 in this estimate. Approving is not stopped. Check that the zeros are meant.`;

/** SCR-08: the one info line of the approval dialog. Approve is not stopped and there is no box to tick (UX-48). */
export const approveWarningLine = (rows: ReadonlyArray<WarnedRowText>): string =>
  `This calculation has a quantity warning. ${warnedRowsList(rows)} ${rows.length === 1 ? 'costs' : 'cost'} 0 in this estimate. Approving is not stopped, and there is no box to tick.`;
