/**
 * The codes and the words of the refusals of an approval (STORY-06.05; FR-101; architecture sections 4.8 and 6 "Approve"; UX spec SCR-06 and SCR-08), written once for the server that says them and the
 * screen that may show them. Pure, with no import. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names the missing step and nothing else, and a status is not a cost.
 *
 * A wrong status is not here: it is the state machine's (`TRANSITION_REFUSALS` in `state-machine.ts`), one code and one sentence for "not submitted" and "already approved" on every path.
 */

/** The `code` of the 409 for an estimate that was never calculated (figure state `none`). */
export const NOT_CALCULATED_CODE = 'NOT_CALCULATED';
export const NOT_CALCULATED_MESSAGE = 'Press Calculate (or Recalculate) first.';

/** The `code` of the 409 for an estimate whose inputs changed since its last calculation (figure state `out-of-date`). */
export const TOTALS_OUT_OF_DATE_CODE = 'TOTALS_OUT_OF_DATE';
export const TOTALS_OUT_OF_DATE_MESSAGE = 'An input changed since the last calculation. Press Recalculate first.';

/** The `code` of the 409 for a `calculationId` that is no longer the estimate's current calculation: a figure that changed under the Lead cannot be approved (architecture section 4.8). */
export const CALCULATION_CHANGED_CODE = 'CALCULATION_CHANGED';
export const CALCULATION_CHANGED_MESSAGE = 'The figures were calculated again since this page was loaded. Reload the page and check them before approving.';

/**
 * The answer to an approval that passed every check, until STORY-06.06 writes the approval (assumption A-1 of STORY-06.05). A fixed code and no estimate and no figure; the status is 501 and
 * **nothing is written**, so a request that reaches it cannot change an estimate. The sentence below is the error's own message (the log's); **on the wire `problem.ts` masks the title of every 5xx with the
 * generic `INTERNAL_TITLE`**, so a client tells this answer by its status and its code.
 */
export const APPROVAL_NOT_AVAILABLE_CODE = 'APPROVAL_NOT_AVAILABLE';
export const APPROVAL_NOT_AVAILABLE_MESSAGE = 'Approving is not available yet.';
