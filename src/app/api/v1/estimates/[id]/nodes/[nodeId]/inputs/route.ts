import { inputEntriesOf } from '@/lib/estimate/part-view';
import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { nodeParamsSchema, saveInputsBodySchema, savedInputsSchema } from '@/server/views/schemas';

/**
 * `PATCH /api/v1/estimates/{id}/nodes/{nodeId}/inputs` (STORY-05.03 AC-4, AC-7; architecture sections 4.8 and 6 "Save inputs"): save what was typed into a part, by field ID,
 * as the part was when the person looked (`revision`). An Admin and a Lead may save into any estimate, an Engineer only their own, while this person may change its
 * inputs (`assertEditable`). The order of the refusals is: 404 (the estimate, then the part, the same for one that is not theirs and one that does not exist), 409 (not
 * editable by this person, or the part changed since the person looked), 422 under each field at fault (a number that is not 0 or more with up to 2 decimals, a text that
 * is too long, a material that is not in the Material Master, a field that is unknown, Restricted or not a field a person types into). A blank clears a value. A value equal
 * after normalisation (`1.50` and `1.5`) changes nothing and raises no revision; a real change raises the part's revision and the estimate's `inputs_revision` in one
 * transaction. The answer is the part's new revision, how complete it is and what is stored: no figure.
 */
export const PATCH = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]/inputs',
  method: 'PATCH',
  params: nodeParamsSchema,
  body: saveInputsBodySchema,
  output: savedInputsSchema,
  handler: async ({ user, params, body }) => {
    const saved = await getEstimateService().saveInputs({ id: user.id, role: user.role }, params.id, { nodeId: params.nodeId, ...body });
    return { id: saved.id, revision: saved.revision, completeness: saved.completeness, inputs: inputEntriesOf(saved.inputs) };
  },
});
