import { BACKUP_LATE_AFTER_DAYS, DISK_NEARLY_FULL_BELOW_PERCENT, DISK_READING_STALE_AFTER_DAYS } from '@/lib/settings/backup-status';
import { formatIst, formatIstWithWeekday } from '@/lib/time';

/**
 * The words of SCR-15 "Settings", Last backup line (UX spec section 6, written out; STORY-02.09 AC-1 to AC-5). One file, so a sentence is written once and a test can compare it with
 * the spec. The two thresholds are quoted from the constants the rule uses, so the notice and the rule cannot drift apart.
 */

export const SETTINGS_TITLE = 'Settings';
export const SETTINGS_DESCRIPTION = 'E-mail alerts for assigned and overdue tasks, the weekly backup and the server disk. Nothing on this page starts, restores or deletes a backup.';
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

/**
 * The e-mail alerts card (SCR-15, STORY-09.02; FR-019). The words are the UX spec's and the SCR-15 mock-up's. Where SCR-15 has none (marked "proposed"), the developer proposed them for the
 * ux-expert's end review (Dev Record of AQP-349).
 */
export const ALERTS_HEADING = 'E-mail alerts';
export const ALERTS_SWITCH_LABEL = 'E-mail alerts';
export const ALERTS_ON = 'ON';
export const ALERTS_OFF = 'OFF';
export const ALERTS_ON_HINT = 'When ON, Engineers are e-mailed when a task is assigned and when it becomes overdue, with a daily digest at 11:00 IST.';
export const ALERTS_OFF_HINT = 'When OFF, nothing is sent.';

export const SENDER_NAME_LABEL = 'Sender name';
export const SENDER_ADDRESS_LABEL = 'Sender e-mail address';
export const CREDENTIALS_NOTE = 'The mail server password is set on the server by Accucut IT, not here.';

export const SAVE_LABEL = 'Save settings';
export const SAVING_LABEL = 'Saving settings';
export const TEST_LABEL = 'Send test e-mail';
export const TESTING_LABEL = 'Sending test e-mail';
/** Proposed: the test goes to the Admin's own address (OQ-UX-09, SCR-15), and always from the saved sender, not from what is typed and not yet saved. */
export const testHint = (address: string): string => `The test e-mail goes to your own address, ${address}. It is sent from the saved sender.`;

/** Proposed (SCR-15 has no "saved" line). */
export const SAVED_TITLE = 'Settings saved';
export const SAVED_BODY = 'Your changes to e-mail alerts are saved.';
/** SCR-15 "Save failed". */
export const SAVE_FAILED_TITLE = 'Settings were not saved';
export const SAVE_FAILED_BODY = 'Nothing was changed. Try again.';

/** SCR-15 "Test sent". */
export const TEST_SENT_TITLE = 'Test e-mail sent';
export const testSentBody = (address: string): string => `Test e-mail sent to ${address}. Check the inbox. It can take a minute.`;
/** SCR-15 "Test failed". */
export const TEST_FAILED_TITLE = 'Test failed';
export const TEST_FAILED_BODY =
  'The test e-mail was not sent. The mail server did not answer. Mail server details are set by Accucut IT on the server. Try again, or ask them to check the connection.';
/** SCR-15 "Sender not allowed". The sender stays editable. */
export const SENDER_NOT_ALLOWED_TITLE = 'Sender not allowed';
export const SENDER_NOT_ALLOWED_BODY =
  'The test e-mail was not sent. The mail server did not accept this sender address for this mailbox. Change the sender e-mail address to one the mailbox is allowed to send from, or ask Accucut IT.';
/** Proposed: no sender is saved, so there is nothing to send from. */
export const NO_SENDER_TITLE = 'No sender saved';
export const NO_SENDER_BODY = 'The test e-mail was not sent. Save a sender name and e-mail address first. The test e-mail is sent from them.';

/** Proposed (AC-8): shown while `FEATURE_EMAIL` is off. Saving and the test e-mail still work, so the Admin can prove the mailbox before anyone is e-mailed. */
export const EMAIL_NOT_ENABLED = 'Sending is not enabled on this server yet. Accucut IT turns it on. You can still save these settings and send a test e-mail.';

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
