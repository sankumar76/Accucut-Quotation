import { getConfigReadService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { configFieldsSchema } from '@/server/views/schemas/config';

/**
 * `GET /api/v1/config/fields` (STORY-08.01 AC-1, AC-5): every field of the current configuration version in column order, with its letter, kind and formula in
 * display form. Admin and Lead only; the role is checked before anything is looked up (CR-33), so an Engineer gets the fixed 403 and a signed-out caller 401, with no
 * formula, no rate name and no field in either. Only GET is exported: the edit routes belong to stories 08.02 onward.
 */
export const GET = withRoute({
  route: '/api/v1/config/fields',
  method: 'GET',
  output: configFieldsSchema,
  handler: async () => {
    const { fields } = await getConfigReadService().getFields();
    return { fields: [...fields] };
  },
});
