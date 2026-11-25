/**
 * The remarks of an Ignored row as a list shows them (CR-01 item 7D, AQP-401 AC-3; UX 12944 section 1, "Remarks in a list"). Pure and tiny: SCR-03 is a first-load route (NFR-009), so this file imports nothing and
 * writes no sentence beyond the ellipsis. Line breaks become spaces; a text of up to `REMARKS_PREVIEW_LENGTH` code points is shown whole; a longer one is cut at the last space before the limit and ends with an ellipsis,
 * and the row then offers "Read all remarks", a link to the task page where the whole text is. The remarks are shown as **text nodes only**: nothing here builds markup, so `<b>x</b>` shows as typed.
 */

/** The longest remarks a row shows whole, in code points (UX 12944). One named value (NFR-032). */
export const REMARKS_PREVIEW_LENGTH = 140;

export interface RemarksPreview {
  /** What the row draws: the remarks on one line, whole or cut with the ellipsis. */
  readonly text: string;
  /** True when the row must offer "Read all remarks": the text was cut. */
  readonly cut: boolean;
}

const LINE_BREAK = /\s*[\r\n]+\s*/g;
const ELLIPSIS = '…';

export function remarksPreview(remarks: string): RemarksPreview {
  // A line break is a space, however many in a row (a blank line is one space, not several); the ends are trimmed. Code points, as the limit is counted everywhere else.
  const letters = Array.from(remarks.replace(LINE_BREAK, ' ').trim());
  if (letters.length <= REMARKS_PREVIEW_LENGTH) return { text: letters.join(''), cut: false };
  const head = letters.slice(0, REMARKS_PREVIEW_LENGTH);
  // The next letter is a space: the head ends on a whole word, so nothing is dropped. Otherwise the last word is cut at the last space before the limit (a text with no space is cut at the limit).
  const wordEnds = letters[REMARKS_PREVIEW_LENGTH] === ' ' ? head.length : head.lastIndexOf(' ');
  const kept = wordEnds > 0 ? head.slice(0, wordEnds) : head;
  return { text: `${kept.join('').trimEnd()}${ELLIPSIS}`, cut: true };
}
