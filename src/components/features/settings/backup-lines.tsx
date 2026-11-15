import { Notice } from '@/components/shared/notice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BackupStatusView } from '@/server/services/settings-service';

import {
  BACKUP_LATE_BODY,
  BACKUP_LATE_TITLE,
  BACKUPS_HEADING,
  diskText,
  DISK_FULL_BODY,
  DISK_FULL_TITLE,
  DISK_LABEL,
  LAST_GOOD_LABEL,
  lastGoodText,
  NO_BACKUP_YET,
  NO_DISK_READING,
  SAME_SERVER_NOTE,
} from './texts';

export interface BackupLinesProps {
  readonly status: BackupStatusView;
}

function Line({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-s-1 md:flex-row md:gap-s-4">
      <dt className="text-label text-ink-2 md:w-1/3 md:shrink-0">{label}</dt>
      <dd className="min-w-0 text-ink">{value}</dd>
    </div>
  );
}

/**
 * SCR-15 "Last good backup" and "Server disk" (STORY-02.09 AC-1 to AC-5, AC-8): two read-only lines and, when they apply, the notices "Backup late" and "Disk nearly full". Each notice
 * is an icon, a bold title and a sentence, so neither is shown by colour alone. There is no button, link or field here: nothing starts, restores or deletes a backup. A server
 * component: the answer comes from the server and nothing on the page changes in the browser.
 */
export function BackupLines({ status }: BackupLinesProps) {
  const { lastGoodBackupAt, backupLate, diskReading, diskNearlyFull } = status;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{BACKUPS_HEADING}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-s-4">
        {backupLate ? <Notice tone="warn" title={BACKUP_LATE_TITLE}>{BACKUP_LATE_BODY}</Notice> : null}
        {diskNearlyFull ? <Notice tone="warn" title={DISK_FULL_TITLE}>{DISK_FULL_BODY}</Notice> : null}
        <dl className="flex flex-col gap-s-3">
          <Line label={LAST_GOOD_LABEL} value={lastGoodBackupAt === null ? NO_BACKUP_YET : lastGoodText(new Date(lastGoodBackupAt))} />
          <Line
            label={DISK_LABEL}
            value={diskReading === null ? NO_DISK_READING : diskText({ ...diskReading, readAt: new Date(diskReading.readAt) })}
          />
        </dl>
        <p className="text-ink-2">{SAME_SERVER_NOTE}</p>
      </CardContent>
    </Card>
  );
}
