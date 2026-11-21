import { getSettingsService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { alertSettingsBodySchema, alertSettingsSchema, settingsSchema } from '@/server/views/schemas/settings';

/**
 * `GET /api/v1/settings` (STORY-02.09 AC-1 to AC-6, STORY-09.02 AC-2, AC-6): the last good backup, whether it is late, the newest reading of the server disk (from `job_runs`), and the e-mail alerts
 * (the switch, the sender name and address, and whether this server sends e-mail) and `mailFailures` (STORY-09.06 AC-8: null, or the count of e-mails that failed in the last 7 days with the last class code and time). Admin only, and the role is checked before anything is looked up (CR-33), so a Lead and an Engineer get the
 * same fixed 403 and a signed-out caller 401, with no date, no figure and no address in either. No credential of any kind is in the answer: its schema is strict.
 *
 * `PUT /api/v1/settings` (STORY-09.02 AC-3): saves the switch and the sender and answers the e-mail alerts as saved. Only these three values can be sent (a strict body); a wrong name or address is a 422
 * with one message per field. The change writes no audit entry (decision D-i); the service writes one info line with no address.
 *
 * Only GET and PUT are exported, on purpose: no route starts, restores or deletes a backup (that is the Admin's command on the server, STORY-10.05 and 10.11), so Next.js answers every other method with 405.
 */
export const GET = withRoute({
  route: '/api/v1/settings',
  method: 'GET',
  output: settingsSchema,
  async handler() {
    const service = getSettingsService();
    const [backups, alerts, mailFailures] = await Promise.all([service.getBackupStatus(), service.getAlertSettings(), service.getMailFailures()]);
    return { ...backups, ...alerts, mailFailures };
  },
});

export const PUT = withRoute({
  route: '/api/v1/settings',
  method: 'PUT',
  body: alertSettingsBodySchema,
  output: alertSettingsSchema,
  handler: ({ body, user }) => getSettingsService().updateAlertSettings(body, user),
});
