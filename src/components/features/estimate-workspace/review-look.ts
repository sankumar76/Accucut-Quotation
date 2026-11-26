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
  /** A row was just chosen: the form's title takes the focus once the form shows (RO-2). Not on the first paint. */
  readonly focusTitle: boolean;
}

/**
 * The field as the review look draws it: without its hint, except the QTY per Assy one (it says the count is for the whole order, which the Lead needs to read the figures). The same field object otherwise, so
 * labels, Excel letters, units and the order are the Engineer's.
 */
export const reviewField = (field: FormField): FormField => (field.hint === null || field.hint === QTY_PER_ASSY_HINT ? field : { ...field, hint: null });
