import { getExportService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';
import { exportFileSchema } from '@/server/views/schemas/export';

/**
 * `GET /api/v1/estimates/{id}/export` (STORY-07.01 AC-2, AC-3, AC-4; architecture sections 4.6 and 6 "Export"; ADR-012): the estimate as an `.xlsx` in the worksheet's own layout, for the Lead and the
 * Admin only. The manifest row lists no other role, so `withRoute` refuses an Engineer with the fixed 403 body and **no file** before the ID is looked at (CR-33, NFR-002), and a signed-out caller is a
 * 401 before that. The file is built on the server only, in a worker thread (`export-service`), and sent as an attachment with the name `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx` and
 * `Cache-Control: private, no-store` (`file-response.ts`).
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/export',
  method: 'GET',
  params: estimateIdParamsSchema,
  download: true,
  output: exportFileSchema,
  handler: ({ user, params }) => getExportService().getFile({ id: user.id, role: user.role }, params.id),
});
