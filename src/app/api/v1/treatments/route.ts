import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { createTreatmentBodySchema, treatmentSchema, treatmentsResponseSchema } from '@/server/views/schemas/treatments';

const CREATED = 201;

/** `GET /api/v1/treatments` (STORY-02.05 AC-1): every listed treatment for the Treatment / Color tab, "Other" first and locked. Admin only; the role check runs before anything is read. */
export const GET = withRoute({
  route: '/api/v1/treatments',
  method: 'GET',
  output: treatmentsResponseSchema,
  handler: async () => ({ treatments: await getMastersService().listTreatments() }),
});

/**
 * `POST /api/v1/treatments` (AC-2, AC-6): adds a treatment and records who did it. A name that is blank, too long or taken is 422 with the field
 * named, and so is a name the system keeps (`NAME_RESERVED`, in any letter case); nothing is stored.
 */
export const POST = withRoute({
  route: '/api/v1/treatments',
  method: 'POST',
  status: CREATED,
  body: createTreatmentBodySchema,
  output: treatmentSchema,
  handler: ({ user, requestId, body }) => getMastersService().createTreatment({ actorId: user.id, actorLabel: user.name, requestId }, body),
});
