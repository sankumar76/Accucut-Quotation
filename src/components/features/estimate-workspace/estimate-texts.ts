/**
 * The words of SCR-05 "Estimate workspace" for the header and the customer (UX spec section 6, SCR-05; UX-15, UX-24), written once. None of them names a rate,
 * a price or a formula: the screen does not hint that any exist (UX-24).
 */

export const ESTIMATE_META_TITLE = 'Estimate';
export const ESTIMATE_META_DESCRIPTION = 'Open an estimate and enter the inputs of its parts.';

export const FOLDER_TITLE = 'Task folder';
export const NOTES_FROM_PREFIX = 'Notes from';
export const NO_LINK_NOTE = 'This path has no link. Select it and copy it yourself.';

export const NO_CUSTOMER_TITLE = 'Choose the customer to start.';
export const NO_CUSTOMER_BODY = 'The form opens as soon as you pick one.';

export const CUSTOMER_LABEL = 'Customer';
export const CUSTOMER_TAG = 'Choose this first';
export const CUSTOMER_HINT = 'Choose the customer this estimate is for. Changing it later asks you to confirm.';
export const CUSTOMER_PLACEHOLDER = 'Choose the customer';
export const CUSTOMER_LOADING = 'Loading customers';
export const CUSTOMER_LOCKED_HINT = 'This estimate can no longer be changed.';
export const CUSTOMER_SAVED = 'Customer saved.';
export const CUSTOMER_SAVING = 'Saving';

export const LOAD_FAILED_TITLE = 'We could not load the customers';
export const SAVE_FAILED_TITLE = 'The customer was not saved';
export const FAILED_BODY = 'Check your connection and try again. What you typed is kept.';
export const TRY_AGAIN = 'Try again';

export const CHANGE_TITLE = 'Change the customer?';
export const CHANGE_CONFIRM = 'Change customer';
export const changeDescription = (from: string, to: string): string =>
  `You are changing the customer from ${from} to ${to}. Nothing you typed is lost. The new customer applies the next time the estimate is calculated.`;
export const keepLabel = (name: string): string => `Keep ${name}`;

export const FORM_AREA_TITLE = 'Parts and inputs';
export const FORM_AREA_LOCKED = 'The parts tree and the form open here once the customer is chosen.';
export const FORM_AREA_OPEN = 'The parts tree and the form open here.';

export const REVIEW_CUSTOMER_LABEL = 'Customer';
export const REVIEW_NO_CUSTOMER = 'Not chosen yet';
