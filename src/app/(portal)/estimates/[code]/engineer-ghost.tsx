import type { ReactNode } from 'react';

import { FORM_LOCKED } from '@/components/features/estimate-workspace/estimate-texts';
import { ghostOf } from '@/components/features/estimate-workspace/part-form-ghost';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

/**
 * The Engineer's loading ghost (DEF-145, PF-6, PF-7, PF-15; architect note `lead-page-server-props-2026-11-27.md` 5a): drawn **from the form body that the page already holds for the form's seed**
 * (DEF-085, DL-469: `readFirstPartFormBodies`, the same service read as the routes' `GET /form`, built by the routes' own builder, so the strict schemas and no added field), so the page makes no
 * read for it. It is a server element handed to the workspace as `cards` is, and shows in the form area from the first paint until the form replaces it, and also while the tree is read (PF-7). **It takes the form's definition only and never the
 * part's saved values**: it is a new part's shape, with the defaults (the ux ruling; the same as the ghost of the second wait), so no value the Engineer typed and no count made from one is drawn. With no body (the read failed, or the estimate has no rows) there is no ghost and the three bars
 * stand in; the kind of the fault was logged where the bodies were read.
 */
export function engineerGhostFrom(first: { readonly form: unknown } | null, state: { readonly status: EstimateStatus; readonly ignored: boolean }): ReactNode {
  if (first === null) return undefined;
  const editable = canEditInputs(state, 'ENGINEER');
  return ghostOf({ form: first.form, notice: editable ? undefined : FORM_LOCKED, head: 'engineer', editable });
}
