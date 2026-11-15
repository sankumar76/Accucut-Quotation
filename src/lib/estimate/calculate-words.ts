/**
 * The codes and the words of Calculate (STORY-05.09; SPEC section 6.3; architecture sections 4.2 and 6 "Calculate"), written once for the server that says them and the screen that shows them.
 * Pure, with no import, so the page may carry it. **None of them holds a figure, a rate or a formula** (NFR-002): the Engineer's whole answer to a good Calculate is the fixed sentence
 * below, and an answer to a refused one names parts and fields, never a number that came from a calculation.
 */

/** The `code` of the 422 that lists the parts with a missing input. */
export const CALCULATE_BLOCKED_CODE = 'CALCULATE_BLOCKED';

/** The one sentence of a Calculate that went through: what an Engineer is told, whatever the estimate costs (FR-056, NFR-002). */
export const CALCULATE_MESSAGE = 'Cost will be calculated based on the input fields and sent for review/approval.';

/** What the Engineer's answer says the estimate is now. Calculate takes a draft to this and to nothing else. */
export const CALCULATE_SUBMITTED_STATUS = 'SUBMITTED';

/** The 409s of a Calculate that cannot go ahead although every input is there (AC-4), each with its code. */
export const CUSTOMER_NOT_CHOSEN_CODE = 'CUSTOMER_NOT_CHOSEN';
export const CUSTOMER_NOT_CHOSEN_MESSAGE = 'Choose the customer before calculating.';
export const NO_PARTS_CODE = 'NO_PARTS';
export const NO_PARTS_MESSAGE = 'Add at least one part before calculating.';
/** A customer or a material the estimate names was deleted by the Admin after it was chosen (STORY-02.07; A-13). Nothing is written. */
export const CUSTOMER_DELETED_CODE = 'CUSTOMER_DELETED';
export const CUSTOMER_DELETED_MESSAGE = 'The customer chosen for this estimate was deleted. Choose another customer before calculating.';
export const MATERIAL_DELETED_CODE = 'MATERIAL_DELETED';
export const MATERIAL_DELETED_MESSAGE = 'A material chosen for a part was deleted. Choose another material for that part before calculating.';

/** "Nothing was submitted. 3 parts have missing inputs." (UX spec SCR-05, "Calculate blocked"): the summary above the list, and the title of the 422. */
export function blockedSummary(parts: number): string {
  return `Nothing was submitted. ${parts === 1 ? '1 part has' : `${parts} parts have`} missing inputs.`;
}
