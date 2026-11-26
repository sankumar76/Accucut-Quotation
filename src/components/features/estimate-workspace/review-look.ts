import { QTY_PER_ASSY_HINT } from '@/lib/estimate/quantity-hint';
import type { FormField } from '@/lib/estimates/form-client';

/**
 * What turns the Engineer's part form into the Lead's and the Admin's read-only view (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` section 3). One prop on the same form, so there is
 * no second one (UD-1): no intro and no hints, "Not entered" for an empty value, the chosen surface treatments as chips and the Lead's notice in place of "can no longer be changed". Nothing here holds a figure: the
 * row's eyebrow, title and figure line are drawn on the server above the form (ruling 3.6), and the form is labelled by that title.
 */
export interface PartReview {
  /** The words of the one notice of the block (the page's, by status: `review-texts.ts`). */
  readonly notice: string;
  /** What is said once, politely, after a row is chosen: "Showing the inputs of 1.4 Top cover. Read-only." (a text the server wrote). */
  readonly showing: string;
}

/** The review look as the fields see it: what the server handed in, and whether a row was chosen after the page was drawn (the first paint steals no focus and says nothing). */
export type PartReviewState = PartReview & { readonly chosen: boolean };

/**
 * The field as the review look draws it: without its hint, except the QTY per Assy one (it says the count is for the whole order, which the Lead needs to read the figures). The same field object otherwise, so
 * labels, Excel letters, units and the order are the Engineer's.
 */
export const reviewField = (field: FormField): FormField => (field.hint === null || field.hint === QTY_PER_ASSY_HINT ? field : { ...field, hint: null });
