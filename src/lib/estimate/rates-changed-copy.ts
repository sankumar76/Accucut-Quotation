import type { RateChangeCounts } from './rate-diff';

/**
 * The words of "Rates changed" for a Lead or an Admin (STORY-06.11; UX spec SCR-06 state "Rates changed" and SCR-08 "Rates changed", UX-62; FR-106; architecture section 4.8 "Rates changed since the last
 * calculation"), written once for the two places that say them: the notice of the review and the one line of the approval dialog. Pure, with one import of a type, so the lazy dialog chunk and the server read
 * it and **the page's first load does not** (NFR-009, ADR-016: `/estimates/[code]`). Nothing here is read by an Engineer's page (NFR-002).
 *
 * **Counts by kind, and no value** (NFR-002): the sentences are made from the three counts of `rate-diff` and carry no old or new rate, price, exchange rate or ID.
 *
 * **"Rates" is process rates and exchange rates together.** The UX example, "2 rates and 1 material price changed", is the story's own case (a process rate, a material price and an exchange rate): a Lead
 * thinks of a customer's rate and an exchange rate alike as "a rate", and the material is the one kind named apart. The answer of `GET /costs` still carries the three counts by kind (AC-7).
 */

/** The bold first line of the notice (SCR-06) and of the line in the approval dialog (SCR-08). */
export const RATES_CHANGED_TITLE = 'Rates changed since this was calculated.';

/** The word of the link inside the notice. It points at the Recalculate button of the action bar. */
export const RATES_CHANGED_LINK = 'Recalculate';

/** What follows the link in the notice: the reason to press it, and that approving is not stopped. */
export const RATES_CHANGED_AFTER_LINK = 'to use them. Approving is not blocked.';

const plural = (count: number, one: string, many: string): string => `${String(count)} ${count === 1 ? one : many}`;

/** "2 rates and 1 material price", "1 rate", "3 material prices": the kinds that changed, by count. Empty when nothing changed (no notice is drawn then). */
export function changedKinds(counts: RateChangeCounts): string {
  const rates = counts.processRates + counts.exchangeRates;
  return [rates > 0 ? plural(rates, 'rate', 'rates') : null, counts.materialPrices > 0 ? plural(counts.materialPrices, 'material price', 'material prices') : null].filter((part) => part !== null).join(' and ');
}

/**
 * The first sentence under the notice's title: what changed and since when. `at` is the time of the calculation in view, written in IST (`formatIst`). The notice goes on with the link and
 * `RATES_CHANGED_AFTER_LINK`: "... changed since this was calculated at 05 Nov 2026, 10:42 IST. Recalculate to use them. Approving is not blocked."
 */
export const ratesChangedSentence = (counts: RateChangeCounts, at: string): string => `${changedKinds(counts)} changed since this was calculated at ${at}.`;

/** SCR-08: the one info line of the approval dialog, after `RATES_CHANGED_TITLE`. Counts only; approving is not stopped and the window is the place to say how to use the new rates. */
export const approveRatesLine = (counts: RateChangeCounts): string =>
  `${changedKinds(counts)} changed since this was calculated. Approving is not blocked. Close this window and Recalculate first if you want them used.`;
