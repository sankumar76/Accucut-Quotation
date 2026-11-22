import { PORTAL_NAME, renderMail } from '../layout';

/**
 * The "Server check needed" message to the Admin (STORY-09.06 AC-10, decision D-a; architecture sections 4.7 and 9.5): a pure function from two flags to the subject, the HTML and the plain text.
 *
 * The input is two booleans and nothing else, so the message cannot hold a figure, a path, a drive letter, a volume name or a secret: `backup-watch`'s own rule (STORY-10.05). It says in words
 * that the weekly backup is late and/or that the server disk is nearly full, that the server should be checked, and that the reminder comes every morning until it is fixed. The words are
 * the developer's proposal (SCR-22 has no template for it), for the ux-expert's end review.
 */

export interface BackupMissedMessage {
  /** No good backup in the last 8 days (`isBackupLate`). */
  readonly backupLate: boolean;
  /** Free space below the limit of the Settings page (`isDiskNearlyFull`). */
  readonly diskNearlyFull: boolean;
}

export interface RenderedBackupMissed {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const BACKUP_MISSED_SUBJECT = `${PORTAL_NAME}: server check needed`;
export const BACKUP_MISSED_HEADING = 'Server check needed';
export const BACKUP_LATE_SENTENCE = 'The weekly backup is late.';
export const DISK_FULL_SENTENCE = 'The server disk is nearly full.';
export const CHECK_THE_SERVER_SENTENCE = 'Please ask Accucut IT to check the server.';
export const REMINDER_SENTENCE = 'You will get this reminder each morning until it is fixed.';

export function renderBackupMissed(message: BackupMissedMessage): RenderedBackupMissed {
  const { backupLate, diskNearlyFull } = message;
  if (!backupLate && !diskNearlyFull) throw new RangeError('A server that needs no check has no message.');
  const problems = [backupLate ? BACKUP_LATE_SENTENCE : null, diskNearlyFull ? DISK_FULL_SENTENCE : null].filter((sentence): sentence is string => sentence !== null);
  const { html, text } = renderMail({ heading: BACKUP_MISSED_HEADING, paragraphs: [problems.join(' '), CHECK_THE_SERVER_SENTENCE, REMINDER_SENTENCE] });
  return { subject: BACKUP_MISSED_SUBJECT, html, text };
}
