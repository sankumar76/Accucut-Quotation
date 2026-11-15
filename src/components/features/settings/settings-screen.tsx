import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BackupStatusView } from '@/server/services/settings-service';

import { BackupLines } from './backup-lines';
import { ALERTS_HEADING, ALERTS_PLACEHOLDER, SETTINGS_DESCRIPTION, SETTINGS_TITLE } from './texts';

export interface SettingsScreenProps {
  readonly status: BackupStatusView;
}

/**
 * SCR-15 "Settings" (STORY-02.09 AC-1 to AC-5): the frame of the page and the Last backup line. Read-only. Below the backup card is the labelled place of the e-mail alerts (the switch and the
 * sender, FR-019, story 09.02): a heading and one sentence, with no control, so the page does not suggest a setting that cannot be changed yet. A server component.
 */
export function SettingsScreen({ status }: SettingsScreenProps) {
  return (
    <div className="flex w-full max-w-prose flex-col gap-s-4 md:gap-s-5">
      <PageHeader title={SETTINGS_TITLE} description={SETTINGS_DESCRIPTION} />
      <BackupLines status={status} />
      <Card>
        <CardHeader>
          <CardTitle>{ALERTS_HEADING}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-2">{ALERTS_PLACEHOLDER}</p>
        </CardContent>
      </Card>
    </div>
  );
}
