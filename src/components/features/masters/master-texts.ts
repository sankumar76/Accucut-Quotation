/**
 * The words and the type that more than one masters screen says (SCR-11 "Process master" and SCR-13 "Materials and lists": the Materials, Exchange
 * rates and Treatment / Color tabs; UX spec section 6, "SCR-11 Process master", and the mock-ups `docs/03-ux/screens/SCR-11.html` and `SCR-13.html`).
 * The words that only the Process Master says are in `process-texts.ts`; the words of each tab of SCR-13 are in its own `*-texts.ts`. The messages
 * under the fields are in `src/lib/masters`, where the server's schemas read them too.
 */

/**
 * The class that lets a long name wrap inside a table cell, a dialog title or a description (ux-spec v0.17: "long names wrap"). It is
 * defined once, in `shared/break-long-names.ts`, where `Notice` also reads it: a notice always wraps, so no caller adds it to one (AQP-275).
 * @deprecated Import it from `@/components/shared/break-long-names`; this re-export goes when its importers move (GitHub #225).
 */
export { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';

export const CLEAR_FILTERS = 'Clear filters';

export const ERROR_RETRY = 'Try again';

export const TRY_AGAIN_BODY = 'Check your connection and try again. Nothing was changed.';
export const FAILED_DIALOGS_TITLE = 'The form did not open.';
export const FAILED_DIALOGS_MESSAGE = 'Check your connection and try again.';

/** A notice under the page header (the slot of "Saved"): replaced by the next one, cleared by the next press of a button. */
export interface PageNotice {
  readonly tone: 'success' | 'warn' | 'info';
  /** The bold line, when there is one. */
  readonly title?: string;
  readonly text: string;
}

/**
 * The load error's sentence while a success notice (Added, Saved or Deleted) is on the page: the change happened, and the read after it failed
 * (DEF-020, DEF-029; ux-spec v0.21 and v0.23, section 6.0 "Error (load)"). Process, the Materials tab and the Treatment / Color tab say it; the Exchange
 * rates tab has its own words, because it shows a form and not a list.
 */
export const SAVED_NOT_SHOWN_BODY = 'The change was saved, but we could not show the list. Check your connection and try again.';
