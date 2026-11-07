import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { createProcessItemBodySchema, processItemSchema, processItemsResponseSchema } from '@/server/views/schemas/process-items';

const CREATED = 201;

/** `GET /api/v1/process-items` (STORY-02.01 AC-1): every rate, for SCR-11. Admin only; the role check runs before anything is read. */
export const GET = withRoute({
  route: '/api/v1/process-items',
  method: 'GET',
  output: processItemsResponseSchema,
  handler: async () => ({ processItems: await getMastersService().listProcessItems() }),
});

/** `POST /api/v1/process-items` (AC-2, AC-5): adds a rate with its unit and default value, and records who did it. */
export const POST = withRoute({
  route: '/api/v1/process-items',
  method: 'POST',
  status: CREATED,
  body: createProcessItemBodySchema,
  output: processItemSchema,
  handler: ({ user, requestId, body }) => getMastersService().createProcessItem({ actorId: user.id, actorLabel: user.name, requestId }, body),
});
