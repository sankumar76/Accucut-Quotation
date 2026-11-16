import { BACKUP_LATE_AFTER_DAYS, DISK_NEARLY_FULL_BELOW_PERCENT, DISK_READING_STALE_AFTER_DAYS } from '@/lib/settings/backup-status';
import { formatIst, formatIstWithWeekday } from '@/lib/time';

/**
 * The words of SCR-15 "Settings", Last backup line (UX spec section 6, written out; STORY-02.09 AC-1 to AC-5). One file, so a sentence is written once and a test can compare it with
 * the spec. The two thresholds are quoted from the constants the rule uses, so the notice and the rule cannot drift apart.
 */

export const SETTINGS_TITLE = 'Settings';
export const SETTINGS_DESCRIPTION = 'The weekly backup and the server disk. Nothing on this page starts, restores or deletes a backup.';
export const SETTINGS_META_DESCRIPTION = 'The date of the last good backup and the free space on the server disk.';

export const BACKUPS_HEADING = 'Backups';
export const SAME_SERVER_NOTE = 'Backups are kept on the same server.';

export const LAST_GOOD_LABEL = 'Last good backup';
export const NO_BACKUP_YET = 'No good backup yet.';

export const DISK_LABEL = 'Server disk';
export const NO_DISK_READING = 'The server disk has not been read yet.';

export const BACKUP_LATE_TITLE = 'Backup late';
export const BACKUP_LATE_BODY = `No backup has finished for ${BACKUP_LATE_AFTER_DAYS} days. Ask Accucut IT to check the weekly backup.`;
/** When there has never been a good backup (STORY-10.05 AC-10): no number of days, and true whether no backup ran or only failed ones did. */
export const BACKUP_NEVER_BODY = 'No backup has finished without errors yet. Ask Accucut IT to check the weekly backup.';

export const DISK_FULL_TITLE = 'Disk nearly full';
export const DISK_FULL_BODY = `Less than ${DISK_NEARLY_FULL_BELOW_PERCENT} % of the server disk is free. Backups are kept on the same server, so ask Accucut IT to free space or add disk.`;

/** The labelled place the e-mail alert switch and the sender will fill (FR-019, story 09.02). It says so in words and offers no control. */
export const ALERTS_HEADING = 'E-mail alerts';
export const ALERTS_PLACEHOLDER = 'The switch for e-mail alerts and the sender address will be added here.';

export const ERROR_TITLE = 'We could not load the settings';
export const ERROR_RETRY = 'Try again';

/** "Sunday 01 Nov 2026, 02:00 IST. Finished without errors." (UX spec SCR-15). */
export function lastGoodText(finishedAt: Date): string {
  return `${formatIstWithWeekday(finishedAt)}. Finished without errors.`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

function counted(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/** How long ago a reading was made, in the largest whole unit: "less than a minute ago", "5 minutes ago", "1 hour ago", "2 days ago". */
export function readingAgeText(ageSeconds: number): string {
  if (ageSeconds < SECONDS_PER_MINUTE) return 'less than a minute ago';
  if (ageSeconds < SECONDS_PER_HOUR) return counted(Math.floor(ageSeconds / SECONDS_PER_MINUTE), 'minute');
  if (ageSeconds < SECONDS_PER_DAY) return counted(Math.floor(ageSeconds / SECONDS_PER_HOUR), 'hour');
  return counted(Math.floor(ageSeconds / SECONDS_PER_DAY), 'day');
}

/**
 * The Server disk line. A reading no older than the limit says how long ago it was made. An older one says its date and that it is old, and never claims to be current: the daily
 * check may have stopped, and the percentage is then what the disk had, not what it has.
 */
export function diskText(reading: { readonly freePercent: number; readonly readAt: Date; readonly ageSeconds: number; readonly stale: boolean }): string {
  if (!reading.stale) return `${reading.freePercent} % free. Read ${readingAgeText(reading.ageSeconds)}.`;
  return `${reading.freePercent} % free when it was last read, on ${formatIst(reading.readAt)}. That is more than ${DISK_READING_STALE_AFTER_DAYS} days ago, so it may be out of date.`;
}
