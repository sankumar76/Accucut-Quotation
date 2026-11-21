import { formatDefaultValue } from './process-items';

/**
 * What the two sides of a changed default share (STORY-02.08; SCR-11 "Customers differ", architecture section 8 "Customers"): the limits of
 * the choice request and the words of the page notices and the dialog. Pure and without zod, so the page does not carry them (NFR-009) and a
 * client component may import it. The server's schema (`src/server/views/schemas/process-items.ts`) imports the limits from here.
 *
 * A "choice" is the Admin's answer for one customer whose value was neither the old default nor the new one: **apply** the new default or
 * **keep** the customer's own value (AC-2, AC-3). The words below are the proposal of the story (OQ-1: the ux-expert rules at the end review).
 */

/** The most choices one request may carry (AC-4); the planning volume is 500 customers (NFR-011). */
export const PROPAGATION_MAX_CHOICES = 1000;

export const CHOICES = ['apply', 'keep'] as const;
export type PropagationChoice = (typeof CHOICES)[number];

/**
 * The customer's value as it was listed, as decimal text: digits, then up to four decimals (the column holds four; a listed value is shown to
 * at least two). A sign, a separator and an exponent are not part of it, and it is never a JSON number.
 */
export const SHOWN_VALUE_PATTERN = /^\d{1,12}(?:\.\d{1,4})?$/;
export const SHOWN_VALUE_MESSAGE = 'Send the value as it was listed: a number with up to 4 decimals, as text.';

export const DEFAULT_CHANGED_MESSAGE = 'The default changed again while this window was open. Reload the page to see the current value.';
export const DEFAULT_CHANGED_CODE = 'DEFAULT_CHANGED';
export const REPEATED_CUSTOMER_MESSAGE = 'This customer is listed twice.';
export const UNKNOWN_CUSTOMER_MESSAGE = 'This customer does not exist.';

/** "1 customer" and "17 customers". */
export const customers = (count: number): string => `${count} ${count === 1 ? 'customer' : 'customers'}`;

/** "17 customers had 0.47 and now have 0.52." The values are shown in the unit's own form (a percentage keeps its sign). */
export function hadAndNowHave(moved: number, unit: string, previous: string, next: string): string {
  const [was, is] = [formatDefaultValue(previous, unit), formatDefaultValue(next, unit)];
  return moved === 1 ? `1 customer had ${was} and now has ${is}.` : `${moved} customers had ${was} and now have ${is}.`;
}

/** "3 customers have a different value." */
export const haveDifferentValue = (count: number): string =>
  count === 1 ? '1 customer has a different value.' : `${count} customers have a different value.`;

/** The title of the dialog "Customers differ". */
export const differTitle = (name: string, unit: string, previous: string, next: string): string =>
  `${name} changed from ${formatDefaultValue(previous, unit)} to ${formatDefaultValue(next, unit)}`;

/** The paragraph of the dialog: what moved by itself, who differs, and what is asked. */
export function differBody(moved: number, differing: number, unit: string, previous: string, next: string): string {
  const first = moved === 0 ? `No customer had ${formatDefaultValue(previous, unit)}.` : hadAndNowHave(moved, unit, previous, next);
  return `${first} ${haveDifferentValue(differing)} Choose what to do for ${differing === 1 ? 'it' : 'each one'}.`;
}

/** The two buttons that set every radio; neither saves (AC-3). One customer reads "Keep it" and "Apply to it". */
export const keepAllLabel = (count: number): string => (count === 1 ? 'Keep it' : `Keep all ${count}`);
export const applyAllLabel = (count: number): string => (count === 1 ? 'Apply to it' : `Apply to all ${count}`);

export const SAVE_CHOICES = 'Save choices';
export const SAVING_CHOICES = 'Saving';
export const FAILED_CHOICES_TITLE = 'We could not save your choices.';
export const DIFFER_LIST_LABEL = 'Customers whose value differs from the old default';

/** The radio labels of one customer: "Apply 0.52" and "Keep 0.50". */
export const applyLabel = (unit: string, next: string): string => `Apply ${formatDefaultValue(next, unit)}`;
export const keepLabel = (unit: string, current: string): string => `Keep ${formatDefaultValue(current, unit)}`;

/** The notice after a save that moved customers on its own and asked nothing (AC-1): the audit log keeps the detail. */
export function movedNotice(name: string, moved: number, unit: string, previous: string, next: string): string {
  const base = `${name} saved.`;
  return moved === 0 ? `${base} The change is in the audit log.` : `${base} ${hadAndNowHave(moved, unit, previous, next)} The change is in the audit log.`;
}

/** The bold line of the notice once the dialog has been answered: the save, and how many customers moved by themselves. */
export const savedTitle = (name: string, moved: number, unit: string, previous: string, next: string): string =>
  moved === 0 ? `${name} saved.` : `${name} saved. ${hadAndNowHave(moved, unit, previous, next)}`;

/** The notice when the dialog is closed without Save choices (AC-5): the same as Keep all, and nothing is stored. */
export const dismissedNotice = (count: number): string =>
  count === 1
    ? "1 customer kept its own value. Its rate changes only when you edit it on the customer's page."
    : `${count} customers kept their own value. Their rates change only when you edit them on the customer's page.`;

/** What Save choices answers (AC-3). */
export interface PropagationCounts {
  readonly applied: number;
  readonly kept: number;
  readonly skipped: number;
}

/**
 * The sentence of the notice after Save choices: the counts that are not zero, and the audit log only when a customer's rate really changed (a kept or skipped
 * customer writes no entry). A customer whose value changed since the list was shown is left alone and counted apart (AC-4).
 */
export function choicesNotice(counts: PropagationCounts, unit: string, next: string): string {
  const parts = [
    ...(counts.applied > 0 ? [`${customers(counts.applied)} now ${counts.applied === 1 ? 'has' : 'have'} ${formatDefaultValue(next, unit)}.`] : []),
    ...(counts.kept > 0 ? [`${customers(counts.kept)} kept ${counts.kept === 1 ? 'its' : 'their'} own value.`] : []),
    ...(counts.skipped > 0
      ? [`${customers(counts.skipped)} changed since you looked, so ${counts.skipped === 1 ? 'it was' : 'they were'} left alone.`]
      : []),
    ...(counts.applied > 0 ? ['The changes are in the audit log.'] : []),
  ];
  return parts.join(' ');
}
