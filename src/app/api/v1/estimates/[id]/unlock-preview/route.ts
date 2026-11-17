import { getUnlockService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';
import { unlockPreviewSchema } from '@/server/views/schemas/unlock';

/**
 * `GET /api/v1/estimates/{id}/unlock-preview` (STORY-06.08 AC-1, AC-8; architecture section 6 "Unlock preview"): what changed since the approval, for the dialog of SCR-09. Lead and Admin only, so `withRoute`
 * refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002). It reads and changes nothing. The answer is the number of the configuration version the approval was calculated with and
 * the one in force now, and **counts by kind** of what changed (process rates, material prices, exchange rates) and nothing else: no rate, price, name or value, old or new (NFR-002). 404 for an estimate that
 * does not exist, 409 with the state machine's code for one that is not APPROVED, 409 `CUSTOMER_DELETED` or `MATERIAL_DELETED` in the unlock's words for one whose customer or material was deleted.
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/unlock-preview',
  method: 'GET',
  params: estimateIdParamsSchema,
  output: unlockPreviewSchema,
  handler: ({ user, params }) => getUnlockService().preview({ id: user.id, role: user.role }, params.id),
});
