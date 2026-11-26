import { formatFigure, NO_FIGURE } from '@/lib/money';
import type { NodeCostsLine } from '@/server/views/schemas/node-costs';

/**
 * The words of SCR-07 "Cost details" (STORY-06.03; UX spec SCR-07 "Rules" and "States", UX-01, UX-34, UX-41, UX-57). They are written here, in the one place the screen is built from, and never in
 * `estimate-texts.ts`, which the Engineer's first load carries whole: nothing in this folder reaches an Engineer (NFR-002; `tests/unit/cost-details-architecture.test.ts`). A letter in a sentence
 * is always a parameter, taken from the configuration version the figures belong to (FR-021, UX-26), never typed.
 */

export const COST_DETAILS_TITLE = 'Cost details';
export const COST_DETAILS_META_TITLE = 'Cost details';
/** The head of the page (the mock-up, AQP-452): the last step of the breadcrumb is "Cost details <Sl. No>", and the sentence under the title. */
export const COST_DETAILS_CRUMB = (slNo: string): string => `Cost details ${slNo}`;
export const COST_DETAILS_DESCRIPTION = 'Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.';
export const TASK_QUEUE_LABEL = 'Task queue';
/** The eyebrow over the row's heading. */
export const ROW_EYEBROW = 'Cost details for one row';
/** The title of the parts tree column, as SCR-06's. */
export const COST_TREE_TITLE = 'Parts tree';
/** The tag of the one box of the row, and the sentences in it (the mock-up; the same words as SCR-06's "How the total is built"). The letters are the version's, never typed. */
export const BOX_TAG = 'This row, on screen and in the Excel row';
export const COUNT_FIELD_NAME = 'QTY per Assy';
export const boxFigureNote = (priceLetter: string, count: string): string =>
  `Unit Production Price (${priceLetter}) for this row. Its count for the whole order, ${COUNT_FIELD_NAME} ${count}, is already included. The estimate total adds every row's ${priceLetter}; nothing is multiplied by the rows above.`;
export const boxCurrencies = (usd: string, eur: string, usdLetter: string, eurLetter: string): string => `In US dollars $ ${usd}, in euros € ${eur} (${usdLetter} and ${eurLetter} of this row).`;
export const BOX_ROUNDING = 'Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.';
export const BACK_TO_ESTIMATE = 'Back to the estimate';
export const STAGES_HEADING = 'The six stages';
export const ROW_LABEL = 'Part';
export const COUNT_UNIT = 'nos';
export const COUNT_HINT = 'for the whole order, already included in the price';
export const BOX_NAME = 'Unit Production Price';

/** The state `none`: nothing has been calculated, so there is nothing to show (SCR-07 has no wording of its own for it; assumption A-2). */
export const NOT_CALCULATED_TITLE = 'Not calculated';
export const NOT_CALCULATED_BODY = 'The Engineer has not calculated this estimate yet, so there are no stages to show for this part.';
/** The link to the estimate, where the button now is (STORY-06.04 AC-10; ux-spec v0.29 "SCR-07 final words": it names the button, as SCR-10 does). */
export const GO_TO_ESTIMATE_TO_CALCULATE = 'Go to the estimate to Calculate';
export const GO_TO_ESTIMATE_TO_RECALCULATE = 'Go to the estimate to Recalculate';

/**
 * The state `out-of-date` (UX-57, AC-7): the row header stays and the stages are replaced by these words. They name the button now that it works (STORY-06.04 AC-10; ux-spec v0.29 "SCR-07 final words"): the interim
 * words that AQP-320 shipped, which named none, are replaced by "Cleared. Press Recalculate", its sentence and the link above.
 */
export const CLEARED_TITLE = 'Cleared. Press Recalculate';
export const CLEARED_BODY = 'An input changed, so every calculated figure is cleared, on every row. Press Recalculate on the estimate to see the stages again.';

/** The sentence under the stages (AC-2, UX-01): what the working prints and the rounding rule. */
export const RULES_TITLE = 'How to read the working';
export const RULES_WORKING =
  'Each line shows its formula in column letters, then the same formula with the values it was worked out from. Inputs and rates are shown as typed, a percent rate as a percentage, and calculated values to 4 decimals. The portal works with every digit, not only the 4 shown, so repeating the arithmetic by hand gives the figure printed or, now and then, a figure a hundredth or two away from it.';
export const RULES_ROUNDING =
  'Money and weights are shown to 2 decimals. The portal keeps every digit, adds the unrounded values and rounds once, so adding the shown figures by hand can differ by a few hundredths. A dash means there is no figure, for example after a division by zero.';
export const RULES_READ_ONLY = 'This page only shows the formulas. They cannot be changed here.';
export const CONFIGURATION_LINE = (at: string, number: number): string => `Calculated ${at} · configuration version ${number}`;

export const STAGE_TOTAL_LABEL = 'Stage total';
export const BLANK_VALUE_LABEL = 'Blank: this part has no material rate';

/** The line under the lines of a stage that has treatment lines hidden (AC-3, SPEC section 14 item 5). */
export const hiddenLinesNote = (count: number): string =>
  count === 1
    ? '1 treatment line is hidden because it is not selected for this part. It is still calculated and exported as 0.'
    : `${count} treatment lines are hidden because they are not selected for this part. They are still calculated and exported as 0.`;

/** Where a stage's total differs from the lines as shown (UX SCR-07: stage 5 explains it). */
export const roundingNote = (lineCount: number, shownSum: string, total: string): string =>
  `The ${lineCount} lines above add to ${shownSum} as shown, and the stage total is ${total}. The portal adds the unrounded values, then rounds once.`;

/** The Not applicable row's note (UX-34): said once, above the stages. */
export const NOT_APPLICABLE_NOTE = 'The material of this part is "Not applicable", so its material rate is blank and the lines that read the material show 0.00 with no worked line. The other stages work as usual.';

/** What a value looks like on a line: two decimals with Indian grouping and its unit, a dash for no figure, nothing for a blank. */
export function valueText(line: NodeCostsLine): string {
  if (line.blank) return '';
  const figure = formatFigure(line.value);
  return figure === NO_FIGURE || line.unit === null ? figure : `${figure} ${line.unit}`;
}

/** The formula line of a calculated field: `AK = (M * I) - (O * Material-Scrap-Rate)`; `null` for a typed or looked-up value. */
export const formulaLine = (line: NodeCostsLine): string | null => (line.formula === null ? null : `${line.letter} = ${line.formula}`);

/** The worked line: `AK = (2.8260 × 58.00) - (0.4260 × 22.00) = 154.54`; `null` where there is none to print. */
export const workingLine = (line: NodeCostsLine): string | null => (line.working === null ? null : `${line.letter} = ${line.working} = ${formatFigure(line.value)}`);
