/**
 * The one sentence SCR-17 prints under the formula of the estimate total (UX-09, STORY-08.01 AC-3). It names a column, and a column letter is always derived from the registry
 * (coding standards section 10), so the letter is passed in and never typed here: it is the letter of the field that holds each row's price.
 */
export function totalFormulaNote(unitPriceLetter: string): string {
  return `The estimate total is the sum of every row's ${unitPriceLetter}. Each row's count is typed for the whole order, so nothing is multiplied by the rows above.`;
}

/**
 * The sentence SCR-18 prints under the formula of the estimate total (AC-6, UX spec SCR-18 "Editing BL"). Every letter in it comes from the registry and is passed in: the column that holds each row's price, and the
 * columns that read the total (the fields whose formulas use it, and the approved price, which is set against it).
 */
export function totalFormulaEditorNote(unitPriceLetter: string, readerLetters: ReadonlyArray<string>): string {
  const readers = readerLetters.length <= 1 ? readerLetters.join('') : `${readerLetters.slice(0, -1).join(', ')} and ${readerLetters[readerLetters.length - 1] ?? ''}`;
  const verb = readerLetters.length === 1 ? 'reads' : 'read';
  const tail = readerLetters.length === 0 ? '' : ` ${readers} ${verb} from it.`;
  return `SUM(${unitPriceLetter}) adds the ${unitPriceLetter} of every row. Each row's ${unitPriceLetter} already holds the count for the whole order, so nothing is multiplied by the rows above.${tail}`;
}
