import type { ReactNode } from 'react';

import { QTY_PER_ASSY_HINT } from '@/lib/estimate/quantity-hint';
import type { FormField } from '@/lib/estimates/form-client';

/**
 * What turns the Engineer's part form into the Lead's and the Admin's read-only view (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` section 3). One prop on the same form, so there is
 * no second one (UD-1): no intro and no hints, "Not entered" for an empty value, the chosen surface treatments as chips, the Lead's notice in place of "can no longer be changed", and the row's own line between the title
 * and the count. Nothing here holds a figure: the row line is a server-drawn element the page hands in.
 */
export interface PartReview {
  /** The words of the one notice of the block (the page's, by status: `review-texts.ts`). */
  readonly notice: string;
  /** The row's figure line, drawn on the server (Lead and Admin only), shown under the title. */
  readonly rowLine: ReactNode;
  /** The row's eyebrow, title and figure line, drawn on the server: what is on the page while the form is read, so the title and the line are there at first paint and nothing moves when the form arrives (UX ruling 3.6). */
  readonly head: ReactNode;
  /** What is said once, politely, after a row is chosen: "Showing the inputs of 1.4 Top cover. Read-only." (a text the server wrote). */
  readonly showing: string;
  /** The figures are current as the page was drawn (DEF-131 stage 2): a save that changes an input then clears them, and the island asks the page to be drawn again, once. */
  readonly figuresCurrent: boolean;
}

/** The review look as the fields see it: what the server handed in, and whether a row was chosen after the page was drawn (the first paint steals no focus and says nothing). */
export type PartReviewState = PartReview & {
  readonly chosen: boolean;
  /** A save changed the part (DEF-131 stage 2): the island asks the page to be drawn again when that took the figures from current to cleared. Only the Lead's and the Admin's editable island gives one. */
  readonly onWrote?: (() => void) | undefined;
  /** A save was refused because the estimate was approved or taken out of the editable states elsewhere (ED-12): the island turns the block read-only. */
  readonly onLocked?: (() => void) | undefined;
};

/**
 * The field as the review look draws it: without its hint, except the QTY per Assy one (it says the count is for the whole order, which the Lead needs to read the figures). The same field object otherwise, so
 * labels, Excel letters, units and the order are the Engineer's.
 */
export const reviewField = (field: FormField): FormField => (field.hint === null || field.hint === QTY_PER_ASSY_HINT ? field : { ...field, hint: null });
