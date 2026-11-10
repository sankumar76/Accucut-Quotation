import type { PageNotice } from './process-texts';

/**
 * The words of SCR-13 "Materials and lists", Exchange rates tab (UX spec section 6, "SCR-13"; the mock-up `docs/03-ux/screens/SCR-13.html`).
 * The labels, the hints and the message under a field are in `src/lib/masters/exchange-rates.ts`, where the server's schema reads them too.
 * The words that SCR-11 says for every master (the failure line, Try again) are SCR-11's, imported where used.
 *
 * The ux-spec fixes the tab name, the two labels, the hints, the stamp line and the Save button's name. The sentences of the states below
 * (Saved, Nothing to save, Failed, Loading, Error) are the ux-expert's ruling on QLT-06 and STD-13 (ux-spec v0.21, SCR-13 "The Exchange rates tab:
 * final words"). Each is true in every case it can appear in: a save that reaches the server changes nothing when the screen was stale, and a lost
 * answer can follow a commit, so neither Saved nor Failed promises an audit entry or says that nothing changed.
 */

export const EXCHANGE_TAB = 'Exchange rates';

/** The placeholder of an empty field, and the state "Not set yet" (AC-1). */
export const NOT_SET_YET = 'Not set yet';

export const SAVE_EXCHANGE_RATES = 'Save exchange rates';
export const SAVING_EXCHANGE_RATES = 'Saving';

export const EXCHANGE_LOADING_LABEL = 'Loading the exchange rates';
export const EXCHANGE_ERROR_TITLE = 'We could not load the exchange rates';

export const FAILED_SAVE_RATES_MESSAGE = 'We could not save the exchange rates.';

/** Under the failed-save title. It does not say "Nothing was changed": a lost answer can follow a commit, and trying again is safe (the same values write no second entry). */
export const FAILED_SAVE_RATES_BODY = 'Check your connection and try again. What you typed is still in the form.';

/** The sentence under the tab bar after a save. It makes no promise about the audit log: a stale screen can save values the server already holds. */
export const RATES_SAVED_NOTICE: PageNotice = { tone: 'success', text: 'Exchange rates saved.' };

/** The load error's sentence while the Saved notice is on the page: the save happened, and the read after it failed (DEF-020 case). */
export const RATES_SAVED_NOT_SHOWN_BODY = 'The exchange rates were saved, but we could not show them. Check your connection and try again.';

/** Save pressed with the values the screen shows as stored: nothing is sent and nothing is written. The screen speaks for itself, not for the server. */
export const RATES_NOTHING_TO_SAVE_NOTICE: PageNotice = { tone: 'info', text: 'You have not changed either rate, so there is nothing to save.' };

/** "Last updated by Meera Iyer, 02 Nov 2026, 15:10 IST." The time arrives already in IST, from `formatIst` (AC-1). */
export const lastUpdatedLine = (name: string, whenInIst: string): string => `Last updated by ${name}, ${whenInIst}.`;
