import { getCalculationService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { calculateAnswerSchema, calculateBodySchema, estimateIdParamsSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/calculate` (STORY-05.09, STORY-05.12; FR-055, FR-056, FR-104; architecture sections 4.2, 4.3 and 6 "Calculate"): the Engineer presses Calculate on their own draft. Engineer only,
 * checked before the ID is looked at (a Lead's and an Admin's Calculate is Recalculate, STORY-06.04). Everything runs in one transaction under the estimate's row lock: an estimate that is not theirs
 * is the same 404 as one that does not exist (CR-33), one that is not a draft is a 409 with a named code, a part with a missing input is a 422 `CALCULATE_BLOCKED` that lists the parts and fields
 * and writes nothing, and a good Calculate stores the calculation, prepares the estimate and answers `{status, message}` with the fixed sentence and **nothing else** (NFR-002): no number from the
 * calculation is in the answer, a log line or the time it takes to answer, beyond the work of the parts.
 *
 * **The body (STORY-05.12)** is none, or `{acknowledge: {inputsRevision}}` from the 409 `CALCULATE_ACK_REQUIRED` that a first press earns when a row has 0 in QTY per Assy. An empty body is allowed
 * (`optionalBody`) and a body that is not that shape is 400 (`badBodyIs400`). The service compares the number with the estimate's revision under the lock; `acknowledge` with nothing to warn is ignored.
 * The audit entry of an acknowledged warning names the person who pressed and this request.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/calculate',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: calculateBodySchema,
  optionalBody: true,
  badBodyIs400: true,
  output: calculateAnswerSchema,
  handler: ({ user, params, body, requestId }) =>
    getCalculationService().calculate({ id: user.id, role: user.role }, params.id, {
      acknowledge: body?.acknowledge,
      audit: { actorId: user.id, actorLabel: user.name, requestId },
    }),
});
