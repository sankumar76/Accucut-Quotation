/**
 * The words of "Change the customer?" on SCR-06 (CR-01 item 6, AQP-390; UX spec section 0.9 row 6, SCR-06 state `changecust`), written once. The dialog says what changes and what does not: nothing typed is lost,
 * the new customer's rates apply at the next Recalculate, and the change is logged. The sentences the mock-up does not give (the failures and the empty list) are the developer's proposal from the dialogs of
 * Cancel approval and Unlock, for the ux-expert to rule on. None of them names a rate, a price or a formula.
 */

export const CHANGE_TITLE = 'Change the customer?';
export const SET_TITLE = 'Set the customer?';
export const CHANGE_LABEL = 'Change customer';
export const SET_LABEL = 'Set customer';
export const CHANGING_LABEL = 'Saving';
export const NEW_CUSTOMER_LABEL = 'New customer';
export const NEW_CUSTOMER_PLACEHOLDER = 'Choose a customer';
export const LOADING_CUSTOMERS = 'Loading customers';
export const CHOOSE_ANOTHER_MESSAGE = 'Choose a customer other than the current one.';

export const keepLabel = (name: string): string => `Keep ${name}`;
export const CLOSE_LABEL = 'Cancel';

/** "From Brightwater Controls to Marlow Agro Systems. Nothing entered is lost. ..." (the mock-up's sentence, the Excel-file clause left to the file-name story). */
export function changeDescription(from: string | null, to: string): string {
  const start = from === null ? `The customer will be ${to}.` : `From ${from} to ${to}.`;
  return `${start} Nothing entered is lost. The new customer's rates apply at the next Recalculate. The change is logged.`;
}

/** The line under the button when the dialog's code did not come (the first-open failure of every overlay, architecture section 10). */
export const FIRST_OPEN_FAILED = 'The customer window did not open. Check your connection and try again.';
export const LOAD_FAILED_TITLE = 'We could not load the customers';
export const SAVE_FAILED_TITLE = 'The customer was not changed';
export const FAILED_BODY = 'Check your connection and try again.';
export const TRY_AGAIN = 'Try again';
