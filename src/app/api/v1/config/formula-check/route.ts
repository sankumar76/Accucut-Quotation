import { getConfigEditService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { formulaCheckAnswerSchema, formulaCheckBodySchema } from '@/server/views/schemas/config-edit';

/**
 * `POST /api/v1/config/formula-check` (STORY-08.02 AC-2, AC-3, AC-7, AC-8; FR-022, FR-023; architecture section 6 "Formula check"): the live check of SCR-18. The Admin alone: `withRoute` answers a Lead
 * and an Engineer with the fixed 403 and a signed-out caller 401, before the body is read for anything. A formula with an unknown name, a syntax error, a loop or a breach of the scope rule is a 422 with the
 * SCR-18 sentence under `text`; a good one answers what it uses, what it feeds and its result on the sample row. It stores nothing.
 */
export const POST = withRoute({
  route: '/api/v1/config/formula-check',
  method: 'POST',
  body: formulaCheckBodySchema,
  output: formulaCheckAnswerSchema,
  handler: async ({ user, body, requestId }) => {
    const checked = await getConfigEditService().checkFormula({ user, requestId }, body);
    return { ...checked, uses: [...checked.uses], feeds: [...checked.feeds], note: checked.note, preview: checked.preview === null ? null : { ...checked.preview, operands: [...checked.preview.operands] } };
  },
});
