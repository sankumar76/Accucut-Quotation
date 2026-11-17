import { getExportService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';
import { exportSummarySchema } from '@/server/views/schemas/export';

/**
 * `GET /api/v1/estimates/{id}/export-summary` (STORY-07.01 AC-3, AC-6; architecture section 6 "Export summary"): what SCR-10 shows before the file is asked for, for the Lead and the Admin only: the name
 * the file would have, the counts of parts and pictures, the first and last column, and the rows the file will hold. The manifest row lists no other role, so an Engineer is refused with the fixed 403
 * before the ID is looked at (CR-33, NFR-002). The answer is one strict schema (`exportSummarySchema`) and holds no figure.
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/export-summary',
  method: 'GET',
  params: estimateIdParamsSchema,
  output: exportSummarySchema,
  handler: ({ user, params }) => getExportService().getSummary({ id: user.id, role: user.role }, params.id),
});
