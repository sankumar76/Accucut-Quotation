/**
 * The words and the type that more than one masters screen says (SCR-11 "Process master" and SCR-13 "Materials and lists": the Materials, Exchange
 * rates and Treatment / Color tabs; UX spec section 6, "SCR-11 Process master", and the mock-ups `docs/03-ux/screens/SCR-11.html` and `SCR-13.html`).
 * The words that only the Process Master says are in `process-texts.ts`; the words of each tab of SCR-13 are in its own `*-texts.ts`. The messages
 * under the fields are in `src/lib/masters`, where the server's schemas read them too.
 */

/**
 * The class that lets a long name wrap inside a table cell, a dialog title or a description (ux-spec v0.17: "long names wrap"). It is
 * defined once, in `shared/break-long-names.ts`, where `Notice` and `EmptyState` also read it: a notice and an empty-state title always wrap, so
 * no caller adds it to either (AQP-275, AQP-289).
 * @deprecated Import it from `@/components/shared/break-long-names`; this re-export goes when its importers move (GitHub issue 225).
 */
export { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';

export const CLEAR_FILTERS = 'Clear filters';

export const ERROR_RETRY = 'Try again';

export const TRY_AGAIN_BODY = 'Check your connection and try again. Nothing was changed.';
export const FAILED_DIALOGS_TITLE = 'The form did not open.';
export const FAILED_CONFIRMATION_TITLE = 'The confirmation did not open.';
export const FAILED_DIALOGS_MESSAGE = 'Check your connection and try again.';

// ---- The refusal to delete a customer or a material that an open estimate uses (STORY-02.07; ux-spec SCR-12 and SCR-13 "Delete blocked") ----------------

/** The two masters whose delete an open estimate blocks (BR-053). */
export type InUseKind = 'customer' | 'material';

export const IN_USE_CLOSE = 'Close';
export const inUseTitle = (name: string): string => `${name} cannot be deleted yet`;

/** The sentence above the list: "An open estimate uses this customer:" for one, and the count for more (the mock-up draws one; the plural is the developer's proposal). */
export const inUseLead = (kind: InUseKind, total: number): string =>
  total === 1 ? `An open estimate uses this ${kind}:` : `${total} open estimates use this ${kind}:`;

/** The note after the ten named estimates, when there are more ("and N more", AC-2). */
export const inUseMore = (count: number): string => `and ${count} more`;

/** What to do first, in the words of the mock-up (`SCR-12.html`, `SCR-13.html`); the plural follows its sentence. */
export const inUseAdvice = (kind: InUseKind, total: number): string => {
  const one = total === 1;
  if (kind === 'customer') return `Approve ${one ? 'it' : 'them'}, or move ${one ? 'it' : 'them'} to another customer, and then delete this one.`;
  return `Approve ${one ? 'it' : 'them'}, or change the material on ${one ? 'its' : 'their'} parts, and then delete this one.`;
};

/** The list's label for a screen reader. */
export const IN_USE_LIST_LABEL = 'Open estimates';

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
