import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { createMaterialBodySchema, materialSchema, materialsResponseSchema } from '@/server/views/schemas/materials';

const CREATED = 201;

/** `GET /api/v1/materials` (STORY-02.03 AC-1): every listed material with its numbers, for SCR-13. Admin only; the role check runs before anything is read. */
export const GET = withRoute({
  route: '/api/v1/materials',
  method: 'GET',
  output: materialsResponseSchema,
  handler: async () => ({ materials: await getMastersService().listMaterials() }),
});

/**
 * `POST /api/v1/materials` (AC-2, AC-3, AC-5): adds a material and records who did it. A name that is taken, and a specific gravity of 0 or
 * below, are 422 with the field named (UX-37); nothing is stored.
 */
export const POST = withRoute({
  route: '/api/v1/materials',
  method: 'POST',
  status: CREATED,
  body: createMaterialBodySchema,
  output: materialSchema,
  handler: ({ user, requestId, body }) => getMastersService().createMaterial({ actorId: user.id, actorLabel: user.name, requestId }, body),
});
