import { NOT_CALCULATED_CODE } from '../estimate/approval-words';

/**
 * The codes and the words of the two refusals of the Excel download (STORY-07.04; FR-100, FR-101; D-28, D-37; architecture section 4.6 "No file exists until a calculation is current"; UX spec SCR-10 "No file
 * until a calculation is current"), written once for the server that says them (the 409 of `GET /estimates/{id}/export`) and the screen that shows them (SCR-10), so a person reads the same sentences on both.
 * Pure, with no import but the shared code. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names the missing step and nothing else.
 *
 * There is one refusal per state of the figures and no other way round: no out-of-date file, no file name, sheet or marker for one, and no confirmation (D-28).
 */

/** The `code` of the 409 for an estimate that was never calculated (figure state `none`): the code the approval refuses with too (STORY-06.05), so one code means "calculate first" everywhere. */
export const EXPORT_NOT_CALCULATED_CODE = NOT_CALCULATED_CODE;

/** The `code` of the 409 for an estimate whose inputs changed since its last calculation (figure state `out-of-date`). */
export const EXPORT_OUT_OF_DATE_CODE = 'EXPORT_OUT_OF_DATE';

/** The two parts of each refusal: the bold line and the sentence under it on SCR-10. The 409 says them as one text (`message`). */
export interface RefusalWords {
  readonly code: string;
  readonly lead: string;
  readonly rest: string;
}

/** Never calculated: "There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current." */
export const NOT_CALCULATED_REFUSAL: RefusalWords = {
  code: EXPORT_NOT_CALCULATED_CODE,
  lead: 'There is no file to download yet.',
  rest: 'This estimate has not been calculated. The download stays off until a calculation is current.',
};

/** Total cleared: "The total is cleared because an input changed. There is no file to download until you press Recalculate." */
export const OUT_OF_DATE_REFUSAL: RefusalWords = {
  code: EXPORT_OUT_OF_DATE_CODE,
  lead: 'The total is cleared because an input changed.',
  rest: 'There is no file to download until you press Recalculate.',
};

/** The sentence of a refusal as the 409 carries it (its `title`). */
export const refusalMessage = ({ lead, rest }: RefusalWords): string => `${lead} ${rest}`;
