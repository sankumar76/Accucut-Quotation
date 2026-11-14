import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema, formResponseSchema } from '@/server/views/schemas';

/**
 * `GET /api/v1/estimates/{id}/form` (STORY-05.03 AC-1, AC-3, AC-8; STORY-05.04 AC-1, AC-6, AC-7; architecture section 6 "Estimate form"): the eight sections of the part form, each with
 * its number, name and column range, and each field with its ID, Excel letter, label, unit, hint, default, rule and whether a person types into it, the fields of a later story as
 * placeholders (an ID, a letter and a label), and when a part was last written. It is built from the field registry, not typed. An Admin and a Lead may read any estimate, an Engineer only their own; an estimate that is not theirs answers exactly as one that does not
 * exist (404, CR-33). **One schema for every role, and no rate, cost or formula in it** (NFR-002, ADR-008): Material Rate / Kg (I) and every calculated field are not on it.
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/form',
  method: 'GET',
  params: estimateIdParamsSchema,
  output: formResponseSchema,
  handler: async ({ user, params }) => {
    const form = await getEstimateService().getForm({ id: user.id, role: user.role }, params.id);
    return { sections: form.sections, lastSavedAt: form.lastSavedAt };
  },
});
