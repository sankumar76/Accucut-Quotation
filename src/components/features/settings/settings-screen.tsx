import { PageHeader } from '@/components/shared/page-header';
import type { AlertSettingsView, BackupStatusView } from '@/server/services/settings-service';

import { AlertsCard } from './alerts-card';
import { BackupLines } from './backup-lines';
import { SETTINGS_DESCRIPTION, SETTINGS_TITLE } from './texts';

export interface SettingsScreenProps {
  readonly status: BackupStatusView;
  readonly alerts: AlertSettingsView;
  /** The signed-in Admin's own address: where the test e-mail goes. */
  readonly adminAddress: string;
}

/**
 * SCR-15 "Settings" (STORY-02.09 AC-1 to AC-5, STORY-09.02 AC-1): the e-mail alerts (the switch, the sender, the test e-mail: a client component) and, below them, the Last backup line
 * (read-only). The page itself is a server component: the answers come from the server for the first paint, and only the alerts card sends script.
 */
export function SettingsScreen({ status, alerts, adminAddress }: SettingsScreenProps) {
  return (
    <div className="flex w-full max-w-prose flex-col gap-s-4 md:gap-s-5">
      <PageHeader title={SETTINGS_TITLE} description={SETTINGS_DESCRIPTION} />
      <AlertsCard
        initial={{ alertsEnabled: alerts.alertsEnabled, senderName: alerts.senderName, senderAddress: alerts.senderAddress }}
        emailEnabled={alerts.emailEnabled}
        adminAddress={adminAddress}
      />
      <BackupLines status={status} />
    </div>
  );
}
