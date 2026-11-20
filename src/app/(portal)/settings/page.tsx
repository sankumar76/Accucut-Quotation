
import { SettingsScreen } from '@/components/features/settings/settings-screen';
import { SETTINGS_META_DESCRIPTION, SETTINGS_TITLE } from '@/components/features/settings/texts';
import { getSettingsService } from '@/server/composition';
import { authorizePage } from '@/server/http/page-access';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata(SETTINGS_TITLE, SETTINGS_META_DESCRIPTION);

/**
 * SCR-15 "Settings" (STORY-02.09 AC-1 to AC-6, STORY-09.02 AC-1): the Admin sees the e-mail alerts (the switch, the sender and the test e-mail) and the last good backup and the server disk, read-only. The page checks the role first, with its own
 * address, before it reads anything: a Lead or an Engineer gets SCR-26 "no access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page.
 * The status and the alerts are read on the server for the first paint; the backup lines are drawn by a server component, so no script is sent for them.
 *
 * There is deliberately no `loading.tsx` beside this page, for the reason given on the Users page: it would turn the 403 of a refused role into a streamed 200 (QLT-72,
 * `tests/security/loading-boundaries.test.ts`). A read that fails shows the error state of `error.tsx`.
 */
export default async function SettingsPage() {
  const user = await authorizePage('/settings');
  const service = getSettingsService();
  const [status, alerts] = await Promise.all([service.getBackupStatus(), service.getAlertSettings()]);
  return <SettingsScreen status={status} alerts={alerts} adminAddress={user.email} />;
}
