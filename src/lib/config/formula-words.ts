/**
 * The words of the formula editor, SCR-18 (STORY-08.02; UX spec SCR-18): every sentence the server's check and save say, written once. They are pure strings built from names the caller passes in, so a
 * column letter or a field name is never typed here (coding standards section 10). A message quotes only what the Admin typed in this very request, or letters and labels of the registry; it never holds
 * a rate value or a figure.
 */

/** `"Invented-Rte-per-Unit" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.` */
export function unknownNameMessage(typed: string): string {
  return `"${typed}" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.`;
}

/** `The formula ends too soon. A number or name is missing after "+" (position 29).` */
export function endsTooSoonMessage(after: string, position: number): string {
  return `The formula ends too soon. A number or name is missing after "${after}" (position ${String(position)}).`;
}

/** `This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references.` */
export function loopMessage(letter: string, loopLetters: ReadonlyArray<string>): string {
  return `This formula would make ${letter} depend on itself. The loop is ${loopLetters.join(' → ')}. Remove one of these references.`;
}

/** What the formula reads, as the valid message names it: `P (Cutting Time)`, `the rate <its name>`, or the name of a fixed operand. */
export type UseWords = string;

function joinWithAnd(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** `The formula is valid. It uses P (Cutting Time) and the rate <its name>. Column AL feeds AY.` */
export function validMessage(uses: ReadonlyArray<UseWords>, letter: string, feeds: ReadonlyArray<string>): string {
  const usesSentence = uses.length === 0 ? 'It reads no field or rate.' : `It uses ${joinWithAnd(uses)}.`;
  const feedsSentence = feeds.length === 0 ? `No other field reads column ${letter}.` : `Column ${letter} feeds ${joinWithAnd(feeds)}.`;
  return `The formula is valid. ${usesSentence} ${feedsSentence}`;
}

/** `Formula saved as configuration version 10.` */
export function savedMessage(versionNumber: number): string {
  return `Formula saved as configuration version ${String(versionNumber)}.`;
}

/** The save of a formula that is already the saved one: nothing is written, so no version is made and the password is not asked for (the decision of STORY-08.02, "edit to its own text"). */
export const UNCHANGED_MESSAGE = 'This is already the saved formula, so no new version was made.';

/** `PUT` on a field that has no formula to edit (A, F, I, BO): 409. */
export const NO_FORMULA_FIELD_MESSAGE = 'This field has no formula to edit.';

/** The stored formula cannot hold more than this many characters (the registry schema's limit), once its names are stored as references. */
export const FORMULA_TOO_LONG_MESSAGE = 'This formula is too long to save. Shorten it, for example by splitting it over two fields.';

/** 409 `CONFIG_VERSION_CHANGED`: another save came first (AC-9). */
export function versionChangedMessage(currentVersion: number): string {
  return `The fields and formulas were changed while you were editing. They are now at configuration version ${String(currentVersion)}. Your formula was not saved; open the editor again to see what changed.`;
}
