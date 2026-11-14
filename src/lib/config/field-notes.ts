/**
 * The one sentence SCR-17 prints under the formula of the estimate total (UX-09, STORY-08.01 AC-3). It names a column, and a column letter is always derived from the registry
 * (coding standards section 10), so the letter is passed in and never typed here: it is the letter of the field that holds each row's price.
 */
export function totalFormulaNote(unitPriceLetter: string): string {
  return `The estimate total is the sum of every row's ${unitPriceLetter}. Each row's count is typed for the whole order, so nothing is multiplied by the rows above.`;
}
