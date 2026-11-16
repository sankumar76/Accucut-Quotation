import { z } from 'zod';

import { getApprovalService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { approveBodySchema, estimateIdParamsSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/approve` (STORY-06.05 AC-1 to AC-5, AC-8; FR-101; architecture sections 4.8 and 6 "Approve"): a Lead or an Admin approves a submitted estimate. This story is the **guard**: the server
 * refuses the approval unless the figures are current, whatever the browser showed. Lead and Admin only, so `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a
 * signed-out caller is a 401 before that. Then, under the estimate's row lock in one transaction: 404 (no such estimate), 409 with the state machine's code (a status that is not SUBMITTED), 409 `NOT_CALCULATED`,
 * 409 `TOTALS_OUT_OF_DATE`, 409 `CALCULATION_CHANGED` (the `calculationId` is not the current one). A refusal writes nothing, not even an audit entry (AC-8).
 *
 * **Until STORY-06.06 writes the approval, a request that passes every check is the fixed 501 `APPROVAL_NOT_AVAILABLE`** and writes nothing (assumption A-1 of STORY-06.05). The answer schema is `never`: no body of
 * success exists yet, so none can leave, and 06.06 replaces this with the approval's own strict schema. The body is strict; the price and the reason are shape-checked here and judged by 06.06.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/approve',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: approveBodySchema,
  output: z.never(),
  handler: ({ user, params, body }) => getApprovalService().approve({ id: user.id, role: user.role }, params.id, body),
});
