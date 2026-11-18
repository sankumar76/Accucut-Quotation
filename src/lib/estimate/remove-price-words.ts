/**
 * The words of Remove price (STORY-06.13; FR-108; UX spec SCR-06 "Remove price (Admin)" and "Price removed"), written once for the server that says them and the dialog and the notice that show them. Pure, with no
 * import. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names a step or a state and nothing else. (The dialog's own text names the price, because the Admin sees it on the page; it is
 * built in the dialog's file from the price the page already holds.)
 *
 * The 409 for a request that names an approval that is not the latest is Cancel approval's own (`APPROVAL_CHANGED`, `cancel-words.ts`): one code and one sentence on both paths. The password's refusals are the step-up's
 * (`lib/auth/step-up.ts`). The spec has no sentence for the three below (assumptions of STORY-06.13, listed in the pull request): each names what is true and nothing else, and none holds a figure.
 */

/** The approval is the latest one but was not cancelled: the safeguard of section 4.10, "removal is not offered until the cancel has been done". */
export const APPROVAL_NOT_CANCELLED_CODE = 'APPROVAL_NOT_CANCELLED';
export const APPROVAL_NOT_CANCELLED_MESSAGE = 'This approval has not been cancelled, so its price cannot be removed. Cancel the approval first.';

/** The price of this approval was removed already (by a request that came first, or on another screen). */
export const PRICE_ALREADY_REMOVED_CODE = 'PRICE_ALREADY_REMOVED';
export const PRICE_ALREADY_REMOVED_MESSAGE = 'The price of this approval has already been removed.';

/** The estimate has no approval at all. */
export const NO_PRICE_TO_REMOVE_CODE = 'NO_PRICE_TO_REMOVE';
export const NO_PRICE_TO_REMOVE_MESSAGE = 'This estimate has no approved price to remove.';
