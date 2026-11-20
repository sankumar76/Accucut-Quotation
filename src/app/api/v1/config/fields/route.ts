import { getConfigReadService, getConfigStructureService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { configFieldsSchema } from '@/server/views/schemas/config';
import { insertFieldAnswerSchema, insertFieldBodySchema } from '@/server/views/schemas/config-structure';

/**
 * `GET /api/v1/config/fields` (STORY-08.01 AC-1, AC-5): every field of the current configuration version in column order, with its letter, kind and formula in
 * display form. Admin and Lead only; the role is checked before anything is looked up (CR-33), so an Engineer gets the fixed 403 and a signed-out caller 401, with no
 * formula, no rate name and no field in either.
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

/**
 * `POST /api/v1/config/fields` (STORY-08.03 AC-1, AC-4, AC-7; FR-074, FR-077; architecture section 6 "Insert field"): inserts an input, an output, or an input with its cost column, as **one** new immutable version with its
 * audit entry in one transaction. The Admin alone (the manifest row of this method; `GET` above is the Admin's and the Lead's), so a Lead and an Engineer get the fixed 403 and a signed-out caller 401 before the body is read.
 * No password step (FR-080). A stale `baseVersion` is 409 `CONFIG_VERSION_CHANGED` with the newer number and nothing stored; bad input is the 422 of the preview.
 */
export const POST = withRoute({
  route: '/api/v1/config/fields',
  method: 'POST',
  body: insertFieldBodySchema,
  output: insertFieldAnswerSchema,
  handler: async ({ user, body, requestId }) => {
    const inserted = await getConfigStructureService().insertFields({ user, requestId }, body);
    return { version: inserted.version, letters: [...inserted.letters], message: inserted.message };
  },
});
