import { getCalculationService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { calculateAnswerSchema, estimateIdParamsSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/calculate` (STORY-05.09; FR-055, FR-056; architecture sections 4.2 and 6 "Calculate"): the Engineer presses Calculate on their own draft. Engineer only, checked
 * before the ID is looked at (a Lead's and an Admin's Calculate is Recalculate, STORY-06.04). Everything runs in one transaction under the estimate's row lock: an estimate that is not theirs
 * is the same 404 as one that does not exist (CR-33), one that is not a draft is a 409 with a named code, a part with a missing input is a 422 `CALCULATE_BLOCKED` that lists the parts and fields
 * and writes nothing, and a good Calculate stores the calculation, submits the estimate and answers `{status, message}` with the fixed sentence and **nothing else** (NFR-002): no number from the
 * calculation is in the answer, a log line or the time it takes to answer, beyond the work of the parts. There is no body: the quantity warning's acknowledgement is STORY-05.12's.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/calculate',
  method: 'POST',
  params: estimateIdParamsSchema,
  output: calculateAnswerSchema,
  handler: ({ user, params }) => getCalculationService().calculate({ id: user.id, role: user.role }, params.id),
});
