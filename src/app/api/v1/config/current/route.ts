import { getConfigReadService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { configCurrentSchema } from '@/server/views/schemas/config';

/**
 * `GET /api/v1/config/current` (STORY-08.01 AC-5, AC-6): the number of the current configuration version, who saved it, when, and how many estimates use it. Admin and
 * Lead only, with the role checked first (CR-33): an Engineer gets the fixed 403 and a signed-out caller 401.
 */
export const GET = withRoute({
  route: '/api/v1/config/current',
  method: 'GET',
  output: configCurrentSchema,
  handler: () => getConfigReadService().getCurrent(),
});
