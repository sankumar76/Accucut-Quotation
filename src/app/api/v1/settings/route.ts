import { getSettingsService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { settingsSchema } from '@/server/views/schemas/settings';

/**
 * `GET /api/v1/settings` (STORY-02.09 AC-1 to AC-6): the last good backup, whether it is late, and the newest reading of the server disk, from `job_runs`. Admin only, and the role is
 * checked before anything is looked up (CR-33), so a Lead and an Engineer get the same fixed 403 and a signed-out caller 401, with no date and no figure in either.
 *
 * Only GET is exported, on purpose: the page is read-only. No route starts, restores or deletes a backup (that is the Admin's command on the server, STORY-10.05 and 10.11), and the
 * alert switch and the sender (`PUT /settings`) are story 09.02's, so Next.js answers every other method with 405.
 */
export const GET = withRoute({
  route: '/api/v1/settings',
  method: 'GET',
  output: settingsSchema,
  handler: () => getSettingsService().getBackupStatus(),
});
