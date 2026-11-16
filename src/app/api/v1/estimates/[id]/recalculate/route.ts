import { getCalculationService, getEstimateReviewService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { calculateBodySchema, estimateIdParamsSchema } from '@/server/views/schemas/estimates';
import { costsSchema } from '@/server/views/schemas/costs';

/**
 * `POST /api/v1/estimates/{id}/recalculate` (STORY-06.04 AC-3; FR-061; architecture sections 4.2, 4.8 and 6 "Recalculate"): a Lead or an Admin presses Recalculate on an estimate. Lead and Admin only, so
 * `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401 before that. It is **the Calculate of the same service** (`recalculate`
 * shares its transaction, its checks and their order with `calculate`, so there is no second calculation path): a part with a missing input is the 422 `CALCULATE_BLOCKED` that writes nothing, no customer
 * is a 409, an approved estimate is the 409 `ESTIMATE_APPROVED_IS_LOCKED`, and a good press stores a new record in the person's name, submits a draft and leaves a submitted estimate submitted.
 *
 * The body is the same as Calculate's: none, or `{acknowledge: {inputsRevision}}` from the 409 `CALCULATE_ACK_REQUIRED` that a 0 in QTY per Assy earns every press, even when the Engineer already went
 * ahead (UX-44, A-26). A body that is not that shape is 400.
 *
 * **The answer is the costs view** (`costsSchema`, the answer of `GET /costs`): after the write, the figures are read the one way they are ever read, through the figure state, so they are `current`
 * and the answer is exactly what the review would show. No figure is read from the write itself, and the schema is strict (NFR-002).
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/recalculate',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: calculateBodySchema,
  optionalBody: true,
  badBodyIs400: true,
  output: costsSchema,
  handler: async ({ user, params, body, requestId }) => {
    const viewer = { id: user.id, role: user.role };
    await getCalculationService().recalculate(viewer, params.id, { acknowledge: body?.acknowledge, audit: { actorId: user.id, actorLabel: user.name, requestId } });
    return getEstimateReviewService().getCosts(viewer, params.id);
  },
});
