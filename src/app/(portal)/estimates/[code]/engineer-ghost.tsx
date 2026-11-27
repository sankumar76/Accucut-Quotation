import type { ReactNode } from 'react';

import { FORM_LOCKED } from '@/components/features/estimate-workspace/estimate-texts';
import { ghostOf } from '@/components/features/estimate-workspace/part-form-ghost';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { EstimateService, EstimateViewer } from '@/server/services/estimate-service';
import { formBody } from '@/server/views/part-form-bodies';

/**
 * The Engineer's loading ghost (DEF-145, PF-6, PF-15; architect note `lead-page-server-props-2026-11-27.md` 5a): the form's definition, read here on the server as the same viewer by the service behind
 * `GET /estimates/{id}/form`, passed through the route's own builder (`formBody`, so the strict schema and no added field), and drawn as a server element handed to the workspace as `cards` is. The Engineer's tree is read
 * after hydration, so no part is known here: the ghost is a new part's, with the defaults. **The form's own read stays** (the client's `/form` read is made as ever; this one adds a read to the render and nothing
 * is seeded into the form, DL-455 (3)(a)). A fault is not a fault of the page: no ghost, and the three bars stand in. Only the kind of the fault is logged, never its cause or the estimate.
 */
export async function engineerGhost(estimates: Pick<EstimateService, 'getForm'>, viewer: EstimateViewer, estimateId: string, state: { readonly status: EstimateStatus; readonly ignored: boolean }): Promise<ReactNode> {
  try {
    const form = formBody(await estimates.getForm(viewer, estimateId));
    return ghostOf({ form, notice: canEditInputs(state, 'ENGINEER') ? undefined : FORM_LOCKED, head: 'engineer' });
  } catch (error) {
    logger.warn({ errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined }, 'The form could not be read for the Engineer\'s loading ghost; the page draws the bars instead.');
    return undefined;
  }
}
