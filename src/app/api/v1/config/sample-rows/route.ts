import { getConfigEditService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { sampleRowsAnswerSchema } from '@/server/views/schemas/config-edit';

/**
 * `GET /api/v1/config/sample-rows` (STORY-08.02 AC-1, AC-7; architecture section 6 "Sample rows"): the rows of the latest calculated estimate, which the editor's preview is tried on, or no estimate and no
 * rows while none was calculated, and the names of the fixed operands for the suggestions. The Admin alone (the rows are named by the typed Description and Part No. only; no figure is in the answer).
 */
export const GET = withRoute({
  route: '/api/v1/config/sample-rows',
  method: 'GET',
  output: sampleRowsAnswerSchema,
  handler: async ({ user, requestId }) => {
    const { estimate, rows, operandNames } = await getConfigEditService().listSampleRows({ user, requestId });
    return { estimate, rows: [...rows], operandNames: [...operandNames] };
  },
});
