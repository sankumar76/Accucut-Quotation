/**
 * The codes and the words of the refusals of an approval (STORY-06.05, STORY-06.06; FR-101; architecture sections 4.8 and 6 "Approve"; UX spec SCR-06 and SCR-08), written once for the server that says them and the
 * screen that may show them. Pure, with no import. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names the missing step and nothing else, and a status is not a cost.
 * (From STORY-06.06 an approval that passes every check is written, so the 501 `APPROVAL_NOT_AVAILABLE` of STORY-06.05 is gone.)
 *
 * A wrong status is not here: it is the state machine's (`TRANSITION_REFUSALS` in `state-machine.ts`), one code and one sentence for "not prepared" and "already approved" on every path.
 */

/** The `code` of the 409 for an estimate that was never calculated (figure state `none`). */
export const NOT_CALCULATED_CODE = 'NOT_CALCULATED';
export const NOT_CALCULATED_MESSAGE = 'Press Calculate (or Recalculate) first.';

/** The `code` of the 409 for an estimate whose inputs changed since its last calculation (figure state `out-of-date`). */
export const TOTALS_OUT_OF_DATE_CODE = 'TOTALS_OUT_OF_DATE';
export const TOTALS_OUT_OF_DATE_MESSAGE = 'An input changed since the last calculation. Press Recalculate first.';

/** The `code` of the 409 for a `calculationId` that is no longer the estimate's current calculation: a figure that changed under the Lead cannot be approved (architecture section 4.8). */
export const CALCULATION_CHANGED_CODE = 'CALCULATION_CHANGED';
export const CALCULATION_CHANGED_MESSAGE = 'The figures were calculated again after this page was loaded, so nothing was approved. Show the new figures and check the total before you approve.';
