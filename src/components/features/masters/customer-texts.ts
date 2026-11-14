import type { CustomerRate } from '@/lib/masters/customers';
import { RUPEE } from '@/lib/masters/master-rules';
import { PERCENT_UNIT } from '@/lib/masters/process-items';

import type { PageNotice } from './master-texts';

/**
 * The words of SCR-12 "Customer master" (UX spec section 6, "SCR-12"; ux-spec v0.22 "The Customers list from 768 px"; the mock-up
 * `docs/03-ux/screens/SCR-12.html`). The messages under the fields and the limits are in `src/lib/masters/customers.ts`, where the server's schemas
 * read them too. The words every masters screen says (the Try again button, the long-name class, the failure lines) are in `master-texts.ts`.
 *
 * The mock-up fixes the title, the description, the columns, the buttons, the empty, no-match and error states and the reset dialog. The sentences it
 * does not give (the notices after a save and a reset, the failed writes) were the developer's proposal from the patterns of SCR-11 and the
 * Treatment / Color tab. The ux-expert confirmed them in ux-spec v0.24, SCR-12 "The Customers words: final words", and ruled the customer's page its own
 * load-error title. They follow the shared rule of ux-spec v0.21 section 6.0 that a failed write never says "Nothing was changed.". Delete and
 * Delete blocked (story 02.07) are the mock-up's words; the sentences it does not give are the developer's proposal from the Treatment / Color tab, for the
 * ux-expert to rule on.
 */

export const CUSTOMERS_TITLE = 'Customers';
export const CUSTOMERS_DESCRIPTION = 'Each customer has its own value for every process rate.';
export const CUSTOMERS_META_DESCRIPTION = 'Manage customers and the rate each one is quoted at for every process rate.';

export const ADD_CUSTOMER = 'Add customer';
export const ADDING_CUSTOMER = 'Adding customer';

export const CUSTOMER_SEARCH_LABEL = 'Search';
export const CUSTOMER_SEARCH_PLACEHOLDER = 'Customer name';

export const CUSTOMER_LIST_LABEL = 'Customers';
export const CUSTOMER_REGION_LABEL = 'Customers, scrollable';
export const CUSTOMER_HEADINGS = { name: 'Customer', phone: 'Phone', email: 'E-mail', rates: 'Rates' } as const;

export const CUSTOMERS_LOADING_LABEL = 'Loading customers';
export const CUSTOMERS_ERROR_TITLE = 'We could not load customers';
/** The customer's own page has its own load-error title and sentence (ux-spec v0.24 and v0.26). */
export const CUSTOMER_PAGE_ERROR_TITLE = 'We could not load this customer';
/** Under that title (ux-spec v0.26): the read can fail after a save or a reset that went through, so the sentence does not say "Nothing was changed.". */
export const CUSTOMER_PAGE_ERROR_BODY = 'Check your connection and try again. If you just saved or reset this customer, that change was kept.';

export const CUSTOMERS_EMPTY_TITLE = 'No customers yet';
export const CUSTOMERS_EMPTY_DESCRIPTION = 'Add the first customer. It starts with every default rate.';
export const CUSTOMERS_NO_MATCH_DESCRIPTION = 'Check the spelling or add the customer.';
export const noCustomerMatchTitle = (query: string): string => `No customer matches "${query.trim()}"`;

/** The Rates column: how many of the customer's rates differ from the defaults. */
export const ALL_DEFAULT = 'All default';
export const differText = (count: number): string => `${count} differ`;

export const editCustomerLabel = (name: string): string => `Edit ${name}`;
export const EDIT_ACTION = 'Edit';
export const DELETE_ACTION = 'Delete';
export const deleteCustomerLabel = (name: string): string => `Delete ${name}`;

export const FAILED_ADD_CUSTOMER_MESSAGE = 'We could not add the customer.';
/** Under a failed Add or Save: the shared sentence of ux-spec v0.21 section 6.0 for a write that keeps what the person typed. It never says "Nothing was changed.". */
export const FAILED_WRITE_KEEPS_FORM_BODY = 'Check your connection and try again. What you typed is still in the form.';
export const FAILED_WRITE_BODY = 'Check your connection and try again.';

/** After an add: the sentence under the page header, replaced by the next one. Each add writes exactly one audit entry, so the clause is always true. */
export const customerAddedNotice = (name: string): PageNotice => ({
  tone: 'success',
  text: `${name} was added. Every rate starts at the current default. The change is in the audit log.`,
});

// ---- The edit page ------------------------------------------------------------------------------------------------------------

export const DETAILS_TITLE = 'Details';
export const RATES_TITLE = 'Rates for this customer';
export const RATES_HINT = 'Percent rates are typed as plain numbers: 12 means 12%, 12.5 means 12.5%';
export const BREADCRUMB_LABEL = 'Breadcrumb';

export const FIELD_LABELS = { name: 'Customer name', phone: 'Phone', email: 'E-mail', address: 'Address' } as const;

export const RATE_HEADINGS = { rate: 'Rate', default: 'Default', own: 'This customer', status: 'Status' } as const;
export const DIFFERS_TAG = 'Differs from default';
export const SAME_AS_DEFAULT = 'Same as default';
export const rateRegionLabel = (name: string): string => `Rates for ${name}, scrollable`;
export const rateInputLabel = (rate: string, customer: string): string => `${rate} for ${customer}`;

export const SAVE_CUSTOMER = 'Save customer';
export const SAVING_CUSTOMER = 'Saving';
export const CANCEL_EDIT = 'Cancel';
export const RESET_ACTION = 'Reset to defaults';

export const FAILED_SAVE_CUSTOMER_MESSAGE = 'We could not save the changes.';

export const editDescription = (differ: number): string =>
  differ === 0 ? 'Every rate is at its default.' : `${differ} ${differ === 1 ? 'rate differs' : 'rates differ'} from the defaults.`;

/** After a save that changed something. A save that finds nothing changed writes no entry on the server, so the sentence makes no claim about the audit log. */
export const customerSavedNotice = (name: string): PageNotice => ({ tone: 'success', text: `${name} was saved.` });

/** A save with nothing changed sends no request (the same rule as every master's form). */
export const NOTHING_TO_SAVE_NOTICE: PageNotice = { tone: 'info', title: 'Nothing to save.', text: 'You have not changed any detail or rate.' };

export const resetNotice = (name: string, count: number): PageNotice =>
  count === 0
    ? { tone: 'info', title: `${name} is already at the defaults.`, text: 'Every saved rate already equals its current default, so no saved value was replaced. The rate boxes show the defaults.' }
    : { tone: 'success', text: `${name} was reset to the defaults. ${count} ${count === 1 ? 'rate was' : 'rates were'} replaced.` };

// ---- The reset dialog (AC-3) ---------------------------------------------------------------------------------------------------

export const RESET_KEEP = 'Keep current rates';
export const RESET_CONFIRM = 'Reset to defaults';
export const RESETTING = 'Resetting';
export const resetTitle = (name: string): string => `Reset ${name} to defaults?`;

// ---- The delete dialogs (STORY-02.07; ux-spec SCR-12 "Delete" and "Delete blocked") ------------------------------------------------

export const DELETE_KEEP_CUSTOMER = 'Keep customer';
export const DELETE_CONFIRM_CUSTOMER = 'Delete customer';
export const deleteCustomerTitle = (name: string): string => `Delete ${name}?`;
/** The words of the mock-up. "You cannot undo this here" is true: the portal has no restore (the story's "not in scope"), so a deleted customer is gone from every screen. */
export const deleteCustomerDescription = (name: string): string =>
  `${name} no longer appears in this list or in the customer choice on new estimates. Estimates that are already calculated keep their figures. You cannot undo this here.`;
export const FAILED_DELETE_CUSTOMER_MESSAGE = 'We could not delete the customer.';

/** After a delete: one `master.deleted` entry is written with it, so the clause is always true (the pattern of the Treatment / Color tab). */
export const customerDeletedNotice = (name: string): PageNotice => ({ tone: 'success', text: `${name} was deleted. The change is in the audit log.` });

/** The customer was deleted elsewhere while the dialog was open (the pattern of ux-spec v0.17): nothing failed and nothing is at risk, so it is not an alert. */
export const customerGoneNotice = (name: string): PageNotice => ({
  tone: 'info',
  title: `${name} was already deleted.`,
  text: 'It was deleted after you opened this list, so there was nothing to delete.',
});

/** The value as the dialog and the table show it, with its sign: "₹ 0.50" and "11.00 %". */
export function rateWords(rate: Pick<CustomerRate, 'unit'>, value: string): string {
  return rate.unit === PERCENT_UNIT ? `${value} %` : `${RUPEE} ${value}`;
}

/** The sentence above the list of rates the reset replaces. A customer with none that differ is told so, and the confirm button is still offered (a reset is idempotent). */
export const resetDescription = (total: number, differing: number): string =>
  differing === 0
    ? `All ${total} rates already equal the current Process master values, so no saved value will be replaced.`
    : `All ${total} rates return to the current Process master values. The ${differing} ${differing === 1 ? 'value' : 'values'} this customer has now ${differing === 1 ? 'is' : 'are'} replaced:`;

export const RESET_FAILED_MESSAGE = 'We could not reset the rates.';

/** The second paragraph of the reset dialog, always shown: what is typed and not saved is replaced too, and the details are not (ux-spec v0.25). */
export const RESET_TYPED_NOTE =
  'A rate value you have typed on this page and not yet saved is replaced too. The details (name, phone, e-mail, address) stay as typed.';
