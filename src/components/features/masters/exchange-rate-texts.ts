import type { PageNotice } from './process-texts';

/**
 * The words of SCR-13 "Materials and lists", Exchange rates tab (UX spec section 6, "SCR-13"; the mock-up `docs/03-ux/screens/SCR-13.html`).
 * The labels, the hints and the message under a field are in `src/lib/masters/exchange-rates.ts`, where the server's schema reads them too.
 * The words that SCR-11 says for every master (the failure line, Try again) are SCR-11's, imported where used.
 *
 * The ux-spec fixes the tab name, the two labels, the hints, the stamp line and the Save button's name. The sentences of the states below
 * (Saved, Nothing to save, Failed, Loading, Error) are proposed from the patterns of SCR-11 and the Materials tab, for the ux-expert to rule.
 */

export const EXCHANGE_TAB = 'Exchange rates';

/** The placeholder of an empty field, and the state "Not set yet" (AC-1). */
export const NOT_SET_YET = 'Not set yet';

export const SAVE_EXCHANGE_RATES = 'Save exchange rates';
export const SAVING_EXCHANGE_RATES = 'Saving';

export const EXCHANGE_LOADING_LABEL = 'Loading the exchange rates';
export const EXCHANGE_ERROR_TITLE = 'We could not load the exchange rates';

export const FAILED_SAVE_RATES_MESSAGE = 'We could not save the exchange rates.';

/** The sentence under the tab bar after a save; the audit log keeps the detail (the pattern of SCR-11 "Saved"). */
export const RATES_SAVED_NOTICE: PageNotice = { tone: 'success', text: 'Exchange rates saved. The change is in the audit log.' };

/** Save pressed with the values that are already stored: nothing is sent and nothing is written. */
export const RATES_UNCHANGED_NOTICE: PageNotice = { tone: 'info', text: 'The exchange rates already have these values. Nothing was changed.' };

/** "Last updated by Meera Iyer, 02 Nov 2026, 15:10 IST." The time arrives already in IST, from `formatIst` (AC-1). */
export const lastUpdatedLine = (name: string, whenInIst: string): string => `Last updated by ${name}, ${whenInIst}.`;
